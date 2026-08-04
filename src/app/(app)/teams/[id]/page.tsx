import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getTeam, listTeamOptions } from "@/repo/teams";
import { listManagerOptions } from "@/repo/employees";
import { deleteTeamAction, updateTeamAction } from "@/actions/teams";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDelete } from "@/components/confirm-delete";
import { TeamMembers } from "@/components/team-members";
import { TeamForm } from "@/components/team-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const team = await getTeam(user, id);
  if (!team) notFound();

  const [employeeOptions, teamOptions] = await Promise.all([
    listManagerOptions(),
    listTeamOptions(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
          <p className="text-muted-foreground">
            {team.description ?? "Team"}
            {team.parentTeamName && (
              <>
                {" · sub-team of "}
                <Link href={`/teams/${team.parentTeamId}`} className="hover:underline">
                  {team.parentTeamName}
                </Link>
              </>
            )}
          </p>
        </div>
        {team.canManage && (
          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger render={<Button variant="outline" size="sm" />}>
                Edit
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit team</DialogTitle>
                </DialogHeader>
                <TeamForm
                  action={updateTeamAction.bind(null, team.id)}
                  initial={{
                    name: team.name,
                    description: team.description,
                    parentTeamId: team.parentTeamId,
                  }}
                  parentOptions={teamOptions.filter((t) => t.id !== team.id)}
                  submitLabel="Save changes"
                />
              </DialogContent>
            </Dialog>
            <ConfirmDelete
              label="Delete"
              description={`Delete ${team.name}? Sub-teams move up to its parent; members are unassigned from it. Recorded in the audit log.`}
              onConfirm={deleteTeamAction.bind(null, team.id)}
            />
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Members ({team.memberCount})</CardTitle>
          </CardHeader>
          <CardContent>
            <TeamMembers
              teamId={team.id}
              members={team.members}
              candidates={employeeOptions}
              canManage={team.canManage}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sub-teams ({team.subTeams.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {team.subTeams.length === 0 && <p className="text-sm text-muted-foreground">None</p>}
            {team.subTeams.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <Link href={`/teams/${s.id}`} className="font-medium hover:underline">
                  {s.name}
                </Link>
                <span className="text-muted-foreground">{s.memberCount} members</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
