import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/components/AssistantBrief.tsx"),
  "utf8"
);

describe("KLYX assistant brief read-only i18n contract", () => {
  it("keeps the exact authenticated GET-only action source", () => {
    expect(source).toContain('fetch("/api/brain/actions", {');
    expect(source).toContain('cache: "no-store"');
    expect(source).toContain("Authorization: `Bearer ${token}`");
    expect(source).not.toContain('method: "POST"');
    expect(source).not.toContain('method: "PATCH"');
    expect(source).not.toContain('method: "DELETE"');
  });

  it("preserves the existing 30-second read-only polling cadence", () => {
    expect(source).toContain("window.setInterval(() => {");
    expect(source).toContain("}, 30000)");
    expect(source).toContain("window.clearInterval(interval)");
  });

  it("refetches server-localized actions after locale changes", () => {
    expect(source).toContain("useKlyxLocale()");
    expect(source).toContain("[load, locale]");
  });

  it("keeps dynamic server actions and links verbatim", () => {
    expect(source).toContain("first?.title ?? null");
    expect(source).toContain("href={first.href}");
    expect(source).toContain("{first.label}");
  });

  it("preserves non-executing fallback navigation", () => {
    expect(source).toContain('data.accountType === "provider"');
    expect(source).toContain('"/provider/jobs"');
    expect(source).toContain('"/assistant/market"');
  });

  it("keeps fetch failures non-blocking and non-reflective", () => {
    expect(source).toContain("if (!response.ok) return;");
    expect(source).not.toContain("body.error");
    expect(source).not.toContain("error.message");
  });
});
