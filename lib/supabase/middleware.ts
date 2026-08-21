import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  API_RATE_LIMIT_POLICIES,
  apiRateLimitExceededResponse,
  consumeApiRateLimit,
  rateLimitResponseHeaders,
  type ApiRateLimitPolicy,
} from "@/lib/api-rate-limit";
import {
  isKlyxAuthenticationRoute,
  isKlyxProtectedRoute,
} from "@/lib/auth-routes";

function redirectToLogin(request: NextRequest) {
  const redirectTarget = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const loginUrl = request.nextUrl.clone();

  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("redirect", redirectTarget);

  return NextResponse.redirect(loginUrl);
}

function authenticatedApiRateLimitPolicy(
  request: NextRequest
): ApiRateLimitPolicy | null {
  const pathname = request.nextUrl.pathname;

  if (
    request.method === "POST" &&
    pathname === "/api/quotes"
  ) {
    return API_RATE_LIMIT_POLICIES.quoteCreate;
  }

  if (
    request.method === "PATCH" &&
    pathname === "/api/quotes"
  ) {
    return API_RATE_LIMIT_POLICIES.quoteMutation;
  }

  if (
    request.method === "POST" &&
    pathname === "/api/stripe/create-checkout-session"
  ) {
    return API_RATE_LIMIT_POLICIES.stripeCheckoutCreate;
  }

  if (
    request.method === "POST" &&
    pathname === "/api/stripe/create-group-checkout-session"
  ) {
    return API_RATE_LIMIT_POLICIES.stripeGroupCheckoutCreate;
  }

  if (
    request.method === "POST" &&
    pathname === "/api/stripe/connect/create-account"
  ) {
    return API_RATE_LIMIT_POLICIES.stripeConnectOnboarding;
  }

  if (
    request.method === "GET" &&
    pathname === "/api/stripe/connect/status"
  ) {
    return API_RATE_LIMIT_POLICIES.stripeConnectStatus;
  }

  return null;
}

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }

  return target;
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
    if (isKlyxProtectedRoute(pathname)) {
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

  if (user) {
    const policy = authenticatedApiRateLimitPolicy(request);

    if (policy) {
      try {
        const rateLimit = await consumeApiRateLimit(user.id, policy);

        if (!rateLimit.allowed) {
          return copyResponseCookies(
            response,
            apiRateLimitExceededResponse(policy, rateLimit)
          );
        }

        for (const [name, value] of Object.entries(
          rateLimitResponseHeaders(policy, rateLimit)
        )) {
          response.headers.set(name, value);
        }
      } catch {
        const unavailable = NextResponse.json(
          {
            error: "Protection anti-abus temporairement indisponible.",
            code: "KLYX_RATE_LIMIT_UNAVAILABLE",
          },
          {
            status: 503,
            headers: {
              "Retry-After": "5",
            },
          }
        );

        return copyResponseCookies(response, unavailable);
      }
    }
  }

  if (!user && isKlyxProtectedRoute(pathname)) {
    return redirectToLogin(request);
  }

  if (user && isKlyxAuthenticationRoute(pathname)) {
    const dashboardUrl = request.nextUrl.clone();

    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";

    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}
