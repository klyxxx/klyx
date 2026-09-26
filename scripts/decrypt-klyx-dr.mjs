import fs from "node:fs";
import crypto from "node:crypto";

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  throw new Error("Encrypted archive input/output missing.");
}

if (!fs.existsSync(input)) {
  throw new Error("Encrypted DR archive missing.");
}

if (fs.existsSync(output)) {
  throw new Error("Plain output already exists.");
}

const stat = fs.statSync(input);
const tagLength = 16;

if (stat.size <= 8 + tagLength) {
  throw new Error("Invalid KLYX DR archive.");
}

const fd = fs.openSync(input, "r");

function readAt(length, position) {
  const buffer = Buffer.alloc(length);
  const bytes = fs.readSync(fd, buffer, 0, length, position);
  if (bytes !== length) {
    throw new Error("Truncated KLYX DR archive.");
  }
  return buffer;
}

async function decryptRange({ key, iv, tag, start, end }) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const inputStream = fs.createReadStream(input, { start, end });
  const outputStream = fs.createWriteStream(output, { flags: "wx" });

  try {
    await new Promise((resolve, reject) => {
      inputStream.on("error", reject);
      decipher.on("error", reject);
      outputStream.on("error", reject);
      outputStream.on("finish", resolve);

      inputStream
        .pipe(decipher)
        .pipe(outputStream);
    });
  } catch (error) {
    try {
      fs.rmSync(output, { force: true });
    } catch {
      // Nothing else to clean.
    }
    throw error;
  }
}

try {
  const magic = readAt(8, 0).toString("ascii");

  if (magic === "KLYXDR01") {
    const passphrase = process.env.KLYX_DR_PASSPHRASE;
    if (!passphrase || passphrase.length < 16) {
      throw new Error("Valid DR passphrase missing.");
    }

    const headerLength = 8 + 16 + 12;
    if (stat.size <= headerLength + tagLength) {
      throw new Error("Invalid KLYX DR v1 archive.");
    }

    const salt = readAt(16, 8);
    const iv = readAt(12, 24);
    const tag = readAt(tagLength, stat.size - tagLength);

    const key = crypto.scryptSync(
      passphrase,
      salt,
      32,
      {
        N: 131072,
        r: 8,
        p: 1,
        maxmem: 256 * 1024 * 1024,
      },
    );

    try {
      await decryptRange({
        key,
        iv,
        tag,
        start: headerLength,
        end: stat.size - tagLength - 1,
      });
    } finally {
      key.fill(0);
    }

    console.log("KLYX DR decryption : AES-256-GCM v1 PASS");
    process.exit(0);
  }

  if (magic !== "KLYXDR02") {
    throw new Error("Invalid KLYX DR magic header.");
  }

  const headerSize = readAt(4, 8).readUInt32BE(0);
  if (headerSize < 2 || headerSize > 1024 * 1024) {
    throw new Error("Invalid KLYX DR v2 header length.");
  }

  const headerStart = 12;
  const payloadStart = headerStart + headerSize;

  if (stat.size <= payloadStart + tagLength) {
    throw new Error("Invalid KLYX DR v2 archive.");
  }

  let header;
  try {
    header = JSON.parse(readAt(headerSize, headerStart).toString("utf8"));
  } catch {
    throw new Error("Invalid KLYX DR v2 header.");
  }

  if (
    header?.version !== 2 ||
    header?.cipher !== "AES-256-GCM" ||
    header?.keyWrap !== "RSA-OAEP-SHA256" ||
    typeof header?.wrappedKey !== "string" ||
    typeof header?.iv !== "string"
  ) {
    throw new Error("Unsupported KLYX DR v2 envelope.");
  }

  const privateKeyPem =
    process.env.KLYX_DR_PRIVATE_KEY_PEM ??
    (
      process.env.KLYX_DR_PRIVATE_KEY_PATH &&
      fs.existsSync(process.env.KLYX_DR_PRIVATE_KEY_PATH)
        ? fs.readFileSync(process.env.KLYX_DR_PRIVATE_KEY_PATH, "utf8")
        : ""
    );

  if (!privateKeyPem) {
    throw new Error("KLYX DR private key missing.");
  }

  const privateKey = crypto.createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== "rsa") {
    throw new Error("KLYX DR private key must be RSA.");
  }

  const iv = Buffer.from(header.iv, "base64");
  const wrappedKey = Buffer.from(header.wrappedKey, "base64");

  if (iv.length !== 12 || wrappedKey.length === 0) {
    throw new Error("Invalid KLYX DR v2 envelope values.");
  }

  const key = crypto.privateDecrypt(
    {
      key: privateKey,
      oaepHash: "sha256",
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    },
    wrappedKey,
  );

  if (key.length !== 32) {
    key.fill(0);
    throw new Error("Invalid KLYX DR data key.");
  }

  const tag = readAt(tagLength, stat.size - tagLength);

  try {
    await decryptRange({
      key,
      iv,
      tag,
      start: payloadStart,
      end: stat.size - tagLength - 1,
    });
  } finally {
    key.fill(0);
  }

  console.log("KLYX DR decryption : RSA-OAEP + AES-256-GCM v2 PASS");
} finally {
  fs.closeSync(fd);
}
