import {
  fileURLToPath,
} from "node:url";

import {
  defineConfig,
} from "vitest/config";

// KLYX_TEST_INTEGRATION_FOUNDATION_13_30

const root =
  fileURLToPath(
    new URL(
      ".",
      import.meta.url
    )
  );

const serverOnlyStub =
  fileURLToPath(
    new URL(
      "./tests/stubs/server-only.ts",
      import.meta.url
    )
  );

export default defineConfig({
  resolve: {
    alias: {
      "@":
        root,
      "server-only":
        serverOnlyStub,
    },
  },

  test: {
    environment:
      "node",

    globals:
      false,

    include: [
      "tests/**/*.test.ts",
    ],

    exclude: [
      "node_modules/**",
      ".next/**",
      "scripts/backups/**",
    ],

    alias: {
      "server-only":
        serverOnlyStub,
    },

    server: {
      deps: {
        inline: [
          "server-only",
        ],
      },
    },

    clearMocks:
      true,

    restoreMocks:
      true,

    mockReset:
      true,

    testTimeout:
      10_000,
  },
});