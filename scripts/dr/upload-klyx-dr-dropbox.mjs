import fs from "node:fs";
import path from "node:path";

import {
  uploadEncryptedArchiveToDropbox,
} from "./dropbox-offsite-provider.mjs";

const archivePath = process.argv[2];
const proofPath = process.argv[3] || "";
const expectedCommit = (process.env.KLYX_DR_EXPECTED_COMMIT ?? "").trim().toLowerCase();

if (!archivePath) {
  throw new Error("Usage: node scripts/dr/upload-klyx-dr-dropbox.mjs <archive.klyxdr> [proof.json]");
}

const resolvedArchive = path.resolve(archivePath);
const fileName = path.basename(resolvedArchive);

if (expectedCommit) {
  if (!/^[a-f0-9]{40}$/.test(expectedCommit)) {
    throw new Error("KLYX_DR_EXPECTED_COMMIT must be a full 40-character Git SHA.");
  }

  const expectedShort = expectedCommit.slice(0, 8);
  const match = fileName.match(/^klyx-dr-\d{8}-\d{6}-([a-f0-9]{8})\.klyxdr$/);

  if (!match || match[1] !== expectedShort) {
    throw new Error(`Dropbox offsite archive SHA mismatch. Expected ${expectedShort}.`);
  }
}

const proof = await uploadEncryptedArchiveToDropbox({
  archivePath: resolvedArchive,
});

const sanitized = {
  ...proof,
  gitCommit: expectedCommit || null,
};

if (proofPath) {
  const resolvedProof = path.resolve(proofPath);
  fs.mkdirSync(path.dirname(resolvedProof), { recursive: true });
  fs.writeFileSync(resolvedProof, `${JSON.stringify(sanitized, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

console.log(JSON.stringify(sanitized));
