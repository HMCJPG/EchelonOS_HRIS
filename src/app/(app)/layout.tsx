import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { canImport, canManageUsers, canViewAudit } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  hr: "HR",
  manager: "Manager",
  employee: "Viewer",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const nav = [
    { href: "/employees", label: "Employees" },
    { href: "/teams", label: "Teams" },
    { href: "/org-chart", label: "Org Chart" },
    { href: "/search", label: "Search" },
    ...(canImport(user) ? [{ href: "/import", label: "Import" }] : []),
    ...(canViewAudit(user) ? [{ href: "/audit", label: "Audit Log" }] : []),
    ...(canManageUsers(user) ? [{ href: "/users", label: "Users" }] : []),
    { href: "/about", label: "About" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/employees" className="text-lg font-semibold tracking-tight">
            Echelon HRIS
          </Link>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
            <Badge variant="secondary">{ROLE_LABEL[user.role]}</Badge>
            <Button render={<a href="/logout" />} nativeButton={false} variant="ghost" size="sm">
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
