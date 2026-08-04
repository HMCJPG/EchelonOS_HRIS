import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, employees, type User, type Role } from "@/db/schema";

export const workosEnabled = () =>
  Boolean(process.env.WORKOS_API_KEY && process.env.WORKOS_CLIENT_ID);

export const DEV_COOKIE = "hris_dev_session";

type Identity = {
  email: string;
  name: string | null;
  workosUserId: string | null;
  /** dev-auth only: role picked on the dev login page overrides the DB role */
  devRole: Role | null;
};

async function getIdentity(): Promise<Identity | null> {
  if (workosEnabled()) {
    const { withAuth } = await import("@workos-inc/authkit-nextjs");
    const { user } = await withAuth();
    if (!user) return null;
    return {
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
      workosUserId: user.id,
      devRole: null,
    };
  }
  const jar = await cookies();
  const raw = jar.get(DEV_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    if (typeof parsed.email !== "string") return null;
    return {
      email: parsed.email.toLowerCase(),
      name: parsed.name ?? null,
      workosUserId: null,
      devRole: parsed.role ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve the session to a `users` row, creating it on first sign-in.
 * Bootstrap rule: the very first user ever becomes admin; everyone else
 * defaults to employee (read-only) until an admin promotes them.
 * A matching `employees.email` auto-links the HR record.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const ident = await getIdentity();
  if (!ident) return null;

  let user = await db.query.users.findFirst({ where: eq(users.email, ident.email) });

  if (!user) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
    const emp = await db.query.employees.findFirst({ where: eq(employees.email, ident.email) });
    const role: Role = n === 0 ? "admin" : ident.devRole ?? "employee";
    [user] = await db
      .insert(users)
      .values({
        email: ident.email,
        name: ident.name,
        workosUserId: ident.workosUserId,
        role,
        employeeId: emp?.id ?? null,
      })
      .returning();
  }

  // Dev-auth role switcher wins without persisting, so demoing RBAC is one dropdown.
  if (!workosEnabled() && ident.devRole) return { ...user, role: ident.devRole };
  return user;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}
