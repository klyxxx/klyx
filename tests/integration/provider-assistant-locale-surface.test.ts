import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const page = fs.readFileSync(
  path.join(process.cwd(), "app/provider/assistant/page.tsx"),
  "utf8"
);

describe("provider assistant localized surface", () => {
  it("renders visible assistant copy through the provider dictionary", () => {
    expect(page).toContain('t("badge")');
    expect(page).toContain('t("prepareQuestion")');
    expect(page).toContain('t("surfaceDescription")');
    expect(page).toContain('aria-label={t("conversationLabel")}');
    expect(page).toContain('t("conversationIntro")');
    expect(page).toContain('t("preparing")');
    expect(page).toContain('t("draftsTitle")');
    expect(page).toContain('t("draftReady")');
    expect(page).toContain('placeholder={t("placeholder")}');
    expect(page).toContain('t("controlNote")');
  });

  it("does not reintroduce the previous hardcoded French surface", () => {
    expect(page).not.toContain("Que dois-je préparer pour ton activité ?");
    expect(page).not.toContain("Conversation avec KLYX");
    expect(page).not.toContain("KLYX prépare une réponse");
    expect(page).not.toContain("Brouillons à vérifier");
    expect(page).not.toContain("Brouillon prêt à vérifier.");
    expect(page).not.toContain("Demander à KLYX…");
  });

  it("preserves the provider assistant action boundaries", () => {
    expect(page).toContain('fetch("/api/provider/assistant"');
    expect(page).toContain('method: "POST"');
    expect(page).toContain('method: "PATCH"');
    expect(page).toContain('action: "apply" | "discard"');
    expect(page).toContain('query.get("prompt")');
  });
});
