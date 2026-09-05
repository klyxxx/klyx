import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app/provider/assistant/page.tsx"),
  "utf8"
);

const routeSource = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/provider/assistant/assistant-route-core.ts"
  ),
  "utf8"
);

describe("KLYX provider assistant i18n safety contract", () => {
  it("keeps the authenticated GET/POST/PATCH surface and bounded payloads", () => {
    expect(pageSource).toContain('fetch("/api/provider/assistant", {');
    expect(pageSource).toContain('cache: "no-store"');
    expect(pageSource).toContain('method: "POST"');
    expect(pageSource).toContain('body: JSON.stringify({ message: request })');
    expect(pageSource).toContain('method: "PATCH"');
    expect(pageSource).toContain('body: JSON.stringify({ draftId, action })');
    expect(pageSource).toContain(
      "Authorization: `Bearer ${accessToken}`"
    );
  });

  it("preserves explicit user actions and the 1000-character boundaries", () => {
    expect(pageSource).toContain("maxLength={1000}");
    expect(pageSource).toContain('.get("prompt")?.trim().slice(0, 1000)');
    expect(pageSource).toContain("onSubmit={(event) => void submit(event)}");
    expect(pageSource).toContain(
      "onClick={() => void submit(undefined, example)}"
    );
    expect(routeSource).toContain("body.message.trim().slice(0, 1000)");
    expect(pageSource).not.toContain("setInterval(");
    expect(pageSource).not.toContain("setTimeout(");
  });

  it("keeps apply limited to availability and other drafts manual-copy only", () => {
    expect(pageSource).toContain('draft.draft_type === "availability"');
    expect(pageSource).toContain('void processDraft(draft.id, "apply")');
    expect(pageSource).toContain('void processDraft(draft.id, "discard")');
    expect(pageSource).toContain('draft.draft_type !== "availability"');
    expect(routeSource).toContain('if (draft.draft_type !== "availability")');
    expect(routeSource).toContain(
      "Les réponses et devis restent des brouillons à copier manuellement."
    );
    expect(routeSource).toContain('.from("availability_slots")');
  });

  it("keeps conversational content readable while localizing chrome and status", () => {
    expect(pageSource).toContain("useKlyxLocale()");
    expect(pageSource).toContain(
      "translateKlyxProviderAssistant(locale, key)"
    );
    expect(pageSource).toContain('{entry.role === "assistant" && entry.title');
    expect(pageSource).toContain("{entry.title}");
    expect(pageSource).toContain("{entry.text}");
    expect(pageSource).toContain("{draft.title}");
    expect(pageSource).toContain('draftPreview(draft, t("draftReady"))');
    expect(pageSource).toContain("{preview}");
    expect(pageSource).not.toContain("JSON.stringify(draft.payload, null, 2)");
    expect(pageSource).toContain("translateKlyxProviderAssistantStatus(");
  });

  it("keeps backend failures generic in presentation and forbids transactional execution", () => {
    expect(pageSource).toContain('setErrorMessage(t("submitError"))');
    expect(pageSource).toContain('setErrorMessage(t("actionError"))');
    expect(pageSource).not.toContain("setErrorMessage(body.error");
    expect(pageSource).not.toContain("{body.error}");
    expect(pageSource).not.toContain("error.message");
    expect(pageSource).not.toContain("/api/stripe");
    expect(pageSource).not.toContain("/api/bookings");
    expect(pageSource).not.toContain("refund");
    expect(pageSource).not.toContain("payment_intent");
    expect(pageSource).not.toContain("transfer");
  });
});
