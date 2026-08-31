import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX search compatibility contract", () => {
  it("routes legacy search URLs to the canonical recommendations experience", () => {
    const page = read("app/search/page.tsx");

    expect(page).toContain("KLYX_SEARCH_COMPATIBILITY_REDIRECT");
    expect(page).toContain("useSearchParams");
    expect(page).toContain("useRouter");
    expect(page).toContain("new URLSearchParams(queryString)");
    expect(page).toContain('params.get("start")');
    expect(page).toContain('params.get("time")');
    expect(page).toContain('params.set("time", legacyStart)');
    expect(page).toContain("router.replace(");
    expect(page).toContain('`/recommendations?${nextQuery}`');
    expect(page).toContain('"/recommendations"');
  });

  it("preserves every historical query parameter and only derives time from start", () => {
    const page = read("app/search/page.tsx");

    expect(page).toContain("const params = new URLSearchParams(queryString);");
    expect(page).toContain("if (legacyStart && !time)");
    expect(page).toContain("const nextQuery = params.toString();");
    expect(page).not.toContain("params.delete(");
    expect(page).not.toContain("new URLSearchParams();");
  });

  it("contains no marketplace data loading, filtering, comparison, or booking logic", () => {
    const page = read("app/search/page.tsx");

    expect(page).not.toContain("fetch(");
    expect(page).not.toContain("/api/services/public");
    expect(page).not.toContain("/api/search/providers");
    expect(page).not.toContain("klyxScore");
    expect(page).not.toContain("reviewCount");
    expect(page).not.toContain("pricing");
    expect(page).not.toContain("MatchExplanation");
    expect(page).not.toContain("SearchRecovery");
    expect(page).not.toContain("/providers/");
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
  });

  it("keeps a neutral KLYX loading state while the client redirect resolves", () => {
    const page = read("app/search/page.tsx");

    expect(page).toContain("<Suspense");
    expect(page).toContain("LoaderCircle");
    expect(page).toContain("text-blue-600");
    expect(page).not.toContain("violet");
    expect(page).not.toContain("indigo");
    expect(page).not.toContain("linear-gradient");
  });
});
