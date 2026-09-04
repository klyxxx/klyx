import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

const publicConfig = read("lib/klyx-public-config.ts");
const supportPage = read("app/support/SupportPageContent.tsx");

describe("KLYX public support email contract", () => {
  it("uses the professional klyx.be support address as the public fallback", () => {
    expect(publicConfig).toContain('"support@klyx.be"');
    expect(publicConfig).not.toContain("klyxsupport@gmail.com");
    expect(publicConfig).toContain("process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim()");
  });

  it("keeps the support page wired to the central public support email", () => {
    expect(supportPage).toContain("KLYX_PUBLIC_CONFIG.supportEmail");
    expect(supportPage).toContain("`mailto:${KLYX_PUBLIC_CONFIG.supportEmail}");
    expect(supportPage).toContain("const email = KLYX_PUBLIC_CONFIG.supportEmail");
    expect(supportPage).toContain("href={`mailto:${email}`}");
  });
});
