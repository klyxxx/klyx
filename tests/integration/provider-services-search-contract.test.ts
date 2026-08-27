import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const source = readFileSync("app/components/ProviderStudio.tsx", "utf8");

test("provider studio uses a single searchable service picker", () => {
  expect(source).toMatch(/KLYX_PROVIDER_SERVICE_SEARCH_16_13/);
  expect(source).toMatch(/type="search"/);
  expect(source).toMatch(/placeholder="Rechercher un service\.\.\."/);
  expect(source).toMatch(/availableServiceMatches/);
  expect(source).toMatch(/\.filter\(\(service\) => !service\.enabled\)/);
  expect(source).toMatch(/normalizeServiceSearch/);
  expect(source).not.toMatch(/grid gap-3 sm:grid-cols-2 lg:grid-cols-4/);
});

test("provider service search preserves activation, removal and editor selection", () => {
  expect(source).toMatch(/activateService\(service\.serviceId\)/);
  expect(source).toMatch(/deactivateService\(service\.serviceId\)/);
  expect(source).toMatch(/setSelectedServiceId\(service\.serviceId\)/);
  expect(source).toMatch(/aria-label={`Retirer \$\{serviceLabel\(service\.slug, service\.name\)\}`}/);
  expect(source).toMatch(/<ServiceEditor/);
});
