"use client";

import * as React from "react";
import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/actions/employees";

export type EmployeeFormValues = {
  firstName?: string;
  lastName?: string;
  email?: string;
  title?: string | null;
  department?: string | null;
  phone?: string | null;
  location?: string | null;
  hireDate?: string | null;
  status?: string;
  managerId?: string | null;
  salary?: number | null;
};

export function EmployeeForm({
  action,
  initial = {},
  managers,
  salaryEditable,
  submitLabel,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  initial?: EmployeeFormValues;
  managers: { id: string; name: string }[];
  salaryEditable: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  const selectCls = "border-input bg-background h-9 w-full rounded-md border px-3 text-sm";
  return (
    <form action={formAction} className="max-w-2xl space-y-4">
      {state && !state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" name="firstName" defaultValue={initial.firstName} required />
        <Field label="Last name" name="lastName" defaultValue={initial.lastName} required />
        <Field label="Email" name="email" type="email" defaultValue={initial.email} required />
        <Field label="Title" name="title" defaultValue={initial.title ?? undefined} />
        <Field label="Department" name="department" defaultValue={initial.department ?? undefined} />
        <Field label="Phone" name="phone" defaultValue={initial.phone ?? undefined} />
        <Field label="Location" name="location" defaultValue={initial.location ?? undefined} />
        <Field label="Hire date" name="hireDate" type="date" defaultValue={initial.hireDate ?? undefined} />
        <div className="space-y-1">
          <Label htmlFor="status">Status</Label>
          <select id="status" name="status" defaultValue={initial.status ?? "active"} className={selectCls}>
            <option value="active">Active</option>
            <option value="on_leave">On leave</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="managerId">Manager</Label>
          <select id="managerId" name="managerId" defaultValue={initial.managerId ?? ""} className={selectCls}>
            <option value="">No manager (top level)</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        {salaryEditable && (
          <Field
            label="Salary (annual USD)"
            name="salary"
            type="number"
            defaultValue={initial.salary != null ? String(initial.salary) : undefined}
          />
        )}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} required={required} />
    </div>
  );
}
