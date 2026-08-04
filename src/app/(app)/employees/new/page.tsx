import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canCreateEmployee, canEditSalary } from "@/lib/authz";
import { listManagerOptions } from "@/repo/employees";
import { createEmployeeAction } from "@/actions/employees";
import { EmployeeForm } from "@/components/employee-form";

export default async function NewEmployeePage() {
  const user = await requireUser();
  if (!canCreateEmployee(user)) redirect("/employees");
  const managers = await listManagerOptions();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Add employee</h1>
      <EmployeeForm
        action={createEmployeeAction}
        managers={managers}
        salaryEditable={canEditSalary(user)}
        submitLabel="Create employee"
      />
    </div>
  );
}
