import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.env.KLYX_E2E_EMAIL;
const PASSWORD = process.env.KLYX_E2E_PASSWORD;
const BASE_URL =
  process.env.KLYX_GOLDEN_BASE_URL || "http://127.0.0.1:3100";
const BUCKET = "client-service-photos";

for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUBLIC_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  KLYX_E2E_EMAIL: EMAIL,
  KLYX_E2E_PASSWORD: PASSWORD,
})) {
  if (!value) {
    throw new Error(`Missing required Golden photo environment: ${name}`);
  }
}

const apiHost = new URL(SUPABASE_URL).hostname.toLowerCase();
const appHost = new URL(BASE_URL).hostname.toLowerCase();

assert.ok(
  ["127.0.0.1", "localhost", "::1"].includes(apiHost),
  `Golden photo proof refuses non-loopback Supabase: ${SUPABASE_URL}`
);
assert.ok(
  ["127.0.0.1", "localhost", "::1"].includes(appHost),
  `Golden photo proof refuses non-loopback app: ${BASE_URL}`
);
assert.notEqual(
  process.env.KLYX_VISION_ENABLED,
  "1",
  "Golden photo lifecycle must never call external vision."
);

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
const browser = createClient(SUPABASE_URL, PUBLIC_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const { data: signInData, error: signInError } =
  await browser.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });

if (signInError || !signInData.session?.access_token || !signInData.user) {
  throw new Error(
    `Golden photo client sign-in failed: ${signInError?.message || "missing session"}`
  );
}

const { data: profile, error: profileError } = await admin
  .from("profiles")
  .select("id")
  .eq("owner_user_id", signInData.user.id)
  .eq("account_type", "client")
  .limit(1)
  .maybeSingle();

if (profileError || !profile?.id) {
  throw new Error(
    `Golden photo client profile missing: ${profileError?.message || "not found"}`
  );
}

const { data: buckets, error: bucketsError } =
  await admin.storage.listBuckets();

if (bucketsError) {
  throw new Error(
    `Golden photo bucket listing failed: ${bucketsError.message}`
  );
}

const bucketAlreadyExisted = (buckets ?? []).some(
  (bucket) => bucket.name === BUCKET
);

if (!bucketAlreadyExisted) {
  const { error: createBucketError } = await admin.storage.createBucket(
    BUCKET,
    {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    }
  );

  if (createBucketError) {
    throw new Error(
      `Golden photo bucket creation failed: ${createBucketError.message}`
    );
  }
}

const fileName = `golden-photo-${randomUUID()}.png`;
const storagePath = `${profile.id}/${fileName}`;
// Minimal byte sequence with a real PNG signature. The photo route validates
// magic bytes; the isolated proof intentionally avoids external image tooling.
const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
let requestId = null;

async function objectExists() {
  const { data, error } = await admin.storage
    .from(BUCKET)
    .list(profile.id, {
      search: fileName,
      limit: 10,
    });

  if (error) {
    throw new Error(`Golden photo storage listing failed: ${error.message}`);
  }

  return (data ?? []).some((object) => object.name === fileName);
}

