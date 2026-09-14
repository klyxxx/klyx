import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = { selectedProfileId: "profile-client" };
  const getUser = vi.fn();
  const createClient = vi.fn(() => ({ auth: { getUser } }));

  const profileOrder = vi.fn();
  const profileEq = vi.fn(() => ({ order: profileOrder }));
  const profileSelect = vi.fn(() => ({ eq: profileEq }));

  const accountMaybeSingle = vi.fn();
  const accountEq = vi.fn(() => ({ maybeSingle: accountMaybeSingle }));
  const accountSelect = vi.fn(() => ({ eq: accountEq }));

  const capabilityEq = vi.fn();
  const capabilitySelect = vi.fn(() => ({ eq: capabilityEq }));

  const from = vi.fn((table: string) => {
    if (table === "profiles") return { select: profileSelect };
    if (table === "accounts") return { select: accountSelect };
    if (table === "account_actor_capabilities") {
      return { select: capabilitySelect };
    }
    throw new Error(`Unexpected table in test: ${table}`);
  });

  return {
    state,
    getUser,
    createClient,
    profileOrder,
    accountMaybeSingle,
    accountEq,
    capabilityEq,
    from,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "klyx_active_profile"
        ? { value: mocks.state.selectedProfileId }
        : undefined,
  })),
}));
vi.mock("@/lib/active-profile", () => ({
  ACTIVE_PROFILE_COOKIE: "klyx_active_profile",
}));
vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: { from: mocks.from },
}));

import {
  getAuthenticatedAccount,
  getAuthenticatedProfile,
  requireAccountCapability,
  requireAccountType,
} from "@/lib/api-auth";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const ACCOUNT_ID = "10000000-0000-4000-8000-000000000001";

function request(path = "/api/test", method = "GET") {
  return new Request(`https://www.klyx.be${path}`, {
    method,
    headers: { authorization: "Bearer test-token" },
  });
}

function profile(id: string, accountType: "client" | "provider") {
  return {
    id,
    owner_user_id: USER_ID,
    account_id: ACCOUNT_ID,
    account_type: accountType,
    first_name: "KLYX",
    last_name: "User",
    country_code: "BE",
    currency_code: "EUR",
  };
}

