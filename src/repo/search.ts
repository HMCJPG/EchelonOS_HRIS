import "server-only";
import { asc, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { employees, teams } from "@/db/schema";

export type SearchResult =
  | { type: "employee"; id: string; label: string; sub: string }
  | { type: "team"; id: string; label: string; sub: string };

/**
 * ILIKE over names/emails/titles/departments and team names. At take-home
 * scale (hundreds of rows) an index-free substring scan is sub-millisecond;
 * upgrade path is pg_trgm GIN, then tsvector — documented in the README.
 * Salary is never touched here, so search can't become the authz bypass.
 */
export async function searchAll(q: string): Promise<SearchResult[]> {
  if (!q.trim()) return [];
  const like = `%${q.trim()}%`;

  const [emps, tms] = await Promise.all([
    db
      .select()
      .from(employees)
      .where(
        or(
          sql`(${employees.firstName} || ' ' || ${employees.lastName}) ILIKE ${like}`,
          ilike(employees.email, like),
          ilike(employees.title, like),
          ilike(employees.department, like),
        ),
      )
      .orderBy(asc(employees.lastName))
      .limit(50),
    db
      .select()
      .from(teams)
      .where(or(ilike(teams.name, like), ilike(teams.description, like)))
      .orderBy(asc(teams.name))
      .limit(50),
  ]);

  return [
    ...emps.map((e) => ({
      type: "employee" as const,
      id: e.id,
      label: `${e.firstName} ${e.lastName}`,
      sub: [e.title, e.department].filter(Boolean).join(" · ") || e.email,
    })),
    ...tms.map((t) => ({
      type: "team" as const,
      id: t.id,
      label: t.name,
      sub: t.description ?? "Team",
    })),
  ];
}
