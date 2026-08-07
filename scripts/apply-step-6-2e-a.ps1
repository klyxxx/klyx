$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$search = Join-Path $root "app\search\page.tsx"
$coverage = Join-Path $root "app\coverage\page.tsx"

foreach ($file in @($search, $coverage)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier introuvable : $file"
  }

  Copy-Item -LiteralPath $file -Destination "$file.step-6-2e-a.backup" -Force
}

$searchContent = Get-Content -LiteralPath $search -Raw -Encoding UTF8

if (-not $searchContent.Contains('import KlyxSelect from "@/app/components/KlyxSelect";')) {
  $anchor = 'import SearchRecovery from "./SearchRecovery";'
  if (-not $searchContent.Contains($anchor)) {
    throw "Import SearchRecovery introuvable dans app\search\page.tsx"
  }
  $searchContent = $searchContent.Replace(
    $anchor,
    $anchor + "`r`n" + 'import KlyxSelect from "@/app/components/KlyxSelect";'
  )
}

$searchContent = $searchContent.Replace(@'
              <select
                value={draft.service}
                onChange={(event) => updateDraft("service", event.target.value)}
                className="filter-control"
              >
                {SERVICE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
'@, @'
              <KlyxSelect
                value={draft.service}
                onChange={(value) => updateDraft("service", value)}
                options={SERVICE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                ariaLabel="Service"
              />
'@)

$searchContent = $searchContent.Replace(@'
              <select
                value={draft.duration}
                disabled={!draft.time}
                onChange={(event) => updateDraft("duration", event.target.value)}
                className="filter-control disabled:cursor-not-allowed disabled:opacity-50"
              >
                {[1, 2, 3, 4, 6, 8].map((hours) => (
                  <option key={hours} value={hours}>
                    {hours} heure{hours > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
'@, @'
              <KlyxSelect
                value={draft.duration}
                disabled={!draft.time}
                onChange={(value) => updateDraft("duration", value)}
                options={[1, 2, 3, 4, 6, 8].map((hours) => ({
                  value: String(hours),
                  label: `${hours} heure${hours > 1 ? "s" : ""}`,
                }))}
                ariaLabel="Durée"
              />
'@)

$searchContent = $searchContent.Replace(@'
              <select
                value={draft.pricing}
                onChange={(event) => updateDraft("pricing", event.target.value)}
                className="filter-control"
              >
                {PRICING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
'@, @'
              <KlyxSelect
                value={draft.pricing}
                onChange={(value) => updateDraft("pricing", value)}
                options={PRICING_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                ariaLabel="Type de tarif"
              />
'@)

$searchContent = $searchContent.Replace(@'
              <select
                value={draft.sort}
                onChange={(event) =>
                  updateDraft("sort", event.target.value as ProviderSearchSort)
                }
                className="filter-control"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
'@, @'
              <KlyxSelect
                value={draft.sort}
                onChange={(value) =>
                  updateDraft("sort", value as ProviderSearchSort)
                }
                options={SORT_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                ariaLabel="Trier par"
              />
'@)

Set-Content -LiteralPath $search -Value $searchContent -Encoding UTF8

$coverageContent = Get-Content -LiteralPath $coverage -Raw -Encoding UTF8

if (-not $coverageContent.Contains('import KlyxSelect from "@/app/components/KlyxSelect";')) {
  $anchor = 'import { BELGIAN_LOCALITIES } from "@/lib/belgian-localities";'
  if (-not $coverageContent.Contains($anchor)) {
    throw "Import BELGIAN_LOCALITIES introuvable dans app\coverage\page.tsx"
  }
  $coverageContent = $coverageContent.Replace(
    $anchor,
    $anchor + "`r`n" + 'import KlyxSelect from "@/app/components/KlyxSelect";'
  )
}

$coverageContent = $coverageContent.Replace(@'
              <select
                value={serviceSlug}
                onChange={(event) =>
                  setServiceSlug(event.target.value)
                }
                disabled={loading}
                className="klyx-input"
              >
                {services.map((service) => (
                  <option
                    key={service.id}
                    value={service.slug}
                  >
                    {service.name ?? service.slug}
                  </option>
                ))}
              </select>
'@, @'
              <KlyxSelect
                value={serviceSlug}
                onChange={setServiceSlug}
                disabled={loading}
                options={services.map((service) => ({
                  value: service.slug,
                  label: service.name ?? service.slug,
                }))}
                ariaLabel="Service recherché"
              />
'@)

$coverageContent = $coverageContent.Replace(@'
              <select
                value={locality}
                onChange={(event) =>
                  setLocality(event.target.value)
                }
                className="klyx-input"
              >
                <option value="">
                  Choisir une commune
                </option>
                {BELGIAN_LOCALITIES.map((item) => (
                  <option
                    key={item.name}
                    value={item.name}
                  >
                    {item.name} ·{" "}
                    {item.postalCodes.join(", ")}
                  </option>
                ))}
              </select>
'@, @'
              <KlyxSelect
                value={locality}
                onChange={setLocality}
                placeholder="Choisir une commune"
                options={BELGIAN_LOCALITIES.map((item) => ({
                  value: item.name,
                  label: `${item.name} · ${item.postalCodes.join(", ")}`,
                }))}
                ariaLabel="Ma commune"
              />
'@)

Set-Content -LiteralPath $coverage -Value $coverageContent -Encoding UTF8

Write-Host ""
Write-Host "Etape 6.2E-A appliquee avec succes." -ForegroundColor Green
Write-Host "4 selects remplaces dans /search."
Write-Host "2 selects remplaces dans /coverage."
Write-Host "Aucun changement Supabase, Stripe ou multi-profils."
Write-Host "Execute maintenant : npm run build"
