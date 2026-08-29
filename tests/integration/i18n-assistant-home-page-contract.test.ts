import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/assistant/page.tsx"),
  "utf8"
);

describe("KLYX unified assistant home read-only i18n contract", () => {
  it("keeps the exact authenticated GET-only action source", () => {
    expect(source).toContain('fetch(\n          "/api/brain/actions"');
    expect(source).toContain('cache: "no-store"');
    expect(source).toContain("Authorization:\n                `Bearer ${accessToken}`");
    expect(source).not.toContain('method: "POST"');
    expect(source).not.toContain('method: "PATCH"');
    expect(source).not.toContain('method: "DELETE"');
  });

  it("refetches server-localized actions after locale changes", () => {
    expect(source).toContain("useKlyxLocale()");
    expect(source).toContain("}, [locale]);");
  });

  it("keeps the top server action content and destination verbatim", () => {
    expect(source).toContain("{topAction.title}");
    expect(source).toContain("{topAction.description}");
    expect(source).toContain("href={topAction.href}");
    expect(source).toContain("{topAction.label}");
  });

  it("preserves canonical client and provider navigation destinations", () => {
    for (const href of [
      "/assistant/market",
      "/assistant/actions",
      "/requests",
      "/search",
      "/provider/jobs",
      "/provider/assistant",
    ]) {
      expect(source).toContain(`href="${href}"`);
    }

    expect(source).not.toContain('href="/brain"');
  });

  it("keeps one primary conversational composer and role-aware shortcuts", () => {
    expect(source).toContain("KLYX_UNIFIED_ASSISTANT_HOME_16_01");
    expect(source).toContain("<AssistantCommandBar actions={data?.actions ?? []} />");
    expect(source).toContain('accountType === "client"');
    expect(source).toContain('title="Préparer côté pro"');
    expect(source).not.toContain("<AssistantBrief />");
    expect(source).not.toContain("<ProactiveAssistantPanel />");
  });

  it("does not reflect backend or network error details", () => {
    expect(source).not.toContain("body.error");
    expect(source).not.toContain("error.message");
    expect(source).toContain('setErrorMessage(t("loadError"))');
  });
});
