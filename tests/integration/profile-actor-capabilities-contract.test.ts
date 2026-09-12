import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveProfileCapabilityState } from "@/lib/profile-actor-capabilities";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const migration = read(
  "supabase/migrations/20260912230000_klyx_profile_actor_capabilities.sql"
);
const activeProfile = read("lib/active-profile.ts");
const apiAuth = read("lib/api-auth.ts");
const accountSwitcher = read("lib/account-switcher.ts");
const capabilityRoute = read("app/api/profiles/capabilities/route.ts");
const assistantLayout = read("app/assistant/layout.tsx");
const providerLayout = read("app/provider/layout.tsx");
const riskRoute = read("app/api/security/risk/risk-route-core.ts");
const quotePreflight = read("lib/quote-transaction-qualification-preflight.ts");
const rollback = read("docs/migrations/profile-actor-capabilities-rollback.md");

describe("KLYX progressive profile actor capabilities", () => {
  it("supports request-only, offer-only and dual-capability profiles", () => {
    expect(
      resolveProfileCapabilityState("client", [
        {
          profile_id: "p1",
          capability: "request_services",
          enabled: true,
        },
        {
          profile_id: "p1",
          capability: "offer_services",
          enabled: true,
        },
      ])
    ).toEqual({
      canRequestServices: true,
      canOfferServices: true,
      capabilitySource: "capabilities",
    });

    expect(
      resolveProfileCapabilityState("provider", [
        {
          profile_id: "p2",
          capability: "request_services",
          enabled: true,
        },
        {
          profile_id: "p2",
          capability: "offer_services",
          enabled: false,
        },
      ])
    ).toEqual({
      canRequestServices: true,
      canOfferServices: false,
      capabilitySource: "capabilities",
    });
  });

  it("keeps the legacy discriminator as fallback only when capability rows are absent", () => {
    expect(resolveProfileCapabilityState("client", [])).toEqual({
      canRequestServices: true,
      canOfferServices: false,
      capabilitySource: "legacy",
    });
    expect(resolveProfileCapabilityState("provider", [])).toEqual({
      canRequestServices: false,
      canOfferServices: true,
      capabilitySource: "legacy",
    });

    expect(migration).toContain("when exists (");
    expect(migration).toContain(
      "from public.profile_actor_capabilities as actor_capability"
    );
    expect(migration).toContain("else coalesce(");
    expect(migration).toContain("nullif(profile.account_type, '')");
    expect(activeProfile).toContain("capabilitySource");
    expect(activeProfile).toContain("loadProfileCapabilityStates");
  });

  it("backfills legacy permissions with the same null-safe discriminator as runtime fallback", () => {
    expect(migration).toContain("nullif(profile.account_type, '')");
    expect(migration).toContain("nullif(profile.current_mode, '')");
    expect(migration).toContain("nullif(profile.role, '')");
    expect(migration).toContain("'client'\n  ) <> 'provider'");
    expect(migration).toContain("'client'\n  ) = 'provider'");
    expect(migration).toContain("'legacy_backfill'");
    expect(migration).toContain("on conflict (profile_id, capability) do nothing");
  });

  it("keeps capability writes server-side, owner reads under RLS, and the security audit authoritative", () => {
    expect(migration).toContain(
      "alter table public.profile_actor_capabilities enable row level security;"
    );
    expect(migration).toContain(
      "revoke all privileges on table public.profile_actor_capabilities\n  from public, anon, authenticated;"
    );
    expect(migration).toContain(
      "grant select on table public.profile_actor_capabilities\n  to authenticated;"
    );
    expect(migration).toContain(
      "using (public.klyx_owns_profile(profile_id));"
    );
    expect(migration).toContain(
      "create or replace function public.klyx_security_audit()"
    );
    expect(migration).toContain("'profile_actor_capabilities'");
    expect(capabilityRoute).toContain('.eq("owner_user_id", user.id)');
    expect(capabilityRoute).toContain("writeProfileCapabilityState");
  });

  it("moves provider discovery to offer_services without bypassing publication or skill verification", () => {
    expect(migration).toContain(
      "public.klyx_profile_has_capability(p_profile_id, 'offer_services')"
    );
    expect(migration).toContain("provider_profile.is_published = true");
    expect(migration).toContain("verification.status = 'approved'");
    expect(migration).toContain("user_service.provider_enabled = true");
    expect(migration).toContain("service_profile.available = true");
  });

  it("keeps the stored legacy discriminator readable while compatibility shims route dual profiles by capability", () => {
    expect(activeProfile).toContain("legacyAccountType: AccountType");
    expect(activeProfile).toContain("capabilityState.canOfferServices");
    expect(activeProfile).toContain("capabilityState.canRequestServices");
    expect(apiAuth).toContain("compatibilityAccountTypeForRequest");
    expect(apiAuth).toContain('pathname.startsWith("/api/provider/")');
    expect(apiAuth).toContain("canOfferServices");
    expect(apiAuth).toContain("canRequestServices");
    expect(accountSwitcher).toContain("projectAccountTypeForCurrentSurface");
    expect(accountSwitcher).toContain('window.location.pathname.startsWith("/provider")');
    expect(assistantLayout).toContain("!profile.canRequestServices");
    expect(providerLayout).toContain("!profile.canOfferServices");
  });

  it("keeps dual profiles under provider risk and payment qualification controls", () => {
    expect(riskRoute).toContain(
      "profile.canRequestServices && profile.canOfferServices"
    );
    expect(riskRoute).toContain("isProvider: profile.canOfferServices");
    expect(riskRoute).toContain("!profile.canOfferServices ||");
    expect(quotePreflight).toContain("!profile.canOfferServices");
    expect(quotePreflight).toContain("!profile.canRequestServices");
    expect(quotePreflight).toContain(
      "lifecycleQuote.provider_profile_id !== profile.id"
    );
    expect(quotePreflight).toContain(
      "lifecycleQuote.client_profile_id !== profile.id"
    );
    expect(quotePreflight).toContain("isUserServiceTransactionEligible");
  });

  it("does not destructively modify legacy roles, bookings or payment identity", () => {
    expect(migration).not.toMatch(/drop\s+table\s+public\.profiles/i);
    expect(migration).not.toMatch(
      /drop\s+column\s+(role|current_mode|account_type)/i
    );
    expect(migration).not.toMatch(/alter\s+table\s+public\.bookings/i);
    expect(migration).not.toMatch(/update\s+public\.bookings/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.bookings/i);
    expect(migration).not.toMatch(
      /update\s+public\.profiles\s+set\s+stripe_/i
    );
    expect(migration).toContain("Do not drop while consumers remain");
  });

  it("documents a non-destructive rollback before legacy columns can ever be removed", () => {
    expect(rollback).toContain("Do **not** drop `profiles.role`");
    expect(rollback).toContain(
      "Keep `profile_actor_capabilities` and its rows in place"
    );
    expect(rollback).toContain("Do not alter any booking/payment table");
    expect(rollback).toContain(
      "The legacy discriminator cannot represent both"
    );
  });
});
