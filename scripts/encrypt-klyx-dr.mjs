import fs from "node:fs";
import crypto from "node:crypto";

const input =
  process.argv[2];

const output =
  process.argv[3];

const passphrase =
  process.env.KLYX_DR_PASSPHRASE;

if (
  !input ||
  !output
) {
  throw new Error(
    "Input/output missing."
  );
}

if (
  !passphrase ||
  passphrase.length < 16
) {
  throw new Error(
    "DR passphrase must contain at least 16 characters."
  );
}

if (
  !fs.existsSync(input)
) {
  throw new Error(
    "Plain backup archive missing."
  );
}

if (
  fs.existsSync(output)
) {
  throw new Error(
    "Encrypted backup already exists."
  );
}

const magic =
  Buffer.from(
    "KLYXDR01",
    "ascii"
  );

const salt =
  crypto.randomBytes(16);

const iv =
  crypto.randomBytes(12);

const key =
  crypto.scryptSync(
    passphrase,
    salt,
    32,
    {
      N:
        131072,

      r:
        8,

      p:
        1,

      maxmem:
        256 * 1024 * 1024,
    }
  );

const cipher =
  crypto.createCipheriv(
    "aes-256-gcm",
    key,
    iv
  );

const inputStream =
  fs.createReadStream(
    input
  );

const outputStream =
  fs.createWriteStream(
    output,
    {
      flags:
        "wx",
    }
  );

outputStream.write(
  magic
);

outputStream.write(
  salt
);

outputStream.write(
  iv
);

await new Promise(
  (
    resolve,
    reject
  ) => {
    inputStream.on(
      "error",
      reject
    );

    cipher.on(
      "error",
      reject
    );

    outputStream.on(
      "error",
      reject
    );

    cipher.on(
      "end",
      () => {
        const tag =
          cipher.getAuthTag();

        outputStream.write(
          tag
        );

        outputStream.end();
      }
    );

    outputStream.on(
      "finish",
      resolve
    );

    inputStream.pipe(
      cipher
    );

    cipher.pipe(
      outputStream,
      {
        end:
          false,
      }
    );
  }
);

console.log(
  "KLYX DR encryption : AES-256-GCM PASS"
);