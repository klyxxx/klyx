import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX search recovery i18n contract", () => {
  it("uses the shared locale while keeping recovery navigation explicit", () => {
    const component = read("app/search/SearchRecovery.tsx");

    expect(component).toContain("KLYX_SEARCH_RECOVERY_I18N");
    expect(component).toContain("useKlyxLocale");
    expect(component).toContain("buildSearchRecoverySuggestions(filters, result, locale)");
    expect(component).toContain("href={recoveryHref(suggestion.nextFilters)}");
    expect(component).toContain("scroll={false}");
    expect(component).not.toContain("KLYX peut adapter la recherche");
    expect(component).not.toContain("Rien n’est modifié automatiquement");
    expect(component).not.toContain("fetch(");
    expect(component).not.toContain("supabase");
  });

  it("keeps locale optional and limits suggestions exactly as before", () => {
    const helper = read("lib/search-recovery.ts");

    expect(helper).toContain('locale: KlyxLocale = "fr"');
    expect(helper).toContain("second.priority - first.priority");
    expect(helper).toContain(".slice(0, 5)");
    expect(helper).toContain('id: "raise_budget"');
    expect(helper).toContain("priority: 100");
    expect(helper).toContain('id: "remove_time"');
    expect(helper).toContain("priority: 95");
    expect(helper).toContain('id: "show_all"');
    expect(helper).toContain("priority: 20");
  });

  it("preserves the exact filter recovery mutations and href query keys", () => {
    const helper = read("lib/search-recovery.ts");

    expect(helper).toContain('next.budget = "";');
    expect(helper).toContain('next.startTime = "";');
    expect(helper).toContain('next.endTime = "";');
    expect(helper).toContain('next.date = "";');
    expect(helper).toContain('next.pricing = "all";');
    expect(helper).toContain('next.city = "";');
    expect(helper).toContain('params.set("service", filters.service)');
    expect(helper).toContain('params.set("city", filters.city.trim())');
    expect(helper).toContain('params.set("start", filters.startTime)');
    expect(helper).toContain('params.set("end", filters.endTime)');
    expect(helper).toContain('params.set("budget", filters.budget)');
    expect(helper).toContain('params.set("pricing", filters.pricing)');
    expect(helper).toContain('params.set("sort", filters.sort)');
  });

  it("keeps recovery free of automatic network or financial actions", () => {
    const component = read("app/search/SearchRecovery.tsx");
    const helper = read("lib/search-recovery.ts");
    const combined = `${component}\n${helper}`.toLowerCase();

    expect(combined).not.toContain("setinterval(");
    expect(combined).not.toContain("settimeout(");
    expect(combined).not.toContain("stripe");
    expect(combined).not.toContain("payment_intent");
    expect(combined).not.toContain('method: "post"');
    expect(combined).not.toContain('method: "patch"');
    expect(combined).not.toContain('method: "delete"');
  });
});
