import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX public provider visual simplification contract", () => {
  it("keeps the provider identity compact and removes the hero-photo layout", () => {
    const page = read("app/providers/[id]/page.tsx");

    expect(page).toContain("KLYX_PUBLIC_PROVIDER_VISUAL_SIMPLIFICATION");
    expect(page).toContain('className="grid h-16 w-16');
    expect(page).not.toContain("min-h-96");
    expect(page).not.toContain("md:grid-cols-[340px_1fr]");
  });

  it("shows at most three non-destructive work proofs in a 4:3 presentation", () => {
    const page = read("app/providers/[id]/page.tsx");

    expect(page).toContain(".limit(3)");
    expect(page).toContain("aspect-[4/3]");
    expect(page).not.toContain("aspect-square");
  });

  it("prioritizes the selected service proposal before the public gallery", () => {
    const page = read("app/providers/[id]/page.tsx");
    const proposal = page.indexOf('data-testid="klyx-provider-thread-continuation"');
    const gallery = page.indexOf('t("galleryTitle")');

    expect(proposal).toBeGreaterThan(-1);
    expect(gallery).toBeGreaterThan(-1);
    expect(proposal).toBeLessThan(gallery);
  });
});
