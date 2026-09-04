import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const commandBar = readFileSync(
  "app/components/AssistantCommandBar.tsx",
  "utf8"
);

describe("assistant command publication i18n contract", () => {
  it("keeps explicit confirmation before market publication", () => {
    const confirmationIndex = commandBar.indexOf(
      '"/api/brain/confirm-request"'
    );
    const publicationIndex = commandBar.indexOf(
      'fetch("/api/brain/market-publish"'
    );

    expect(confirmationIndex).toBeGreaterThan(-1);
    expect(publicationIndex).toBeGreaterThan(confirmationIndex);
    expect(commandBar).toContain("confirmation.confirmationId");
    expect(commandBar).toContain("confirmed: true");
  });

  it("localizes only the generated publication copy", () => {
    expect(commandBar).toContain('t("publishedRequestTitle", {');
    expect(commandBar).toContain(
      't("publishedRequestFallbackDescription", {'
    );
    expect(commandBar).toContain("service: payload.serviceSlug");
    expect(commandBar).toContain("city: payload.city");
    expect(commandBar).toContain("}).slice(0, 120)");
    expect(commandBar).not.toContain("`Besoin de ${payload.serviceSlug}`");
    expect(commandBar).not.toContain(
      "`Demande KLYX pour ${payload.serviceSlug} à ${payload.city}.`"
    );
  });
});
