"use client";

import * as React from "react";
import { toast } from "sonner";
import { setUserRoleAction } from "@/actions/users";
import type { Role } from "@/db/schema";

export function RoleSelect({ userId, role, disabled }: { userId: string; role: Role; disabled?: boolean }) {
  const [pending, startTransition] = React.useTransition();

  return (
    <select
      defaultValue={role}
      disabled={disabled || pending}
      className="border-input bg-background h-8 rounded-md border px-2 text-sm"
      onChange={(e) => {
        const next = e.target.value as Role;
        startTransition(async () => {
          const res = await setUserRoleAction(userId, next);
          if (!res.ok) {
            toast.error(res.error);
          } else {
            toast.success("Role updated.");
          }
        });
      }}
    >
      <option value="admin">Admin</option>
      <option value="hr">HR</option>
      <option value="manager">Manager</option>
      <option value="employee">Employee / Viewer</option>
    </select>
  );
}
