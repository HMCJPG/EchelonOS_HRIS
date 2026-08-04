import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEmployee } from "@/repo/employees";
import { deleteEmployeeAction } from "@/actions/employees";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDelete } from "@/components/confirm-delete";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const emp = await getEmployee(user, id);
  if (!emp) notFound();

  const facts: [string, React.ReactNode][] = [
    ["Email", emp.email],
    ["Title", emp.title ?? "—"],
    ["Department", emp.department ?? "—"],
    [
      "Manager",
      emp.managerId ? (
        <Link key="m" href={`/employees/${emp.managerId}`} className="hover:underline">
          {emp.managerName}
        </Link>
      ) : (
        "— (top level)"
      ),
    ],
    ["Phone", emp.phone ?? "—"],
    ["Location", emp.location ?? "—"],
    ["Hire date", emp.hireDate ?? "—"],
    ["Status", <StatusBadge key="s" status={emp.status} />],
  ];
  if (emp.salaryVisible) {
    facts.push(["Salary", emp.salary != null ? usd.format(emp.salary) : "Not recorded"]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {emp.firstName} {emp.lastName}
          </h1>
          <p className="text-muted-foreground">{[emp.title, emp.department].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex items-center gap-2">
          {emp.canEdit && (
            <Button render={<Link href={`/employees/${emp.id}/edit`} />} nativeButton={false} size="sm" variant="outline">
              Edit
            </Button>
          )}
          {emp.canDelete && (
            <ConfirmDelete
              label="Delete"
              description={`Delete ${emp.firstName} ${emp.lastName}? Their direct reports will be reassigned to ${emp.managerName ?? "no manager"}. This is recorded in the audit log.`}
              onConfirm={deleteEmployeeAction.bind(null, emp.id)}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
                  <dd className="text-sm">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Direct reports ({emp.reports.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {emp.reports.length === 0 && <p className="text-sm text-muted-foreground">None</p>}
              {emp.reports.map((r) => (
                <div key={r.id} className="text-sm">
                  <Link href={`/employees/${r.id}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                  <span className="text-muted-foreground"> {r.title ? `· ${r.title}` : ""}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Teams</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {emp.teams.length === 0 && <p className="text-sm text-muted-foreground">No team memberships</p>}
              {emp.teams.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <Link href={`/teams/${t.id}`} className="font-medium hover:underline">
                    {t.name}
                  </Link>
                  {t.roleInTeam === "lead" && <Badge variant="secondary">Lead</Badge>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
