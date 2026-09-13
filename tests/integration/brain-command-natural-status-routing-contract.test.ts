import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const classifierSource = readFileSync(
  join(process.cwd(), "lib/klyx-assistant-intent.ts"),
  "utf8"
);
const handlerSource = readFileSync(
  join(process.cwd(), "app/api/brain/converse/unified-intent.ts"),
  "utf8"
);
const commandSource = readFileSync(
  join(process.cwd(), "app/api/brain/command/route.ts"),
  "utf8"
);

describe("brain command natural status routing contract", () => {
  it("classifies existing-mission status intent before any new service flow", () => {
    expect(classifierSource).toContain("hasSpecificBrainCommandIntent(normalizedMessage)");
    expect(classifierSource).toContain("hasGeneralBrainCommandIntent(normalizedMessage)");
    expect(classifierSource).toContain("if (missionManagement && !incomeSearch)");
    expect(classifierSource).toContain('intent: "mission_management"');
  });

  it("uses a specifically matching grounded action for specific intents", () => {
    expect(handlerSource).toContain("hasSpecificBrainCommandIntent(intent.normalizedMessage)");
    expect(handlerSource).toContain("bestSpecificBrainCommandAction(actions, intent.normalizedMessage)");
    expect(handlerSource).toContain("bestBrainCommandAction(actions, intent.normalizedMessage)");
  });

  it("does not convert missing mission actions into service creation or execution", () => {
    expect(handlerSource).toContain("if (!action)");
    expect(handlerSource).toContain("action: null");
    expect(handlerSource).toContain("automaticExecutionAllowed: false");
    expect(handlerSource).not.toContain("/api/bookings/create");
    expect(commandSource).toContain("automaticExecutionAllowed: false");
  });
});
