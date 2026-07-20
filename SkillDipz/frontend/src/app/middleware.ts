import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/", "/login", "/register", "/onboarding", "/verify-otp"];
const STUDENT_ROUTES = ["/student"];
const COMPANY_ROUTES = ["/company"];

export function middleware(req: NextRequest) {
  const token = req.cookies.get("accessToken")?.value;
  const role = req.cookies.get("userRole")?.value;
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  // Not logged in — block protected routes
  if (!token && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // logged in - block auth pages
  if (token && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL(getRedirectPath(role || ""), req.url));
  }

  // Role-based guards
  if (token && pathname.startsWith("/student") && role !== "STUDENT") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (token && pathname.startsWith("/company") && role !== "COMPANY") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

function getRedirectPath(role: string) {
  if (role === "STUDENT") return "/student/overview";
  if (role === "COMPANY") return "/company/dashboard";
  return "/";
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
