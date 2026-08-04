import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  if (!process.env.WORKOS_API_KEY) return NextResponse.redirect(new URL("/dev-login", req.url));
  const { getSignInUrl } = await import("@workos-inc/authkit-nextjs");
  return NextResponse.redirect(await getSignInUrl());
}
