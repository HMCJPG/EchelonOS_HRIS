import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native/WASM/heavy server-only deps out of the webpack bundle.
  serverExternalPackages: ["@electric-sql/pglite", "@react-pdf/renderer", "exceljs", "ws"],
};

export default nextConfig;
