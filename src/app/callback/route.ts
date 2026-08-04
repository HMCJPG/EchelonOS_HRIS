import { NextResponse, type NextRequest } from "next/server";

// Lazy import so building/running without WorkOS env (dev-auth mode) never
// evaluates the SDK.
export async function GET(req: NextRequest) {
  if (!process.env.WORKOS_API_KEY) return NextResponse.redirect(new URL("/dev-login", req.url));
  const { handleAuth } = await import("@workos-inc/authkit-nextjs");
  return handleAuth()(req);
}
