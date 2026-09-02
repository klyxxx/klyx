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
  it("keeps the canonical client composer while making new requests conversational", () => {
    const home = read("app/assistant/page.tsx");
    const composer = read("app/components/AssistantCommandBar.tsx");

    expect(home).toContain("<AssistantCommandBar />");
    expect(home).toContain("<AssistantHomeResume />");

    expect(composer).toContain('fetch("/api/brain/command"');
    expect(composer).toContain('result.mode !== "new_request"');
    expect(composer).toContain('fetch("/api/brain/converse"');
    expect(composer).toContain('"/api/brain/confirm-request"');
    expect(composer).toContain('fetch("/api/brain/market-publish"');
    expect(composer).toContain("flowCopy.confirm");
    expect(composer).toContain("flowCopy.edit");
    expect(composer).toContain('router.push("/request/photo")');
  });

  it("uses one visible OpenAI wording call without changing deterministic facts", () => {
    const clientRoute = read("app/api/brain/converse/route.ts");
    const providerBoundary = read("app/api/provider/assistant/route.ts");
    const providerVisible = read(
      "app/api/provider/assistant/assistant-route-visible.ts"
    );
    const visibleAi = read("lib/klyx-visible-ai.ts");
    const shadow = read("lib/brain/llm/shadow.ts");

    expect(clientRoute).toContain("withoutKlyxLlmShadow");
    expect(clientRoute).toContain("deterministicPost(request)");
    expect(clientRoute).toContain("generateKlyxVisibleAiReply");
    expect(clientRoute).toContain("deterministicSafety: true");

    expect(shadow).toContain("AsyncLocalStorage");
    expect(shadow).toContain("shadowSuppression.getStore() === true");
    expect(shadow).toContain("withoutKlyxLlmShadow");

    expect(providerBoundary).toContain('POST as corePost');
    expect(providerBoundary).toContain('from "./assistant-route-visible"');
    expect(providerBoundary).toContain(
      'secureBoundary("POST", corePost, request)'
    );
    expect(providerVisible).toContain("deterministicPost(request)");
    expect(providerVisible).toContain('responseBody.aiMode === "openai"');
    expect(providerVisible).toContain("deterministicSafety: true");

    expect(visibleAi).toContain("ne change aucun fait verrouillé");
    expect(visibleAi).toContain("ne prétends jamais qu'une action a été exécutée");
    expect(visibleAi).toContain('mode: "fallback"');
  });
});