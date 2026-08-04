"use client";

import * as React from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { hierarchy, tree } from "d3-hierarchy";
import { toast } from "sonner";
import { reparentAction } from "@/actions/employees";
import type { OrgNode } from "@/repo/employees";
import { Button } from "@/components/ui/button";
import { EmployeeNode, type EmployeeFlowNode } from "./employee-node";

const nodeTypes = { employee: EmployeeNode };

type TreeDatum = { id: string; children: TreeDatum[] };

/** Levels visible before subtrees start collapsed. */
const DEFAULT_EXPANDED_DEPTH = 2;

function computeLayout(
  data: OrgNode[],
  collapsed: Set<string>,
  onToggle: (id: string) => void,
): { nodes: EmployeeFlowNode[]; edges: Edge[] } {
  const byId = new Map(data.map((n) => [n.id, n]));
  const childrenOf = new Map<string | null, OrgNode[]>();
  for (const n of data) {
    // Treat a dangling manager reference as a root rather than dropping the node.
    const key = n.managerId && byId.has(n.managerId) ? n.managerId : null;
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), n]);
  }

  const build = (n: OrgNode): TreeDatum => ({
    id: n.id,
    children: collapsed.has(n.id) ? [] : (childrenOf.get(n.id) ?? []).map(build),
  });
  const roots = (childrenOf.get(null) ?? []).map(build);
  // Synthetic root so a multi-root forest still lays out as one tree.
  const root = hierarchy<TreeDatum>({ id: "__root__", children: roots });
  tree<TreeDatum>().nodeSize([230, 150])(root);

  const nodes: EmployeeFlowNode[] = [];
  const edges: Edge[] = [];
  root.each((d) => {
    if (d.data.id === "__root__") return;
    const n = byId.get(d.data.id)!;
    const childCount = (childrenOf.get(n.id) ?? []).length;
    nodes.push({
      id: n.id,
      type: "employee",
      position: { x: d.x ?? 0, y: ((d.y ?? 0) - 150) },
      draggable: n.canEdit,
      data: {
        label: n.name,
        title: n.title,
        department: n.department,
        status: n.status,
        childCount,
        collapsed: collapsed.has(n.id),
        canEdit: n.canEdit,
        employeeId: n.id,
        onToggle,
      },
    });
    if (n.managerId && byId.has(n.managerId) && !collapsed.has(n.managerId)) {
      edges.push({
        id: `${n.managerId}->${n.id}`,
        source: n.managerId,
        target: n.id,
        type: "smoothstep",
      });
    }
  });
  return { nodes, edges };
}

function descendantsOf(data: OrgNode[], rootId: string): Set<string> {
  const childrenOf = new Map<string | null, OrgNode[]>();
  for (const n of data) childrenOf.set(n.managerId, [...(childrenOf.get(n.managerId) ?? []), n]);
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const c of childrenOf.get(id) ?? []) {
      if (!out.has(c.id)) {
        out.add(c.id);
        stack.push(c.id);
      }
    }
  }
  return out;
}

function initialCollapsed(data: OrgNode[]): Set<string> {
  const byId = new Map(data.map((n) => [n.id, n]));
  const depthOf = (n: OrgNode): number => {
    let d = 0;
    let cur = n;
    while (cur.managerId && byId.has(cur.managerId) && d < 50) {
      cur = byId.get(cur.managerId)!;
      d++;
    }
    return d;
  };
  const hasChildren = new Set(data.map((n) => n.managerId).filter(Boolean) as string[]);
  return new Set(
    data.filter((n) => hasChildren.has(n.id) && depthOf(n) >= DEFAULT_EXPANDED_DEPTH).map((n) => n.id),
  );
}

