import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const commandSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/brain/command/route.ts"),
  "utf8"
);
const classifierSource = fs.readFileSync(
  path.join(process.cwd(), "lib/klyx-assistant-intent.ts"),
  "utf8"
);
const helperSource = fs.readFileSync(
  path.join(process.cwd(), "lib/brain-command-intent.ts"),
  "utf8"
);
const handlerSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/brain/converse/unified-intent.ts"),
  "utf8"
);

describe("KLYX multilingual brain command router contract", () => {
  it("delegates unified intent parsing to the multilingual classifier", () => {
    expect(commandSource).toContain('from "@/lib/klyx-assistant-intent"');
    expect(commandSource).toContain("classifyKlyxAssistantIntent(rawMessage)");
    expect(classifierSource).toContain('from "@/lib/brain-command-intent"');
    expect(classifierSource).toContain("normalizeBrainCommandMessage(rawMessage)");
    expect(classifierSource).toContain("hasSpecificBrainCommandIntent(normalizedMessage)");
    expect(classifierSource).toContain("hasGeneralBrainCommandIntent(normalizedMessage)");
    expect(classifierSource).toContain("hasNewNeedBrainCommandIntent(normalizedMessage)");
  });

  it("preserves authentication and bounded message validation in preflight", () => {
    expect(commandSource).toContain("getAuthenticatedProfile(request)");
    expect(commandSource).toContain('body.message?.trim() ?? ""');
    expect(commandSource).toContain('from "@/lib/klyx-assistant-message-limits"');
    expect(commandSource).toContain("isKlyxAssistantMessageTooLong(rawMessage)");
  });

  it("moves grounded mission selection into the shared conversation handler", () => {
    expect(handlerSource).toContain("getBrainActions(profile)).slice(0, 20)");
    expect(handlerSource).toContain("bestSpecificBrainCommandAction(actions, intent.normalizedMessage)");
    expect(handlerSource).toContain("bestBrainCommandAction(actions, intent.normalizedMessage)");
    expect(handlerSource).toContain("normalizeKlyxAssistantActionHref(localized.href)");
    expect(handlerSource).toContain("automaticExecutionAllowed: false");
  });

  it("keeps preflight role-neutral and non-transactional", () => {
    expect(commandSource).toContain('mode: "new_request"');
    expect(commandSource).toContain("assistantIntent: intent.intent");
    expect(commandSource).toContain("requiresConfirmation: false");
    expect(commandSource).toContain("automaticExecutionAllowed: false");
    expect(commandSource).toContain('href: "/assistant"');
    expect(commandSource).not.toContain("payment_intents");
    expect(commandSource).not.toContain("checkout.sessions");
    expect(commandSource).not.toContain("refunds.create");
    expect(commandSource).not.toContain("/api/bookings/create");
  });

  it("keeps multilingual service, management and income signals explicit", () => {
    expect(helperSource).toContain('"what should i do"');
    expect(helperSource).toContain('"wat moet ik doen"');
    expect(helperSource).toContain('"was soll ich tun"');
    expect(helperSource).toContain('"i need"');
    expect(helperSource).toContain('"ik zoek"');
    expect(helperSource).toContain('"ich brauche"');
    expect(helperSource).toContain('.replace(/ß/g, "ss")');

    expect(classifierSource).toContain('"earn"');
    expect(classifierSource).toContain('"opdrachten vinden"');
    expect(classifierSource).toContain('"auftrage finden"');
  });
});
