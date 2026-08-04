"use client";

import * as React from "react";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DirectoryTableRow = {
  id: string;
  name: string;
  email: string;
  title: string | null;
  department: string | null;
  managerName: string | null;
  hireDate: string | null;
  status: string;
  salary: number | null;
};


const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function DirectoryTable({ rows, showSalary }: { rows: DirectoryTableRow[]; showSalary: boolean }) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const columns = React.useMemo<ColumnDef<DirectoryTableRow>[]>(() => {
    const cols: ColumnDef<DirectoryTableRow>[] = [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <Link href={`/employees/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      { accessorKey: "title", header: "Title", cell: ({ getValue }) => getValue() ?? "—" },
      { accessorKey: "department", header: "Department", cell: ({ getValue }) => getValue() ?? "—" },
      { accessorKey: "managerName", header: "Manager", cell: ({ getValue }) => getValue() ?? "—" },
      { accessorKey: "hireDate", header: "Hire date", cell: ({ getValue }) => getValue() ?? "—" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const s = String(getValue());
          return <StatusBadge status={s} />;
        },
      },
    ];
    if (showSalary) {
      cols.push({
        accessorKey: "salary",
        header: "Salary",
        cell: ({ getValue }) => {
          const v = getValue<number | null>();
          return v == null ? "—" : usd.format(v);
        },
      });
    }
    return cols;
  }, [showSalary]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead
                  key={h.id}
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={h.column.getToggleSortingHandler()}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? ""}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                No employees match these filters.
              </TableCell>
            </TableRow>
          )}
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="whitespace-nowrap">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
