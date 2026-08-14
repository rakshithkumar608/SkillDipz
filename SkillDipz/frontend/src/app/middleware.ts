import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/", "/login", "/register", "/onboarding", "/verify-otp"];

// const STUDENT_ROUTES = ["/student"];
// const COMPANY_ROUTES = ["/company"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow public routes through
  const isPublic = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r+"/")
  );
  if(isPublic) return NextResponse.next();

  
  // Read the role cookie written by auth.ts on login
  const role = req.cookies.get("sd_role")?.value;
  const isLoggedIn = !!role;

  // Not logged in — block protected routes
  if(!isLoggedIn) {
    if(
      pathname.startsWith("/student") ||
      pathname.startsWith("/company")
    ) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  // Logged in - redirect away from login/register
  if(pathname === "/login" || pathname === "/register") {
    return NextResponse.redirect(
      new URL(getRedirectPath(role), req.url)
    );
  } 

  // Role baesd guard: STUDENT cannot visit / company, COMPANY cannot visit/ student
  if (pathname.startsWith("/student")&& role !== "STUDENT") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if(pathname.startsWith("/company") && role !== "COMPANY") {
    return NextResponse.redirect(new URL("/login", req.url));  
  }

  return NextResponse.next();
}


function getRedirectPath(role: string): string {
  if (role === "STUDENT") return "/student/overview";
  if (role === "COMPANY") return "/company/dashboard";
  return "/";
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
