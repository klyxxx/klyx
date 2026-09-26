import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const mobile = (...parts: string[]) => path.join(root, "mobile", ...parts);

describe("mobile release contract", () => {
  it("uses stable Expo 57 and explicit store identities", () => {
    const pkg = JSON.parse(fs.readFileSync(mobile("package.json"), "utf8"));
    const app = JSON.parse(fs.readFileSync(mobile("app.json"), "utf8"));

    expect(pkg.dependencies.expo).toMatch(/^~57\./);
    expect(pkg.dependencies["react-native"]).toMatch(/^0\.86\./);
    expect(app.expo.ios.bundleIdentifier).toBe("be.klyx.app");
    expect(app.expo.android.package).toBe("be.klyx.app");
  });

  it("does not place KLYX provider secrets in the mobile source", () => {
    const source = fs.readFileSync(mobile("app", "index.tsx"), "utf8");
    for (const marker of [
      "STRIPE_SECRET_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUMSUB_SECRET_KEY",
      "TWILIO_AUTH_TOKEN",
      "RESEND_API_KEY",
      "OPENAI_API_KEY",
    ]) {
      expect(source).not.toContain(marker);
    }
  });

  it("defaults to the canonical HTTPS web product and requires controlled EAS profiles", () => {
    const source = fs.readFileSync(mobile("app", "index.tsx"), "utf8");
    const eas = JSON.parse(fs.readFileSync(mobile("eas.json"), "utf8"));

    expect(source).toContain("https://www.klyx.be");
    expect(source).not.toContain("http://www.klyx.be");
    expect(eas.build.development.distribution).toBe("internal");
    expect(eas.build.preview.distribution).toBe("internal");
    expect(eas.build.production.autoIncrement).toBe(true);
  });
});
