import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX real OpenAI end-to-end probe", () => {
  it("exercises the real assistant and vision gateways behind admin auth", () => {
    const route = read("app/api/admin/openai-e2e/route.ts");

    expect(route).toContain("requireKlyxAdmin()");
    expect(route).toContain("generateKlyxAiReply({");
    expect(route).toContain("analyzePhotoVisualContent({");
    expect(route).toContain('assistant.mode === "openai"');
    expect(route).toContain('vision.provider === "openai"');
    expect(route).toContain("vision.used");
    expect(route).toContain("export async function POST()");
  });

  it("uses only synthetic in-memory image data and exposes no model output", () => {
    const route = read("app/api/admin/openai-e2e/route.ts");

    expect(route).toContain("createSyntheticProbePng()");
    expect(route).toContain("deflateSync(raw)");
    expect(route).toContain("un carré bleu sur fond blanc");
    expect(route).not.toContain("request.json");
    expect(route).not.toContain("assistant.text");
    expect(route).not.toContain("supabase");
    expect(route).not.toContain("stripe");
    expect(route).not.toContain('from("bookings")');
  });

  it("requires an explicit admin click instead of spending OpenAI credits automatically", () => {
    const component = read("app/components/OpenAiE2eProbe.tsx");
    const page = read("app/ai-status/page.tsx");

    expect(component).toContain('fetch("/api/admin/openai-e2e"');
    expect(component).toContain('method: "POST"');
    expect(component).toContain("onClick={() => void runProbe()}");
    expect(component).not.toContain("useEffect");
    expect(page).toContain('import OpenAiE2eProbe from "@/app/components/OpenAiE2eProbe"');
    expect(page).toContain("<OpenAiE2eProbe");
    expect(page).not.toContain('"use client"');
    expect(page).not.toContain("fetch(");
  });

  it("keeps the AI status surface in the single-blue KLYX visual language", () => {
    const page = read("app/ai-status/page.tsx");

    expect(page).toContain("text-blue-600");
    expect(page).not.toContain("violet-");
    expect(page).not.toContain("linear-gradient");
  });
});
