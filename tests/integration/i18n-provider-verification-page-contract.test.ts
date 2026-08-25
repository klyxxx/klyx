import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const page = readRepoFile("app/provider/verification/page.tsx");
const api = readRepoFile("app/api/provider/verification/route.ts");
const documentApi = readRepoFile(
  "app/api/provider/verification/document/route.ts"
);
const i18n = readRepoFile("lib/klyx-provider-verification-i18n.ts");

describe("KLYX provider verification i18n contract", () => {
  it("uses the shared locale provider with explicit French fallback", () => {
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("translateKlyxProviderVerification");
    expect(page).toContain("translateKlyxProviderVerificationStatus");
    expect(page).toContain("getKlyxProviderVerificationDocumentType");
    expect(i18n).toContain(
      'return LOCALE_SET.has(locale)\n    ? (locale as KlyxProviderVerificationLocale)\n    : "fr"'
    );
  });

  it("preserves the authenticated no-store verification read", () => {
    expect(page).toContain('"/api/provider/verification"');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("Authorization: `Bearer ${token}`");
    expect(api).toContain('requireAccountType(profile, "provider")');
    expect(api).toContain('.eq("profile_id", profile.id)');
  });

  it("preserves private direct upload, accepted MIME types and 10 MiB maximum", () => {
    expect(page).toContain('.from("provider-verification")');
    expect(page).toContain(".upload(path, file");
    expect(page).toContain("cacheControl: \"3600\"");
    expect(page).toContain("upsert: false");
    expect(page).toContain("contentType: file.type");
    expect(page).toContain("file.size > 10 * 1024 * 1024");

    for (const mime of [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]) {
      expect(page).toContain(`\"${mime}\"`);
      expect(api).toContain(`\"${mime}\"`);
    }
  });

  it("preserves exact profile/type path ownership and evidence registration payload", () => {
    expect(page).toContain(
      "`${profileId}/${type}/${safeFileName(file.name)}`"
    );
    expect(page).toContain('method: "POST"');
    expect(page).toContain("documentType: type");
    expect(page).toContain("storagePath: path");
    expect(page).toContain("originalName: file.name");
    expect(page).toContain("mimeType: file.type");
    expect(page).toContain("sizeBytes: file.size");
    expect(api).toContain('storagePath.startsWith(`${profile.id}/`)');
    expect(api).toContain('storagePath.includes("..")');
  });

  it("preserves failed-registration Storage rollback", () => {
    expect(page).toContain("if (!response.ok)");
    expect(page).toContain('.from("provider-verification")');
    expect(page).toContain(".remove([path])");
  });

  it("preserves explicit signed preview and owned document deletion", () => {
    expect(page).toContain('"/api/provider/verification/document"');
    expect(page).toContain("body: JSON.stringify({ documentId })");
    expect(page).toContain('method: "DELETE"');
    expect(documentApi).toContain("createSignedUrl(document.storage_path, 60)");
    expect(documentApi).toContain('.eq("profile_id", profile.id)');
    expect(documentApi).toContain('document.status === "approved"');
    expect(documentApi).toContain(".remove([document.storage_path])");
  });

  it("preserves explicit manual submission and server identity/address requirements", () => {
    expect(page).toContain('method: "PATCH"');
    expect(page).toContain('document.document_type === "identity"');
    expect(page).toContain('document.document_type === "address"');
    expect(api).toContain('verification.identity_status === "missing"');
    expect(api).toContain('verification.address_status === "missing"');
    expect(api).toContain('status: "submitted"');
  });

  it("preserves locked verification states and approved-document delete block", () => {
    for (const status of ["submitted", "under_review", "approved"]) {
      expect(page).toContain(`\"${status}\"`);
      expect(api).toContain(`\"${status}\"`);
    }
    expect(page).toContain('document.status !== "approved"');
    expect(documentApi).toContain('document.status === "approved"');
  });

  it("keeps provider and reviewer authored data verbatim", () => {
    expect(page).toContain("{document.original_name}");
    expect(page).toContain("{document.rejection_reason}");
    expect(page).not.toContain(
      "translateKlyxProviderVerificationStatus(locale, document.rejection_reason"
    );
  });

  it("uses safe localized presentation errors instead of reflecting backend or Storage errors", () => {
    expect(page).toContain('setErrorMessage(t("loadError"))');
    expect(page).toContain('setErrorMessage(t("uploadError"))');
    expect(page).toContain('setErrorMessage(t("previewError"))');
    expect(page).toContain('setErrorMessage(t("deleteError"))');
    expect(page).toContain('setErrorMessage(t("submitError"))');
    expect(page).not.toContain("body.error ||");
    expect(page).not.toContain("body.message ||");
    expect(page).not.toContain("error instanceof Error");
    expect(page).not.toContain("uploadError.message");
  });

  it("does not add booking, payment, refund, transfer or automatic verification execution", () => {
    for (const forbidden of [
      "create-checkout-session",
      "payment_intent",
      "refund",
      "transfer",
      'fetch("/api/bookings',
      "autoApprove",
      "automaticApproval",
    ]) {
      expect(page.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
