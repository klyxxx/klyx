import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

const serverOnlyStub = fileURLToPath(
  new URL("./tests/stubs/server-only.ts", import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: {
      "server-only": serverOnlyStub,
    },
  },
  test: {
    alias: {
      "server-only": serverOnlyStub,
    },
    server: {
      deps: {
        inline: ["server-only"],
      },
    },
  },
});
