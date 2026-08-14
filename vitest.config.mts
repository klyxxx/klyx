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

export default defineConfig({
  resolve: {
    alias: {
      "@":
        root,
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