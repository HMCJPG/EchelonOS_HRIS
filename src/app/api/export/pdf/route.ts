import { createElement, type ReactElement } from "react";
import type { NextRequest } from "next/server";
import type { DocumentProps } from "@react-pdf/renderer";
import { getExportData } from "../shared";
import { DirectoryPdf } from "./document";

export async function GET(req: NextRequest) {
  const data = await getExportData(req);
  if (data instanceof Response) return data;

  const { renderToBuffer } = await import("@react-pdf/renderer");
  const buffer = await renderToBuffer(
    createElement(DirectoryPdf, {
      rows: data.rows,
      generatedAt: new Date().toISOString().slice(0, 10),
    }) as unknown as ReactElement<DocumentProps>,
  );
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="employees.pdf"',
    },
  });
}
