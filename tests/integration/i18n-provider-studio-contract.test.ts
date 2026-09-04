import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const studioSource = fs.readFileSync(
  path.join(process.cwd(), "app/components/ProviderStudio.tsx"),
  "utf8"
);

const routeSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/provider/studio/studio-route-core.ts"),
  "utf8"
);

describe("KLYX provider studio i18n safety contract", () => {
  it("keeps the deterministic studio API surface and payloads", () => {
    expect(studioSource).toContain('fetch("/api/provider/studio", {');
    expect(studioSource).toContain('method: "GET"');
    expect(studioSource).toContain('method: "PUT"');
    expect(studioSource).toContain('method: "POST"');
    expect(studioSource).toContain('method: "DELETE"');
    expect(studioSource).toContain("businessName,");
    expect(studioSource).toContain("headline,");
    expect(studioSource).toContain("bio,");
    expect(studioSource).toContain("yearsExperience: Number(yearsExperience || 0)");
    expect(studioSource).toContain("publish,");
    expect(studioSource).toContain("services,");
    expect(studioSource).toContain('formData.append("kind", kind)');
    expect(studioSource).toContain('formData.append("file", file)');
    expect(studioSource).toContain(
      'formData.append("documentType", extra.documentType)'
    );
  });

  it("keeps publication and destructive actions explicitly user-triggered", () => {
    expect(studioSource).toContain("onClick={() => void saveStudio(true)}");
    expect(studioSource).toContain("onClick={() => void saveStudio(false)}");
    expect(studioSource).toContain('window.confirm(t("deleteConfirm"))');
    expect(studioSource).toContain(
      'onClick={() => void deleteMedia("gallery", item.id)}'
    );
    expect(studioSource).toContain(
      'onClick={() => void deleteMedia("document", document.id)}'
    );
    expect(studioSource).not.toContain("setInterval(");
    expect(studioSource).not.toContain("setTimeout(");
  });

  it("preserves upload, pricing, zone and availability boundaries", () => {
    expect(studioSource).toContain("studio.gallery.length >= 8");
    expect(studioSource).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(studioSource).toContain(
      'accept="application/pdf,image/jpeg,image/png,image/webp"'
    );
    expect(studioSource).toContain("serviceArea: [...service.serviceArea, zone].slice(0, 10)");
    expect(studioSource).toContain('max="10000"');
    expect(studioSource).toContain('max="100"');
    expect(studioSource).toContain("DAY_LABELS.map((definition) => {");
    expect(routeSource).toContain("hourlyPrice < 1 || hourlyPrice > 10000");
    expect(routeSource).toContain("fixedPrice < 1 || fixedPrice > 10000");
    expect(routeSource).toContain(").slice(0, 10)");
  });

  it("localizes presentation without changing canonical service or document values", () => {
    expect(studioSource).toContain("useKlyxLocale()");
    expect(studioSource).toContain("translateKlyxProviderStudio(locale, key, params)");
    expect(studioSource).toContain("getKlyxProviderStudioServiceLabel(");
    expect(studioSource).toContain("getKlyxProviderStudioDayLabel(");
    expect(studioSource).toContain("getKlyxProviderStudioDocumentTypeLabel(");
    expect(studioSource).toContain("getKlyxProviderStudioDocumentStatusLabel(");
    expect(studioSource).toContain('value={documentType}');
    expect(studioSource).toContain('await uploadMedia("gallery", file, t("galleryUploadError"))');
    expect(studioSource).toContain('"document",\n        file,\n        t("documentUploadError"),\n        { documentType }');
    expect(studioSource).not.toContain("Configurer mes services");
    expect(studioSource).not.toContain("Disponibilités hebdomadaires");
    expect(studioSource).not.toContain("Pièce d’identité est nécessaire");
  });

  it("keeps Stripe and Twilio outside the Studio presentation lot", () => {
    expect(studioSource).not.toContain("/api/stripe");
    expect(studioSource).not.toContain("twilio");
    expect(studioSource).not.toContain("payment_intent");
    expect(studioSource).not.toContain("transfer");
  });
});
