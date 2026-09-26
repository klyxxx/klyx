import fs from "node:fs";
import crypto from "node:crypto";

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  throw new Error("Input/output missing.");
}

if (!fs.existsSync(input)) {
  throw new Error("Plain backup archive missing.");
}

if (fs.existsSync(output)) {
  throw new Error("Encrypted backup already exists.");
}

const publicKeyPem =
  process.env.KLYX_DR_PUBLIC_KEY_PEM ??
  (
    process.env.KLYX_DR_PUBLIC_KEY_PATH &&
    fs.existsSync(process.env.KLYX_DR_PUBLIC_KEY_PATH)
      ? fs.readFileSync(process.env.KLYX_DR_PUBLIC_KEY_PATH, "utf8")
      : ""
  );

if (!publicKeyPem) {
  throw new Error("KLYX DR public key missing.");
}

const publicKey = crypto.createPublicKey(publicKeyPem);
if (publicKey.asymmetricKeyType !== "rsa") {
  throw new Error("KLYX DR public key must be RSA.");
}

const magic = Buffer.from("KLYXDR02", "ascii");
const dataKey = crypto.randomBytes(32);
const iv = crypto.randomBytes(12);

const wrappedKey = crypto.publicEncrypt(
  {
    key: publicKey,
    oaepHash: "sha256",
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
  },
  dataKey,
);

const header = Buffer.from(
  JSON.stringify({
    version: 2,
    cipher: "AES-256-GCM",
    keyWrap: "RSA-OAEP-SHA256",
    wrappedKey: wrappedKey.toString("base64"),
    iv: iv.toString("base64"),
  }),
  "utf8",
);

if (header.length > 1024 * 1024) {
  throw new Error("KLYX DR envelope header is unexpectedly large.");
}

const headerLength = Buffer.alloc(4);
headerLength.writeUInt32BE(header.length, 0);

const cipher = crypto.createCipheriv("aes-256-gcm", dataKey, iv);
const inputStream = fs.createReadStream(input);
const outputStream = fs.createWriteStream(output, { flags: "wx" });

outputStream.write(magic);
outputStream.write(headerLength);
outputStream.write(header);

try {
  await new Promise((resolve, reject) => {
    inputStream.on("error", reject);
    cipher.on("error", reject);
    outputStream.on("error", reject);

    cipher.on("end", () => {
      const tag = cipher.getAuthTag();
      outputStream.write(tag);
      outputStream.end();
    });

    outputStream.on("finish", resolve);

    inputStream.pipe(cipher);
    cipher.pipe(outputStream, { end: false });
  });
} catch (error) {
  try {
    fs.rmSync(output, { force: true });
  } catch {
    // Best-effort cleanup.
  }
  throw error;
} finally {
  dataKey.fill(0);
}

console.log("KLYX DR envelope encryption : RSA-OAEP + AES-256-GCM PASS");
