# Admin Guide

## Deployment

See "Production setup" in the README for the Neon / WorkOS / Vercel steps. Environment
variables are documented in `.env.example`.

- Use Neon's **pooled** connection string — serverless functions otherwise exhaust
  Postgres connections.
- `WORKOS_COOKIE_PASSWORD` must be at least 32 characters; rotate it to invalidate all
  sessions.
- Schema changes: edit `src/db/schema.ts`, run `npm run db:push` (drizzle-kit) against
  the target database.

## Users, roles, and the bootstrap rule

- **Users** are auth identities (created automatically on first sign-in via WorkOS).
  **Employees** are HR records. They're linked automatically when the sign-in email
  matches an employee's email.
- The **first user ever** to sign in becomes **Admin**. Every later user starts as
  read-only **Viewer**.
- Promote/demote on the **Users** page (`/users`, Admin only). You cannot demote
  yourself — ask another admin (prevents locking the org out of admin entirely).
- A **Manager**'s scope comes from the org chart: whoever reports to their linked
  employee record. Assign the role *and* make sure their user is linked to the right
  employee (matching email does this automatically).

## Audit log (`/audit`, Admin/HR)

Every create/update/delete/import is recorded with actor, timestamp, entity, and a
field-by-field old→new diff, written in the same database transaction as the change
itself. Salary changes appear here — which is why the page is restricted to Admin/HR.
Filter by entity type (employees, teams, users).

## Data safety behaviors

- **Deleting an employee** reassigns their direct reports up to the deleted person's
  manager (never orphans a subtree) and cascades their compensation record and team
  memberships. Admin only.
- **Deleting a team** moves its sub-teams up to its parent; memberships are removed.
- **Reporting cycles are impossible**: every path that changes a manager (form edit,
  drag-and-drop, bulk import) runs cycle detection inside the transaction.
- **Bulk import is all-or-nothing** and capped at 5,000 rows per file.

## Local development

- No env vars needed: PGlite (embedded Postgres) + dev-auth persona picker.
- `npm run db:setup` seeds a 40-person demo org and the four persona users
  (`admin@ / hr@ / manager@ / viewer@echelon.dev`).
- Reseed from scratch: `npx tsx scripts/seed.ts --force` (stop the dev server first —
  PGlite is single-process).
- Dev-auth mode is only active when WorkOS env vars are absent; it cannot be reached
  when WorkOS is configured.
