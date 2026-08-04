import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "About — Echelon HRIS" };

const STACK = [
  ["Next.js (App Router)", "Server components + server actions; one deployable unit on Vercel."],
  ["Postgres (Neon)", "Serverless driver over WebSocket — the HTTP driver lacks transactions, and import/audit correctness depends on them."],
  ["Drizzle ORM", "The core query here is a recursive CTE; Drizzle keeps raw SQL first-class with no engine binary to fight on serverless."],
  ["WorkOS AuthKit", "B2B-native auth (SSO/SCIM-ready), matching an HRIS buyer. Roles live in our DB, not IdP claims — manager permissions derive from the org graph."],
  ["React Flow + d3-hierarchy", "Pan/zoom/drag org chart with Reingold–Tilford layout; reparenting is drop-on-card with optimistic update and server-checked cycle rejection."],
] as const;

const DECISIONS = [
  {
    title: "users vs employees are separate tables",
    body: "Auth principals and HR records are different things: real HRISes have employees who never log in and users who aren't employees (auditors, analysts). Linked by email; collapsing them is the expensive-to-undo mistake.",
  },
  {
    title: "Adjacency list + recursive CTEs for the hierarchy",
    body: "Org charts are shallow and small; a recursive CTE over an indexed manager_id is sub-millisecond, and reparenting (drag-and-drop) is a single UPDATE. Cycle prevention runs inside the same transaction as every reparent, edit, and import.",
  },
  {
    title: "Salary lives in a separate compensation table",
    body: "“Can this role see money” becomes a join decision instead of field-stripping. Field-stripping is where leaks happen — a new endpoint forgets one omit.",
  },
  {
    title: "Audit log written app-layer, same transaction as the mutation",
    body: "A DB trigger can't know the actor, and SET LOCAL through a pooler is fragile. The repo layer is the only mutation path, so the discipline holds; the audit page is Admin/HR-gated because comp diffs live in it.",
  },
  {
    title: "Authorization is one pure, unit-tested module enforced in the repo layer",
    body: "The only code that touches the DB enforces the rules, so route handlers and actions can't forget a check that lives below them. Manager scope is derived per-request from the org chart, never cached in a session.",
  },
  {
    title: "Bulk import: client dry-run, server re-validation, all-or-nothing commit",
    body: "The client parses CSV/Excel for a preview; the server re-validates with the same Zod schemas and commits in one transaction. Managers are referenced by email and wired in a second pass, so row order never matters. A half-imported org chart is worse than a re-upload.",
  },
  {
    title: "Exports share the directory's query builder",
    body: "The export URL carries the same querystring as the filtered directory view — “customizable export filters” is one source of truth, not a second filter system. CSV columns match the import template, so an export re-imports cleanly.",
  },
] as const;

const RBAC: { cap: string; roles: [string, string, string, string] }[] = [
  { cap: "View directory / teams / org chart", roles: ["✓", "✓", "✓", "✓"] },
  { cap: "See salaries", roles: ["all", "all", "reports + self", "self only"] },
  { cap: "Add / edit employees", roles: ["✓", "✓", "direct reports", "—"] },
  { cap: "Delete employees", roles: ["✓", "—", "—", "—"] },
  { cap: "Manage teams & membership", roles: ["✓", "✓", "—", "—"] },
  { cap: "Bulk import / export", roles: ["✓", "✓", "—", "—"] },
  { cap: "Audit log", roles: ["✓", "✓", "—", "—"] },
  { cap: "Manage users & roles", roles: ["✓", "—", "—", "—"] },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">About this system</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A lightweight HRIS: employee & team directories, an interactive drag-and-drop org chart,
          bulk import with dry-run preview, filtered CSV/Excel/PDF exports, an append-only audit
          log, and role-based access control. This page summarizes the architecture; the{" "}
          <a
            className="underline underline-offset-2 hover:text-foreground"
            href="https://github.com/HMCJPG/EchelonOS_HRIS"
            target="_blank"
            rel="noreferrer"
          >
            README
          </a>{" "}
          carries the full decision log.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stack</CardTitle>
          <CardDescription>Each choice optimizes for serverless correctness over ceremony.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {STACK.map(([name, why]) => (
            <div key={name} className="grid gap-1 sm:grid-cols-[220px_1fr] sm:gap-4">
              <span className="text-sm font-medium">{name}</span>
              <span className="text-sm text-muted-foreground">{why}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role-based access control</CardTitle>
          <CardDescription>
            Your current role is shown in the header. New sign-ins start as read-only Viewer until
            an Admin promotes them on the Users page — unknown accounts never get edit rights.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Capability</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>HR</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Viewer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RBAC.map((r) => (
                  <TableRow key={r.cap}>
                    <TableCell className="font-medium">{r.cap}</TableCell>
                    {r.roles.map((v, i) => (
                      <TableCell key={i} className="text-muted-foreground">{v}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            The Manager asymmetry is deliberate: <em>view</em> extends to the whole reporting
            subtree, <em>edit</em> is direct reports only. Manager scope is derived per-request
            from the org chart, never cached in the session.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Design decisions</CardTitle>
          <CardDescription>What was chosen, and why — condensed from the README.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {DECISIONS.map((d) => (
            <div key={d.title}>
              <p className="text-sm font-medium">{d.title}</p>
              <p className="text-sm text-muted-foreground">{d.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Known limitations</CardTitle>
          <CardDescription>Deliberate scope cuts, each with a migration path.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <Badge variant="secondary" className="mr-2">history</Badge>
            No point-in-time org reconstruction — current-state tables plus an append-only audit
            log, not effective-dated versions. Path: promote audit rows to versioned records.
          </p>
          <p>
            <Badge variant="secondary" className="mr-2">import</Badge>
            Imports cap at 5,000 rows per file. Path: blob upload + queued job past ~10k rows.
          </p>
          <p>
            <Badge variant="secondary" className="mr-2">export</Badge>
            The org-chart PDF captures the current viewport and expansion state — it is a raster of
            what you see.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
