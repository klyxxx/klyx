import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/provider/quotes/page.tsx"),
  "utf8"
);

describe("provider quotes UX", () => {
  it("prioritizes quotes that still need an explicit provider action", () => {
    expect(source).toContain("prioritizedQuotes");
    expect(source).toContain('left.status === "requested"');
    expect(source).toContain("priorityQuote");
    expect(source).toContain("otherQuotes");
  });

  it("keeps send as an explicit provider action", () => {
    expect(source).toContain("event.preventDefault();");
    expect(source).toContain('action: "send"');
    expect(source).toContain('method: "PATCH"');
    expect(source).toContain('t("approvalRequired")');
    expect(source).toContain('t("editableNotice")');
  });

  it("keeps AI drafting secondary and non-executing", () => {
    expect(source).toContain('fetch("/api/provider/quotes/draft"');
    expect(source).toContain('method: "POST"');
    expect(source).toContain("prepareSmartDraft");
    expect(source).not.toContain("/api/bookings");
    expect(source).not.toContain("/api/stripe");
  });

  it("uses the single-blue KLYX visual language", () => {
    expect(source).toContain("bg-blue-600");
    expect(source).toContain("text-blue-600");
    expect(source).not.toContain("text-cyan-");
    expect(source).not.toContain("bg-cyan-");
    expect(source).not.toContain("text-violet-");
    expect(source).not.toContain("bg-violet-");
    expect(source).not.toContain("bg-[linear-gradient");
  });
});
