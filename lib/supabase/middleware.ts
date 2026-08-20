import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = [
  "/accounts",
  "/book",
  "/bookings",
  "/brain",
  "/connect",
  "/create-store",
  "/dashboard",
  "/favorites",
  "/memory",
  "/messages",
  "/notifications",
  "/payment",
  "/profile",
  "/projects",
  "/request",
  "/reviews",
  "/scores",
  "/settings",
  "/tracking",
];

const authenticationRoutes = [
  "/login",
  "/signup",
  "/reset-password",
];

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isProtectedRoute(pathname: string) {
  return protectedRoutes.some((route) =>
    matchesRoute(pathname, route)
  );
}

function isAuthenticationRoute(pathname: string) {
  return authenticationRoutes.some((route) =>
    matchesRoute(pathname, route)
  );
}

function redirectToLogin(request: NextRequest) {
  const redirectTarget = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const loginUrl = request.nextUrl.clone();

  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("redirect", redirectTarget);

  return NextResponse.redirect(loginUrl);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const pathname = request.nextUrl.pathname;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    if (isProtectedRoute(pathname)) {
      return redirectToLogin(request);
    }

    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(name, value, options);
            }
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedRoute(pathname)) {
    return redirectToLogin(request);
  }

  if (user && isAuthenticationRoute(pathname)) {
    const dashboardUrl = request.nextUrl.clone();

    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";

    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}
