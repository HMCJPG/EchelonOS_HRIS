"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { employeeSchema } from "@/lib/validation";
import {
  createEmployee,
  updateEmployee,
  deleteEmployee,
  reparentEmployee,
} from "@/repo/employees";

export type ActionResult = { ok: true } | { ok: false; error: string };

function formToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

function revalidateEmployeeSurfaces() {
  revalidatePath("/employees");
  revalidatePath("/org-chart");
  revalidatePath("/audit");
}

export async function createEmployeeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = employeeSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  let id: string;
  try {
    const emp = await createEmployee(user, parsed.data);
    id = emp.id;
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  revalidateEmployeeSurfaces();
  redirect(`/employees/${id}`);
}

export async function updateEmployeeAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = employeeSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await updateEmployee(user, id, parsed.data);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  revalidateEmployeeSurfaces();
  revalidatePath(`/employees/${id}`);
  return { ok: true };
}

export async function deleteEmployeeAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await deleteEmployee(user, id);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  revalidateEmployeeSurfaces();
  redirect("/employees");
}

/** Org chart drag-and-drop. Returns the error instead of throwing so the client can roll back. */
export async function reparentAction(employeeId: string, newManagerId: string | null): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await reparentEmployee(user, employeeId, newManagerId);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  revalidateEmployeeSurfaces();
  return { ok: true };
}
