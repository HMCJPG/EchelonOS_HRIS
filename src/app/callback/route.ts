import { NextResponse, type NextRequest } from "next/server";

// Lazy import so building/running without WorkOS env (dev-auth mode) never
// evaluates the SDK.
export async function GET(req: NextRequest) {
  if (!process.env.WORKOS_API_KEY) return NextResponse.redirect(new URL("/dev-login", req.url));
  const { handleAuth } = await import("@workos-inc/authkit-nextjs");
  // On callback failure (spent one-time code from a double-hit/refresh, or a
  // PKCE cookie set on a different host) redirect into the app instead of
  // surfacing authkit's raw JSON error: an existing session lands inside,
  // otherwise the middleware restarts sign-in cleanly on this host.
  return handleAuth({
    onError: () => NextResponse.redirect(new URL("/", req.url)),
  })(req);
}
