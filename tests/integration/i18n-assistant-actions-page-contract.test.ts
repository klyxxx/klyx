import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app/assistant/actions/page.tsx"),
  "utf8"
);

const apiSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/brain/actions/route.ts"),
  "utf8"
);

describe("KLYX assistant actions page read-only contract", () => {
  it("keeps the page on the exact authenticated GET endpoint", () => {
    expect(pageSource).toContain('fetch(\n          "/api/brain/actions"');
    expect(pageSource).toContain('cache: "no-store"');
    expect(pageSource).toContain('Authorization:\n                "Bearer " + accessToken');
    expect(pageSource).not.toContain('method: "POST"');
    expect(pageSource).not.toContain('method: "PATCH"');
    expect(pageSource).not.toContain('method: "DELETE"');
  });

  it("keeps refresh explicit and adds no polling timer", () => {
    expect(pageSource).toContain('onClick={() => void load(true)}');
    expect(pageSource).not.toContain("setInterval");
    expect(pageSource).not.toContain("setTimeout");
  });

  it("refetches the localized server actions when locale changes", () => {
    expect(pageSource).toContain("useKlyxLocale()");
    expect(pageSource).toContain("[load, locale]");
  });

  it("renders server action content and navigation verbatim", () => {
    expect(pageSource).toContain("{action.title}");
    expect(pageSource).toContain("{action.description}");
    expect(pageSource).toContain("href={action.href}");
    expect(pageSource).toContain("{action.label}");
  });

  it("does not reflect backend error messages", () => {
    expect(pageSource).not.toContain("body.error");
    expect(pageSource).not.toContain("error.message");
    expect(pageSource).toContain('t("loadError")');
  });

  it("keeps the server action endpoint GET-only and non-executing", () => {
    expect(apiSource).toContain("export async function GET(");
    expect(apiSource).not.toContain("export async function POST(");
    expect(apiSource).not.toContain("export async function PATCH(");
    expect(apiSource).not.toContain("export async function DELETE(");
    expect(apiSource).toContain("automaticExecutionAllowed:\n        false");
    expect(apiSource).toContain("localizeKlyxBrainActions(");
  });

  it("preserves cancellation-aware ordering and the 30-action cap", () => {
    expect(apiSource).toContain("protectedGroupHrefs");
    expect(apiSource).toContain("second.priority -\n            first.priority");
    expect(apiSource).toContain(".slice(\n          0,\n          30\n        )");
  });
});
