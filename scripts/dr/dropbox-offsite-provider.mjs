import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const KLYX_DROPBOX_ROOT = "/KLYX-DR";
export const DROPBOX_SINGLE_UPLOAD_MAX_BYTES = 150 * 1024 * 1024;

const ARCHIVE_NAME_RE = /^klyx-dr-\d{8}-\d{6}-[a-f0-9]{8}\.klyxdr$/;
const RETRY_DELAYS_MS = [0, 1000, 3000, 10000, 30000];

function requireNonEmpty(value, name) {
  if (!value || !String(value).trim()) {
    throw new Error(`${name} missing.`);
  }

  return String(value).trim();
}

export function assertDropboxArchiveName(fileName) {
  const name = requireNonEmpty(fileName, "KLYX DR archive name");

  if (path.basename(name) !== name || !ARCHIVE_NAME_RE.test(name)) {
    throw new Error("Invalid KLYX DR archive name for Dropbox offsite storage.");
  }

  return name;
}

export function buildDropboxArchivePath(fileName) {
  return `${KLYX_DROPBOX_ROOT}/${assertDropboxArchiveName(fileName)}`;
}

export function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function isTransientStatus(status) {
  return status === 429 || status >= 500;
}

async function sleep(ms) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withBoundedRetry(operation, label, delays = RETRY_DELAYS_MS) {
  let lastError;

  for (let index = 0; index < delays.length; index += 1) {
    await sleep(delays[index]);

    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const transient = Boolean(error?.klyxTransient);

      if (!transient || index === delays.length - 1) {
        break;
      }
    }
  }

  throw new Error(`${label} failed after bounded retries.`, {
    cause: lastError,
  });
}

