import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/components/AssistantCommandBar.tsx"),
  "utf8"
);

describe("KLYX assistant command bar safety and i18n contract", () => {
  it("keeps command submission explicit and preserves the exact API payload", () => {
    expect(source).toContain("onSubmit={submit}");
    expect(source).toContain('fetch(\n          "/api/brain/command"');
    expect(source).toContain('method: "POST"');
    expect(source).toContain('"Content-Type":\n                "application/json"');
    expect(source).toContain("Authorization:\n                \"Bearer \" +\n                session.access_token");
    expect(source).toContain("JSON.stringify({\n                message,");
    expect(source).toContain("maxLength={700}");
  });

  it("keeps browser-side execution forbidden and only navigates to server-selected destinations", () => {
    expect(source).toContain("// NO actions from browser.");
    expect(source).toContain("result.action.href");
    expect(source).toContain("if (result.href)");
    expect(source).toContain('"/assistant/actions"');
    expect(source).not.toContain("payment_intents");
    expect(source).not.toContain("checkout.sessions");
    expect(source).not.toContain("refunds.create");
    expect(source).not.toContain("/api/bookings/create");
  });

  it("keeps suggested server actions navigation-only and verbatim", () => {
    expect(source).toContain("actions.slice(0, 3)");
    expect(source).toContain("router.push(\n                      action.href");
    expect(source).toContain("{action.label}");
  });

  it("preserves explicit photo navigation without hidden upload", () => {
    expect(source).toContain('router.push(\n                  "/request/photo"');
    expect(source).not.toContain("storage.from(");
  });

  it("does not reflect backend or network error details", () => {
    expect(source).not.toContain("result.error");
    expect(source).not.toContain("error.message");
    expect(source).toContain('t("genericError")');
  });

  it("localizes presentation while leaving user input intact", () => {
    expect(source).toContain("useKlyxLocale()");
    expect(source).toContain("getKlyxAssistantCommandExamples(locale)");
    expect(source).toContain("const message =\n      value.trim();");
    expect(source).toContain("setValue(\n                  example");
  });
});
