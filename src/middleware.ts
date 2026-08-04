import { NextResponse, type NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";

const PUBLIC = ["/login", "/dev-login", "/callback"];

// WorkOS AuthKit middleware when configured; otherwise a cookie-presence check
// for the local dev-auth mode. No DB access here (edge runtime).
export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  if (process.env.WORKOS_API_KEY && process.env.WORKOS_CLIENT_ID) {
    const { authkitMiddleware } = await import("@workos-inc/authkit-nextjs");
    return authkitMiddleware({
      middlewareAuth: { enabled: true, unauthenticatedPaths: PUBLIC },
    })(req, event);
  }

  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (!req.cookies.get("hris_dev_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/dev-login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|css|js)$).*)"],
};
