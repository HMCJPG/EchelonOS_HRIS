import type { NextRequest } from "next/server";
import { getExportData, rowToRecord, EXPORT_COLUMNS } from "../shared";

export async function GET(req: NextRequest) {
  const data = await getExportData(req);
  if (data instanceof Response) return data;

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Employees");
  ws.columns = EXPORT_COLUMNS.map((c) => ({ header: c.header, key: c.header, width: 18 }));
  ws.getRow(1).font = { bold: true };
  for (const row of data.rows) ws.addRow(rowToRecord(row));
  ws.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + EXPORT_COLUMNS.length)}1` };

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="employees.xlsx"',
    },
  });
}
