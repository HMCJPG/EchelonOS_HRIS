import { sql } from "drizzle-orm";
import type { Db, Tx } from "@/db";

type Executor = Db | Tx;

/**
 * Adjacency list + recursive CTE. Org charts are shallow (~6-8 levels) and
 * small (hundreds of rows), so this is sub-millisecond with the manager_id
 * index. Upgrade path if ancestor checks ever become hot: closure table
 * maintained by trigger, adjacency list stays source of truth.
 */
export async function getSubtreeIds(dbx: Executor, rootId: string): Promise<string[]> {
  const result = await dbx.execute(sql`
    WITH RECURSIVE subtree AS (
      SELECT id FROM employees WHERE id = ${rootId}
      UNION ALL
      SELECT e.id FROM employees e JOIN subtree s ON e.manager_id = s.id
    )
    SELECT id FROM subtree
  `);
  return (result as unknown as { rows: { id: string }[] }).rows.map((r) => r.id);
}

/**
 * True if setting `newManagerId` as the manager of `employeeId` would create
 * a cycle — i.e. employeeId is newManagerId itself or one of its ancestors.
 * MUST run inside the same transaction as the UPDATE.
 */
export async function wouldCreateCycle(
  dbx: Executor,
  employeeId: string,
  newManagerId: string | null,
): Promise<boolean> {
  if (!newManagerId) return false;
  if (newManagerId === employeeId) return true;
  const result = await dbx.execute(sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, manager_id FROM employees WHERE id = ${newManagerId}
      UNION ALL
      SELECT e.id, e.manager_id FROM employees e JOIN ancestors a ON e.id = a.manager_id
    )
    SELECT 1 AS hit FROM ancestors WHERE id = ${employeeId} LIMIT 1
  `);
  return (result as unknown as { rows: unknown[] }).rows.length > 0;
}
