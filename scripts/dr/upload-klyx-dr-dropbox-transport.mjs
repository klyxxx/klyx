import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  requestDropboxAccessToken,
  uploadEncryptedArchiveToDropbox,
} from "./dropbox-offsite-provider.mjs";

const archivePath = process.argv[2];
const handoffProofPath = process.argv[3];
const outputProofPath = process.argv[4];
const expectedCommit = String(process.env.KLYX_DR_EXPECTED_COMMIT ?? "")
  .trim()
  .toLowerCase();
const handoffRunId = Number(process.env.KLYX_DR_HANDOFF_RUN_ID ?? "0");

if (!archivePath || !handoffProofPath || !outputProofPath) {
  throw new Error(
    "Usage: node scripts/dr/upload-klyx-dr-dropbox-transport.mjs <archive.klyxdr> <handoff-proof.json> <transport-proof.json>",
  );
}

if (!/^[a-f0-9]{40}$/.test(expectedCommit)) {
  throw new Error("KLYX_DR_EXPECTED_COMMIT must be an exact 40-character Git SHA.");
}

if (!Number.isInteger(handoffRunId) || handoffRunId <= 0) {
  throw new Error("KLYX_DR_HANDOFF_RUN_ID must be a positive integer.");
}

const resolvedArchive = path.resolve(archivePath);
const resolvedHandoffProof = path.resolve(handoffProofPath);
const resolvedOutputProof = path.resolve(outputProofPath);

for (const filePath of [resolvedArchive, resolvedHandoffProof]) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`Required DR input missing: ${path.basename(filePath)}`);
  }
}

const archiveBytes = fs.readFileSync(resolvedArchive);
if (archiveBytes.subarray(0, 8).toString("ascii") !== "KLYXDR02") {
  throw new Error("Dropbox transport accepts only KLYXDR02 archives.");
}

const archiveSha256 = crypto
  .createHash("sha256")
  .update(archiveBytes)
  .digest("hex");
const handoff = JSON.parse(fs.readFileSync(resolvedHandoffProof, "utf8"));

if (
  handoff?.format !== "KLYX_DR_CONNECTOR_HANDOFF_PROOF" ||
  handoff?.version !== 1 ||
  handoff?.gitCommit !== expectedCommit ||
  handoff?.archiveSha256 !== archiveSha256 ||
  handoff?.encryptionFormat !== "KLYXDR02" ||
  handoff?.providerTarget !== "dropbox" ||
  handoff?.handoffRequired !== true ||
  handoff?.productionWrite !== false ||
  handoff?.plaintextUploaded !== false ||
  handoff?.privateRecoveryKeyPresent !== false
) {
  throw new Error("Encrypted handoff proof does not match this exact SHA/archive.");
}

const upload = await uploadEncryptedArchiveToDropbox({
  archivePath: resolvedArchive,
});

if (
  upload?.provider !== "dropbox" ||
  upload?.archiveSha256 !== archiveSha256 ||
  upload?.readBackVerified !== true ||
  typeof upload?.archivePath !== "string" ||
  !upload.archivePath.startsWith("/KLYX-DR/")
) {
  throw new Error("Dropbox upload/read-back evidence is incomplete.");
}

const accessToken = await requestDropboxAccessToken({
  appKey: process.env.KLYX_DR_DROPBOX_APP_KEY,
  appSecret: process.env.KLYX_DR_DROPBOX_APP_SECRET,
  refreshToken: process.env.KLYX_DR_DROPBOX_REFRESH_TOKEN,
});

async function getMetadataWithBoundedRetry() {
  const delays = [0, 1000, 3000, 10000];
  let lastError;

  for (const delay of delays) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      const response = await fetch("https://api.dropboxapi.com/2/files/get_metadata", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: upload.archivePath,
          include_deleted: false,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const error = new Error(
          `Dropbox metadata read failed with HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`,
        );
        error.transient = response.status === 429 || response.status >= 500;
        throw error;
      }

      return response.json();
    } catch (error) {
      lastError = error;
      const transient = Boolean(error?.transient) || error instanceof TypeError;
      if (!transient) throw error;
    }
  }

  throw new Error("Dropbox metadata verification failed after bounded retries.", {
    cause: lastError,
  });
}

const metadata = await getMetadataWithBoundedRetry();
if (
  metadata?.[".tag"] !== "file" ||
  typeof metadata?.id !== "string" ||
  !metadata.id.startsWith("id:") ||
  typeof metadata?.path_display !== "string" ||
  metadata.path_display.toLowerCase() !== upload.archivePath.toLowerCase()
) {
  throw new Error("Dropbox metadata does not identify the uploaded DR archive.");
}

const proof = {
  format: "KLYX_DR_DROPBOX_TRANSPORT_PROOF",
  version: 1,
  gitCommit: expectedCommit,
  handoffRunId,
  provider: "dropbox",
  fileId: metadata.id,
  path: upload.archivePath,
  archiveRevision: upload.archiveRevision,
  archiveBytes: upload.archiveBytes,
  archiveSha256,
  checksumPath: upload.checksumPath,
  checksumRevision: upload.checksumRevision,
  uploadVerified: true,
  contentHashVerified: true,
  verifiedAt: upload.verifiedAt,
  productionWrite: false,
  plaintextRetained: false,
  privateRecoveryKeyInGitHub: false,
};

fs.mkdirSync(path.dirname(resolvedOutputProof), { recursive: true, mode: 0o700 });
fs.writeFileSync(resolvedOutputProof, `${JSON.stringify(proof, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});

console.log("KLYX Dropbox transport: upload + read-back + metadata PASS");
console.log(`path=${proof.path}`);
console.log(`sha256=${proof.archiveSha256}`);
