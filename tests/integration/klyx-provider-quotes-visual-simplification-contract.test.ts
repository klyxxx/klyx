import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX provider quotes visual simplification contract", () => {
  it("renders quotes as a compact prioritized list instead of dashboard cards", () => {
    const page = read("app/provider/quotes/page.tsx");

    expect(page).toContain("divide-y divide-border border-y border-border");
    expect(page).toContain("const priorityQuote = prioritizedQuotes[0] ?? null");
    expect(page).toContain("const otherQuotes = priorityQuote ? prioritizedQuotes.slice(1) : []");
    expect(page).toContain("quoteView(priorityQuote");
    expect(page).toContain("otherQuotes.map((quote) => quoteView(quote))");
    expect(page).toContain("text-base font-semibold leading-6");
    expect(page).toContain('data-quote-priority={priority ? "true" : "false"}');
    expect(page).not.toContain("<details");
    expect(page).not.toContain("ChevronDown");
    expect(page).not.toContain("text-2xl sm:text-3xl");
    expect(page).not.toContain("bg-violet-");
    expect(page).not.toContain("text-violet-");
  });

  it("keeps the KLYX draft secondary, editable and explicitly review-required", () => {
    const page = read("app/provider/quotes/page.tsx");

    expect(page).toContain('fetch("/api/provider/quotes/draft"');
    expect(page).toContain('t("smartDraft")');
    expect(page).toContain("smartDraft.assumptions.map");
    expect(page).toContain("smartDraft.warnings.map");
    expect(page).toContain('t("approvalRequired")');
    expect(page).toContain('value={prices[quote.id] ?? ""}');
    expect(page).toContain('value={messages[quote.id] ?? ""}');
    expect(page).not.toContain("confidenceLabel");
    expect(page).not.toContain('role="progressbar"');
  });

  it("keeps one primary explicit send action and read-only sent quotes", () => {
    const page = read("app/provider/quotes/page.tsx");

    expect(page).toContain('action: "send"');
    expect(page).toContain('t("send")');
    expect(page).toContain("bg-[#2563EB]");
    expect(page).toContain("{requested && (");
    expect(page).toContain("{!requested && (");
    expect(page).toContain('t("sentPrice")');
    expect(page).toContain("quote.provider_message");
    expect(page).toContain("await load()");
  });
});
