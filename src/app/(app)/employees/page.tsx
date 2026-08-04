import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { canCreateEmployee, canExport, canViewAnySalary } from "@/lib/authz";
import { listEmployees, listDepartments } from "@/repo/employees";
import { listTeamOptions } from "@/repo/teams";
import { DirectoryTable } from "@/components/directory-table";
import { FilterBar } from "@/components/filter-bar";
import { ExportMenu } from "@/components/export-menu";
import { Button } from "@/components/ui/button";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const filters = { q: sp.q, department: sp.department, status: sp.status, teamId: sp.team };

  const [rows, departments, teamOptions] = await Promise.all([
    listEmployees(user, filters),
    listDepartments(),
    listTeamOptions(),
  ]);

  const showSalary = canViewAnySalary(user) && rows.some((r) => r.salary != null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Employee Directory</h1>
        <div className="flex items-center gap-2">
          {canExport(user) && <ExportMenu basePath="/api/export" params={sp} />}
          {canCreateEmployee(user) && (
            <Button render={<Link href="/employees/new" />} nativeButton={false} size="sm">
              Add employee
            </Button>
          )}
        </div>
      </div>
      <FilterBar
        action="/employees"
        q={sp.q}
        departments={departments}
        department={sp.department}
        status={sp.status}
        teams={teamOptions}
        teamId={sp.team}
      />
      <p className="text-sm text-muted-foreground">{rows.length} employees</p>
      <DirectoryTable
        rows={rows.map((r) => ({
          id: r.id,
          name: `${r.firstName} ${r.lastName}`,
          email: r.email,
          title: r.title,
          department: r.department,
          managerName: r.managerName,
          hireDate: r.hireDate,
          status: r.status,
          salary: r.salary,
        }))}
        showSalary={showSalary}
      />
    </div>
  );
}
