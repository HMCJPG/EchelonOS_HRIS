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
  {
    name: "Next.js (App Router)",
    body: "The entire application lives in a single Next.js codebase using Server Components and Server Actions.",
  },
  {
    name: "Postgres (Neon)",
    body: "Neon provides the backing database. I use the serverless WebSocket driver because imports, org-chart updates, and audit logging all depend on transaction support.",
  },
  {
    name: "Drizzle ORM",
    body: "Most of the application uses Drizzle directly. The org-chart functionality relies heavily on recursive SQL queries, and Drizzle makes it easy to drop down to raw SQL when needed.",
  },
  {
    name: "WorkOS AuthKit",
    body: "Authentication is handled through WorkOS. Roles and permissions are stored in the application's database rather than the identity provider because manager access depends on the reporting hierarchy, which only exists inside the HRIS itself.",
  },
  {
    name: "React Flow + d3-hierarchy",
    body: "The org chart is built with React Flow and d3-hierarchy. React Flow handles interactions such as dragging, zooming, and navigation. d3-hierarchy generates the layout for the reporting tree.",
  },
] as const;

const RBAC: { cap: string; roles: [string, string, string, string] }[] = [
  { cap: "View directory, teams, org chart", roles: ["✓", "✓", "✓", "✓"] },
  { cap: "View salaries", roles: ["All", "All", "Reports + Self", "Self"] },
  { cap: "Add / edit employees", roles: ["✓", "✓", "Direct Reports", "—"] },
  { cap: "Delete employees", roles: ["✓", "—", "—", "—"] },
  { cap: "Manage teams", roles: ["✓", "✓", "—", "—"] },
  { cap: "Import / export data", roles: ["✓", "✓", "—", "—"] },
  { cap: "Audit log access", roles: ["✓", "✓", "—", "—"] },
  { cap: "Manage users & roles", roles: ["✓", "—", "—", "—"] },
];

const DECISIONS = [
  {
    title: "Users and Employees Are Separate",
    body: "Users represent authenticated accounts. Employees represent HR records. Keeping them separate supports scenarios where someone exists in the HR system but never signs in, or where someone signs in but is not an employee.",
  },
  {
    title: "Org Chart Structure",
    body: "The reporting hierarchy is stored using a simple manager relationship (manager_id). Hierarchy queries use recursive CTEs, which keeps updates simple while still making subtree lookups and reporting-chain traversal efficient. Cycle detection runs whenever reporting relationships are modified so invalid hierarchies cannot be created.",
  },
  {
    title: "Compensation Is Stored Separately",
    body: "Salary information lives in a dedicated compensation table. This makes authorization simpler and reduces the risk of exposing compensation data through endpoints that should not have access to it.",
  },
  {
    title: "Audit Logging",
    body: "All mutations write audit entries inside the same database transaction as the underlying change. That guarantees the audit log and the actual data stay in sync.",
  },
  {
    title: "Authorization",
    body: "Authorization rules are centralized in a single module and enforced in the repository layer. Since all database operations flow through the repository layer, permission checks cannot be accidentally skipped by a route or server action.",
  },
  {
    title: "Bulk Imports",
    body: "Imports follow a two-step process: validate and preview on the client, then re-validate and commit on the server. Everything is committed in a single transaction. Manager relationships are resolved by email after records are loaded, so file ordering does not matter.",
  },
  {
    title: "Exports",
    body: "Exports reuse the same filtering logic as the employee directory. This ensures that exported data always matches the view currently shown in the application and avoids maintaining multiple filtering systems.",
  },
] as const;

const LIMITATIONS = [
  {
    title: "Historical Reconstruction",
    body: "The system stores current state plus an audit log. It does not currently support viewing the organization at an arbitrary point in time.",
  },
  {
    title: "Import Limits",
    body: "Imports are capped at 5,000 rows per file.",
  },
  {
    title: "Org Chart PDF Export",
    body: "The PDF export captures the current chart exactly as displayed, including zoom level and expansion state.",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">About this System</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Echelon HRIS is a lightweight human resources platform built for managing employees,
          teams, reporting structures, and permissions.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Employee and team directories</li>
          <li>Interactive drag-and-drop org chart</li>
          <li>Bulk CSV/Excel imports with preview mode</li>
          <li>CSV, Excel, and PDF exports</li>
          <li>Audit logging</li>
          <li>Role-based access control</li>
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          This page gives a high-level overview of how the system works. The{" "}
          <a
            className="underline underline-offset-2 hover:text-foreground"
            href="https://github.com/HMCJPG/EchelonOS_HRIS"
            target="_blank"
            rel="noreferrer"
          >
            README
          </a>{" "}
          contains a more detailed breakdown of implementation decisions and tradeoffs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tech Stack</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {STACK.map((s) => (
            <div key={s.name} className="grid gap-1 sm:grid-cols-[220px_1fr] sm:gap-4">
              <span className="text-sm font-medium">{s.name}</span>
              <span className="text-sm text-muted-foreground">{s.body}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role-Based Access Control</CardTitle>
          <CardDescription>Every user belongs to one of four roles.</CardDescription>
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
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <p>
              New users are assigned the Viewer role by default and receive read-only access until
              an Admin promotes them.
            </p>
            <p>
              Manager permissions are intentionally limited. Managers can view their entire
              reporting tree, but can only make changes to their direct reports.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Architecture Decisions</CardTitle>
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
          <CardTitle>Known Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {LIMITATIONS.map((l) => (
            <div key={l.title}>
              <p className="text-sm font-medium">{l.title}</p>
              <p className="text-sm text-muted-foreground">{l.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
