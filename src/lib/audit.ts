import { auditLogs, type User } from "@/db/schema";
import type { Db, Tx } from "@/db";

export type FieldDiff = Record<string, { old: unknown; new: unknown }>;

/** Shallow diff over the given fields; null when nothing changed. */
export function diffFields<T extends object>(
  oldObj: Partial<T>,
  newObj: Partial<T>,
  fields: (keyof T & string)[],
): FieldDiff | null {
  const out: FieldDiff = {};
  for (const f of fields) {
    const a = oldObj[f] ?? null;
    const b = newObj[f] ?? null;
    if (String(a) !== String(b)) out[f] = { old: a, new: b };
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Written inside the same transaction as the mutation it records, via the
 * repo layer (the only mutation path). App-layer by design: a Postgres
 * trigger can't know the actor, and SET LOCAL through a pooler is fragile.
 */
export async function writeAudit(
  dbx: Db | Tx,
  entry: {
    actor: User;
    entityType: "employee" | "team" | "user";
    entityId: string | null;
    entityLabel: string;
    action: "create" | "update" | "delete" | "import";
    changes?: FieldDiff | null;
  },
) {
  await dbx.insert(auditLogs).values({
    actorUserId: entry.actor.id,
    actorEmail: entry.actor.email,
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityLabel: entry.entityLabel,
    action: entry.action,
    changes: entry.changes ?? null,
  });
}
