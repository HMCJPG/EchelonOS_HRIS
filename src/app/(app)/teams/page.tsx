import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { canManageTeams } from "@/lib/authz";
import { listTeams } from "@/repo/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const rows = await listTeams(user, sp.q);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Team Directory</h1>
        {canManageTeams(user) && (
          <Button render={<Link href="/teams/new" />} nativeButton={false} size="sm">
            Add team
          </Button>
        )}
      </div>
      <form action="/teams" method="GET" className="flex items-center gap-2">
        <Input name="q" placeholder="Search teams…" defaultValue={sp.q ?? ""} className="w-56" />
        <Button type="submit" variant="secondary" size="sm">
          Apply
        </Button>
      </form>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Parent team</TableHead>
              <TableHead>Lead(s)</TableHead>
              <TableHead className="text-right">Members</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No teams found.
                </TableCell>
              </TableRow>
            )}
            {rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link href={`/teams/${t.id}`} className="font-medium hover:underline">
                    {t.name}
                  </Link>
                </TableCell>
                <TableCell>{t.parentTeamName ?? "—"}</TableCell>
                <TableCell>{t.leadNames.length ? t.leadNames.join(", ") : "—"}</TableCell>
                <TableCell className="text-right">{t.memberCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
