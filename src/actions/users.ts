"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { setUserRole } from "@/repo/users";
import type { Role } from "@/db/schema";
import type { ActionResult } from "@/actions/employees";

export async function setUserRoleAction(userId: string, role: Role): Promise<ActionResult> {
  const actor = await requireUser();
  try {
    await setUserRole(actor, userId, role);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
  revalidatePath("/users");
  return { ok: true };
}
