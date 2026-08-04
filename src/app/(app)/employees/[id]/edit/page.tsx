import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canEditSalary } from "@/lib/authz";
import { getEmployee, listManagerOptions } from "@/repo/employees";
import { updateEmployeeAction } from "@/actions/employees";
import { EmployeeForm } from "@/components/employee-form";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const emp = await getEmployee(user, id);
  if (!emp) notFound();
  if (!emp.canEdit) redirect(`/employees/${id}`);

  // An employee can't be their own manager; the select excludes self (deeper
  // cycles are rejected server-side inside the transaction).
  const managers = (await listManagerOptions()).filter((m) => m.id !== id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Edit {emp.firstName} {emp.lastName}
      </h1>
      <EmployeeForm
        action={updateEmployeeAction.bind(null, id)}
        initial={{
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          title: emp.title,
          department: emp.department,
          phone: emp.phone,
          location: emp.location,
          hireDate: emp.hireDate,
          status: emp.status,
          managerId: emp.managerId,
          salary: emp.salary,
        }}
        managers={managers}
        salaryEditable={canEditSalary(user)}
        submitLabel="Save changes"
      />
    </div>
  );
}
