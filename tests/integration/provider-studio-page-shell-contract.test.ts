import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/provider/studio/page.tsx"),
  "utf8"
);

describe("KLYX provider Services page shell", () => {
  it("keeps readiness and capabilities around the real Studio without changing navigation", () => {
    expect(source).toContain("<ProviderReadinessStatus />");
    expect(source).toContain("<ProviderCapabilitiesEntry />");
    expect(source).toContain("<ProviderStudio profileId={profile.id} />");
    expect(source).not.toContain("AppSidebar");
    expect(source).not.toContain("studio.module.css");
  });
});
