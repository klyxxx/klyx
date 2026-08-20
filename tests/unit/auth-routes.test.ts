import { describe, expect, it } from "vitest";
import {
  KLYX_PROTECTED_ROUTES,
  isKlyxAuthenticationRoute,
  isKlyxProtectedRoute,
} from "@/lib/auth-routes";

describe("KLYX route classification", () => {
  it("keeps every audited account surface behind authentication", () => {
    const expected = [
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
      "/coverage",
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
    ];

    expect([...KLYX_PROTECTED_ROUTES]).toEqual(expected);
  });

  it("protects nested private routes", () => {
    expect(isKlyxProtectedRoute("/provider/jobs")).toBe(true);
    expect(isKlyxProtectedRoute("/booking-groups/example")).toBe(true);
    expect(isKlyxProtectedRoute("/admin/disputes")).toBe(true);
    expect(isKlyxProtectedRoute("/founder/cleanup")).toBe(true);
    expect(isKlyxProtectedRoute("/coverage")).toBe(true);
  });

  it("does not confuse public discovery and support routes with private prefixes", () => {
    expect(isKlyxProtectedRoute("/providers")).toBe(false);
    expect(isKlyxProtectedRoute("/recommendations")).toBe(false);
    expect(isKlyxProtectedRoute("/search")).toBe(false);
    expect(isKlyxProtectedRoute("/support")).toBe(false);
    expect(isKlyxProtectedRoute("/delete-account")).toBe(false);
  });

  it("classifies only authentication screens as authentication routes", () => {
    expect(isKlyxAuthenticationRoute("/login")).toBe(true);
    expect(isKlyxAuthenticationRoute("/signup/provider")).toBe(true);
    expect(isKlyxAuthenticationRoute("/reset-password")).toBe(true);
    expect(isKlyxAuthenticationRoute("/dashboard")).toBe(false);
  });
});
