import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Plain GET form — filter state lives in the URL, which is what lets the
 * export endpoints reuse the exact same query (one source of truth).
 */
export function FilterBar({
  action,
  q,
  departments,
  department,
  status,
  teams,
  teamId,
}: {
  action: string;
  q?: string;
  departments: string[];
  department?: string;
  status?: string;
  teams?: { id: string; name: string }[];
  teamId?: string;
}) {
  const selectCls =
    "border-input bg-background h-9 rounded-md border px-3 text-sm";
  return (
    <form action={action} method="GET" className="flex flex-wrap items-center gap-2">
      <Input
        name="q"
        placeholder="Search name, email, title…"
        defaultValue={q ?? ""}
        className="w-56"
      />
      <select name="department" defaultValue={department ?? ""} className={selectCls}>
        <option value="">All departments</option>
        {departments.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select name="status" defaultValue={status ?? ""} className={selectCls}>
        <option value="">Any status</option>
        <option value="active">Active</option>
        <option value="on_leave">On leave</option>
        <option value="terminated">Terminated</option>
      </select>
      {teams && (
        <select name="team" defaultValue={teamId ?? ""} className={selectCls}>
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
      <Button type="submit" variant="secondary" size="sm">
        Apply
      </Button>
    </form>
  );
}
