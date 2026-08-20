export const KLYX_PROTECTED_ROUTES = [
  "/accounts",
  "/admin",
  "/agent",
  "/ai-status",
  "/assistant",
  "/book",
  "/booking-groups",
  "/bookings",
  "/brain",
  "/connect",
  "/create-store",
  "/dashboard",
  "/favorites",
  "/founder",
  "/memory",
  "/messages",
  "/notifications",
  "/onboarding",
  "/payment",
  "/profile",
  "/projects",
  "/provider",
  "/quotes",
  "/request",
  "/requests",
  "/reviews",
  "/scores",
  "/security",
  "/settings",
  "/tracking",
  "/trust",
] as const;

export const KLYX_AUTHENTICATION_ROUTES = [
  "/login",
  "/signup",
  "/reset-password",
] as const;

export function matchesKlyxRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isKlyxProtectedRoute(pathname: string) {
  return KLYX_PROTECTED_ROUTES.some((route) =>
    matchesKlyxRoute(pathname, route)
  );
}

export function isKlyxAuthenticationRoute(pathname: string) {
  return KLYX_AUTHENTICATION_ROUTES.some((route) =>
    matchesKlyxRoute(pathname, route)
  );
}
