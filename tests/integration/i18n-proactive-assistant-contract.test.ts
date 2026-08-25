import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/components/ProactiveAssistantPanel.tsx"),
  "utf8"
);

describe("KLYX proactive assistant read-only i18n contract", () => {
  it("keeps the exact authenticated GET-only action source", () => {
    expect(source).toContain('fetch("/api/brain/actions", {');
    expect(source).toContain('cache: "no-store"');
    expect(source).toContain("Authorization: `Bearer ${token}`");
    expect(source).not.toContain('method: "POST"');
    expect(source).not.toContain('method: "PATCH"');
    expect(source).not.toContain('method: "DELETE"');
  });

  it("preserves the existing 30-second polling cadence", () => {
    expect(source).toContain("window.setInterval(() => {");
    expect(source).toContain("}, 30000)");
    expect(source).toContain("window.clearInterval(interval)");
  });

  it("refetches server-localized actions when locale changes", () => {
    expect(source).toContain("useKlyxLocale()");
    expect(source).toContain("[load, locale]");
  });

  it("preserves server ordering, top-three cap and urgent threshold", () => {
    expect(source).toContain("(data?.actions ?? []).slice(0, 3)");
    expect(source).toContain("action.priority >= 95");
    expect(source).not.toContain(".sort(");
  });

  it("keeps dynamic server action content and navigation verbatim", () => {
    expect(source).toContain("{action.title}");
    expect(source).toContain("{action.description}");
    expect(source).toContain("href={action.href}");
    expect(source).toContain("{action.label}");
  });

  it("keeps sensitive explanations as presentation only", () => {
    expect(source).toContain("explainKlyxProactiveAction(locale, action.kind)");
    expect(source).toContain("{info.why}");
    expect(source).toContain("{info.confirmation}");
  });

  it("does not reflect backend error details", () => {
    expect(source).not.toContain("body.error");
    expect(source).not.toContain("error.message");
    expect(source).toContain('t("loadError")');
  });
});
