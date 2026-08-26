import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const messagesPath = path.join(
  process.cwd(),
  "lib/klyx-founder-final-check-i18n.ts"
);

function readMessages() {
  expect(fs.existsSync(messagesPath)).toBe(true);
  return fs.readFileSync(messagesPath, "utf8");
}

describe("Founder final-check visible labels", () => {
  it("does not expose internal development step numbering", () => {
    const source = readMessages();

    for (const legacyLabel of [
      "Étape 11.8",
      "Étape 11",
      "Step 11.8",
      "Step 11",
      "Stap 11.8",
      "Stap 11",
      "Schritt 11.8",
      "Schritt 11",
    ]) {
      expect(source).not.toContain(legacyLabel);
    }
  });

  it("keeps functional final-validation language", () => {
    const source = readMessages();

    expect(source).toContain('badge: "Contrôle final"');
    expect(source).toContain('step: "Statut"');
    expect(source).toContain('readyTitle: "Validation prête à être finalisée"');
    expect(source).toContain('validatedTitle: "Validation finale réussie"');
  });
});
