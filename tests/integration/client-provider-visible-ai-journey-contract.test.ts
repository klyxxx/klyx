import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(
    path.join(process.cwd(), relativePath),
    "utf8"
  );
}

describe("KLYX visible AI journeys", () => {
  it("keeps the client request journey on one conversational entry screen", () => {
    const home = read("app/assistant/page.tsx");
    const flow = read("app/components/ClientAssistantFlow.tsx");

    expect(home).toContain("ClientAssistantFlow");
    expect(home).not.toContain("AssistantHomeResume");
    expect(home).not.toContain("AssistantCommandBar");

    expect(flow).toContain('fetch("/api/brain/command"');
    expect(flow).toContain('fetch("/api/brain/converse"');
    expect(flow).toContain('"/api/brain/confirm-request"');
    expect(flow).toContain('fetch("/api/brain/market-publish"');
    expect(flow).toContain("Confirmer");
    expect(flow).toContain("Modifier");
    expect(flow).toContain('router.push("/request/photo")');
  });

  it("uses OpenAI as a visible wording layer without changing deterministic facts", () => {
    const clientRoute = read("app/api/brain/converse/route.ts");
    const providerRoute = read("app/api/provider/assistant/route.ts");
    const visibleAi = read("lib/klyx-visible-ai.ts");

    expect(clientRoute).toContain("deterministicPost(request)");
    expect(clientRoute).toContain("generateKlyxVisibleAiReply");
    expect(clientRoute).toContain("deterministicSafety: true");

    expect(providerRoute).toContain("visibleProviderPost");
    expect(providerRoute).toContain('responseBody.aiMode === "openai"');
    expect(providerRoute).toContain("deterministicSafety: true");

    expect(visibleAi).toContain("ne change aucun fait verrouillé");
    expect(visibleAi).toContain("ne prétends jamais qu'une action a été exécutée");
    expect(visibleAi).toContain('mode: "fallback"');
  });
});
