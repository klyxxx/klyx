import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app/provider/jobs/page.tsx"),
  "utf8"
);

const assistantPromptSource = fs.readFileSync(
  path.join(process.cwd(), "lib/klyx-provider-assistant-mission-prompt.ts"),
  "utf8"
);

const jobsRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/provider/jobs/jobs-route-core.ts"),
  "utf8"
);

const offerRouteSource = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/market/requests/[id]/offers/offer-route-core.ts"
  ),
  "utf8"
);

describe("KLYX provider jobs i18n safety contract", () => {
  it("keeps jobs loading authenticated, read-only and non-cached", () => {
    expect(pageSource).toContain('fetch("/api/provider/jobs", {');
    expect(pageSource).toContain('cache: "no-store"');
    expect(pageSource).toContain('Authorization: "Bearer " + accessToken');
    expect(jobsRouteSource).toMatch(/automaticExecutionAllowed:\s*false/);
    expect(jobsRouteSource).toMatch(/fullCoverageOnly:\s*true/);
  });

  it("keeps offer creation behind explicit provider form submission", () => {
    expect(pageSource).toContain("event.preventDefault();");
    expect(pageSource).toContain(
      "onSubmit={(event) => void submitOffer(event, item)}"
    );
    expect(pageSource).toContain(
      '"/api/market/requests/" + request.id + "/offers"'
    );
    expect(pageSource).toContain('method: "POST"');
    expect(pageSource).toMatch(
      /body:\s*JSON\.stringify\(\{\s*amount,\s*message:\s*messages\[request\.id\]\s*\?\?\s*"",\s*\}\)/
    );
    expect(pageSource).not.toContain("setInterval(");
    expect(pageSource).not.toContain("setTimeout(");
  });

  it("keeps client and server amount/message guards", () => {
    expect(pageSource).toContain("!Number.isFinite(amount) || amount <= 0");
    expect(pageSource).toContain('min="0.01"');
    expect(pageSource).toContain("maxLength={1500}");
    expect(offerRouteSource).toContain("const message = clean(body.message, 1500);");
    expect(offerRouteSource).toContain("amount > 1000000");
    expect(offerRouteSource).toMatch(/amount\s*<=\s*0/);
  });

  it("keeps both multi-slot full-coverage guards and live revalidation", () => {
    expect(pageSource).toMatch(
      /request\.requestMode\s*===\s*"multi_slot"\s*&&\s*!request\.coverage\?\.fullCoverage/
    );
    expect(pageSource).toMatch(
      /item\.requestMode\s*===\s*"multi_slot"\s*&&\s*!item\.coverage\?\.fullCoverage/
    );
    expect(jobsRouteSource).toContain("candidate.full_coverage");
    expect(jobsRouteSource).toMatch(/fullCoverageOnly:\s*true/);
    expect(offerRouteSource).toContain("MULTI_SLOT_FULL_COVERAGE_REQUIRED");
    expect(offerRouteSource).toContain("validateProviderLiveMultiSlotCoverage");
    expect(offerRouteSource).toContain("MULTI_SLOT_LIVE_COVERAGE_REQUIRED");
  });

  it("keeps provider-authored and request data verbatim in the reusable mission card", () => {
    expect(pageSource).toContain("{item.title}");
    expect(pageSource).toContain("{item.city}");
    expect(pageSource).toContain("{item.description}");
    expect(pageSource).toContain("{reason}");
    expect(pageSource).toContain('item.service?.name ?? t("fallbackService")');
    expect(pageSource).toContain("item.coverage.label");
  });

  it("keeps assistant handoff non-executing and preserves its localized mission sentinel", () => {
    expect(pageSource).toContain('"/provider/assistant?prompt="');
    expect(pageSource).toContain("buildKlyxProviderAssistantMissionPrompt(locale, {");
    expect(assistantPromptSource).toContain("`${labels.mission}: ${context.title}`");
    expect(assistantPromptSource).toContain("labels.control");
    expect(pageSource).toContain('t("assistantControlNote")');
    expect(pageSource).not.toContain("/api/stripe");
    expect(pageSource).not.toContain("/api/bookings");
    expect(pageSource).not.toContain("payment_intent");
    expect(pageSource).not.toContain("refund");
    expect(pageSource).not.toContain("transfer");
  });

  it("localizes presentation without reflecting backend or network errors", () => {
    expect(pageSource).toContain("useKlyxLocale()");
    expect(pageSource).toContain("translateKlyxProviderJobs(locale, key)");
    expect(pageSource).toContain('t("loadError")');
    expect(pageSource).toContain('t("offerError")');
    expect(pageSource).not.toContain("body.error");
    expect(pageSource).not.toContain("error.message");
  });
});
