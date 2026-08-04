import { requireUser } from "@/lib/auth";
import { listOrgNodes } from "@/repo/employees";
import { OrgChart } from "@/components/org-chart/org-chart";

export default async function OrgChartPage() {
  const user = await requireUser();
  const nodes = await listOrgNodes(user);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Organizational Chart</h1>
      <OrgChart data={nodes} />
    </div>
  );
}
