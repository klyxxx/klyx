import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const workflow = read(".github/workflows/klyx-ux-visual.yml");
const existingE2E = read(".github/workflows/klyx-e2e.yml");
const config = read("playwright.ux-visual.config.ts");
const spec = read("tests/ux-visual/klyx-ux-visual.spec.ts");

describe("KLYX UX / Visual Certification contract", () => {
  it("adds a dedicated additive workflow without replacing Playwright browser verification", () => {
    expect(workflow).toContain("name: KLYX UX / Visual Certification");
    expect(workflow).toContain("ux-visual-certification:");
    expect(workflow).toContain("name: KLYX UX / Visual Certification");
    expect(workflow).toContain("npx playwright test");
    expect(workflow).toContain("--config=playwright.ux-visual.config.ts");
    expect(workflow).toContain("group: klyx-ux-visual-${{ github.ref }}");
    expect(workflow).toContain("cancel-in-progress: true");
    expect(existingE2E).toContain("name: Playwright browser verification");
    expect(existingE2E).toContain("npm run test:e2e");
    expect(workflow).not.toContain("enable-auto-merge");
  });

  it("certifies desktop and mobile independently", () => {
    expect(config).toContain('name: "desktop-chrome"');
    expect(config).toContain('viewport: { width: 1440, height: 900 }');
    expect(config).toContain('name: "mobile-chrome"');
    expect(config).toContain('viewport: { width: 390, height: 844 }');
    expect(config).toContain('testDir: "./tests/ux-visual"');
  });

  it("covers every required critical surface including a real active mission from the rendered rail", () => {
    for (const route of [
      '"/assistant"',
      '"/profile"',
      '"/settings"',
      '"/request/photo"',
    ]) {
      expect(spec).toContain(route);
    }

    expect(spec).toContain("findActiveMission");
    expect(spec).toContain("visibleMissionHref");
    expect(spec).toContain('section[aria-label="En cours"] a[href]');
    expect(spec).toContain('href.startsWith("/bookings/")');
    expect(spec).toContain('href.startsWith("/booking-groups/")');
    expect(spec).toContain(
      "Dedicated E2E account must expose at least one active mission"
    );
    expect(spec).not.toContain('fetch("/api/bookings/overview"');
    expect(spec).not.toContain('fetch("/api/provider/jobs"');
  });

  it("measures objective layout, interaction and browser-error invariants", () => {
    for (const contract of [
      "horizontalOverflow",
      "horizontallyClipped",
      "fixedOutsideViewport",
      "blockedControls",
      "overlaps",
      "mainVisible",
      "isInsideIntentionalHorizontalScroller",
      'getByTestId("desktop-mission-rail")',
      'getByTestId("assistant-shell-mobile-header")',
      'getByTestId("assistant-shell-mobile-menu")',
      'locator("details")',
      'locator(\'[data-testid="account-switcher"]\')',
      'getByText("Compte", { exact: true })',
      "CERTIFIED_LANGUAGE_LABELS",
      "voiceSmoke",
      "photoLiveSmoke",
      'page.on("console"',
      'page.on("pageerror"',
    ]) {
      expect(spec).toContain(contract);
    }
  });

  it("keeps visual references reproducible from certified main and uploads diagnostics", () => {
    expect(config).toContain("snapshotPathTemplate");
    expect(spec).toContain("toHaveScreenshot");
    expect(workflow).toContain("Load latest certified main visual baseline");
    expect(workflow).toContain("actions/workflows/klyx-ux-visual.yml/runs");
    expect(workflow).toContain("--update-snapshots");
    expect(workflow).toContain("klyx-ux-visual-baseline");
    expect(workflow).toContain("klyx-ux-visual-report-${{ github.run_id }}");
    expect(workflow).toContain("ux-visual-report/");
    expect(workflow).toContain("ux-visual-results/");
    expect(workflow).toContain("tests/ux-visual/__screenshots__/");
    expect(workflow).toContain("Guard UX / Visual artifacts against secrets");
  });

  it("uses browser-local mocks for Voice and Photo smoke coverage without paid visual services", () => {
    expect(spec).toContain("MockSpeechRecognition");
    expect(spec).toContain('Object.defineProperty(mediaDevices, "getUserMedia"');
    expect(spec).toContain(
      'new DOMException("UX certification denied camera", "NotAllowedError")'
    );
    expect(workflow).not.toMatch(/figma|chromatic|percy|applitools|browserstack/i);
  });
});
