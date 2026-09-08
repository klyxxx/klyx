import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX favorites visual simplification contract", () => {
  it("keeps favorite providers compact instead of rendering marketplace cards", () => {
    const page = read("app/favorites/page.tsx");

    expect(page).toContain("KLYX_FAVORITES_VISUAL_SIMPLIFICATION");
    expect(page).toContain('className="grid h-14 w-14');
    expect(page).toContain("divide-y divide-border");
    expect(page).not.toContain("aspect-[16/10]");
    expect(page).not.toContain("sm:grid-cols-2");
    expect(page).not.toContain("xl:grid-cols-3");
    expect(page).not.toContain("absolute right-3 top-3");
    expect(page).not.toContain("group-hover:scale");
    expect(page).not.toContain("hover:scale");
  });

  it("uses KLYX blue only for useful actions on the favorites page", () => {
    const page = read("app/favorites/page.tsx");

    expect(page).toContain("bg-[#2563EB]");
    expect(page).not.toContain("bg-violet-600");
    expect(page).not.toContain("text-violet-");
  });

  it("preserves favorites data and provider navigation boundaries", () => {
    const page = read("app/favorites/page.tsx");

    expect(page).toContain('.from("favorites")');
    expect(page).toContain("<FavoriteButton");
    expect(page).toContain('href={`/providers/${favorite.userId}`}');
    expect(page).toContain('formatKlyxFavoritePrice(');
  });
});
