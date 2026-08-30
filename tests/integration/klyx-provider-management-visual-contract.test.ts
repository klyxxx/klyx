import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX provider management visual language", () => {
  it("keeps provider readiness on the blue KLYX language", () => {
    const source = read("app/components/ProviderReadinessStatus.tsx");

    expect(source).toContain("text-blue-600");
    expect(source).toContain("bg-blue-600/8");
    expect(source).not.toContain("text-violet-");
    expect(source).not.toContain("bg-violet-");
  });

  it("keeps provider capabilities entry on the blue KLYX language", () => {
    const source = read("app/components/ProviderCapabilitiesEntry.tsx");

    expect(source).toContain("text-blue-600");
    expect(source).toContain("bg-blue-600");
    expect(source).not.toContain("text-violet-");
    expect(source).not.toContain("bg-violet-");
  });

  it("keeps semantic readiness success in green", () => {
    const source = read("app/components/ProviderReadinessStatus.tsx");

    expect(source).toContain("emerald-500");
  });
});
