import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import {
  createClient,
} from "@supabase/supabase-js";

const root =
  process.cwd();

const outputDirectory =
  process.argv[2];

if (!outputDirectory) {
  throw new Error(
    "Storage backup output directory missing."
  );
}

function readEnvFile(
  filePath
) {
  const result = {};

  if (
    !fs.existsSync(filePath)
  ) {
    return result;
  }

  for (
    const rawLine of
    fs
      .readFileSync(
        filePath,
        "utf8"
      )
      .split(/\r?\n/)
  ) {
    const line =
      rawLine.trim();

    if (
      !line ||
      line.startsWith("#")
    ) {
      continue;
    }

    const index =
      line.indexOf("=");

    if (index <= 0) {
      continue;
    }

    const key =
      line
        .slice(0, index)
        .trim();

    let value =
      line
        .slice(index + 1)
        .trim();

    if (
      value.length >= 2 &&
      (
        (
          value.startsWith('"') &&
          value.endsWith('"')
        ) ||
        (
          value.startsWith("'") &&
          value.endsWith("'")
        )
      )
    ) {
      value =
        value.slice(
          1,
          -1
        );
    }

    result[key] =
      value;
  }

  return result;
}

const env =
  readEnvFile(
    path.join(
      root,
      ".env.local"
    )
  );

const supabaseUrl =
  env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRole =
  env.SUPABASE_SERVICE_ROLE_KEY;

if (
  !supabaseUrl ||
  !serviceRole
) {
  throw new Error(
    "Supabase URL or local service-role missing."
  );
}

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

fs.mkdirSync(
  outputDirectory,
  {
    recursive: true,
  }
);

const objectDirectory =
  path.join(
    outputDirectory,
    "objects"
  );

fs.mkdirSync(
  objectDirectory,
  {
    recursive: true,
  }
);

const {
  data: buckets,
  error: bucketError,
} =
  await supabase
    .storage
    .listBuckets();

if (bucketError) {
  throw bucketError;
}

async function listObjects(
  bucketName,
  prefix = ""
) {
  const result = [];

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
        `${bucketName}/${prefix}: ${error.message}`
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

      /*
       * Supabase représente généralement
       * un dossier virtuel sans id.
       */
      if (!entry.id) {
        const children =
          await listObjects(
            bucketName,
            objectPath
          );

        result.push(
          ...children
        );

        continue;
      }

      result.push({
        path:
          objectPath,

        metadata:
          entry.metadata ??
          null,

        createdAt:
          entry.created_at ??
          null,

        updatedAt:
          entry.updated_at ??
          null,

        lastAccessedAt:
          entry.last_accessed_at ??
          null,
      });
    }

    if (
      entries.length < 1000
    ) {
      break;
    }

    offset +=
      entries.length;
  }

  return result;
}

const manifest = {
  format:
    "KLYX_SUPABASE_STORAGE_BACKUP",

  version:
    1,

  createdUtc:
    new Date().toISOString(),

  buckets:
    [],

  totalObjects:
    0,

  totalBytes:
    0,
};

for (
  const bucket of
  buckets ?? []
) {
  const bucketName =
    bucket.name;

  const objects =
    await listObjects(
      bucketName
    );

  const bucketManifest = {
    id:
      bucket.id,

    name:
      bucketName,

    public:
      Boolean(
        bucket.public
      ),

    fileSizeLimit:
      bucket.file_size_limit ??
      null,

    allowedMimeTypes:
      bucket.allowed_mime_types ??
      null,

    objects:
      [],
  };

  for (
    const object of objects
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .storage
        .from(bucketName)
        .download(
          object.path
        );

    if (
      error ||
      !data
    ) {
      throw new Error(
        `Storage download failed: ${bucketName}/${object.path}: ${error?.message ?? "unknown"}`
      );
    }

    const buffer =
      Buffer.from(
        await data.arrayBuffer()
      );

    const sha256 =
      crypto
        .createHash(
          "sha256"
        )
        .update(buffer)
        .digest("hex");

    /*
     * Nom local indépendant du nom original :
     * évite les caractères Windows interdits.
     * Le manifest conserve le vrai chemin.
     */
    const localName =
      crypto
        .createHash(
          "sha256"
        )
        .update(
          `${bucketName}\0${object.path}`
        )
        .digest("hex") +
      ".bin";

    fs.writeFileSync(
      path.join(
        objectDirectory,
        localName
      ),
      buffer
    );

    bucketManifest.objects.push({
      path:
        object.path,

      backupFile:
        `objects/${localName}`,

      size:
        buffer.length,

      sha256,

      metadata:
        object.metadata,

      createdAt:
        object.createdAt,

      updatedAt:
        object.updatedAt,

      lastAccessedAt:
        object.lastAccessedAt,
    });

    manifest.totalObjects +=
      1;

    manifest.totalBytes +=
      buffer.length;
  }

  manifest.buckets.push(
    bucketManifest
  );
}

/*
 * Compteur Auth uniquement.
 * Aucun email/téléphone/utilisateur
 * n'est écrit dans ce manifest.
 */
let authUsers =
  0;

for (
  let page = 1;
  page <= 1000;
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
        perPage: 1000,
      });

  if (error) {
    throw error;
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

const stateManifest = {
  format:
    "KLYX_SUPABASE_DR_STATE",

  version:
    1,

  createdUtc:
    new Date().toISOString(),

  authUserCount:
    authUsers,

  storageBucketCount:
    manifest.buckets.length,

  storageObjectCount:
    manifest.totalObjects,

  storageBytes:
    manifest.totalBytes,

  secretValuesStored:
    false,
};

fs.writeFileSync(
  path.join(
    outputDirectory,
    "storage-manifest.json"
  ),
  JSON.stringify(
    manifest,
    null,
    2
  ),
  "utf8"
);

fs.writeFileSync(
  path.join(
    outputDirectory,
    "state-manifest.json"
  ),
  JSON.stringify(
    stateManifest,
    null,
    2
  ),
  "utf8"
);

console.log(
  `Storage buckets : ${manifest.buckets.length}`
);

console.log(
  `Storage objects : ${manifest.totalObjects}`
);

console.log(
  `Auth users      : ${authUsers}`
);

console.log(
  "Secret values   : NOT STORED"
);