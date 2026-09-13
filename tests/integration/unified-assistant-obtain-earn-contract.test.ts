import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
}

describe("KLYX unified obtain-or-earn assistant", () => {
  it("uses one canonical assistant home regardless of legacy account type", () => {
    const accountHome = read("lib/account-home.ts");
    const layout = read("app/assistant/layout.tsx");
    const page = read("app/assistant/page.tsx");
    const legacyProvider = read("app/provider/assistant/page.tsx");

    expect(accountHome).toContain('client: "/assistant"');
    expect(accountHome).toContain('provider: "/assistant"');
    expect(layout).not.toContain('profile.accountType !== "client"');
    expect(layout).not.toContain("getKlyxAccountHome");
    expect(page).toContain("<AssistantThread />");
    expect(page).not.toContain("ClientRouteGuard");
    expect(legacyProvider).toContain('redirect("/assistant")');
  });

  it("routes one conversation by intent instead of switching profile", () => {
    const converse = read("app/api/brain/converse/route.ts");
    const handler = read("app/api/brain/converse/unified-intent.ts");
    const command = read("app/api/brain/command/route.ts");

    expect(converse).toContain("classifyKlyxAssistantIntent");
    expect(converse).toContain("getKlyxConversationIntent");
    expect(converse).toContain("handleUnifiedAssistantIntent");
    expect(handler).toContain('intent.intent === "income_search"');
    expect(handler).toContain('intent.intent === "mission_management"');
    expect(handler).toContain('intent.intent === "information"');
    expect(command).toContain('mode: "new_request"');

    for (const source of [converse, handler, command]) {
      expect(source).not.toContain("switchAccount(");
      expect(source).not.toContain("/api/profiles/active");
    }
  });

  it("scopes legacy profile rows to one authenticated account without switching them", () => {
    const scope = read("lib/klyx-account-profile-scope.ts");
    const handler = read("app/api/brain/converse/unified-intent.ts");
    const income = read("lib/klyx-assistant-income-search.ts");

    expect(scope).toContain('.eq("owner_user_id", activeProfile.ownerUserId)');
    expect(scope).not.toContain("switchAccount(");
    expect(scope).not.toContain("ACTIVE_PROFILE_COOKIE");
    expect(handler).toContain("loadKlyxAccountProfiles(profile)");
    expect(handler).toContain("Promise.all(accountProfiles.map((item) => getBrainActions(item)))");
    expect(income).toContain("loadKlyxAccountProfiles(profile)");
    expect(income).toContain('.in("user_id", accountProfileIds)');
  });

  it("keeps income discovery capability-based, read-only and bounded to three options", () => {
    const income = read("lib/klyx-assistant-income-search.ts");

    expect(income).toContain('.eq("provider_enabled", true)');
    expect(income).toContain('.eq("status", "open")');
    expect(income).toContain("locationCompatible");
    expect(income).toContain("accountProfileIdSet.has(request.client_profile_id)");
    expect(income).toContain(".slice(0, 3)");
    expect(income).toContain("automaticExecutionAllowed: false");
    expect(income).not.toContain("requireAccountType");
    expect(income).not.toContain("market_service_offers\")\n      .insert");
  });

  it("allows the same authenticated account to obtain a service without permanent role gates", () => {
    for (const path of [
      "app/api/brain/respond/route.ts",
      "app/api/brain/confirm-request/route.ts",
      "app/api/brain/market-publish/route.ts",
    ]) {
      const source = read(path);
      expect(source).toContain("getAuthenticatedProfile");
      expect(source).not.toContain("requireAccountType");
    }

    const publish = read("app/api/brain/market-publish/route.ts");
    expect(publish).toContain("requireBrainMarketConfirmation");
    expect(publish).toContain("body.confirmed !== true");
  });

  it("manages existing missions by relationship in both directions", () => {
    const actions = read("lib/brain-actions.ts");
    const handler = read("app/api/brain/converse/unified-intent.ts");

    expect(actions).toContain('"parent_id.eq." +');
    expect(actions).toContain('",provider_id.eq." +');
    expect(actions).toContain('",babysitter_id.eq." +');
    expect(actions).toContain("booking.parent_id !== profile.id");
    expect(actions).toContain("booking.provider_id !== profile.id");
    expect(actions).toContain("booking.babysitter_id !== profile.id");
    expect(actions).toContain("addClientBookingActions(profile, bookings, actionMap)");
    expect(actions).toContain("addProviderActions(profile, bookings, actionMap)");
    expect(actions).not.toContain('profile.accountType === "client"');
    expect(handler).toContain("mergeAccountActions");
  });
});
