import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import {
  createClient,
} from "@supabase/supabase-js";

const storageRoot =
  process.argv[2];

const supabaseUrl =
  process.env.KLYX_RESTORE_SUPABASE_URL;

const serviceRole =
  process.env.KLYX_RESTORE_SERVICE_ROLE_KEY;

if (!storageRoot) {
  throw new Error(
    "Storage restore directory missing."
  );
}

if (
  !supabaseUrl ||
  !serviceRole
) {
  throw new Error(
    "Local Supabase restore credentials missing."
  );
}

const manifestPath =
  path.join(
    storageRoot,
    "storage-manifest.json"
  );

const statePath =
  path.join(
    storageRoot,
    "state-manifest.json"
  );

if (
  !fs.existsSync(manifestPath) ||
  !fs.existsSync(statePath)
) {
  throw new Error(
    "Storage restore manifests missing."
  );
}

const manifest =
  JSON.parse(
    fs.readFileSync(
      manifestPath,
      "utf8"
    )
  );

const state =
  JSON.parse(
    fs.readFileSync(
      statePath,
      "utf8"
    )
  );

const supabase =
  createClient(
    supabaseUrl,
    serviceRole,
    {
      auth: {
        autoRefreshToken:
          false,

        persistSession:
          false,
      },
    }
  );

function sha256(
  buffer
) {
  return crypto
    .createHash(
      "sha256"
    )
    .update(buffer)
    .digest("hex");
}

async function listFiles(
  bucketName,
  prefix = ""
) {
  const files = [];

  let offset = 0;

  while (true) {
    const {
      data,
      error,
    } =
      await supabase
        .storage
        .from(bucketName)
        .list(
          prefix,
          {
            limit: 1000,
            offset,

            sortBy: {
              column:
                "name",

              order:
                "asc",
            },
          }
        );

    if (error) {
      throw new Error(
        `Cannot list ${bucketName}/${prefix}: ${error.message}`
      );
    }

    const entries =
      data ?? [];

    for (
      const entry of entries
    ) {
      const objectPath =
        prefix
          ? `${prefix}/${entry.name}`
          : entry.name;

      if (!entry.id) {
        const children =
          await listFiles(
            bucketName,
            objectPath
          );

        files.push(
          ...children
        );

        continue;
      }

      files.push(
        objectPath
      );
    }

    if (
      entries.length < 1000
    ) {
      break;
    }

    offset +=
      entries.length;
  }

  return files;
}

const {
  data: existingBuckets,
  error: existingError,
} =
  await supabase
    .storage
    .listBuckets();

if (existingError) {
  throw existingError;
}

const existingMap =
  new Map(
    (
      existingBuckets ??
      []
    ).map(
      (bucket) => [
        bucket.name,
        bucket,
      ]
    )
  );

let restoredObjects =
  0;

