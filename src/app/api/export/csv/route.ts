import type { NextRequest } from "next/server";
import Papa from "papaparse";
import { getExportData, rowToRecord } from "../shared";

export async function GET(req: NextRequest) {
  const data = await getExportData(req);
  if (data instanceof Response) return data;

  // Columns match the import template, so an export re-imports cleanly.
  const csv = Papa.unparse(data.rows.map(rowToRecord));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="employees.csv"',
    },
  });
}
