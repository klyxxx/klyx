import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    selectedProfileId: "profile-client",
  };

  const getUser = vi.fn();
  const createClient = vi.fn(() => ({
    auth: {
      getUser,
    },
  }));

  const profileOrder = vi.fn();
  const profileEq = vi.fn(() => ({
    order: profileOrder,
  }));
  const profileSelect = vi.fn(() => ({
    eq: profileEq,
  }));

  const accountMaybeSingle = vi.fn();
  const accountEq = vi.fn(() => ({
    maybeSingle: accountMaybeSingle,
  }));
  const accountSelect = vi.fn(() => ({
    eq: accountEq,
  }));

  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: profileSelect,
      };
    }

    if (table === "accounts") {
      return {
        select: accountSelect,
      };
    }

    throw new Error(`Unexpected table in test: ${table}`);
  });

  return {
    state,
    getUser,
    createClient,
    profileOrder,
    profileEq,
    profileSelect,
    accountMaybeSingle,
    accountEq,
    accountSelect,
    from,
  };
});

vi.mock("server-only", () => ({}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

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
  supabaseAdmin: {
    from: mocks.from,
  },
}));

import {
  apiErrorStatus,
  getAuthenticatedAccount,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const ACCOUNT_ID = "10000000-0000-4000-8000-000000000001";

function request() {
  return new Request("https://www.klyx.be/api/test", {
    headers: {
      authorization: "Bearer test-token",
    },
  });
}

function profile(id: string, accountType: "client" | "provider") {
  return {
    id,
    owner_user_id: USER_ID,
    account_type: accountType,
    first_name: accountType === "client" ? "Mohamed" : "Youssouf",
    last_name: "KLYX",
    country_code: "BE",
    currency_code: "EUR",
  };
}

describe("KLYX authenticated account compatibility adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";

    mocks.state.selectedProfileId = "profile-client";
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: "owner@example.com",
        },
      },
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
      data: {
        id: ACCOUNT_ID,
        auth_user_id: USER_ID,
      },
      error: null,
    });
  });

  it("keeps the legacy authenticated-profile path account-independent", async () => {
    const result = await getAuthenticatedProfile(request());

    expect(result.profile.id).toBe("profile-client");
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(mocks.from).not.toHaveBeenCalledWith("accounts");
  });

  it("returns the same canonical account when the active profile switches", async () => {
    const clientContext = await getAuthenticatedAccount(request());

    mocks.state.selectedProfileId = "profile-provider";
    const providerContext = await getAuthenticatedAccount(request());

    expect(clientContext.profile.id).toBe("profile-client");
    expect(providerContext.profile.id).toBe("profile-provider");
    expect(clientContext.account).toEqual({
      id: ACCOUNT_ID,
      authUserId: USER_ID,
    });
    expect(providerContext.account).toEqual(clientContext.account);
    expect(mocks.accountEq).toHaveBeenNthCalledWith(1, "auth_user_id", USER_ID);
    expect(mocks.accountEq).toHaveBeenNthCalledWith(2, "auth_user_id", USER_ID);
  });

  it("never accepts an account belonging to another authenticated user", async () => {
    mocks.accountMaybeSingle.mockResolvedValue({
      data: {
        id: "10000000-0000-4000-8000-000000000002",
        auth_user_id: "00000000-0000-4000-8000-000000000002",
      },
      error: null,
    });

    await expect(getAuthenticatedAccount(request())).rejects.toThrow(
      "Compte KLYX introuvable."
    );
    expect(mocks.accountEq).toHaveBeenCalledWith("auth_user_id", USER_ID);
  });

  it("fails closed when the canonical account is absent", async () => {
    mocks.accountMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(getAuthenticatedAccount(request())).rejects.toThrow(
      "Compte KLYX introuvable."
    );
  });

  it("preserves legacy role authorization and API status behavior", () => {
    expect(() =>
      requireAccountType(
        {
          id: "profile-client",
          ownerUserId: USER_ID,
          accountType: "client",
          firstName: "Mohamed",
          lastName: "KLYX",
          countryCode: "BE",
          currencyCode: "EUR",
        },
        "provider"
      )
    ).toThrow("Cette action nécessite un profil prestataire.");

    expect(apiErrorStatus("Session manquante.")).toBe(401);
    expect(apiErrorStatus("Profil KLYX introuvable.")).toBe(403);
    expect(apiErrorStatus("Compte KLYX introuvable.")).toBe(500);
  });
});