try {
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, pngBytes, {
      contentType: "image/png",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Golden photo upload failed: ${uploadError.message}`);
  }

  assert.equal(
    await objectExists(),
    true,
    "Golden photo object must exist before API analysis."
  );

  const analysisResponse = await fetch(`${BASE_URL}/api/requests/photo`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${signInData.session.access_token}`,
      "Content-Type": "application/json",
      Cookie: `klyx_active_profile=${encodeURIComponent(profile.id)}`,
    },
    body: JSON.stringify({
      storagePath,
      originalName: fileName,
      mimeType: "image/png",
      sizeBytes: pngBytes.byteLength,
      width: 1,
      height: 1,
      description:
        "Le robinet de la cuisine fuit sous l’évier et doit être réparé.",
      useVision: true,
    }),
  });
  const analysisBody = await analysisResponse.json();

  assert.equal(
    analysisResponse.status,
    200,
    `Golden photo analysis failed: ${JSON.stringify(analysisBody)}`
  );
  assert.equal(analysisBody.visionRequested, true);
  assert.equal(
    analysisBody.visionAvailable,
    false,
    "Golden photo proof must keep external vision disabled."
  );
  assert.equal(analysisBody.visionUsed, false);
  assert.equal(analysisBody.analysisMode, "description_assisted");
  assert.ok(
    typeof analysisBody.requestId === "string" && analysisBody.requestId,
    "Golden photo analysis must create server-only metadata."
  );
  assert.ok(
    Array.isArray(analysisBody.analysis?.candidates),
    "Golden photo analysis must return service candidates."
  );
  assert.ok(
    analysisBody.analysis.candidates.length > 0,
    "Golden photo description must resolve at least one canonical service candidate."
  );
  assert.match(
    analysisBody.analysis.limitations,
    /vision|description/i,
    "Golden photo fallback must be explained to the client."
  );

  requestId = analysisBody.requestId;

  const { data: metadata, error: metadataError } = await admin
    .from("photo_service_requests")
    .select(
      "id, profile_id, storage_path, analysis_mode, detected_service_slug, analysis_payload"
    )
    .eq("id", requestId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (metadataError || !metadata) {
    throw new Error(
      `Golden photo metadata verification failed: ${metadataError?.message || "missing row"}`
    );
  }

  assert.equal(metadata.storage_path, storagePath);
  assert.equal(metadata.analysis_mode, "description_assisted");
  assert.equal(metadata.analysis_payload?.vision?.requested, true);
  assert.equal(metadata.analysis_payload?.vision?.available, false);
  assert.equal(metadata.analysis_payload?.vision?.used, false);
  assert.ok(
    typeof metadata.detected_service_slug === "string" &&
      metadata.detected_service_slug,
    "Golden photo metadata must store the selected canonical service slug."
  );

  const deleteResponse = await fetch(`${BASE_URL}/api/requests/photo`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${signInData.session.access_token}`,
      "Content-Type": "application/json",
      Cookie: `klyx_active_profile=${encodeURIComponent(profile.id)}`,
    },
    body: JSON.stringify({ requestId }),
  });
  const deleteBody = await deleteResponse.json();

  assert.equal(
    deleteResponse.status,
    200,
    `Golden photo deletion failed: ${JSON.stringify(deleteBody)}`
  );

  const { data: deletedMetadata, error: deletedMetadataError } = await admin
    .from("photo_service_requests")
    .select("id")
    .eq("id", requestId)
    .maybeSingle();

  if (deletedMetadataError) {
    throw new Error(
      `Golden photo metadata cleanup check failed: ${deletedMetadataError.message}`
    );
  }

  assert.equal(
    deletedMetadata,
    null,
    "Golden photo metadata must be deleted after the client deletes the photo."
  );
  assert.equal(
    await objectExists(),
    false,
    "Golden photo object must be deleted after the client deletes the photo."
  );

  requestId = null;

  console.log(
    JSON.stringify(
      {
        goldenPhotoLifecycleVerified: true,
        uploadVerified: true,
        analysisVerified: true,
        externalVisionCalled: false,
        fallbackVerified: true,
        metadataVerified: true,
        deletionVerified: true,
      },
      null,
      2
    )
  );
} finally {
  if (requestId) {
    await admin
      .from("photo_service_requests")
      .delete()
      .eq("id", requestId)
      .eq("profile_id", profile.id);
  }

  if (await objectExists()) {
    await admin.storage.from(BUCKET).remove([storagePath]);
  }

  if (!bucketAlreadyExisted) {
    const { data: remainingObjects } = await admin.storage
      .from(BUCKET)
      .list(profile.id, { limit: 100 });

    if ((remainingObjects ?? []).length === 0) {
      await admin.storage.deleteBucket(BUCKET);
    }
  }

  await browser.auth.signOut();
}
