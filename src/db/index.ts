import * as schema from "./schema";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import type { ExtractTablesWithRelations } from "drizzle-orm";

// Neon serverless (WebSocket driver — the HTTP driver has no transaction
// support, and bulk import + audit writes need all-or-nothing transactions)
// in prod; PGlite (embedded WASM Postgres) for zero-setup local dev. Both are
// real Postgres, so the recursive CTEs behave identically.
// Cached on globalThis to survive Next dev hot-reload.

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = PgTransaction<PgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

const g = globalThis as unknown as { __db?: Db };

function createDb(): Db {
  /* eslint-disable @typescript-eslint/no-require-imports */
  if (process.env.DATABASE_URL) {
    const { Pool, neonConfig } = require("@neondatabase/serverless") as typeof import("@neondatabase/serverless");
    if (typeof WebSocket === "undefined") {
      neonConfig.webSocketConstructor = require("ws");
    }
    const { drizzle } = require("drizzle-orm/neon-serverless") as typeof import("drizzle-orm/neon-serverless");
    return drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema });
  }
  const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  const { drizzle } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  /* eslint-enable @typescript-eslint/no-require-imports */
  return drizzle(new PGlite("./.pglite"), { schema }) as unknown as Db;
}

// Lazy proxy: nothing (PGlite file locks, Neon pool) is created at import
// time — build workers import this module while collecting page data.
export const db: Db = new Proxy({} as Db, {
  get(_, prop) {
    const real = (g.__db ??= createDb());
    const value = real[prop as keyof Db];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});
export { schema };
