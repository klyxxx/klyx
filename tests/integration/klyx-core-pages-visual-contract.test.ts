import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX core pages visual language", () => {
  it("keeps Messages in the single-blue KLYX visual language", () => {
    const source = read("app/messages/page.tsx");

    expect(source).toContain("text-blue-600");
    expect(source).toContain("bg-blue-600");
    expect(source).not.toContain("text-violet-");
    expect(source).not.toContain("bg-violet-");
  });

  it("keeps Profile in the single-blue KLYX visual language", () => {
    const source = read("app/profile/page.tsx");

    expect(source).toContain("text-blue-600");
    expect(source).toContain("bg-blue-600");
    expect(source).not.toContain("text-violet-");
    expect(source).not.toContain("bg-violet-");
  });

  it("keeps semantic success and error colors available", () => {
    const profile = read("app/profile/page.tsx");
    const messages = read("app/messages/page.tsx");

    expect(profile).toContain("emerald-500");
    expect(profile).toContain("red-500");
    expect(messages).toContain("red-500");
  });
});