function Chart({ data }: { data: OrgNode[] }) {
  const [orgData, setOrgData] = React.useState(data);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => initialCollapsed(data));
  const { getIntersectingNodes, fitView } = useReactFlow();

  // Server refetch (after a mutation revalidates) resets local org state —
  // render-time derived-state adjustment, per react.dev "you might not need an effect".
  const [prevData, setPrevData] = React.useState(data);
  if (prevData !== data) {
    setPrevData(data);
    setOrgData(data);
  }

  const onToggle = React.useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const layout = React.useMemo(
    () => computeLayout(orgData, collapsed, onToggle),
    [orgData, collapsed, onToggle],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);

  // Re-apply layout when data/collapse changes, but carry over React Flow's
  // measured dimensions — replacing nodes wholesale would wipe `measured`
  // and leave every node stuck invisible waiting for a re-measure.
  const applyLayout = React.useCallback(
    (next: EmployeeFlowNode[]) => {
      setNodes((prev) => {
        const measuredById = new Map(prev.map((n) => [n.id, n.measured]));
        return next.map((n) => ({ ...n, measured: measuredById.get(n.id) }));
      });
    },
    [setNodes],
  );
  React.useEffect(() => applyLayout(layout.nodes), [layout, applyLayout]);

  const onNodeDragStop = React.useCallback(
    (_e: MouseEvent | TouchEvent, node: EmployeeFlowNode) => {
      const target = getIntersectingNodes(node)[0];
      const dragged = orgData.find((n) => n.id === node.id);
      const snapBack = () => applyLayout(layout.nodes);
      if (!target || !dragged || target.id === dragged.managerId) return snapBack();
      if (target.id === node.id || descendantsOf(orgData, node.id).has(target.id)) {
        toast.error("You can't move someone under their own report — that would create a cycle.");
        return snapBack();
      }

      const previous = orgData;
      const targetNode = orgData.find((n) => n.id === target.id);
      // Optimistic: reparent locally, roll back if the server rejects.
      setOrgData((cur) => cur.map((n) => (n.id === node.id ? { ...n, managerId: target.id } : n)));
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(target.id);
        return next;
      });
      reparentAction(node.id, target.id).then((res) => {
        if (!res.ok) {
          setOrgData(previous);
          toast.error(res.error);
        } else {
          toast.success(`${dragged.name} now reports to ${targetNode?.name ?? "new manager"}.`);
        }
      });
    },
    [orgData, layout, getIntersectingNodes, applyLayout],
  );

  const exportPdf = React.useCallback(async () => {
    const el = document.querySelector<HTMLElement>(".react-flow__viewport");
    const wrapper = document.querySelector<HTMLElement>(".react-flow");
    if (!el || !wrapper) return;
    toast.info("Rendering PDF…");
    // React Flow nodes are HTML (not SVG), so rasterize with html-to-image
    // and embed in a jsPDF page — no headless Chromium needed.
    const { toPng } = await import("html-to-image");
    const { jsPDF } = await import("jspdf");
    const png = await toPng(wrapper, {
      backgroundColor: "#ffffff",
      filter: (node) =>
        !(node instanceof HTMLElement && /react-flow__(minimap|controls|panel)/.test(node.className?.toString?.() ?? "")),
    });
    const img = new Image();
    img.src = png;
    await new Promise((r) => (img.onload = r));
    const landscape = img.width >= img.height;
    const pdf = new jsPDF({ orientation: landscape ? "l" : "p", unit: "pt", format: "a4" });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const scale = Math.min(pw / img.width, ph / img.height);
    pdf.addImage(png, "PNG", (pw - img.width * scale) / 2, (ph - img.height * scale) / 2, img.width * scale, img.height * scale);
    pdf.save("org-chart.pdf");
  }, []);

  return (
    <div className="h-[calc(100vh-14rem)] min-h-[480px] rounded-md border">
      <ReactFlow
        nodes={nodes}
        edges={layout.edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        nodesConnectable={false}
        edgesFocusable={false}
        proOptions={{ hideAttribution: true }}
        fitView
        minZoom={0.1}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Drag an employee card onto another card to change their manager (highlighted cards are
          ones you can move). Cycles are rejected. Use the buttons on cards to expand/collapse.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fitView()}>
            Fit view
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf}>
            Export PDF
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OrgChart({ data }: { data: OrgNode[] }) {
  return (
    <ReactFlowProvider>
      <Chart data={data} />
    </ReactFlowProvider>
  );
}
