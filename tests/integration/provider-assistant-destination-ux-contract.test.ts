import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider Assistant destination UX", () => {
  it("keeps the assistant conversation-first while preserving explicit draft control", () => {
    const assistant = read("app/provider/assistant/page.tsx");
    const assistantI18n = read("lib/klyx-provider-assistant-i18n.ts");

    expect(assistant).toContain("KLYX_PROVIDER_ASSISTANT_DESTINATION_2026_09_02");
    expect(assistant).toContain('{t("prepareQuestion")}');
    expect(assistant).toContain('placeholder={t("placeholder")}');
    expect(assistant).toContain('{t("surfaceDescription")}');
    expect(assistant).toContain('{t("controlNote")}');
    expect(assistantI18n).toContain("Que dois-je préparer pour ton activité ?");
    expect(assistantI18n).toContain('placeholder: "Demander à KLYX…"');
    expect(assistantI18n).toContain("Rien n’est appliqué ni envoyé sans ta confirmation.");
    expect(assistantI18n).toContain("KLYX prépare. Tu confirmes toujours avant toute action.");

    expect(assistant).toContain('{t("draftsTitle")}');
    expect(assistantI18n).toContain("Brouillons à vérifier");
    expect(assistant).toContain("<details");
    expect(assistant).toContain("pendingDrafts");

    const endpointReadsAndWrites = assistant.match(
      /fetch\("\/api\/provider\/assistant"/g
    );
    expect(endpointReadsAndWrites).toHaveLength(3);
    expect(assistant).toContain('method: "POST"');
    expect(assistant).toContain('method: "PATCH"');
    expect(assistant).toContain('action: "apply" | "discard"');

    expect(assistant).not.toContain("xl:grid-cols");
    expect(assistant).not.toContain("shadow-sm");
    expect(assistant).not.toContain("Prépare tes disponibilités, devis et réponses");
  });
});