for (
  const bucket of
  manifest.buckets
) {
  const options = {
    public:
      Boolean(
        bucket.public
      ),
  };

  if (
    bucket.fileSizeLimit != null
  ) {
    options.fileSizeLimit =
      bucket.fileSizeLimit;
  }

  if (
    Array.isArray(
      bucket.allowedMimeTypes
    )
  ) {
    options.allowedMimeTypes =
      bucket.allowedMimeTypes;
  }

  if (
    !existingMap.has(
      bucket.name
    )
  ) {
    const {
      error,
    } =
      await supabase
        .storage
        .createBucket(
          bucket.name,
          options
        );

    if (error) {
      throw new Error(
        `Cannot create bucket ${bucket.name}: ${error.message}`
      );
    }
  }
  else {
    const {
      error,
    } =
      await supabase
        .storage
        .updateBucket(
          bucket.name,
          options
        );

    if (error) {
      throw new Error(
        `Cannot configure bucket ${bucket.name}: ${error.message}`
      );
    }
  }

  for (
    const object of
    bucket.objects
  ) {
    const backupPath =
      path.join(
        storageRoot,
        ...String(
          object.backupFile
        ).split("/")
      );

    if (
      !fs.existsSync(
        backupPath
      )
    ) {
      throw new Error(
        `Backup object missing: ${object.path}`
      );
    }

    const buffer =
      fs.readFileSync(
        backupPath
      );

    const expectedHash =
      String(
        object.sha256
      ).toLowerCase();

    const sourceHash =
      sha256(
        buffer
      );

    if (
      sourceHash !==
      expectedHash
    ) {
      throw new Error(
        `Backup object SHA256 mismatch: ${object.path}`
      );
    }

    const uploadOptions = {
      upsert:
        true,
    };

    const mimetype =
      object.metadata?.mimetype ??
      object.metadata?.contentType;

    if (mimetype) {
      uploadOptions.contentType =
        String(
          mimetype
        );
    }

    const cacheControl =
      object.metadata?.cacheControl;

    if (
      cacheControl != null
    ) {
      uploadOptions.cacheControl =
        String(
          cacheControl
        );
    }

    const {
      error: uploadError,
    } =
      await supabase
        .storage
        .from(
          bucket.name
        )
        .upload(
          object.path,
          buffer,
          uploadOptions
        );

    if (uploadError) {
      throw new Error(
        `Restore upload failed ${bucket.name}/${object.path}: ${uploadError.message}`
      );
    }

    /*
     * Re-download from the restored
     * local Storage service.
     */
    const {
      data: downloaded,
      error: downloadError,
    } =
      await supabase
        .storage
        .from(
          bucket.name
        )
        .download(
          object.path
        );

    if (
      downloadError ||
      !downloaded
    ) {
      throw new Error(
        `Restore verification download failed ${bucket.name}/${object.path}: ${downloadError?.message ?? "unknown"}`
      );
    }

    const restoredBuffer =
      Buffer.from(
        await downloaded.arrayBuffer()
      );

    const restoredHash =
      sha256(
        restoredBuffer
      );

    if (
      restoredHash !==
      expectedHash
    ) {
      throw new Error(
        `Restored Storage SHA256 mismatch: ${bucket.name}/${object.path}`
      );
    }

    restoredObjects +=
      1;
  }
}

/*
 * Vérifie le nombre réel de fichiers
 * exposés par Storage après restauration.
 */
let actualStorageObjects =
  0;

for (
  const bucket of
  manifest.buckets
) {
  const files =
    await listFiles(
      bucket.name
    );

  actualStorageObjects +=
    files.length;
}

if (
  actualStorageObjects !==
  Number(
    state.storageObjectCount
  )
) {
  throw new Error(
    `Restored Storage object count mismatch. Expected ${state.storageObjectCount}, got ${actualStorageObjects}.`
  );
}

/*
 * Vérification Auth via le vrai service
 * GoTrue local, pas uniquement PostgreSQL.
 */
let authUsers =
  0;

for (
  let page = 1;
  page <= 10000;
  page += 1
) {
  const {
    data,
    error,
  } =
    await supabase
      .auth
      .admin
      .listUsers({
        page,
        perPage:
          1000,
      });

  if (error) {
    throw new Error(
      `Local Auth verification failed: ${error.message}`
    );
  }

  authUsers +=
    data.users.length;

  if (
    data.users.length <
    1000
  ) {
    break;
  }
}

if (
  authUsers !==
  Number(
    state.authUserCount
  )
) {
  throw new Error(
    `Restored Auth user count mismatch. Expected ${state.authUserCount}, got ${authUsers}.`
  );
}

console.log(
  "KLYX LOCAL SERVICE RESTORE VERIFIED"
);

console.log(
  `Auth users      : ${authUsers}`
);

console.log(
  `Storage buckets : ${manifest.buckets.length}`
);

console.log(
  `Storage objects : ${restoredObjects}`
);

console.log(
  "Storage SHA256  : PASS"
);

console.log(
  "Production write: NO"
);