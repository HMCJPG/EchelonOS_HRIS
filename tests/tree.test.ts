import { test, before } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { getSubtreeIds, wouldCreateCycle } from "../src/lib/tree";
import type { Db } from "../src/db";

// Real Postgres semantics (PGlite = WASM Postgres) for the recursive CTEs.
const client = new PGlite(); // in-memory
const db = drizzle(client) as unknown as Db;

const CEO = "00000000-0000-0000-0000-000000000001";
const VP = "00000000-0000-0000-0000-000000000002";
const ENG = "00000000-0000-0000-0000-000000000003";
const OTHER = "00000000-0000-0000-0000-000000000004";

before(async () => {
  await db.execute(sql`
    CREATE TABLE employees (
      id uuid PRIMARY KEY,
      manager_id uuid REFERENCES employees(id)
    )
  `);
  // CEO -> VP -> ENG, plus OTHER under CEO
  await db.execute(sql`INSERT INTO employees (id, manager_id) VALUES
    (${CEO}, NULL), (${VP}, ${CEO}), (${ENG}, ${VP}), (${OTHER}, ${CEO})`);
});

test("subtree includes self and all descendants", async () => {
  const ids = await getSubtreeIds(db, CEO);
  assert.deepEqual(new Set(ids), new Set([CEO, VP, ENG, OTHER]));
  assert.deepEqual(new Set(await getSubtreeIds(db, VP)), new Set([VP, ENG]));
});

test("reparenting under your own descendant is a cycle", async () => {
  assert.ok(await wouldCreateCycle(db, CEO, ENG), "CEO under ENG = cycle");
  assert.ok(await wouldCreateCycle(db, VP, ENG), "VP under own report = cycle");
});

test("self-management is a cycle", async () => {
  assert.ok(await wouldCreateCycle(db, VP, VP));
});

test("legal moves are not flagged", async () => {
  assert.ok(!(await wouldCreateCycle(db, ENG, OTHER)), "moving leaf sideways is fine");
  assert.ok(!(await wouldCreateCycle(db, VP, null)), "promoting to root is fine");
  assert.ok(!(await wouldCreateCycle(db, OTHER, VP)));
});
