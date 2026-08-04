import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canExport } from "@/lib/authz";
import { listEmployees, type DirectoryRow } from "@/repo/employees";
import type { User } from "@/db/schema";

/**
 * One data path for every export format: the URL querystring is the same one
 * the directory page uses, so exports always match the filtered view on
 * screen — "customizable export filters" without a second filter system.
 */
export async function getExportData(
  req: NextRequest,
): Promise<{ user: User; rows: DirectoryRow[] } | Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canExport(user)) return new Response("Forbidden: exports are Admin/HR only", { status: 403 });

  const sp = req.nextUrl.searchParams;
  const rows = await listEmployees(user, {
    q: sp.get("q") ?? undefined,
    department: sp.get("department") ?? undefined,
    status: sp.get("status") ?? undefined,
    teamId: sp.get("team") ?? undefined,
  });
  return { user, rows };
}

export const EXPORT_COLUMNS = [
  { key: "firstName", header: "firstName" },
  { key: "lastName", header: "lastName" },
  { key: "email", header: "email" },
  { key: "title", header: "title" },
  { key: "department", header: "department" },
  { key: "phone", header: "phone" },
  { key: "location", header: "location" },
  { key: "hireDate", header: "hireDate" },
  { key: "status", header: "status" },
  { key: "managerEmail", header: "managerEmail" },
  { key: "managerName", header: "managerName" },
  { key: "salary", header: "salary" },
] as const;

export function rowToRecord(r: DirectoryRow): Record<string, string | number | null> {
  return Object.fromEntries(
    EXPORT_COLUMNS.map((c) => [c.header, (r[c.key as keyof DirectoryRow] as string | number | null) ?? null]),
  );
}
