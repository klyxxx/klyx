import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/provider/assistant/page.tsx"),
  "utf8"
);

describe("provider assistant UX", () => {
  it("keeps the provider assistant conversation-first", () => {
    expect(source).toContain("Que dois-je préparer ?");
    expect(source).toContain("Décrivez ce que KLYX doit préparer");
    expect(source).toContain('onSubmit={(event) => void submit(event)}');
    expect(source).not.toContain("xl:grid-cols-[minmax(0,1fr)_330px]");
    expect(source).not.toContain("shadow-[0_24px_80px");
  });

  it("keeps drafts secondary until they are useful", () => {
    expect(source).toContain("<details");
    expect(source).toContain("Brouillons à vérifier");
    expect(source).toContain('draft.status === "draft"');
    expect(source).toContain('processDraft(draft.id, "apply")');
    expect(source).toContain('processDraft(draft.id, "discard")');
  });

  it("preserves explicit confirmation and the existing assistant API contract", () => {
    expect(source).toContain('fetch("/api/provider/assistant"');
    expect(source).toContain('method: "POST"');
    expect(source).toContain('method: "PATCH"');
    expect(source).toContain("Rien n’est appliqué ni envoyé sans votre confirmation");
  });

  it("uses KLYX blue without the previous violet identity", () => {
    expect(source).toContain("bg-blue-600");
    expect(source).toContain("text-blue-600");
    expect(source).not.toContain("violet-");
  });
});
