import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageTeams } from "@/lib/authz";
import { listTeamOptions } from "@/repo/teams";
import { createTeamAction } from "@/actions/teams";
import { TeamForm } from "@/components/team-form";

export default async function NewTeamPage() {
  const user = await requireUser();
  if (!canManageTeams(user)) redirect("/teams");
  const parents = await listTeamOptions();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Add team</h1>
      <TeamForm action={createTeamAction} parentOptions={parents} submitLabel="Create team" />
    </div>
  );
}
