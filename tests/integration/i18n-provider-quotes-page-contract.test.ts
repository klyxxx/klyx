import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const page = readRepoFile("app/provider/quotes/page.tsx");
const i18n = readRepoFile("lib/klyx-provider-quotes-i18n.ts");
const quoteRoute = readRepoFile("app/api/quotes/quote-route-core.ts");
const draftCore = readRepoFile(
  "app/api/provider/quotes/draft/quote-draft-route-core.ts"
);
const draftHelper = readRepoFile("lib/provider-quote-draft.ts");

describe("KLYX provider quotes page i18n contract", () => {
  it("uses the shared locale provider and explicit French fallback dictionary", () => {
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("translateKlyxProviderQuotes");
    expect(page).toContain("translateKlyxProviderQuoteStatus");
    expect(i18n).toContain('export type KlyxProviderQuotesLocale = "fr" | "en" | "nl" | "de"');
    expect(i18n).toContain('locale === "en" || locale === "nl" || locale === "de" ? locale : "fr"');
  });

  it("preserves the authenticated read and explicit provider-triggered draft contract", () => {
    expect(page).toContain('fetch("/api/quotes"');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("Authorization:");
    expect(page).toContain('fetch("/api/provider/quotes/draft"');
    expect(page).toContain('method: "POST"');
    expect(page).toContain("body: JSON.stringify({ quoteId })");
    expect(draftCore).toContain('requireAccountType(profile, "provider")');
    expect(draftCore).toContain("const draft = buildProviderQuoteDraft({");
    expect(draftCore).toContain("...draft,");
    expect(draftHelper).toContain("requiresConfirmation: true");
    expect(draftHelper).toContain('riskLevel: "review_required"');
  });

  it("keeps quote sending behind an explicit form submit and the canonical PATCH payload", () => {
    expect(page).toContain("event.preventDefault()");
    expect(page).toContain("onSubmit=");
    expect(page).toContain('method: "PATCH"');
    expect(page).toContain('action: "send"');
    expect(page).toContain("providerPrice,");
    expect(page).toContain('providerMessage: messages[quoteId] ?? ""');
    expect(page).toContain("!Number.isFinite(providerPrice) || providerPrice < 0");
    expect(page).toContain("maxLength={1500}");
    expect(quoteRoute).toContain('if (action === "send")');
  });

  it("keeps server and user-authored quote content verbatim", () => {
    expect(page).toContain("{quote.title}");
    expect(page).toContain("{quote.description}");
    expect(page).toContain("{smartDraft.explanation}");
    expect(page).toContain("{assumption}");
    expect(page).toContain("{warning}");
    expect(page).toContain("{quote.provider_message}");
  });

  it("uses safe localized presentation errors instead of reflecting backend errors", () => {
    expect(page).toContain('setErrorMessage(t("loadError"))');
    expect(page).toContain('setErrorMessage(t("draftError"))');
    expect(page).toContain('setErrorMessage(t("sendError"))');
    expect(page).not.toContain("body.error ||");
    expect(page).not.toContain("error instanceof Error ? error.message");
  });

  it("does not add booking, payment, refund or transfer execution", () => {
    for (const forbidden of [
      "create-checkout-session",
      "payment_intent",
      "refund",
      "transfer",
      'fetch("/api/bookings',
    ]) {
      expect(page.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
