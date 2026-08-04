"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { setMembershipAction } from "@/actions/teams";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function TeamMembers({
  teamId,
  members,
  candidates,
  canManage,
}: {
  teamId: string;
  members: { employeeId: string; name: string; title: string | null; roleInTeam: string }[];
  candidates: { id: string; name: string }[];
  canManage: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  const [selected, setSelected] = React.useState("");

  function run(employeeId: string, role: "member" | "lead" | "remove") {
    startTransition(async () => {
      const res = await setMembershipAction(teamId, employeeId, role);
      if (!res.ok) toast.error(res.error);
    });
  }

  const memberIds = new Set(members.map((m) => m.employeeId));
  const addable = candidates.filter((c) => !memberIds.has(c.id));

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-md border">
        {members.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">No members yet.</li>
        )}
        {members.map((m) => (
          <li key={m.employeeId} className="flex flex-wrap items-center gap-2 px-4 py-2">
            <div className="min-w-0 flex-1">
              <Link href={`/employees/${m.employeeId}`} className="text-sm font-medium hover:underline">
                {m.name}
              </Link>
              <span className="ml-2 text-xs text-muted-foreground">{m.title ?? ""}</span>
            </div>
            {m.roleInTeam === "lead" && <Badge variant="secondary">Lead</Badge>}
            {canManage && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(m.employeeId, m.roleInTeam === "lead" ? "member" : "lead")}
                >
                  {m.roleInTeam === "lead" ? "Demote" : "Make lead"}
                </Button>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(m.employeeId, "remove")}>
                  Remove
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="border-input bg-background h-9 flex-1 rounded-md border px-3 text-sm"
          >
            <option value="">Add an employee…</option>
            {addable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!selected || pending}
            onClick={() => {
              run(selected, "member");
              setSelected("");
            }}
          >
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
