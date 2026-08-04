import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  on_leave: "border-amber-200 bg-amber-50 text-amber-700",
  terminated: "border-red-200 bg-red-50 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASS[status])}>
      {status.replace("_", " ")}
    </Badge>
  );
}
