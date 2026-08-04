import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { searchAll } from "@/repo/search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  await requireUser();
  const q = sp.q ?? "";
  const results = q ? await searchAll(q) : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
      <form action="/search" method="GET" className="flex items-center gap-2">
        <Input name="q" placeholder="Search employees and teams…" defaultValue={q} autoFocus />
        <Button type="submit">Search</Button>
      </form>

      {q && (
        <p className="text-sm text-muted-foreground">
          {results.length} result{results.length === 1 ? "" : "s"} for “{q}”
        </p>
      )}
      <ul className="divide-y rounded-md border">
        {q && results.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing found.</li>
        )}
        {results.map((r) => (
          <li key={`${r.type}-${r.id}`}>
            <Link
              href={r.type === "employee" ? `/employees/${r.id}` : `/teams/${r.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
            >
              <Badge variant={r.type === "employee" ? "default" : "secondary"}>
                {r.type === "employee" ? "Employee" : "Team"}
              </Badge>
              <span className="font-medium">{r.label}</span>
              <span className="truncate text-sm text-muted-foreground">{r.sub}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
