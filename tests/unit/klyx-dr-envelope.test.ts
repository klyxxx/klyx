import { execFileSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const workspaces: string[] = [];

function workspace() {
  const directory = mkdtempSync(join(tmpdir(), "klyx-dr-envelope-"));
  workspaces.push(directory);
  return directory;
}

afterEach(() => {
  while (workspaces.length > 0) {
    const directory = workspaces.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe("KLYX DR encrypted archives", () => {
  it("round-trips the v2 public-key envelope without storing the private key in the archive", () => {
    const directory = workspace();
    const plain = join(directory, "payload.zip");
    const encrypted = join(directory, "payload.klyxdr");
    const restored = join(directory, "restored.zip");

    writeFileSync(plain, Buffer.from("klyx-dr-v2\n".repeat(4096)));

    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    execFileSync(
      process.execPath,
      ["scripts/encrypt-klyx-dr-envelope.mjs", plain, encrypted],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          KLYX_DR_PUBLIC_KEY_PEM: publicKey,
        },
      },
    );

    const archive = readFileSync(encrypted);
    expect(archive.subarray(0, 8).toString("ascii")).toBe("KLYXDR02");
    expect(archive.includes(Buffer.from(privateKey))).toBe(false);

    execFileSync(
      process.execPath,
      ["scripts/decrypt-klyx-dr.mjs", encrypted, restored],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          KLYX_DR_PRIVATE_KEY_PEM: privateKey,
        },
      },
    );

    expect(readFileSync(restored)).toEqual(readFileSync(plain));
  });

  it("keeps backward compatibility with KLYXDR01 passphrase archives", () => {
    const directory = workspace();
    const plain = join(directory, "payload.zip");
    const encrypted = join(directory, "payload-v1.klyxdr");
    const restored = join(directory, "restored.zip");
    const passphrase = "klyx-dr-test-passphrase-2026";

    writeFileSync(plain, Buffer.from("klyx-dr-v1\n".repeat(1024)));

    execFileSync(
      process.execPath,
      ["scripts/encrypt-klyx-dr.mjs", plain, encrypted],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          KLYX_DR_PASSPHRASE: passphrase,
        },
      },
    );

    execFileSync(
      process.execPath,
      ["scripts/decrypt-klyx-dr.mjs", encrypted, restored],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          KLYX_DR_PASSPHRASE: passphrase,
        },
      },
    );

    expect(readFileSync(restored)).toEqual(readFileSync(plain));
  });

  it("fails closed when a v2 archive has no private recovery key", () => {
    const directory = workspace();
    const plain = join(directory, "payload.zip");
    const encrypted = join(directory, "payload.klyxdr");
    const restored = join(directory, "restored.zip");

    writeFileSync(plain, "fail-closed");

    const { publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    execFileSync(
      process.execPath,
      ["scripts/encrypt-klyx-dr-envelope.mjs", plain, encrypted],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          KLYX_DR_PUBLIC_KEY_PEM: publicKey,
        },
      },
    );

    expect(() =>
      execFileSync(
        process.execPath,
        ["scripts/decrypt-klyx-dr.mjs", encrypted, restored],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            KLYX_DR_PRIVATE_KEY_PEM: "",
            KLYX_DR_PRIVATE_KEY_PATH: "",
          },
          stdio: "pipe",
        },
      ),
    ).toThrow();
  });
});
