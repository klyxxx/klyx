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

  it("covers all required surfaces and a deterministic read-only active mission", () => {
    for (const route of [
      '"/assistant"',
      '"/profile"',
      '"/settings"',
      '"/request/photo"',
    ]) {
      expect(spec).toContain(route);
    }

    expect(spec).toContain("installActiveMissionFixture");
    expect(spec).toContain("FIXTURE_MISSION_HREF");
    expect(spec).toContain('section[aria-label="En cours"] a[href=');
    expect(spec).toContain('page.route("**/api/bookings/overview"');
    expect(spec).toContain('page.route("**/api/bookings/activity-hidden"');
    expect(spec).toContain('page.route("**/api/bookings/split-missions"');
    expect(spec).toContain('page.route("**/rest/v1/bookings**"');
    expect(spec).toContain('page.route("**/rest/v1/booking_status_events**"');
    expect(spec).toContain('page.route("**/rest/v1/profiles**"');
    expect(spec).toContain('page.route("**/rest/v1/services**"');
    expect(spec).toContain('route.request().method() !== "GET"');
    expect(spec).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("measures objective layout and interaction invariants without modal false positives", () => {
    for (const contract of [
      "horizontalOverflow",
      "horizontallyClipped",
      "fixedOutsideViewport",
      "blockedControls",
      "overlaps",
      "mainVisible",
      "isInsideIntentionalHorizontalScroller",
      "scopeSelector",
      "window.scrollTo",
      "window.scrollX",
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

    expect(spec).toContain("user-reachable horizontal page scroll");
    expect(spec).toContain("rawRootOverflow");
    expect(spec).toContain("'[role=\"dialog\"][aria-modal=\"true\"]'");
  });

  it("opens the settings language disclosure before certifying its options", () => {
    expect(spec).toContain('/^(Langue|Language|Taal|Sprache)$/');
    expect(spec).toContain('getAttribute("aria-expanded")');
    expect(spec).toContain('getByRole("combobox"');
    expect(spec).toContain('getByRole("option")');
    for (const language of ["Français", "English", "Nederlands", "Deutsch"]) {
      expect(spec).toContain(`"${language}"`);
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

  it("uses browser-local mocks for Voice and Photo without paid visual services", () => {
    expect(spec).toContain("MockSpeechRecognition");
    expect(spec).toContain('Object.defineProperty(mediaDevices, "getUserMedia"');
    expect(spec).toContain(
      'new DOMException("UX certification denied camera", "NotAllowedError")'
    );
    expect(workflow).not.toMatch(/figma|chromatic|percy|applitools|browserstack/i);
  });
});
