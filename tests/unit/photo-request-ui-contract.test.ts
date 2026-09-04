import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const photoPage = fs.readFileSync(
  path.join(process.cwd(), "app/request/photo/page.tsx"),
  "utf8"
);

describe("KLYX assistant photo rendering", () => {
  it("keeps the full attachment visible without the old fixed black thumbnail", () => {
    expect(photoPage).toContain("KLYX_ASSISTANT_PHOTO_ATTACHMENT_RENDER_16_07");
    expect(photoPage).toContain('className="max-h-[420px] max-w-full rounded-[18px] object-contain"');
    expect(photoPage).toContain("{file?.name}");
    expect(photoPage).toContain("Remplacer");
    expect(photoPage).not.toContain('className="h-44 w-full object-contain"');
    expect(photoPage).not.toContain('rounded-[22px] border border-border bg-black');
  });

  it("renders the submitted photo with the user message before the KLYX answer", () => {
    const submittedImageIndex = photoPage.indexOf('alt="Photo envoyée à KLYX"');
    const userMessageIndex = photoPage.indexOf("{description.trim()}", submittedImageIndex);
    const assistantLabelIndex = photoPage.indexOf(">KLYX</p>", userMessageIndex);

    expect(submittedImageIndex).toBeGreaterThanOrEqual(0);
    expect(userMessageIndex).toBeGreaterThan(submittedImageIndex);
    expect(assistantLabelIndex).toBeGreaterThan(userMessageIndex);
  });
});
