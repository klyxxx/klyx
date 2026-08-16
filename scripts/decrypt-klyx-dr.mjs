import fs from "node:fs";
import crypto from "node:crypto";

const input =
  process.argv[2];

const output =
  process.argv[3];

const passphrase =
  process.env.KLYX_DR_PASSPHRASE;

if (!input || !output) {
  throw new Error(
    "Encrypted archive input/output missing."
  );
}

if (
  !passphrase ||
  passphrase.length < 16
) {
  throw new Error(
    "Valid DR passphrase missing."
  );
}

if (
  !fs.existsSync(input)
) {
  throw new Error(
    "Encrypted DR archive missing."
  );
}

if (
  fs.existsSync(output)
) {
  throw new Error(
    "Plain output already exists."
  );
}

const stat =
  fs.statSync(input);

const headerLength =
  8 + 16 + 12;

const tagLength =
  16;

if (
  stat.size <=
  headerLength + tagLength
) {
  throw new Error(
    "Invalid KLYX DR archive."
  );
}

const fd =
  fs.openSync(
    input,
    "r"
  );

try {
  const magic =
    Buffer.alloc(8);

  fs.readSync(
    fd,
    magic,
    0,
    8,
    0
  );

  if (
    magic.toString("ascii") !==
    "KLYXDR01"
  ) {
    throw new Error(
      "Invalid KLYX DR magic header."
    );
  }

  const salt =
    Buffer.alloc(16);

  fs.readSync(
    fd,
    salt,
    0,
    16,
    8
  );

  const iv =
    Buffer.alloc(12);

  fs.readSync(
    fd,
    iv,
    0,
    12,
    24
  );

  const tag =
    Buffer.alloc(16);

  fs.readSync(
    fd,
    tag,
    0,
    16,
    stat.size - 16
  );

  const key =
    crypto.scryptSync(
      passphrase,
      salt,
      32,
      {
        N: 131072,
        r: 8,
        p: 1,
        maxmem:
          256 * 1024 * 1024,
      }
    );

  const decipher =
    crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      iv
    );

  decipher.setAuthTag(
    tag
  );

  const start =
    headerLength;

  const end =
    stat.size -
    tagLength -
    1;

  const inputStream =
    fs.createReadStream(
      input,
      {
        start,
        end,
      }
    );

  const outputStream =
    fs.createWriteStream(
      output,
      {
        flags: "wx",
      }
    );

  try {
    await new Promise(
      (
        resolve,
        reject
      ) => {
        inputStream.on(
          "error",
          reject
        );

        decipher.on(
          "error",
          reject
        );

        outputStream.on(
          "error",
          reject
        );

        outputStream.on(
          "finish",
          resolve
        );

        inputStream
          .pipe(decipher)
          .pipe(outputStream);
      }
    );
  }
  catch (error) {
    try {
      fs.rmSync(
        output,
        {
          force: true,
        }
      );
    }
    catch {
      // Nothing else to clean.
    }

    throw error;
  }

  console.log(
    "KLYX DR decryption : AES-256-GCM PASS"
  );
}
finally {
  fs.closeSync(fd);
}