import type { ImportRow } from "@/lib/validation";

/**
 * Pure resolution logic for bulk import, shared by dry-run preview and commit
 * (and unit-tested directly). Email is the natural key; managers are wired by
 * email in a second pass so CSV row order never matters.
 */

export type ExistingEmployee = { id: string; email: string; managerId: string | null };

export type RowDisposition = { index: number; email: string; action: "create" | "update" };
export type RowError = { index: number; message: string };

export type Resolution = {
  dispositions: RowDisposition[];
  errors: RowError[];
  /** email -> managerEmail|null for every employee in the final state */
  managerByEmail: Map<string, string | null>;
};

export function resolveImport(rows: ImportRow[], existing: ExistingEmployee[]): Resolution {
  const errors: RowError[] = [];
  const dispositions: RowDisposition[] = [];

  const existingByEmail = new Map(existing.map((e) => [e.email, e]));
  const existingById = new Map(existing.map((e) => [e.id, e]));

  // Duplicates inside the file
  const seen = new Map<string, number>();
  rows.forEach((r, i) => {
    if (seen.has(r.email)) {
      errors.push({ index: i, message: `Duplicate email ${r.email} (also row ${seen.get(r.email)! + 1})` });
    } else {
      seen.set(r.email, i);
    }
  });

  const csvEmails = new Set(rows.map((r) => r.email));

  rows.forEach((r, i) => {
    if (r.managerEmail === r.email) {
      errors.push({ index: i, message: "Employee can't be their own manager" });
    } else if (r.managerEmail && !csvEmails.has(r.managerEmail) && !existingByEmail.has(r.managerEmail)) {
      errors.push({ index: i, message: `Manager ${r.managerEmail} not found in file or directory` });
    }
    dispositions.push({ index: i, email: r.email, action: existingByEmail.has(r.email) ? "update" : "create" });
  });

  // Final manager graph (keyed by email): start from current state, overlay the file.
  const managerByEmail = new Map<string, string | null>();
  for (const e of existing) {
    managerByEmail.set(e.email, e.managerId ? (existingById.get(e.managerId)?.email ?? null) : null);
  }
  for (const r of rows) managerByEmail.set(r.email, r.managerEmail);

  // Cycle detection over the merged forest.
  const state = new Map<string, "visiting" | "done">();
  for (const email of managerByEmail.keys()) {
    let cur: string | null = email;
    const path: string[] = [];
    while (cur && state.get(cur) !== "done") {
      if (state.get(cur) === "visiting") {
        const rowIdx = rows.findIndex((r) => r.email === cur);
        errors.push({
          index: rowIdx >= 0 ? rowIdx : 0,
          message: `Reporting cycle detected involving ${cur}`,
        });
        break;
      }
      state.set(cur, "visiting");
      path.push(cur);
      cur = managerByEmail.get(cur) ?? null;
    }
    for (const p of path) state.set(p, "done");
  }

  return { dispositions, errors, managerByEmail };
}
