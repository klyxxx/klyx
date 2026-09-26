import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  KLYX_DROPBOX_ROOT,
  assertDropboxArchiveName,
  buildDropboxArchivePath,
  requestDropboxAccessToken,
  uploadEncryptedArchiveToDropbox,
} from "../../scripts/dr/dropbox-offsite-provider.mjs";

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function createEncryptedArchive(name = "klyx-dr-20260926-170000-9350a859.klyxdr") {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "klyx-dropbox-provider-"));
  temporaryDirectories.push(directory);

  const archivePath = path.join(directory, name);
  fs.writeFileSync(
    archivePath,
    Buffer.concat([
      Buffer.from("KLYXDR02", "ascii"),
      Buffer.from("encrypted-payload-for-test", "utf8"),
    ]),
  );

  return archivePath;
}

describe("KLYX Dropbox offsite provider", () => {
  it("keeps every archive inside the canonical KLYX-DR root", () => {
    const name = "klyx-dr-20260926-170000-9350a859.klyxdr";

    expect(assertDropboxArchiveName(name)).toBe(name);
    expect(buildDropboxArchivePath(name)).toBe(`${KLYX_DROPBOX_ROOT}/${name}`);

    expect(() => assertDropboxArchiveName("../escape.klyxdr")).toThrow();
    expect(() => assertDropboxArchiveName("backup.zip")).toThrow();
  });

  it("uses Dropbox OAuth refresh tokens without exposing credentials in the URL", async () => {
    const fetchImpl = vi.fn(async (url, options) => {
      expect(url).toBe("https://api.dropboxapi.com/oauth2/token");
      expect(options.method).toBe("POST");
      expect(String(options.headers.Authorization)).toMatch(/^Basic /);
      expect(String(options.body)).toContain("grant_type=refresh_token");
      expect(String(options.body)).toContain("refresh_token=refresh-value");

      return new Response(JSON.stringify({ access_token: "short-lived-access" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    await expect(
      requestDropboxAccessToken({
        appKey: "app-key",
        appSecret: "app-secret",
        refreshToken: "refresh-value",
        fetchImpl,
      }),
    ).resolves.toBe("short-lived-access");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("uploads only KLYXDR02, reads it back, and verifies SHA-256 before reporting success", async () => {
    const archivePath = createEncryptedArchive();
    const archiveBytes = fs.readFileSync(archivePath);
    let call = 0;

    const fetchImpl = vi.fn(async (url, options) => {
      call += 1;

      if (call === 1) {
        expect(url).toBe("https://api.dropboxapi.com/oauth2/token");
        return new Response(JSON.stringify({ access_token: "access" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (call === 2) {
        expect(url).toContain("/2/files/create_folder_v2");
        return new Response("already exists", { status: 409 });
      }

      if (call === 3) {
        expect(url).toContain("/2/files/get_metadata");
        return new Response(JSON.stringify({ ".tag": "folder", name: "KLYX-DR" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (call === 4) {
        expect(url).toBe("https://content.dropboxapi.com/2/files/upload");
        const apiArg = JSON.parse(options.headers["Dropbox-API-Arg"]);
        expect(apiArg.path).toBe("/KLYX-DR/klyx-dr-20260926-170000-9350a859.klyxdr");
        expect(Buffer.from(options.body)).toEqual(archiveBytes);
        return new Response(JSON.stringify({ rev: "archive-rev" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (call === 5) {
        expect(url).toBe("https://content.dropboxapi.com/2/files/download");
        return new Response(archiveBytes, { status: 200 });
      }

      if (call === 6) {
        expect(url).toBe("https://content.dropboxapi.com/2/files/upload");
        const apiArg = JSON.parse(options.headers["Dropbox-API-Arg"]);
        expect(apiArg.path).toBe("/KLYX-DR/klyx-dr-20260926-170000-9350a859.klyxdr.sha256");
        return new Response(JSON.stringify({ rev: "checksum-rev" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (call === 7) {
        expect(url).toBe("https://content.dropboxapi.com/2/files/download");
        return new Response(optionsForChecksum, { status: 200 });
      }

      throw new Error(`Unexpected Dropbox mock call ${call}: ${url}`);
    });

    let optionsForChecksum;
    const originalFetch = fetchImpl.getMockImplementation();
    fetchImpl.mockImplementation(async (url, options) => {
      if (call === 5 && url === "https://content.dropboxapi.com/2/files/upload") {
        optionsForChecksum = Buffer.from(options.body);
      }
      return originalFetch(url, options);
    });

    const proof = await uploadEncryptedArchiveToDropbox({
      archivePath,
      appKey: "key",
      appSecret: "secret",
      refreshToken: "refresh",
      fetchImpl,
    });

    expect(proof.provider).toBe("dropbox");
    expect(proof.readBackVerified).toBe(true);
    expect(proof.archiveRevision).toBe("archive-rev");
    expect(proof.checksumRevision).toBe("checksum-rev");
    expect(proof.archiveSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(fetchImpl).toHaveBeenCalledTimes(7);
  });

  it("rejects legacy passphrase archives from the automated Dropbox path", async () => {
    const archivePath = createEncryptedArchive();
    const bytes = fs.readFileSync(archivePath);
    bytes.write("KLYXDR01", 0, "ascii");
    fs.writeFileSync(archivePath, bytes);

    const fetchImpl = vi.fn();

    await expect(
      uploadEncryptedArchiveToDropbox({
        archivePath,
        appKey: "key",
        appSecret: "secret",
        refreshToken: "refresh",
        fetchImpl,
      }),
    ).rejects.toThrow("requires KLYXDR02 public-key encryption");

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
