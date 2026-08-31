import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider verification visual contract", () => {
  it("aligns verification and Sumsub with the KLYX theme without replacing real verification flows", () => {
    const layout = read("app/provider/verification/layout.tsx");
    const theme = read("app/provider/verification/verification.module.css");
    const verification = read("app/provider/verification/page.tsx");
    const sumsub = read("app/provider/verification/sumsub/page.tsx");

    expect(layout).toContain('import styles from "./verification.module.css"');
    expect(layout).toContain("className={styles.verification}");

    expect(theme).toContain("--klyx-verification-blue: #2563eb");
    expect(theme).toContain('section[class*="bg-[linear-gradient"]');
    expect(theme).toContain("background-image: none");
    expect(theme).toContain("font-size: clamp(1.75rem, 4vw, 2.5rem)");
    expect(theme).toContain('button[class~="bg-emerald-600"]');
    expect(theme).not.toContain("violet");
    expect(theme).not.toContain("indigo");

    expect(verification).toContain('"/api/provider/verification"');
    expect(verification).toContain('.from("provider-verification")');
    expect(verification).toContain('"/api/provider/verification/document"');
    expect(verification).toContain('method: "POST"');
    expect(verification).toContain('method: "PATCH"');
    expect(verification).toContain('method: "DELETE"');

    expect(sumsub).toContain('from "@sumsub/websdk-react"');
    expect(sumsub).toContain('"/api/provider/sumsub/status"');
    expect(sumsub).toContain('"/api/provider/sumsub/token"');
    expect(sumsub).toContain("<SumsubWebSdk");
  });
});
