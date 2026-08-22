import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function repoPath(file: string) {
  return path.join(process.cwd(), file);
}

function read(file: string) {
  return fs
    .readFileSync(repoPath(file), "utf8")
    .replace(/\r\n/g, "\n");
}

const vision = read("lib/photo-vision-analysis.ts");
const route = read("app/api/requests/photo/photo-route-core.ts");
const page = read("app/request/photo/page.tsx");
const compactPage = page.replace(/\s+/g, " ");
const rateLimit = read("lib/api-rate-limit.ts");
const goldenPhoto = read("scripts/golden-path-photo-lifecycle.mjs");
const goldenWorkflow = read(".github/workflows/klyx-golden-path.yml");
const baseline = read(
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql"
);

describe("KLYX real photo vision", () => {
  it("keeps the isolated Golden photo proof syntax valid", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ["--check", repoPath("scripts/golden-path-photo-lifecycle.mjs")],
        { stdio: "pipe" }
      )
    ).not.toThrow();
  });

  it("uses the existing canonical vision_ai schema mode", () => {
    expect(baseline).toContain(
      "photo_service_requests_analysis_mode_check"
    );
    expect(baseline).toContain("'description_assisted'::\"text\"");
    expect(baseline).toContain("'vision_ai'::\"text\"");
    expect(route).toContain('analysisMode: "description_assisted" | "vision_ai"');
    expect(route).toContain('analysis_mode: analysis.analysisMode');
  });

  it("keeps real vision explicitly enabled and configurable", () => {
    expect(vision).toContain('process.env.KLYX_VISION_ENABLED === "1"');
    expect(vision).toContain("process.env.KLYX_VISION_MODEL");
    expect(vision).toContain('DEFAULT_VISION_MODEL = "gpt-5-mini"');
    expect(vision).toContain('fetch("https://api.openai.com/v1/responses"');
    expect(vision).toContain("store: false");
    expect(vision).toContain('type: "input_image"');
    expect(vision).toContain('detail: "low"');
    expect(vision).toContain('type: "json_schema"');
    expect(vision).toContain("AbortSignal.timeout(20000)");
  });

  it("requires per-photo user consent before external visual analysis", () => {
    expect(page).toContain("const [useVision, setUseVision] = useState(false)");
    expect(page).toContain("Autoriser l’analyse visuelle IA de cette photo");
    expect(page).toContain("useVision,");
    expect(route).toContain("const visionRequested = body.useVision === true");
    expect(route).toContain("if (visionRequested && visionEnabled)");
    expect(route).toContain('.download(storagePath)');
    expect(route).toContain('"vision_not_requested"');
  });

  it("checks actual image bytes and keeps private storage private", () => {
    expect(route).toContain("hasExpectedImageSignature");
    expect(route).toContain('mimeType === "image/jpeg"');
    expect(route).toContain('mimeType === "image/png"');
    expect(route).toContain('=== "WEBP"');
    expect(route).toContain('.from("client-service-photos")');
    expect(route).toContain('.download(storagePath)');
    expect(route).not.toContain("getPublicUrl");
    expect(route).not.toContain("createSignedUrl");
  });

  it("prevents weak visual evidence from choosing a service", () => {
    expect(vision).toContain(
      "export const PHOTO_VISION_MIN_RELIABLE_CONFIDENCE = 60"
    );
    expect(route).toContain(
      "evidence.confidence >= PHOTO_VISION_MIN_RELIABLE_CONFIDENCE"
    );
    expect(route).toContain(
      "trop incertains pour influencer le métier proposé"
    );
    expect(route).toContain("visionContributed");
    expect(page).toContain("Confiance des indices visuels");
    expect(page).toContain(
      "Les indices visuels n’étaient pas assez fiables"
    );
  });

  it("forbids identification, sensitive inference and technical certainty", () => {
    expect(vision).toContain("N'identifie jamais une personne");
    expect(vision).toContain("caractéristique personnelle sensible");
    expect(vision).toContain("ignore son identité");
    expect(vision).toContain("diagnostic technique");
    expect(route).toContain("jamais un diagnostic technique");
  });

  it("persists only bounded analysis metadata, never image bytes or raw visual evidence", () => {
    expect(route).toContain("analysis_payload: {");
    expect(route).toContain("requested: visionRequested");
    expect(route).toContain("available: visionEnabled");
    expect(route).toContain("fallbackReason: vision.fallbackReason");
    expect(route).not.toContain("base64");
    expect(route).not.toContain("dataUrl");
    expect(route).not.toContain("visionSummary");
    expect(route).not.toContain("serviceHints:");
  });

  it("rate-limits costly photo analysis and never triggers transactions", () => {
    expect(rateLimit).toContain("photoAnalysis: {");
    expect(rateLimit).toContain('action: "photo_analysis"');
    expect(route).toContain("API_RATE_LIMIT_POLICIES.photoAnalysis");
    expect(route).toContain("consumeApiRateLimit");
    expect(route).not.toContain("stripe");
    expect(route).not.toContain('/api/bookings');
    expect(route).not.toContain('.from("bookings")');
    expect(route).not.toContain('.from("messages")');
    expect(route).not.toContain("sendEmail");
  });

  it("keeps the UI truthful about vision, fallback and transaction boundaries", () => {
    expect(page).toContain('analysis.analysisMode === "vision_ai"');
    expect(page).toContain("Vision KLYX");
    expect(page).toContain("Analyse de la description");
    expect(page).toContain("Compatibilité KLYX");
    expect(compactPage).toContain(
      "elle ne publie, ne réserve et ne paie rien automatiquement."
    );
    expect(page).not.toContain("La future analyse visuelle réelle sera activée");
  });

  it("proves upload, analysis, metadata and deletion on isolated Supabase without external vision", () => {
    expect(goldenWorkflow).toContain('KLYX_VISION_ENABLED: "0"');
    expect(goldenWorkflow).toContain(
      "-x realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"
    );
    expect(goldenWorkflow).toContain(
      "Verify private photo upload, analysis and deletion lifecycle"
    );
    expect(goldenWorkflow).toContain(
      "node scripts/golden-path-photo-lifecycle.mjs"
    );
    expect(goldenPhoto).toContain('const BUCKET = "client-service-photos"');
    expect(goldenPhoto).toContain("createBucket(");
    expect(goldenPhoto).toContain(".upload(storagePath, pngBytes");
    expect(goldenPhoto).toContain('`${BASE_URL}/api/requests/photo`');
    expect(goldenPhoto).toContain("useVision: true");
    expect(goldenPhoto).toContain("analysisBody.visionAvailable");
    expect(goldenPhoto).toContain("false,");
    expect(goldenPhoto).toContain("analysisBody.analysisMode");
    expect(goldenPhoto).toContain('"description_assisted"');
    expect(goldenPhoto).toContain('.from("photo_service_requests")');
    expect(goldenPhoto).toContain('method: "DELETE"');
    expect(goldenPhoto).toContain("deletedMetadata");
    expect(goldenPhoto).toContain("await objectExists()");
    expect(goldenPhoto).toContain("goldenPhotoLifecycleVerified: true");
    expect(goldenPhoto).toContain("externalVisionCalled: false");
  });
});