async function responseTextSafe(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function httpError(label, status, body) {
  const error = new Error(`${label} failed with HTTP ${status}${body ? `: ${body.slice(0, 500)}` : ""}`);
  error.klyxTransient = isTransientStatus(status);
  return error;
}

export async function requestDropboxAccessToken({
  appKey,
  appSecret,
  refreshToken,
  fetchImpl = globalThis.fetch,
}) {
  const key = requireNonEmpty(appKey, "KLYX_DR_DROPBOX_APP_KEY");
  const secret = requireNonEmpty(appSecret, "KLYX_DR_DROPBOX_APP_SECRET");
  const refresh = requireNonEmpty(refreshToken, "KLYX_DR_DROPBOX_REFRESH_TOKEN");

  if (typeof fetchImpl !== "function") {
    throw new Error("fetch implementation missing.");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refresh,
  });

  const response = await withBoundedRetry(async () => {
    let current;

    try {
      current = await fetchImpl("https://api.dropboxapi.com/oauth2/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${key}:${secret}`, "utf8").toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
    } catch (error) {
      error.klyxTransient = true;
      throw error;
    }

    if (!current.ok) {
      throw httpError("Dropbox OAuth refresh", current.status, await responseTextSafe(current));
    }

    return current;
  }, "Dropbox OAuth refresh");

  const payload = await response.json();
  const accessToken = requireNonEmpty(payload?.access_token, "Dropbox OAuth access token");

  return accessToken;
}

async function dropboxJson({ accessToken, route, body, fetchImpl }) {
  return withBoundedRetry(async () => {
    let response;

    try {
      response = await fetchImpl(`https://api.dropboxapi.com/2/${route}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      error.klyxTransient = true;
      throw error;
    }

    if (!response.ok) {
      throw httpError(`Dropbox ${route}`, response.status, await responseTextSafe(response));
    }

    return response.json();
  }, `Dropbox ${route}`);
}

async function ensureDropboxRoot({ accessToken, fetchImpl }) {
  try {
    await dropboxJson({
      accessToken,
      route: "files/create_folder_v2",
      body: {
        path: KLYX_DROPBOX_ROOT,
        autorename: false,
      },
      fetchImpl,
    });
  } catch (error) {
    const cause = error?.cause ?? error;
    const message = String(cause?.message ?? error?.message ?? "");

    if (!message.includes("HTTP 409")) {
      throw error;
    }
  }

  const metadata = await dropboxJson({
    accessToken,
    route: "files/get_metadata",
    body: {
      path: KLYX_DROPBOX_ROOT,
      include_deleted: false,
    },
    fetchImpl,
  });

  if (metadata?.[".tag"] !== "folder") {
    throw new Error("Dropbox KLYX-DR root is not a folder.");
  }
}

async function uploadBuffer({ accessToken, remotePath, contents, fetchImpl }) {
  return withBoundedRetry(async () => {
    let response;

    try {
      response = await fetchImpl("https://content.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({
            path: remotePath,
            mode: "add",
            autorename: false,
            mute: true,
            strict_conflict: true,
          }),
        },
        body: contents,
      });
    } catch (error) {
      error.klyxTransient = true;
      throw error;
    }

    if (!response.ok) {
      throw httpError("Dropbox file upload", response.status, await responseTextSafe(response));
    }

    return response.json();
  }, "Dropbox file upload");
}

async function downloadBuffer({ accessToken, remotePath, fetchImpl }) {
  return withBoundedRetry(async () => {
    let response;

    try {
      response = await fetchImpl("https://content.dropboxapi.com/2/files/download", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Dropbox-API-Arg": JSON.stringify({ path: remotePath }),
        },
      });
    } catch (error) {
      error.klyxTransient = true;
      throw error;
    }

    if (!response.ok) {
      throw httpError("Dropbox file read-back", response.status, await responseTextSafe(response));
    }

    return Buffer.from(await response.arrayBuffer());
  }, "Dropbox file read-back");
}

export async function uploadEncryptedArchiveToDropbox({
  archivePath,
  appKey = process.env.KLYX_DR_DROPBOX_APP_KEY,
  appSecret = process.env.KLYX_DR_DROPBOX_APP_SECRET,
  refreshToken = process.env.KLYX_DR_DROPBOX_REFRESH_TOKEN,
  fetchImpl = globalThis.fetch,
}) {
  const resolved = path.resolve(requireNonEmpty(archivePath, "Encrypted DR archive path"));

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error("Encrypted KLYX DR archive missing.");
  }

  const fileName = assertDropboxArchiveName(path.basename(resolved));
  const size = fs.statSync(resolved).size;

  if (size <= 0) {
    throw new Error("Encrypted KLYX DR archive is empty.");
  }

  if (size > DROPBOX_SINGLE_UPLOAD_MAX_BYTES) {
    throw new Error("Encrypted KLYX DR archive exceeds bounded Dropbox single-upload limit.");
  }

  const magic = Buffer.alloc(8);
  const descriptor = fs.openSync(resolved, "r");
  try {
    fs.readSync(descriptor, magic, 0, 8, 0);
  } finally {
    fs.closeSync(descriptor);
  }

  if (magic.toString("ascii") !== "KLYXDR02") {
    throw new Error("Automated Dropbox offsite backup requires KLYXDR02 public-key encryption.");
  }

  const accessToken = await requestDropboxAccessToken({
    appKey,
    appSecret,
    refreshToken,
    fetchImpl,
  });

  await ensureDropboxRoot({ accessToken, fetchImpl });

  const contents = fs.readFileSync(resolved);
  const archiveSha256 = sha256Buffer(contents);
  const remotePath = buildDropboxArchivePath(fileName);

  const uploaded = await uploadBuffer({
    accessToken,
    remotePath,
    contents,
    fetchImpl,
  });

  const readBack = await downloadBuffer({
    accessToken,
    remotePath,
    fetchImpl,
  });

  if (readBack.length !== contents.length || sha256Buffer(readBack) !== archiveSha256) {
    throw new Error("Dropbox encrypted archive read-back verification failed.");
  }

  const checksumBody = Buffer.from(`${archiveSha256}  ${fileName}\n`, "utf8");
  const checksumRemotePath = `${remotePath}.sha256`;

  const checksumUploaded = await uploadBuffer({
    accessToken,
    remotePath: checksumRemotePath,
    contents: checksumBody,
    fetchImpl,
  });

  const checksumReadBack = await downloadBuffer({
    accessToken,
    remotePath: checksumRemotePath,
    fetchImpl,
  });

  if (sha256Buffer(checksumReadBack) !== sha256Buffer(checksumBody)) {
    throw new Error("Dropbox checksum sidecar read-back verification failed.");
  }

  return {
    provider: "dropbox",
    archivePath: remotePath,
    archiveRevision: uploaded?.rev ?? null,
    archiveBytes: size,
    archiveSha256,
    checksumPath: checksumRemotePath,
    checksumRevision: checksumUploaded?.rev ?? null,
    readBackVerified: true,
    verifiedAt: new Date().toISOString(),
  };
}
