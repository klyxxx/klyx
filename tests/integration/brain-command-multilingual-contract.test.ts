import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routeSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/brain/command/route.ts"),
  "utf8"
);

const helperSource = fs.readFileSync(
  path.join(process.cwd(), "lib/brain-command-intent.ts"),
  "utf8"
);

describe("KLYX multilingual brain command router contract", () => {
  it("delegates intent parsing to the multilingual helper", () => {
    expect(routeSource).toContain('from "@/lib/brain-command-intent"');
    expect(routeSource).toContain("normalizeBrainCommandMessage(");
    expect(routeSource).toContain("hasSpecificBrainCommandIntent(");
    expect(routeSource).toContain("hasGeneralBrainCommandIntent(");
    expect(routeSource).toContain("hasNewNeedBrainCommandIntent(");
    expect(routeSource).toContain("bestBrainCommandAction(");
    expect(routeSource).not.toContain("function normalize(");
    expect(routeSource).not.toContain("function includesAny(");
  });

  it("preserves authentication, message validation and the 20-action cap", () => {
    expect(routeSource).toContain("getAuthenticatedProfile(");
    expect(routeSource).toContain('body.message?.trim() ?? ""');
    expect(routeSource).toContain('from "@/lib/klyx-assistant-message-limits"');
    expect(routeSource).toContain("isKlyxAssistantMessageTooLong(rawMessage)");
    expect(routeSource).toContain("getBrainActions(");
    expect(routeSource).toContain(").slice(0, 20)");
  });

  it("preserves existing-action routing without automatic execution", () => {
    expect(routeSource).toContain('mode:\n            "existing_action"');
    expect(routeSource).toContain("automaticExecutionAllowed:\n            false");
    expect(routeSource).toContain("action,");
  });

  it("preserves new-request confirmation and the raw user request", () => {
    expect(routeSource).toContain('params.set(\n        "request",\n        rawMessage');
    expect(routeSource).toContain('mode:\n          "new_request"');
    expect(routeSource).toContain("requiresConfirmation:\n          true");
    expect(routeSource).toContain('"/assistant/market?" +');
  });

  it("preserves every no-execution path including unsafe href rejection", () => {
    expect(routeSource).toContain('mode:\n        "no_action"');
    expect(routeSource).toContain('href:\n        "/assistant/actions"');
    expect(routeSource).toContain("if (!safeHref)");
    expect(routeSource.match(/automaticExecutionAllowed:\s*false/g)?.length).toBe(4);
    expect(routeSource).not.toContain("payment_intents");
    expect(routeSource).not.toContain("checkout.sessions");
    expect(routeSource).not.toContain("refunds.create");
    expect(routeSource).not.toContain("/api/bookings/create");
  });

  it("keeps multilingual signals explicit in the helper", () => {
    expect(helperSource).toContain('"what should i do"');
    expect(helperSource).toContain('"wat moet ik doen"');
    expect(helperSource).toContain('"was soll ich tun"');
    expect(helperSource).toContain('"i need"');
    expect(helperSource).toContain('"ik zoek"');
    expect(helperSource).toContain('"ich brauche"');
    expect(helperSource).toContain('.replace(/ß/g, "ss")');
  });
});
