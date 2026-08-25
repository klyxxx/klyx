import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/assistant/page.tsx"),
  "utf8"
);

describe("KLYX assistant home read-only i18n contract", () => {
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

  it("preserves client and provider navigation destinations", () => {
    for (const href of [
      "/assistant/market",
      "/assistant/actions",
      "/requests",
      "/search",
      "/brain",
      "/provider/jobs",
      "/provider/assistant",
    ]) {
      expect(source).toContain(`href="${href}"`);
    }
  });

  it("keeps assistant subcomponents present", () => {
    expect(source).toContain("<AssistantBrief />");
    expect(source).toContain("<AssistantCommandBar");
    expect(source).toContain("<ProactiveAssistantPanel />");
  });

  it("does not reflect backend or network error details", () => {
    expect(source).not.toContain("body.error");
    expect(source).not.toContain("error.message");
    expect(source).toContain('setErrorMessage(t("loadError"))');
  });
});
