import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/onboarding",
  "/verify-otp",
  "/company/auth",
  "/mentor/login",
  "/mentor/register",
  "/mentors",
  "/admin",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow root (loading intro page), static assets, admin, company auth, and mentor auth
  if (
    pathname === "/" ||
    pathname.startsWith("/company/auth") ||
    pathname.startsWith("/admin") ||
    PUBLIC_ROUTES.some((r) => r !== "/" && (pathname === r || pathname.startsWith(r + "/")))
  ) {
    // If logged in and visiting login or register, redirect to respective portal
    const role = req.cookies.get("sd_role")?.value;
    if (
      role &&
      (pathname === "/login" ||
        pathname === "/register" ||
        pathname === "/mentor/login" ||
        pathname === "/mentor/register")
    ) {
      return NextResponse.redirect(new URL(getRedirectPath(role), req.url));
    }
    return NextResponse.next();
  }

  // Read the role cookie written on login
  const role = req.cookies.get("sd_role")?.value;
  const isLoggedIn = !!role;

  // Not logged in — block protected company, student, and mentor routes
  if (!isLoggedIn) {
    if (
      pathname.startsWith("/student") ||
      pathname.startsWith("/company") ||
      pathname.startsWith("/mentor")
    ) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  // Role based security guard:
  // STUDENT cannot access /company/* or /mentor/*
  // COMPANY cannot access /student/* or /mentor/*
  // MENTOR cannot access /student/* or /company/*
  if (pathname.startsWith("/student") && role !== "STUDENT") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (pathname.startsWith("/company") && role !== "COMPANY") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (
    pathname.startsWith("/mentor") &&
    role !== "MENTOR" &&
    role !== "INTERVIEWER" &&
    role !== "ADMIN"
  ) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

function getRedirectPath(role: string): string {
  if (role === "STUDENT") return "/student/overview";
  if (role === "COMPANY") return "/company/dashboard";
  if (role === "MENTOR" || role === "INTERVIEWER") return "/mentor/dashboard";
  return "/onboarding";
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images|lootie).*)"],
};

