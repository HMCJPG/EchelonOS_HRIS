# Echelon HRIS

A lightweight HRIS: employee & team directories, an interactive drag-and-drop org chart,
bulk CSV/Excel import with dry-run preview, CSV/Excel/PDF exports, a full audit log, and
role-based access control — built with Next.js (App Router), Drizzle, Postgres (Neon),
and WorkOS AuthKit.

## Try it live

**https://echelon-os-hris.vercel.app** — deployed on Vercel against Neon Postgres with
WorkOS AuthKit (Google SSO or email), seeded with a 40-person demo org.

What to expect when you sign in:

- **New accounts start as read-only Viewer.** That's the RBAC working, not missing
  features: you'll see the directory, teams, org chart, and search, but no edit
  controls, and the Import/Audit/Users pages stay hidden. The in-app **About** tab
  shows the full role matrix.
- **Want edit access?** An Admin promotes accounts on the **Users** page (takes
  effect on your next page load). Reviewers: ask and you'll be promoted, or see
  [granting reviewer access](#granting-reviewer-access) to pre-provision a role
  before first sign-in.
- The org chart's drag-to-reparent, bulk import dry-run, filtered exports, and the
  audit log are the features worth a minute each — all reachable from the top nav
  once you have the role for them.

| Directory | Org chart |
|---|---|
| ![Employee directory](docs/screenshots/directory.png) | ![Org chart](docs/screenshots/org-chart.png) |

## Quick start (local, zero setup)

```bash
npm install
npm run db:setup   # pushes schema + seeds ~40 employees into an embedded local Postgres (PGlite)
npm run dev
```

Open http://localhost:3000. With no WorkOS keys configured the app runs in **dev-auth
mode**: a local sign-in page with one-click personas for every RBAC role (Admin, HR,
Manager, Viewer). No external services needed.

```bash
npm test           # unit tests: authz rules, import resolver, recursive-CTE cycle checks
npm run typecheck
```

## Production setup (Neon + WorkOS + Vercel)

1. **Neon**: create a free project, copy the **pooled** connection string into
   `DATABASE_URL` (see `.env.example`). Run `npm run db:setup` once against it.
2. **WorkOS**: create an AuthKit app, set `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`,
   `WORKOS_COOKIE_PASSWORD` (32+ random chars), and add your redirect URI
   (`https://<domain>/callback`) in the WorkOS dashboard.
3. **Vercel**: import the repo, set the env vars above. Done.

**First-login bootstrap:** the first user ever to sign in becomes Admin. Everyone after
starts as read-only Viewer until an Admin promotes them on the **Users** page.

### Granting reviewer access

New sign-ins default to Viewer by design — unknown accounts never get edit rights. To
hand a reviewer a specific role before they ever sign in, pre-provision their email
(the sign-in flow links to an existing `users` row by email):

```sql
INSERT INTO users (email, role) VALUES ('reviewer@example.com', 'hr');
```

`hr` demos nearly everything (add/edit employees, bulk import, exports, audit log)
without Admin's delete buttons and user management. Already signed in? An Admin can
change their role live on the **Users** page instead.

## RBAC model

| Capability | Admin | HR | Manager | Viewer |
|---|---|---|---|---|
| View directory / teams / org chart | ✓ | ✓ | ✓ | ✓ |
| See salaries | all | all | direct reports + self | self only |
| Add / edit employees | ✓ | ✓ | **direct reports only** | — |
| Delete employees | ✓ | — | — | — |
| Manage teams & membership | ✓ | ✓ | — | — |
| Bulk import / export | ✓ | ✓ | — | — |
| Audit log | ✓ | ✓ | — | — |
| Manage users & roles | ✓ | — | — | — |

The Manager row implements the spec's asymmetry deliberately: **view** extends to the
whole reporting subtree ("view team"), **edit** is direct reports only. Manager scope is
derived per-request from the org chart (`manager_id`), never cached in the session.

## Decisions & tradeoffs

Each entry: what was chosen, why, and when I'd swap it.

- **Two tables for `users` (auth principals) vs `employees` (HR records)**, linked by
  email. Real HRISes have employees who never log in and users who aren't employees
  (auditors, PE analysts — Echelon's actual customer). Cost: a join on "who am I" and an
  unlinked-user edge case. Swap: never; collapsing them is the expensive-to-undo mistake.
- **Reporting hierarchy: adjacency list (`manager_id`) + recursive CTEs.** Org charts are
  shallow (~6–8 levels) and small; a recursive CTE over an indexed FK is sub-millisecond,
  and reparenting (the headline drag-and-drop feature) is a single UPDATE. Cycle
  prevention runs *inside the same transaction* as every reparent/update/import
  (`src/lib/tree.ts`). Swap: add a trigger-maintained closure table as a read index if
  ancestor checks ever land in a hot path; adjacency list stays the source of truth.
- **Salary in a separate `compensation` table**, not a column. "Can this role see money"
  becomes a join decision instead of field-stripping — field-stripping is where leaks
  happen (a new endpoint forgets one `omit`). Cost: one extra query on detail pages.
- **Current-state tables + append-only audit log**, not effective-dated versions.
  Bitemporal modeling is the "correct" HRIS answer and the wrong take-home answer.
  Known limitation: can't answer "what did the org look like on March 1". Migration
  path: promote `audit_logs` to versioned rows with validity ranges.
- **Audit written app-layer, in the same transaction as the mutation**, via the repo
  layer — a DB trigger can't know the actor, and `SET LOCAL` through a pooler is
  fragile. Cost: discipline-dependent; mitigated by the repo layer being the only
  mutation path. The audit log itself is Admin/HR-gated because comp diffs live in it.
- **Drizzle over Prisma.** The single most important query here is a recursive CTE;
  Drizzle's `sql` escape hatch keeps it first-class, and there's no engine binary to
  fight on serverless. Swap: Prisma if optimizing for team onboarding over query control.
- **Neon serverless driver (WebSocket), not HTTP** — the HTTP driver has no transaction
  support, and import/audit correctness depends on transactions. Use the **pooled**
  connection string; serverless × Postgres connection exhaustion is the classic footgun.
- **PGlite (embedded WASM Postgres) for local dev** when `DATABASE_URL` is unset. Same
  Postgres semantics as prod (the CTE tests run against it), zero local setup.
- **Authorization: one hand-rolled module (`src/lib/authz.ts`) enforced in the repo
  layer** — the only code that touches the DB. Route handlers and actions can't forget a
  check that lives below them; the rules are pure functions with unit tests. Swap
  trigger: OpenFGA/SpiceDB when rules become relationship-heavy across orgs
  ("manager's peer can view but not comp").
- **Roles live in our DB, not IdP claims.** Manager permissions derive from the org
  graph, which only our DB knows; syncing hierarchy into an IdP is busywork. WorkOS
  supplies identity; `users.role` supplies authority.
- **WorkOS over Auth0** — B2B-native (orgs/SSO/SCIM are the product), which matches
  Echelon's buyer. Directory Sync (SCIM) is the "real" long-term answer to bulk import.
- **Org chart: React Flow + d3-hierarchy layout.** React Flow gives pan/zoom/minimap/
  drag; `d3.tree()` (Reingold–Tilford) gives layout. Reparenting is drop-on-card with an
  optimistic local update and rollback + toast on server rejection; client pre-checks
  descendant drops, server re-checks in-transaction (the client check is UX, the server
  check is the guarantee). Collapsed past depth 2 by default — expand/collapse also keeps
  render size bounded. Note: React Flow nodes are HTML, *not* SVG — so the chart PDF
  export rasterizes via `html-to-image` → jsPDF client-side, dodging headless Chromium
  on serverless entirely. Swap: canvas renderer (Sigma) at >5k nodes, which no HRIS hits.
- **Search: `ILIKE` substring over employees + teams** behind the same authz scoping.
  At hundreds-to-thousands of rows an unindexed scan is instant. Upgrade path, in order:
  `pg_trgm` GIN index (typo-tolerance), `tsvector` (ranking), external engine (never,
  probably). Search never touches compensation, so it can't become the authz bypass.
- **Bulk import: client parses (PapaParse / ExcelJS) for a dry-run preview; the server
  re-validates everything with the same Zod schemas and commits in one all-or-nothing
  transaction.** Email is the natural key; managers are referenced by `managerEmail` and
  wired in a second pass so row order (and forward references) never matter. Cycle
  detection runs over the *merged* final state — file + existing rows — before commit,
  then belt-and-braces re-checks inside the transaction. Partial failure choice:
  all-or-nothing over per-row, because a half-imported org chart is worse than a
  re-upload at ≤5k rows. Swap: blob upload + queued job (Inngest/QStash) past ~10k rows.
- **Exports share the directory's query builder** — the export URL carries the same
  querystring as the filtered directory view, so "customizable export filters" is one
  source of truth, not a second filter system. CSV columns match the import template, so
  an export re-imports cleanly. Tabular PDF via `@react-pdf/renderer` server-side.
- **Validation: Zod schemas defined once** (`src/lib/validation.ts`), shared by forms,
  server actions, and import. Highest-leverage file in the repo.

### Known limitations (deliberate)

- No point-in-time org reconstruction (see audit-log decision above).
- Import is capped at 5,000 rows per file (`ponytail:` documented in code; queue + blob
  upload is the upgrade path).
- Salary is annual whole-currency integer; move to cents/decimal when payroll math arrives.
- Org-chart PDF export captures the current viewport/expansion state (it's a raster of
  what you see).
- Dev-auth mode must never ship with WorkOS unset in production — the middleware only
  enables it when WorkOS env vars are absent.

### Windows-on-ARM note (dev machines with Smart App Control)

Smart App Control blocks Tailwind's unsigned native binary, and the WASM fallback can't
walk the filesystem to scan for classes. `scripts/generate-tw-safelist.mjs` (run
automatically on `dev`/`build`) does the scan in plain Node and feeds candidates to the
Tailwind engine via `@source inline(...)`. Redundant but harmless on other platforms.

## Repo tour

```
src/db/            schema + Neon/PGlite driver switch
src/lib/authz.ts   all permission rules (pure, tested)
src/lib/tree.ts    recursive CTEs: subtree, cycle detection
src/lib/audit.ts   diff + audit writer (same-transaction)
src/lib/validation.ts  shared Zod schemas
src/repo/          the ONLY code that touches the db; enforces authz + audit
src/actions/       server actions (parse → repo → revalidate)
src/app/           routes; api/export/* are the streaming export endpoints
scripts/seed.ts    demo org (40 employees, 10 teams, persona users)
tests/             authz rules, import resolver, CTE cycle checks (real Postgres via PGlite)
docs/              user guide + admin guide
```
