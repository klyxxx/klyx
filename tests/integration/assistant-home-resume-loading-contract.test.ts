import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/components/AssistantHomeResume.tsx"),
  "utf8"
).replace(/\r\n/g, "\n");

describe("assistant home resume loading contract", () => {
  it("keeps a stable accessible loading surface until resume lookup settles", () => {
    expect(source).toContain("const [loading, setLoading] = useState(true);");
    expect(source).toContain("if (active) setLoading(false);");
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('aria-busy="true"');
    expect(source).toContain("min-h-[8.5rem]");
    expect(source).toContain("LoaderCircle");
  });

  it("stays quiet after loading when there is no resumable action", () => {
    expect(source).toContain("if (!action) return null;");
  });
});
