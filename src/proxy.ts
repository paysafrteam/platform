import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate only: it checks that a session cookie EXISTS. Real validation happens in the layouts and in every API route.
const SELLER_PREFIXES = ["/dashboard", "/orders", "/invoices", "/receipts", "/income", "/trust", "/payout-account", "/notifications", "/settings"];
const has = (req: NextRequest, name: string) => req.cookies.has(name) || req.cookies.has(`__Host-${name}`);

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") && pathname !== "/admin/sign-in") {
    if (!has(req, "ps_admin")) return NextResponse.redirect(new URL("/admin/sign-in", req.url));
  } else if (SELLER_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!has(req, "ps_session")) {
      const url = new URL("/sign-in", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/orders/:path*", "/invoices/:path*", "/receipts/:path*", "/income/:path*", "/trust/:path*", "/payout-account/:path*", "/notifications/:path*", "/settings/:path*", "/admin/:path*"],
};
