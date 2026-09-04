import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("account switcher never presents an unresolved profile as client", () => {
  const switcher = read("app/components/AccountSwitcher.tsx");
  const i18n = read("lib/klyx-account-switcher-i18n.ts");

  assert.match(
    switcher,
    /if \(!profile\) return loadingLabel;/,
    "an unresolved active profile must render a neutral loading label"
  );
  assert.match(
    switcher,
    /loading \|\| switchingId \? \(/,
    "the avatar slot must stay in an explicit loading state while profiles load or switch"
  );
  assert.match(
    switcher,
    /disabled=\{loading \|\| switchingId !== null\}/,
    "profile switching must remain disabled until the active profile state is known"
  );

  for (const localeText of [
    "Chargement du profil…",
    "Loading profile…",
    "Profiel laden…",
    "Profil wird geladen…",
  ]) {
    assert.ok(
      i18n.includes(localeText),
      `missing neutral loading role translation: ${localeText}`
    );
  }
});
