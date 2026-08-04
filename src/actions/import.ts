"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { employees, compensation } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { canImport, canEditSalary } from "@/lib/authz";
import { importRowSchema, type ImportRow } from "@/lib/validation";
import { resolveImport, type RowError } from "@/lib/import-resolver";
import { writeAudit } from "@/lib/audit";

const MAX_ROWS = 5000; // ponytail: beyond this, move to blob upload + queued job

export type ImportResult =
  | { ok: true; committed: boolean; create: number; update: number; rowErrors: RowError[] }
  | { ok: false; error: string };

/**
 * commit=false → dry-run: validate, resolve managers, detect cycles, report
 * per-row dispositions. commit=true → same checks, then write everything in
 * one all-or-nothing transaction (documented choice over per-row partial
 * success: easiest to reason about, and a re-upload is cheap at this scale).
 */
export async function importEmployeesAction(rawRows: unknown[], commit: boolean): Promise<ImportResult> {
  const user = await requireUser();
  if (!canImport(user)) return { ok: false, error: "Only Admin/HR can import." };
  if (!Array.isArray(rawRows) || rawRows.length === 0) return { ok: false, error: "No rows to import." };
  if (rawRows.length > MAX_ROWS) {
    return { ok: false, error: `Import is capped at ${MAX_ROWS} rows per file.` };
  }

  // Server-side re-validation — never trust the client's parse.
  const rows: ImportRow[] = [];
  const rowErrors: RowError[] = [];
  rawRows.forEach((raw, i) => {
    const parsed = importRowSchema.safeParse(raw);
    if (parsed.success) rows.push(parsed.data);
    else {
      const issue = parsed.error.issues[0];
      rowErrors.push({ index: i, message: `${issue.path.join(".")}: ${issue.message}` });
    }
  });
  if (rowErrors.length) return { ok: true, committed: false, create: 0, update: 0, rowErrors };

  const existing = await db
    .select({ id: employees.id, email: employees.email, managerId: employees.managerId })
    .from(employees);
  const resolution = resolveImport(rows, existing);
  const create = resolution.dispositions.filter((d) => d.action === "create").length;
  const update = resolution.dispositions.filter((d) => d.action === "update").length;

  if (resolution.errors.length || !commit) {
    return { ok: true, committed: false, create, update, rowErrors: resolution.errors };
  }

  const salaryAllowed = canEditSalary(user);

  await db.transaction(async (tx) => {
    // Pass 1: upsert everyone by email (no managers yet, so order can't matter).
    for (const row of rows) {
      await tx
        .insert(employees)
        .values({
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          title: row.title,
          department: row.department,
          phone: row.phone,
          location: row.location,
          hireDate: row.hireDate,
          status: row.status,
        })
        .onConflictDoUpdate({
          target: employees.email,
          set: {
            firstName: row.firstName,
            lastName: row.lastName,
            title: row.title,
            department: row.department,
            phone: row.phone,
            location: row.location,
            hireDate: row.hireDate,
            status: row.status,
            updatedAt: new Date(),
          },
        });
    }

    // Pass 2: wire managers by email.
    const emails = rows.map((r) => r.email);
    const all = await tx
      .select({ id: employees.id, email: employees.email })
      .from(employees)
      .where(inArray(employees.email, [...new Set([...emails, ...rows.map((r) => r.managerEmail).filter((e): e is string => Boolean(e))])]));
    const idByEmail = new Map(all.map((e) => [e.email, e.id]));

    for (const row of rows) {
      const managerId = row.managerEmail ? (idByEmail.get(row.managerEmail) ?? null) : null;
      await tx
        .update(employees)
        .set({ managerId })
        .where(eq(employees.email, row.email));
      if (row.salary != null && salaryAllowed) {
        const empId = idByEmail.get(row.email)!;
        await tx
          .insert(compensation)
          .values({ employeeId: empId, salary: row.salary })
          .onConflictDoUpdate({
            target: compensation.employeeId,
            set: { salary: row.salary, updatedAt: new Date() },
          });
      }
    }

    // Belt-and-braces: re-check the whole forest inside the transaction; a
    // concurrent edit between preview and commit could have introduced a cycle.
    const finalRows = await tx
      .select({ id: employees.id, managerId: employees.managerId })
      .from(employees);
    const managerOf = new Map(finalRows.map((r) => [r.id, r.managerId]));
    const state = new Map<string, "visiting" | "done">();
    for (const id of managerOf.keys()) {
      let cur: string | null = id;
      const path: string[] = [];
      while (cur && state.get(cur) !== "done") {
        if (state.get(cur) === "visiting") {
          throw new Error("Import would create a reporting cycle; nothing was written.");
        }
        state.set(cur, "visiting");
        path.push(cur);
        cur = managerOf.get(cur) ?? null;
      }
      for (const p of path) state.set(p, "done");
    }

    await writeAudit(tx, {
      actor: user,
      entityType: "employee",
      entityId: null,
      entityLabel: `Bulk import (${rows.length} rows)`,
      action: "import",
      changes: {
        created: { old: null, new: create },
        updated: { old: null, new: update },
      },
    });
  });

  revalidatePath("/employees");
  revalidatePath("/org-chart");
  revalidatePath("/audit");
  return { ok: true, committed: true, create, update, rowErrors: [] };
}
