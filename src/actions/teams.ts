"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { teamSchema } from "@/lib/validation";
import { createTeam, updateTeam, deleteTeam, setTeamMembership } from "@/repo/teams";
import type { ActionResult } from "@/actions/employees";

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

export async function createTeamAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = teamSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  let id: string;
  try {
    const team = await createTeam(user, parsed.data);
    id = team.id;
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  revalidatePath("/teams");
  redirect(`/teams/${id}`);
}

export async function updateTeamAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = teamSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await updateTeam(user, id, parsed.data);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  revalidatePath("/teams");
  revalidatePath(`/teams/${id}`);
  return { ok: true };
}

export async function deleteTeamAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await deleteTeam(user, id);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  revalidatePath("/teams");
  redirect("/teams");
}

export async function setMembershipAction(
  teamId: string,
  employeeId: string,
  roleInTeam: "member" | "lead" | "remove",
): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await setTeamMembership(user, teamId, employeeId, roleInTeam);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/teams");
  return { ok: true };
}
