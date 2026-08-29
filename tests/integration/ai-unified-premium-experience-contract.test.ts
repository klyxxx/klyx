import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

function read(
  relativePath: string
) {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      relativePath
    ),
    "utf8"
  );
}

function collectSourceFiles(
  directory: string
): string[] {
  const absolute = path.join(
    process.cwd(),
    directory
  );

  return fs
    .readdirSync(
      absolute,
      { withFileTypes: true }
    )
    .flatMap((entry) => {
      const relative = path.join(
        directory,
        entry.name
      );

      if (entry.isDirectory()) {
        return collectSourceFiles(
          relative
        );
      }

      return /\.(?:ts|tsx)$/.test(
        entry.name
      )
        ? [relative]
        : [];
    });
}

describe(
  "KLYX unified AI and premium experience",
  () => {
    it(
      "centralizes conversational OpenAI access and inventories specialized transports",
      () => {
        const sources = [
          ...collectSourceFiles("app"),
          ...collectSourceFiles("lib"),
        ];

        const directTransports =
          sources
            .filter((file) =>
              read(file).includes(
                "api.openai.com"
              )
            )
            .sort();

        expect(
          directTransports
        ).toEqual(
          [
            path.join(
              "app",
              "api",
              "admin",
              "openai-health",
              "route.ts"
            ),
            path.join(
              "lib",
              "brain",
              "llm",
              "openai-provider.ts"
            ),
            path.join(
              "lib",
              "photo-vision-analysis.ts"
            ),
          ].sort()
        );

        const compatibilityFacade =
          read("lib/klyx-ai.ts");
        const adminHealth =
          read("app/api/admin/openai-health/route.ts");
        const photoVision =
          read("lib/photo-vision-analysis.ts");

        expect(
          compatibilityFacade
        ).toContain(
          "getKlyxLlmProvider"
        );
        expect(
          compatibilityFacade
        ).not.toContain(
          "chat/completions"
        );
        expect(
          compatibilityFacade
        ).not.toContain(
          "api.openai.com"
        );

        expect(adminHealth).toContain(
          "requireKlyxAdmin"
        );
        expect(adminHealth).toContain(
          '"/api/admin/openai-health"'
        );

        expect(photoVision).toContain(
          'process.env.KLYX_VISION_ENABLED === "1"'
        );
        expect(photoVision).toContain(
          'type: "input_image"'
        );
      }
    );

    it(
      "retires the duplicate brain UI without breaking old links",
      () => {
        const brain =
          read("app/brain/page.tsx");
        const assistant =
          read("app/assistant/page.tsx");

        expect(brain).toContain(
          'redirect("/assistant")'
        );
        expect(assistant).not.toContain(
          'href="/brain"'
        );
        expect(assistant).toContain(
          'href="/assistant/market"'
        );
        expect(assistant).toContain(
          'href="/provider/assistant"'
        );
      }
    );

    it(
      "uses the shared LLM only outside deterministic provider actions",
      () => {
        const route = read(
          "app/api/provider/assistant/assistant-route-core.ts"
        );

        expect(route).toContain(
          "generateKlyxAiReply"
        );
        expect(route).toContain(
          'result.intent === "unknown"'
        );
        expect(route).toContain(
          'if (result.intent !== "unknown")'
        );
        expect(route).toContain(
          "Structured provider actions stay deterministic"
        );
      }
    );

    it(
      "applies the premium quality layer and media defaults globally",
      () => {
        const layout =
          read("app/layout.tsx");
        const quality =
          read("app/klyx-quality-system.css");
        const image =
          read("app/components/KlyxImage.tsx");
        const nextConfig =
          read("next.config.ts");

        expect(layout).toContain(
          'import "./klyx-quality-system.css"'
        );
        expect(quality).toContain(
          ":focus-visible"
        );
        expect(quality).toContain(
          "text-wrap: balance"
        );
        expect(quality).toContain(
          "prefers-reduced-motion: reduce"
        );
        expect(image).toContain(
          "quality = 92"
        );
        expect(nextConfig).toContain(
          '"image/avif"'
        );
        expect(nextConfig).toContain(
          '"image/webp"'
        );
      }
    );
  }
);
