import { createClient } from "@supabase/supabase-js";

import {
  assertGoldenPathIsolation,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

const BUCKET = "provider-verification";
const MAX_BYTES = 10 * 1024 * 1024;

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectStorageError(operation, label) {
  const result = await operation;

  if (!result?.error) {
    throw new Error(`${label} unexpectedly succeeded.`);
  }

  return result.error;
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();

  expect(
    localSupabase,
    "Provider verification Storage proof is allowed only on ephemeral local Supabase."
  );

  const publishableKey = requiredGoldenPathEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );
  const serviceRole = requiredGoldenPathEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requiredGoldenPathEnv("KLYX_E2E_EMAIL");
  const password = requiredGoldenPathEnv("KLYX_E2E_PASSWORD");

  const userClient = createClient(e2eOrigin, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const anonymousClient = createClient(e2eOrigin, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const admin = createClient(e2eOrigin, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: signInData, error: signInError } =
    await userClient.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.user) {
    throw new Error("Unable to authenticate provider Storage golden account.");
  }

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, owner_user_id, account_type")
    .eq("owner_user_id", signInData.user.id);

  if (profilesError) {
    throw new Error(
      `Unable to inspect provider Storage golden profiles: ${profilesError.message}`
    );
  }

  const provider = (profiles ?? []).find(
    (profile) => profile.account_type === "provider"
  );
  const client = (profiles ?? []).find(
    (profile) => profile.account_type === "client"
  );

  expect(Boolean(provider), "Golden provider profile is missing.");
  expect(Boolean(client), "Golden client profile is missing.");

  const suffix = `${Date.now()}-${process.pid}`;
  const validPath = `${provider.id}/identity/golden-${suffix}.pdf`;
  const cleanupPath = `${provider.id}/address/cleanup-${suffix}.pdf`;
  const clientInsertPath = `${client.id}/identity/client-insert-${suffix}.pdf`;
  const clientReadPath = `${client.id}/identity/client-read-${suffix}.pdf`;
  const invalidFolderPath = `${provider.id}/secret/secret-${suffix}.pdf`;
  const invalidExtensionPath = `${provider.id}/identity/invalid-${suffix}.exe`;
  const invalidMimePath = `${provider.id}/identity/invalid-${suffix}.txt`;
  const oversizedPath = `${provider.id}/identity/oversized-${suffix}.pdf`;
  const validPdf = Buffer.from(
    "%PDF-1.4\n% KLYX ephemeral provider verification proof\n%%EOF\n",
    "utf8"
  );

  const cleanupPaths = [
    validPath,
    cleanupPath,
    clientInsertPath,
    clientReadPath,
    invalidFolderPath,
    invalidExtensionPath,
    invalidMimePath,
    oversizedPath,
  ];
  let registeredDocumentId = null;

  try {
    const { error: seededClientObjectError } = await admin.storage
      .from(BUCKET)
      .upload(clientReadPath, validPdf, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (seededClientObjectError) {
      throw new Error(
        `Unable to seed cross-profile Storage proof object: ${seededClientObjectError.message}`
      );
    }

    await expectStorageError(
      anonymousClient.storage.from(BUCKET).upload(validPath, validPdf, {
        contentType: "application/pdf",
        upsert: false,
      }),
      "Anonymous provider verification upload"
    );

    await expectStorageError(
      userClient.storage.from(BUCKET).upload(clientInsertPath, validPdf, {
        contentType: "application/pdf",
        upsert: false,
      }),
      "Client-profile-folder upload from provider owner"
    );

    await expectStorageError(
      userClient.storage.from(BUCKET).download(clientReadPath),
      "Cross-profile provider verification read"
    );

    const { data: uploaded, error: uploadError } = await userClient.storage
      .from(BUCKET)
      .upload(validPath, validPdf, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError || !uploaded?.path) {
      throw new Error(
        `Valid provider verification upload failed: ${
          uploadError?.message ?? "missing uploaded path"
        }`
      );
    }

    expect(
      uploaded.path === validPath,
      "Storage returned an unexpected provider verification object path."
    );

    const { data: downloaded, error: downloadError } = await userClient.storage
      .from(BUCKET)
      .download(validPath);

    if (downloadError || !downloaded) {
      throw new Error(
        `Own provider verification object is not readable: ${
          downloadError?.message ?? "missing object body"
        }`
      );
    }

    const downloadedBytes = Buffer.from(await downloaded.arrayBuffer());
    expect(
      downloadedBytes.equals(validPdf),
      "Downloaded provider verification proof does not match uploaded bytes."
    );

    const { data: publicUrlData } = userClient.storage
      .from(BUCKET)
      .getPublicUrl(validPath);
    const publicResponse = await fetch(publicUrlData.publicUrl, {
      redirect: "manual",
    });
    expect(
      !publicResponse.ok,
      "Provider verification bucket must not expose an unauthenticated public object URL."
    );

    await expectStorageError(
      userClient.storage.from(BUCKET).upload(validPath, Buffer.from("changed"), {
        contentType: "application/pdf",
        upsert: true,
      }),
      "Provider verification overwrite"
    );

    await expectStorageError(
      userClient.storage.from(BUCKET).upload(invalidFolderPath, validPdf, {
        contentType: "application/pdf",
        upsert: false,
      }),
      "Provider verification invalid document folder"
    );

    await expectStorageError(
      userClient.storage.from(BUCKET).upload(invalidExtensionPath, validPdf, {
        contentType: "application/pdf",
        upsert: false,
      }),
      "Provider verification invalid extension"
    );

    await expectStorageError(
      userClient.storage.from(BUCKET).upload(
        invalidMimePath,
        Buffer.from("not an accepted verification MIME", "utf8"),
        {
          contentType: "text/plain",
          upsert: false,
        }
      ),
      "Provider verification invalid MIME"
    );

    const oversized = Buffer.alloc(MAX_BYTES + 1, 0x41);
    await expectStorageError(
      userClient.storage.from(BUCKET).upload(oversizedPath, oversized, {
        contentType: "application/pdf",
        upsert: false,
      }),
      "Provider verification oversized upload"
    );

    const { data: registeredDocument, error: registerError } = await admin
      .from("provider_verification_documents")
      .insert({
        profile_id: provider.id,
        document_type: "identity",
        storage_path: validPath,
        original_name: `golden-${suffix}.pdf`,
        mime_type: "application/pdf",
        size_bytes: validPdf.length,
        status: "uploaded",
      })
      .select("id")
      .single();

    if (registerError || !registeredDocument?.id) {
      throw new Error(
        `Unable to register provider verification proof object: ${
          registerError?.message ?? "missing document id"
        }`
      );
    }
    registeredDocumentId = registeredDocument.id;

    await expectStorageError(
      userClient.storage.from(BUCKET).remove([validPath]),
      "Direct deletion of a registered provider verification object"
    );

    const { data: stillReadable, error: stillReadableError } =
      await userClient.storage.from(BUCKET).download(validPath);
    if (stillReadableError || !stillReadable) {
      throw new Error(
        "Registered provider verification object disappeared after rejected direct deletion."
      );
    }

    const { error: cleanupUploadError } = await userClient.storage
      .from(BUCKET)
      .upload(cleanupPath, validPdf, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (cleanupUploadError) {
      throw new Error(
        `Unable to create unregistered cleanup proof object: ${cleanupUploadError.message}`
      );
    }

    const { error: cleanupDeleteError } = await userClient.storage
      .from(BUCKET)
      .remove([cleanupPath]);
    if (cleanupDeleteError) {
      throw new Error(
        `Unregistered provider upload cleanup was blocked: ${cleanupDeleteError.message}`
      );
    }

    await expectStorageError(
      userClient.storage.from(BUCKET).download(cleanupPath),
      "Deleted unregistered provider verification object read"
    );

    process.stdout.write(
      `${JSON.stringify({
        providerVerificationStorageVerified: true,
        privateBucketVerified: true,
        maxBytes: MAX_BYTES,
        acceptedMimeTypes: [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
        ],
        anonymousUploadRejected: true,
        clientProfileFolderRejected: true,
        crossProfileReadRejected: true,
        overwriteRejected: true,
        invalidFolderRejected: true,
        invalidExtensionRejected: true,
        invalidMimeRejected: true,
        oversizedUploadRejected: true,
        ownUploadReadVerified: true,
        registeredDirectDeleteRejected: true,
        unregisteredCleanupVerified: true,
        localSupabaseOnly: true,
      })}\n`
    );
  } finally {
    if (registeredDocumentId) {
      await admin
        .from("provider_verification_documents")
        .delete()
        .eq("id", registeredDocumentId);
    }
    await admin.storage.from(BUCKET).remove(cleanupPaths);
    await userClient.auth.signOut();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX provider Storage golden proof failed: ${message}`);
  process.exitCode = 1;
});
