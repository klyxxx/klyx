import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("app/components/ProviderStudio.tsx", "utf8");

test("provider studio uses a single searchable service picker", () => {
  assert.match(source, /KLYX_PROVIDER_SERVICE_SEARCH_16_13/);
  assert.match(source, /type="search"/);
  assert.match(source, /placeholder="Rechercher un service\.\.\."/);
  assert.match(source, /availableServiceMatches/);
  assert.match(source, /\.filter\(\(service\) => !service\.enabled\)/);
  assert.match(source, /normalizeServiceSearch/);
  assert.doesNotMatch(source, /grid gap-3 sm:grid-cols-2 lg:grid-cols-4/);
});

test("provider service search preserves activation, removal and editor selection", () => {
  assert.match(source, /activateService\(service\.serviceId\)/);
  assert.match(source, /deactivateService\(service\.serviceId\)/);
  assert.match(source, /setSelectedServiceId\(service\.serviceId\)/);
  assert.match(source, /aria-label={`Retirer \$\{serviceLabel\(service\.slug, service\.name\)\}`}/);
  assert.match(source, /<ServiceEditor/);
});
