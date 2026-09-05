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

  it("keeps the assistant reusable after a successful publication", () => {
    expect(commandBar).not.toContain(
      'router.push(published.href || "/bookings")'
    );
    expect(commandBar).toContain(
      'setPublishedHref(published.href || "/bookings")'
    );
    expect(commandBar).toContain("setConversationId(null)");
    expect(commandBar).toContain("setMessages([])");
    expect(commandBar).toContain("setPayload(null)");
    expect(commandBar).toContain("requestAnimationFrame(() => textareaRef.current?.focus())");
    expect(commandBar).toContain("href={publishedHref}");
    expect(commandBar).toContain("flowCopy.viewTracking");
  });

  it("uses the localized initial prompt instead of terminal French-only copy", () => {
    expect(commandBar).toContain(
      'conversationId ? flowCopy.followUpPlaceholder : t("placeholder")'
    );
    expect(commandBar).not.toContain('"Décrivez votre besoin..."');
  });
});
