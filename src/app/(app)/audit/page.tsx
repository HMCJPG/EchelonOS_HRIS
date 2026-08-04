import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canViewAudit } from "@/lib/authz";
import { listAudit } from "@/repo/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  create: "default",
  update: "secondary",
  delete: "destructive",
  import: "outline",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  if (!canViewAudit(user)) redirect("/employees");
  const rows = await listAudit(user, { entityType: sp.type });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Every mutation, written in the same transaction as the change itself. Salary diffs appear
          here, which is why this page is Admin/HR only.
        </p>
      </div>
      <form action="/audit" method="GET" className="flex items-center gap-2">
        <select
          name="type"
          defaultValue={sp.type ?? ""}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="">All entities</option>
          <option value="employee">Employees</option>
          <option value="team">Teams</option>
          <option value="user">Users</option>
        </select>
        <Button type="submit" variant="secondary" size="sm">
          Apply
        </Button>
      </form>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Changes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No audit entries yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {r.createdAt.toISOString().replace("T", " ").slice(0, 16)}
                </TableCell>
                <TableCell className="text-sm">{r.actorEmail ?? "system"}</TableCell>
                <TableCell>
                  <Badge variant={ACTION_VARIANT[r.action] ?? "secondary"}>{r.action}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  <span className="text-muted-foreground">{r.entityType}: </span>
                  {r.entityLabel}
                </TableCell>
                <TableCell className="max-w-md text-xs">
                  {r.changes ? (
                    <div className="space-y-0.5">
                      {Object.entries(r.changes).map(([field, d]) => (
                        <div key={field} className="truncate">
                          <span className="font-medium">{field}</span>:{" "}
                          <span className="text-muted-foreground line-through">
                            {String(d.old ?? "∅")}
                          </span>{" "}
                          → {String(d.new ?? "∅")}
                        </div>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
