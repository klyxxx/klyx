import fs from "node:fs";
import path from "node:path";

import { uploadEncryptedArchiveToDropbox } from "./dropbox-offsite-provider.mjs";

const archivePath = process.argv[2];
const proofPath = process.argv[3];
const expectedCommit = String(process.env.KLYX_DR_EXPECTED_COMMIT ?? "").toLowerCase();

if (!archivePath || !proofPath) {
  throw new Error("Usage: node scripts/dr/upload-dropbox-offsite.mjs <archive.klyxdr> <proof.json>");
}

if (!/^[a-f0-9]{40}$/.test(expectedCommit)) {
  throw new Error("KLYX_DR_EXPECTED_COMMIT must be an exact 40-character Git SHA.");
}

const resolvedArchive = path.resolve(archivePath);
const resolvedProof = path.resolve(proofPath);

if (!fs.existsSync(resolvedArchive) || !fs.statSync(resolvedArchive).isFile()) {
  throw new Error("Encrypted KLYX DR archive missing.");
}

const result = await uploadEncryptedArchiveToDropbox({
  archivePath: resolvedArchive,
});

if (result.provider !== "dropbox" || result.readBackVerified !== true) {
  throw new Error("Dropbox offsite backup did not produce verified read-back evidence.");
}

const proof = {
  format: "KLYX_DR_OFFSITE_BACKUP_PROOF",
  version: 1,
  gitCommit: expectedCommit,
  provider: result.provider,
  archivePath: result.archivePath,
  archiveRevision: result.archiveRevision,
  archiveBytes: result.archiveBytes,
  archiveSha256: result.archiveSha256,
  checksumPath: result.checksumPath,
  checksumRevision: result.checksumRevision,
  readBackVerified: result.readBackVerified,
  verifiedAt: result.verifiedAt,
  productionWrite: false,
  plaintextUploaded: false,
  privateRecoveryKeyPresent: false,
};

fs.mkdirSync(path.dirname(resolvedProof), { recursive: true, mode: 0o700 });
fs.writeFileSync(resolvedProof, `${JSON.stringify(proof, null, 2)}\n`, {
  mode: 0o600,
});

console.log("KLYX Dropbox offsite backup: encrypted upload + read-back PASS");
console.log(`archive=${result.archivePath}`);
console.log(`sha256=${result.archiveSha256}`);
