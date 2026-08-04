"use client";

import * as React from "react";
import Link from "next/link";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Button } from "@/components/ui/button";

export type EmployeeNodeData = {
  label: string;
  title: string | null;
  department: string | null;
  status: string;
  childCount: number;
  collapsed: boolean;
  canEdit: boolean;
  employeeId: string;
  onToggle: (id: string) => void;
};

export type EmployeeFlowNode = Node<EmployeeNodeData, "employee">;

export function EmployeeNode({ data }: NodeProps<EmployeeFlowNode>) {
  return (
    <div
      className={`w-52 rounded-lg border bg-background p-3 shadow-sm ${
        data.status === "terminated" ? "opacity-50" : ""
      } ${data.canEdit ? "cursor-grab border-primary/40" : ""}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="space-y-0.5">
        <Link
          href={`/employees/${data.employeeId}`}
          className="block truncate text-sm font-semibold hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {data.label}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{data.title ?? "—"}</p>
        {data.department && (
          <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground/70">
            {data.department}
          </p>
        )}
      </div>
      {data.childCount > 0 && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-2 h-6 w-full text-xs"
          onClick={(e) => {
            e.stopPropagation();
            data.onToggle(data.employeeId);
          }}
        >
          {data.collapsed ? `Show ${data.childCount} reports` : "Collapse"}
        </Button>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
}
