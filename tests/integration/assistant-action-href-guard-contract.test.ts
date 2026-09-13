import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { normalizeKlyxAssistantActionHref } from "@/lib/klyx-assistant-action-href";

function read(relativePath: string): string {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const unifiedIntent = read("app/api/brain/converse/unified-intent.ts");

describe("KLYX assistant action href guard", () => {
  it("allows only root-relative KLYX navigation", () => {
    expect(normalizeKlyxAssistantActionHref("/bookings/abc?tab=payment#status"))
      .toBe("/bookings/abc?tab=payment#status");
    expect(normalizeKlyxAssistantActionHref(" /tracking/abc "))
      .toBe("/tracking/abc");
  });

  it("rejects external and scheme-confusion hrefs", () => {
    expect(normalizeKlyxAssistantActionHref("https://evil.example/path"))
      .toBeNull();
    expect(normalizeKlyxAssistantActionHref("//evil.example/path"))
      .toBeNull();
    expect(normalizeKlyxAssistantActionHref("javascript:alert(1)"))
      .toBeNull();
    expect(normalizeKlyxAssistantActionHref("/\\evil.example/path"))
      .toBeNull();
  });

  it("fails closed before exposing a grounded mission action", () => {
    expect(unifiedIntent).toContain("normalizeKlyxAssistantActionHref(localized.href)");
    expect(unifiedIntent).toContain("action: href");
    expect(unifiedIntent).toContain(": null");
    expect(unifiedIntent).toContain("automaticExecutionAllowed: false");
    expect(unifiedIntent).not.toContain("payment_intents");
    expect(unifiedIntent).not.toContain("checkout.sessions");
    expect(unifiedIntent).not.toContain("refunds.create");
  });
});
