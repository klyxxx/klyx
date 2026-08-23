import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX AI status page i18n contract", () => {
  it("keeps the route server-rendered and locale-aware", () => {
    const page = read("app/ai-status/page.tsx");

    expect(page).not.toContain('"use client"');
    expect(page).toContain("KLYX_AI_STATUS_PAGE_SERVER_BOUNDARY");
    expect(page).toContain('import { cookies } from "next/headers"');
    expect(page).toContain("KLYX_LANGUAGE_COOKIE_KEY");
    expect(page).toContain("normalizeKlyxLocale");
    expect(page).toContain("getKlyxAiStatusPageDictionary");
    expect(page).toContain("export async function generateMetadata");
  });

  it("preserves the real AI-enabled status check and dashboard destination", () => {
    const page = read("app/ai-status/page.tsx");

    expect(page).toContain("const enabled = isKlyxAiEnabled()");
    expect(page).toContain(
      "enabled ? copy.enabledTitle : copy.fallbackTitle"
    );
    expect(page).toContain(
      "enabled ? copy.enabledDescription : copy.fallbackDescription"
    );
    expect(page).toContain('href="/dashboard"');
  });

  it("keeps the status page presentation mutation-free", () => {
    const page = read("app/ai-status/page.tsx");

    expect(page).not.toContain("fetch(");
    expect(page).not.toContain("supabase");
    expect(page).not.toContain("stripe");
    expect(page).not.toContain("POST");
    expect(page).not.toContain("PUT");
    expect(page).not.toContain("PATCH");
    expect(page).not.toContain("DELETE");
  });

  it("moves the transaction-safety copy into the certified dictionary", () => {
    const page = read("app/ai-status/page.tsx");
    const helper = read("lib/klyx-ai-status-page-i18n.ts");

    expect(page).toContain("copy.safetyDescription");
    expect(page).not.toContain(
      "L’IA ne peut pas confirmer seule un paiement, un remboursement, une réservation ou une activité réglementée."
    );
    expect(helper).toContain(
      "L’IA ne peut pas confirmer seule un paiement, un remboursement, une réservation ou une activité réglementée."
    );
    expect(helper).toContain(
      "The AI cannot confirm a payment, refund, booking, or regulated activity on its own."
    );
    expect(helper).toContain(
      "De AI kan niet zelfstandig een betaling, terugbetaling, boeking of gereguleerde activiteit bevestigen."
    );
    expect(helper).toContain(
      "Die KI kann eine Zahlung, eine Rückerstattung, eine Buchung oder eine regulierte Tätigkeit nicht eigenständig bestätigen."
    );
  });

  it("leaves the server-side OpenAI readiness gate unchanged", () => {
    const ai = read("lib/klyx-ai.ts");

    expect(ai).toContain('process.env.KLYX_OPENAI_ENABLED === "1"');
    expect(ai).toContain("Boolean(process.env.OPENAI_API_KEY?.trim())");
  });
});
