import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, employees, auditLogs, type User, type Role, type AuditLog } from "@/db/schema";
import { canManageUsers, canViewAudit } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ForbiddenError } from "@/repo/employees";

export type UserRow = User & { employeeName: string | null };

export async function listUsers(actor: User): Promise<UserRow[]> {
  if (!canManageUsers(actor)) throw new ForbiddenError("Only Admin can manage users.");
  const rows = await db
    .select({ user: users, firstName: employees.firstName, lastName: employees.lastName })
    .from(users)
    .leftJoin(employees, eq(users.employeeId, employees.id))
    .orderBy(asc(users.email));
  return rows.map((r) => ({
    ...r.user,
    employeeName: r.firstName ? `${r.firstName} ${r.lastName}` : null,
  }));
}

export async function setUserRole(actor: User, userId: string, role: Role): Promise<void> {
  if (!canManageUsers(actor)) throw new ForbiddenError("Only Admin can change roles.");
  if (actor.id === userId && role !== "admin") {
    throw new ForbiddenError("You can't demote yourself — ask another admin.");
  }
  await db.transaction(async (tx) => {
    const target = await tx.query.users.findFirst({ where: eq(users.id, userId) });
    if (!target) throw new Error("User not found.");
    if (target.role === role) return;
    await tx.update(users).set({ role }).where(eq(users.id, userId));
    await writeAudit(tx, {
      actor,
      entityType: "user",
      entityId: userId,
      entityLabel: target.email,
      action: "update",
      changes: { role: { old: target.role, new: role } },
    });
  });
}

export type AuditRow = AuditLog;

export async function listAudit(
  actor: User,
  filter: { entityType?: string } = {},
): Promise<AuditRow[]> {
  if (!canViewAudit(actor)) throw new ForbiddenError("Only Admin/HR can view the audit log.");
  const conds = filter.entityType ? eq(auditLogs.entityType, filter.entityType) : undefined;
  return db.select().from(auditLogs).where(conds).orderBy(desc(auditLogs.createdAt)).limit(200);
}
