import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canImport } from "@/lib/authz";
import { ImportWizard } from "@/components/import-wizard";

export default async function ImportPage() {
  const user = await requireUser();
  if (!canImport(user)) redirect("/employees");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bulk import</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Upload a CSV or Excel file. Email is the natural key — existing employees (matched by
          email) are updated, new ones are created. Managers are referenced by email
          (managerEmail column) and wired up in a second pass, so row order doesn&apos;t matter.
          The import is all-or-nothing: fix any errors shown in the dry run and re-upload.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
