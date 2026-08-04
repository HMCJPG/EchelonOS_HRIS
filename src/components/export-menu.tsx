import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Export links carry the directory's current filter querystring — the export
 * endpoints run the same query builder, so what you see is what you export.
 */
export function ExportMenu({
  basePath,
  params,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])),
  ).toString();
  const suffix = qs ? `?${qs}` : "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<a href={`${basePath}/csv${suffix}`} />}>CSV</DropdownMenuItem>
        <DropdownMenuItem render={<a href={`${basePath}/xlsx${suffix}`} />}>
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem render={<a href={`${basePath}/pdf${suffix}`} />}>PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
