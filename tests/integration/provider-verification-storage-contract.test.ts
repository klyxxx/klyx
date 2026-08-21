import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const migration = readRepoFile(
  "supabase/migrations/20260821235500_klyx_provider_verification_storage_guard.sql"
);
const page = readRepoFile("app/provider/verification/page.tsx");
const api = readRepoFile("app/api/provider/verification/route.ts");
const documentApi = readRepoFile(
  "app/api/provider/verification/document/route.ts"
);
const golden = readRepoFile(
  "scripts/golden-path-provider-verification-storage.mjs"
);
const workflow = readRepoFile(
  ".github/workflows/klyx-provider-storage-golden.yml"
);

describe("KLYX provider verification Storage boundary", () => {
  it("versions the private bucket and accepted upload envelope", () => {
    expect(migration).toContain("insert into storage.buckets");
    expect(migration).toContain("'provider-verification'");
    expect(migration).toContain("public = false");
    expect(migration).toContain("10485760");

    for (const mime of [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]) {
      expect(migration).toContain(`'${mime}'`);
      expect(page).toContain(`\"${mime}\"`);
      expect(api).toContain(`\"${mime}\"`);
    }

    expect(page).toContain("file.size > 10 * 1024 * 1024");
    expect(api).toContain("sizeBytes > 10 * 1024 * 1024");
  });

  it("binds Storage paths to an owned provider profile without reopening profile SELECT", () => {
    expect(migration).toContain("klyx_owns_provider_verification_path");
    expect(migration).toContain("security definer");
    expect(migration).toContain(
      "profile.id::text = (storage.foldername(p_name))[1]"
    );
    expect(migration).toContain("profile.owner_user_id = auth.uid()");
    expect(migration).toContain("profile.account_type = 'provider'");
    expect(migration).toContain(
      "array_length(storage.foldername(p_name), 1) = 2"
    );
    expect(migration).toContain(
      "public.klyx_owns_provider_verification_path(name)"
    );

    for (const folder of [
      "identity",
      "address",
      "business",
      "insurance",
      "professional_certificate",
    ]) {
      expect(migration).toContain(`'${folder}'`);
    }

    for (const extension of ["pdf", "jpg", "jpeg", "png", "webp"]) {
      expect(migration).toContain(`'${extension}'`);
    }
  });

  it("keeps helper execution minimal and browser profile reads closed", () => {
    expect(migration).toContain(
      "revoke all on function public.klyx_owns_provider_verification_path(text)"
    );
    expect(migration).toContain(
      "grant execute on function public.klyx_owns_provider_verification_path(text)"
    );
    expect(migration).toContain("to authenticated, service_role");
    expect(migration).not.toContain("grant select on table public.profiles");
  });

  it("keeps legacy permissive policies unable to widen this bucket", () => {
    expect(migration).toContain("as restrictive\nfor insert");
    expect(migration).toContain("as restrictive\nfor select");
    expect(migration).toContain("as restrictive\nfor delete");
    expect(migration).toContain("as restrictive\nfor update");
    expect(migration).toContain("bucket_id <> 'provider-verification'");
    expect(migration).toContain(
      "with check (bucket_id <> 'provider-verification');"
    );
  });

  it("preserves direct upload and failed-registration cleanup without allowing dossier deletion", () => {
    expect(page).toContain('.from("provider-verification")');
    expect(page).toContain(".upload(path, file");
    expect(page).toContain("upsert: false");
    expect(page).toContain(".remove([path])");
    expect(migration).toContain("klyx_provider_verification_update_guard");
    expect(migration).toContain(
      "klyx_can_cleanup_provider_verification_object"
    );
    expect(migration).toContain(
      "from public.provider_verification_documents as document"
    );
    expect(migration).toContain("where document.storage_path = p_name");
    expect(migration).toContain("and not exists (");
  });

  it("keeps registered document deletion server-authoritative", () => {
    expect(page).toContain('"/api/provider/verification/document"');
    expect(page).toContain('method: "DELETE"');
    expect(documentApi).toContain('document.status === "approved"');
    expect(documentApi).toContain("supabaseAdmin.storage");
    expect(documentApi).toContain('.from("provider-verification")');
    expect(documentApi).toContain(".remove([document.storage_path])");
    expect(documentApi).toContain('.from("provider_verification_documents")');
    expect(documentApi).toContain(".delete()");
    expect(documentApi).toContain('status: "incomplete"');
  });

  it("does not expose the cleanup predicate anonymously", () => {
    expect(migration).toContain(
      "revoke all on function public.klyx_can_cleanup_provider_verification_object(text)"
    );
    expect(migration).toContain("from public, anon");
    expect(migration).toContain(
      "grant execute on function public.klyx_can_cleanup_provider_verification_object(text)"
    );
    expect(migration).toContain("to authenticated, service_role");
  });

  it("proves the real authenticated Storage API boundary on ephemeral Supabase", () => {
    expect(golden).toContain('const BUCKET = "provider-verification"');
    expect(golden).toContain("anonymousUploadRejected: true");
    expect(golden).toContain("clientProfileFolderRejected: true");
    expect(golden).toContain("crossProfileReadRejected: true");
    expect(golden).toContain("overwriteRejected: true");
    expect(golden).toContain("invalidFolderRejected: true");
    expect(golden).toContain("invalidExtensionRejected: true");
    expect(golden).toContain("invalidMimeRejected: true");
    expect(golden).toContain("oversizedUploadRejected: true");
    expect(golden).toContain("ownUploadReadVerified: true");
    expect(golden).toContain("registeredDirectDeleteRejected: true");
    expect(golden).toContain("unregisteredCleanupVerified: true");
    expect(golden).toContain("localSupabaseOnly: true");
    expect(golden).toContain('.from("provider_verification_documents")');

    expect(workflow).toContain("Start ephemeral Supabase with Storage API");
    expect(workflow).not.toContain(
      "-x realtime,storage-api,imgproxy"
    );
    expect(workflow).toContain("node scripts/golden-path-bootstrap.mjs");
    expect(workflow).toContain(
      "node scripts/golden-path-provider-verification-storage.mjs"
    );
    expect(workflow).toContain("supabase stop --no-backup");
  });
});
