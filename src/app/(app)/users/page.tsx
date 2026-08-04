import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/authz";
import { listUsers } from "@/repo/users";
import { RoleSelect } from "@/components/role-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function UsersPage() {
  const user = await requireUser();
  if (!canManageUsers(user)) redirect("/employees");
  const rows = await listUsers(user);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users &amp; Roles</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Users are auth identities (via WorkOS); employees are HR records — they&apos;re linked by
          email when they match. The first user ever to sign in becomes Admin; everyone else starts
          as read-only Viewer until promoted here. Manager scope (view team, edit direct reports)
          comes from the linked employee&apos;s position in the org chart.
        </p>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Linked employee</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="text-sm">{u.email}</TableCell>
                <TableCell className="text-sm">{u.name ?? "—"}</TableCell>
                <TableCell className="text-sm">{u.employeeName ?? "Not linked"}</TableCell>
                <TableCell>
                  <RoleSelect userId={u.id} role={u.role} disabled={u.id === user.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
