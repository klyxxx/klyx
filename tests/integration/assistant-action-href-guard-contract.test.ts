import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { normalizeKlyxAssistantActionHref } from "@/lib/klyx-assistant-action-href";

function read(relativePath: string): string {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const commandRoute = read("app/api/brain/command/route.ts");

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

  it("fails closed before returning an existing assistant action", () => {
    expect(commandRoute).toContain("normalizeKlyxAssistantActionHref(");
    expect(commandRoute).toContain("if (!safeHref)");
    expect(commandRoute).toContain('"no_action"');
    expect(commandRoute).toContain("href: safeHref");
    expect(commandRoute).toContain("automaticExecutionAllowed:");
    expect(commandRoute).toContain("false");
  });
});
