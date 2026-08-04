import { NextResponse, type NextRequest } from "next/server";
import { DEV_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (process.env.WORKOS_API_KEY) {
    const { signOut } = await import("@workos-inc/authkit-nextjs");
    await signOut({ returnTo: "/login" });
    return NextResponse.redirect(new URL("/login", req.url)); // signOut normally redirects itself
  }
  const res = NextResponse.redirect(new URL("/dev-login", req.url));
  res.cookies.delete(DEV_COOKIE);
  return res;
}
