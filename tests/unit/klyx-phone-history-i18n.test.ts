import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

describe("KLYX phone access history i18n contract", () => {
  it("localizes rendered history from stable server codes without refetching on locale changes", () => {
    const source = read("app/settings/PhoneAccessHistory.tsx");

    expect(source).toContain("KLYX_PHONE_ACCESS_HISTORY_I18N_16_08");
    expect(source).toContain("useKlyxLocale");
    expect(source).toContain("translateKlyxPhoneHistoryEvent");
    expect(source).toContain("translateKlyxPhoneHistoryService");
    expect(source).toContain("translateKlyxPhoneHistoryStatus");
    expect(source).toContain("formatKlyxPhoneHistoryDate");
    expect(source).not.toContain("{item.eventLabel}");
    expect(source).toMatch(/const loadHistory = useCallback\([\s\S]*\}, \[\]\);/);
  });

  it("keeps access history read-only and behind its existing GET boundary", () => {
    const source = read("app/settings/PhoneAccessHistory.tsx");

    expect(source).toContain('fetch("/api/profile/phone/access-history"');
    expect(source).toContain('cache: "no-store"');
    expect(source).not.toMatch(/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/);
    expect(source).not.toMatch(/result\.error\s*\|\|/);
  });

  it("keeps the server query scoped to the active contact profile and latest 30 logs", () => {
    const core = read(
      "app/api/profile/phone/access-history/phone-access-history-route-core.ts"
    );

    expect(core).toContain('.eq("contact_profile_id", profile.id)');
    expect(core).toContain('.order("created_at", {');
    expect(core).toContain('.limit(30)');
    expect(core).toContain("eventType: log.event_type");
    expect(core).toContain("bookingStatus:");
    expect(core).toContain("serviceSlug:");
  });

  it("keeps unexpected access-history 5xx responses behind the secure wrapper", () => {
    const wrapper = read("app/api/profile/phone/access-history/route.ts");

    expect(wrapper).toContain("secureApiErrorResponse");
    expect(wrapper).toMatch(/response\.status\s*<\s*500/);
  });
});
