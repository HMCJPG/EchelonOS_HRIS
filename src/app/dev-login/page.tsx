import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DEV_COOKIE, workosEnabled } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Local development sign-in, only reachable when WorkOS env is absent.
// Lets you demo every RBAC role without an IdP round-trip.
export default async function DevLoginPage() {
  if (workosEnabled()) redirect("/login");

  async function signIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const role = String(formData.get("role") ?? "employee");
    const name = String(formData.get("name") ?? "").trim() || null;
    if (!email) return;
    const payload = Buffer.from(JSON.stringify({ email, role, name })).toString("base64");
    (await cookies()).set(DEV_COOKIE, payload, { httpOnly: true, sameSite: "lax", path: "/" });
    redirect("/");
  }

  const personas = [
    { email: "admin@echelon.dev", role: "admin", label: "Admin — full access" },
    { email: "hr@echelon.dev", role: "hr", label: "HR — edit employees, export, audit" },
    { email: "manager@echelon.dev", role: "manager", label: "Manager — view team, edit reports" },
    { email: "viewer@echelon.dev", role: "employee", label: "Viewer — read-only" },
  ];

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Dev sign-in</CardTitle>
          <CardDescription>
            WorkOS is not configured, so the app is in local dev-auth mode. Pick a persona or enter
            any email. The seed script creates matching users for the quick personas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2">
            {personas.map((p) => (
              <form key={p.email} action={signIn}>
                <input type="hidden" name="email" value={p.email} />
                <input type="hidden" name="role" value={p.role} />
                <Button type="submit" variant="outline" className="w-full justify-start">
                  {p.label}
                </Button>
              </form>
            ))}
          </div>
          <form action={signIn} className="space-y-3 border-t pt-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                name="role"
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm"
                defaultValue="employee"
              >
                <option value="admin">Admin</option>
                <option value="hr">HR</option>
                <option value="manager">Manager</option>
                <option value="employee">Employee / Viewer</option>
              </select>
            </div>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
