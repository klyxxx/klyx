import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const mobile = (...parts: string[]) => path.join(root, "mobile", ...parts);

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(?:ts|tsx|js|jsx|json|env|example)$/.test(entry.name) ? [full] : [];
  });
}

describe("mobile release contract", () => {
  it("uses Expo 57, React Native 0.86 and explicit store identities", () => {
    const pkg = JSON.parse(fs.readFileSync(mobile("package.json"), "utf8"));
    const app = JSON.parse(fs.readFileSync(mobile("app.json"), "utf8"));

    expect(pkg.dependencies.expo).toMatch(/^~57\./);
    expect(pkg.dependencies["react-native"]).toMatch(/^0\.86\./);
    expect(app.expo.ios.bundleIdentifier).toBe("be.klyx.app");
    expect(app.expo.android.package).toBe("be.klyx.app");
  });

  it("keeps all provider secrets out of mobile source", () => {
    const source = sourceFiles(mobile()).map((file) => fs.readFileSync(file, "utf8")).join("\n");
    for (const marker of [
      "STRIPE_SECRET_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUMSUB_SECRET_KEY",
      "TWILIO_AUTH_TOKEN",
      "RESEND_API_KEY",
      "OPENAI_API_KEY",
      "ELMAH_IO_API_KEY",
      "TURNSTILE_SECRET_KEY",
    ]) {
      expect(source).not.toContain(marker);
    }
  });

  it("uses the canonical HTTPS product and controlled rollout profiles", () => {
    const api = fs.readFileSync(mobile("src", "lib", "klyx-api.ts"), "utf8");
    const eas = JSON.parse(fs.readFileSync(mobile("eas.json"), "utf8"));
    const app = JSON.parse(fs.readFileSync(mobile("app.json"), "utf8"));

    expect(api).toContain("https://www.klyx.be");
    expect(api).not.toContain("http://www.klyx.be");
    expect(eas.build.internal.distribution).toBe("internal");
    expect(eas.build.test.distribution).toBe("internal");
    expect(eas.build.production.autoIncrement).toBe(true);
    expect(eas.build.internal.env.EXPO_PUBLIC_KLYX_RELEASE_CHANNEL).toBe("INTERNAL");
    expect(eas.build.test.env.EXPO_PUBLIC_KLYX_RELEASE_CHANNEL).toBe("TEST");
    expect(eas.build.production.env.EXPO_PUBLIC_KLYX_RELEASE_CHANNEL).toBe("PILOT");
    expect(app.expo.extra.releaseControl.stripeLiveImplicitActivation).toBe(false);
    expect(app.expo.extra.releaseControl.paidProviderImplicitActivation).toBe(false);
  });
});
