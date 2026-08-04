"use client";

import * as React from "react";
import { toast } from "sonner";
import { importEmployeesAction, type ImportResult } from "@/actions/import";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Normalize a header like "Manager Email" / "manager_email" → "manageremail". */
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const HEADER_MAP: Record<string, string> = {
  email: "email",
  firstname: "firstName",
  lastname: "lastName",
  title: "title",
  jobtitle: "title",
  department: "department",
  dept: "department",
  phone: "phone",
  location: "location",
  hiredate: "hireDate",
  status: "status",
  manager: "managerEmail",
  manageremail: "managerEmail",
  salary: "salary",
};

function remapRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const mapped = HEADER_MAP[normalizeHeader(k)];
    if (mapped) out[mapped] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

function dateToIso(v: unknown): unknown {
  return v instanceof Date ? v.toISOString().slice(0, 10) : v;
}

const TEMPLATE =
  "email,firstName,lastName,title,department,phone,location,hireDate,status,managerEmail,salary\n" +
  "jane@acme.com,Jane,Smith,CEO,Executive,555-0100,NYC,2020-01-15,active,,250000\n" +
  "bob@acme.com,Bob,Jones,Engineer,Engineering,555-0101,Remote,2021-06-01,active,jane@acme.com,140000\n";

export function ImportWizard() {
  const [rows, setRows] = React.useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = React.useState("");
  const [preview, setPreview] = React.useState<ImportResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<ImportResult | null>(null);

  async function parseFile(file: File) {
    setBusy(true);
    setPreview(null);
    setDone(null);
    try {
      let parsed: Record<string, unknown>[] = [];
      if (file.name.toLowerCase().endsWith(".csv")) {
        const Papa = (await import("papaparse")).default;
        const text = await file.text();
        const res = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
        parsed = res.data;
      } else {
        const ExcelJS = (await import("exceljs")).default;
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await file.arrayBuffer());
        const ws = wb.worksheets[0];
        if (!ws) throw new Error("Workbook has no sheets.");
        const headers: string[] = [];
        ws.getRow(1).eachCell((cell, col) => (headers[col] = String(cell.value ?? "")));
        ws.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const obj: Record<string, unknown> = {};
          row.eachCell((cell, col) => {
            const header = headers[col];
            if (!header) return;
            let v: unknown = cell.value;
            if (v && typeof v === "object" && "result" in v) v = (v as { result: unknown }).result;
            if (v && typeof v === "object" && "text" in v) v = (v as { text: unknown }).text;
            obj[header] = v;
          });
          if (Object.keys(obj).length) parsed.push(obj);
        });
      }
      const remapped = parsed
        .map(remapRow)
        .map((r) => ({ ...r, hireDate: dateToIso(r.hireDate) }))
        .filter((r) => Object.values(r).some((v) => v !== "" && v != null));
      if (!remapped.length) throw new Error("No data rows found. Check the headers match the template.");
      setRows(remapped);
      setFileName(file.name);
      const res = await importEmployeesAction(remapped, false);
      setPreview(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse that file.");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    try {
      const res = await importEmployeesAction(rows, true);
      if (!res.ok) toast.error(res.error);
      else if (!res.committed) toast.error("Validation failed — fix the errors and re-upload.");
      else {
        toast.success(`Imported: ${res.create} created, ${res.update} updated.`);
        setDone(res);
        setPreview(null);
        setRows([]);
      }
      if (res.ok && !res.committed) setPreview(res);
    } finally {
      setBusy(false);
    }
  }

  const errByIndex = new Map(
    preview?.ok ? preview.rowErrors.map((e) => [e.index, e.message]) : [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) parseFile(f);
              e.target.value = "";
            }}
          />
          <span className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            {busy ? "Working…" : "Choose CSV or Excel file"}
          </span>
        </label>
        <a
          className="text-sm text-muted-foreground underline"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
          download="import-template.csv"
        >
          Download template CSV
        </a>
      </div>

      {done?.ok && done.committed && (
        <Alert>
          <AlertTitle>Import complete</AlertTitle>
          <AlertDescription>
            {done.create} employees created, {done.update} updated. The change is recorded in the
            audit log.
          </AlertDescription>
        </Alert>
      )}

      {preview && !preview.ok && (
        <Alert variant="destructive">
          <AlertDescription>{preview.error}</AlertDescription>
        </Alert>
      )}

      {preview?.ok && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">
              <span className="font-medium">{fileName}</span> — dry run:{" "}
              <Badge variant="default">{preview.create} create</Badge>{" "}
              <Badge variant="secondary">{preview.update} update</Badge>{" "}
              {preview.rowErrors.length > 0 && (
                <Badge variant="destructive">{preview.rowErrors.length} errors</Badge>
              )}
            </p>
            <Button
              size="sm"
              disabled={busy || preview.rowErrors.length > 0}
              onClick={commit}
            >
              {preview.rowErrors.length > 0 ? "Fix errors to import" : "Import all-or-nothing"}
            </Button>
          </div>

          <div className="max-h-[28rem] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  const err = errByIndex.get(i);
                  return (
                    <TableRow key={i} className={err ? "bg-destructive/10" : ""}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{String(r.email ?? "")}</TableCell>
                      <TableCell>
                        {String(r.firstName ?? "")} {String(r.lastName ?? "")}
                      </TableCell>
                      <TableCell>{String(r.managerEmail ?? "—")}</TableCell>
                      <TableCell>
                        {err ? (
                          <span className="text-sm text-destructive">{err}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">OK</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
