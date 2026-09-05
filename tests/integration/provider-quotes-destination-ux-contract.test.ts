import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider Quotes destination UX", () => {
  it("keeps one priority quote visible while preserving quote preparation and sending", () => {
    const quotes = read("app/provider/quotes/page.tsx");

    expect(quotes).toContain("KLYX_PROVIDER_QUOTES_DESTINATION_2026_09_02");
    expect(quotes).toContain('fetch("/api/quotes"');
    expect(quotes).toContain('fetch("/api/provider/quotes/draft"');
    expect(quotes).toContain('method: "POST"');
    expect(quotes).toContain('method: "PATCH"');
    expect(quotes).toContain('action: "send"');

    expect(quotes).toContain("priorityQuote");
    expect(quotes).toContain("otherQuotes");
    expect(quotes).toContain("<details");
    expect(quotes).toContain("data-quote-priority");
    expect(quotes).toContain('className="klyx-page"');
    expect(quotes).toContain("#2563EB");

    for (const legacyBranding of [
      "blue-300",
      "blue-400",
      "blue-500",
      "blue-600",
      "blue-700",
      "violet-",
      "indigo-",
      "fuchsia-",
      "bg-gradient",
      "linear-gradient",
      "#2b1452",
    ]) {
      expect(quotes).not.toContain(legacyBranding);
    }

    expect(quotes).not.toContain("shadow-sm");
    expect(quotes).not.toContain("ring-1");
    expect(quotes).not.toContain("min-h-72");
  });
});