describe("KLYX canonical account capability authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

    mocks.state.selectedProfileId = "profile-client";
    mocks.getUser.mockResolvedValue({
      data: { user: { id: USER_ID, email: "owner@example.com" } },
      error: null,
    });
    mocks.profileOrder.mockResolvedValue({
      data: [
        profile("profile-client", "client"),
        profile("profile-provider", "provider"),
      ],
      error: null,
    });
    mocks.accountMaybeSingle.mockResolvedValue({
      data: { id: ACCOUNT_ID, auth_user_id: USER_ID },
      error: null,
    });
    mocks.capabilityEq.mockResolvedValue({
      data: [
        { account_id: ACCOUNT_ID, capability: "request_services", enabled: true },
        { account_id: ACCOUNT_ID, capability: "offer_services", enabled: true },
      ],
      error: null,
    });
  });

  it("keeps one account and one capability set across legacy profile switches", async () => {
    const first = await getAuthenticatedAccount(request());
    mocks.state.selectedProfileId = "profile-provider";
    const second = await getAuthenticatedAccount(request());

    expect(first.account.id).toBe(ACCOUNT_ID);
    expect(second.account.id).toBe(ACCOUNT_ID);
    expect(first.profile.id).toBe("profile-client");
    expect(second.profile.id).toBe("profile-provider");
    expect(first.profile.canRequestServices).toBe(true);
    expect(first.profile.canOfferServices).toBe(true);
    expect(second.profile.canRequestServices).toBe(true);
    expect(second.profile.canOfferServices).toBe(true);
  });

  it("routes market mutations through request compatibility without switching canonical identity", async () => {
    mocks.state.selectedProfileId = "profile-provider";

    const post = await getAuthenticatedAccount(
      request("/api/market/requests", "POST")
    );
    const patch = await getAuthenticatedAccount(
      request("/api/market/requests", "PATCH")
    );

    expect(post.account.id).toBe(ACCOUNT_ID);
    expect(patch.account.id).toBe(ACCOUNT_ID);
    expect(post.profile.id).toBe("profile-client");
    expect(patch.profile.id).toBe("profile-client");
    expect(post.profile.accountType).toBe("client");
    expect(patch.profile.accountType).toBe("client");
    expect(post.profile.canRequestServices).toBe(true);
    expect(post.profile.canOfferServices).toBe(true);
  });

  it("projects provider API compatibility mode from offer_services even without a legacy provider profile", async () => {
    mocks.profileOrder.mockResolvedValue({
      data: [profile("profile-client", "client")],
      error: null,
    });

    const context = await getAuthenticatedAccount(
      request("/api/provider/studio")
    );

    expect(context.account.id).toBe(ACCOUNT_ID);
    expect(context.profile.id).toBe("profile-client");
    expect(context.profile.legacyAccountType).toBe("client");
    expect(context.profile.accountType).toBe("provider");
    expect(context.profile.canOfferServices).toBe(true);
  });

  it("fails legacy provider-role checks closed when offer_services is disabled", async () => {
    mocks.profileOrder.mockResolvedValue({
      data: [profile("profile-provider", "provider")],
      error: null,
    });
    mocks.capabilityEq.mockResolvedValue({
      data: [
        { account_id: ACCOUNT_ID, capability: "request_services", enabled: true },
        { account_id: ACCOUNT_ID, capability: "offer_services", enabled: false },
      ],
      error: null,
    });

    const context = await getAuthenticatedAccount(
      request("/api/provider/studio")
    );

    expect(context.profile.legacyAccountType).toBe("provider");
    expect(context.profile.accountType).toBe("client");
    expect(context.profile.canOfferServices).toBe(false);
    expect(() => requireAccountType(context.profile, "provider")).toThrow(
      "Cette action nécessite un profil prestataire."
    );
  });

  it("makes legacy role guards read canonical account capabilities", async () => {
    const { profile: activeProfile } = await getAuthenticatedProfile(request());

    expect(activeProfile.legacyAccountType).toBe("client");
    expect(() => requireAccountType(activeProfile, "client")).not.toThrow();
    expect(() => requireAccountType(activeProfile, "provider")).not.toThrow();
  });

  it("supports extensible account capability checks", async () => {
    mocks.capabilityEq.mockResolvedValue({
      data: [
        { account_id: ACCOUNT_ID, capability: "request_services", enabled: true },
        { account_id: ACCOUNT_ID, capability: "service.review", enabled: true },
      ],
      error: null,
    });

    const { account } = await getAuthenticatedAccount(request());
    expect(() => requireAccountCapability(account, "service.review")).not.toThrow();
    expect(() => requireAccountCapability(account, "missing")).toThrow(
      "KLYX_ACCOUNT_CAPABILITY_REQUIRED:missing"
    );
  });

  it("fails closed on account/profile identity mismatch", async () => {
    mocks.profileOrder.mockResolvedValue({
      data: [
        {
          ...profile("profile-client", "client"),
          account_id: "10000000-0000-4000-8000-000000000099",
        },
      ],
      error: null,
    });

    await expect(getAuthenticatedAccount(request())).rejects.toThrow(
      "KLYX_PROFILE_ACCOUNT_OWNER_MISMATCH"
    );
  });

  it("uses legacy capability fallback only if the account capability table is unavailable", async () => {
    mocks.capabilityEq.mockResolvedValue({
      data: null,
      error: {
        code: "42P01",
        message: "account_actor_capabilities does not exist",
      },
    });

    const context = await getAuthenticatedAccount(request());
    expect(context.account.capabilitySource).toBe("legacy_fallback");
    expect(context.account.canRequestServices).toBe(true);
    expect(context.account.canOfferServices).toBe(true);
  });
});
