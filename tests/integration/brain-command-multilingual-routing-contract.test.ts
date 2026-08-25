import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/api/brain/command/route.ts"),
  "utf8"
);

describe("KLYX brain command multilingual routing contract", () => {
  it("uses the dedicated multilingual intent helper", () => {
    expect(source).toContain('from "@/lib/brain-command-intent"');
    expect(source).toContain("normalizeBrainCommandMessage(rawMessage)");
    expect(source).toContain("hasSpecificBrainCommandIntent(message)");
    expect(source).toContain("hasGeneralBrainCommandIntent(message)");
    expect(source).toContain("hasNewNeedBrainCommandIntent(message)");
    expect(source).toContain("bestBrainCommandAction(actions, message)");
  });

  it("keeps actions recalculated server-side and capped at twenty", () => {
    expect(source).toContain("await getBrainActions(profile)");
    expect(source).toContain(".slice(0, 20)");
  });

  it("never executes an action automatically", () => {
    expect(source.match(/automaticExecutionAllowed: false/g)?.length).toBe(3);
    expect(source).not.toContain("stripe.checkout");
    expect(source).not.toContain("paymentIntents.create");
    expect(source).not.toContain("refunds.create");
  });

  it("keeps new needs behind the assistant market confirmation flow", () => {
    expect(source).toContain('mode: "new_request"');
    expect(source).toContain("requiresConfirmation: true");
    expect(source).toContain('href: "/assistant/market?" + params.toString()');
    expect(source).toContain('params.set("request", rawMessage)');
  });

  it("keeps general no-action routing to the action center", () => {
    expect(source).toContain('mode: "no_action"');
    expect(source).toContain('href: "/assistant/actions"');
  });

  it("preserves the 700-character command boundary", () => {
    expect(source).toContain("rawMessage.length > 700");
  });
});
