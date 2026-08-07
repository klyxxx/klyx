$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$page = Join-Path $root "app\search\page.tsx"
$backup = "$page.step-6-1.backup"

if (-not (Test-Path -LiteralPath $page)) {
  throw "Fichier introuvable : app\search\page.tsx"
}

Copy-Item `
  -LiteralPath $page `
  -Destination $backup `
  -Force

$content = Get-Content `
  -LiteralPath $page `
  -Raw `
  -Encoding UTF8

$importLine = 'import SearchRecovery from "./SearchRecovery";'

if (-not $content.Contains($importLine)) {
  $anchor = 'import MatchExplanation from "./MatchExplanation";'

  if (-not $content.Contains($anchor)) {
    throw "Import MatchExplanation introuvable."
  }

  $content = $content.Replace(
    $anchor,
    $anchor + "`r`n" + $importLine
  )
}

if ($content.Contains("<SearchRecovery")) {
  Write-Host ""
  Write-Host "SearchRecovery existe deja. Aucun doublon ajoute." -ForegroundColor Yellow
  exit 0
}

$alternativesAnchor = @'
        {!loading && !errorMessage && result.showingAlternatives && (
          <div className="mt-8 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-200">
            <AlertCircle className="mt-0.5 shrink-0" size={20} />
            <div>
              <p className="font-semibold">
                Aucun profil ne correspond exactement à tous les critères.
              </p>
              <p className="mt-1 text-sm text-amber-100/80">
                KLYX affiche les alternatives les plus proches. Modifie un filtre
                pour élargir davantage la recherche.
              </p>
            </div>
          </div>
        )}
'@

$alternativesReplacement = @'
        {!loading && !errorMessage && result.showingAlternatives && (
          <>
            <div className="mt-8 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-200">
              <AlertCircle className="mt-0.5 shrink-0" size={20} />
              <div>
                <p className="font-semibold">
                  Aucun profil ne correspond exactement à tous les critères.
                </p>
                <p className="mt-1 text-sm text-amber-100/80">
                  KLYX affiche les alternatives les plus proches et peut adapter
                  la recherche avec ton accord.
                </p>
              </div>
            </div>

            <SearchRecovery
              filters={{
                service: appliedFilters.service,
                city: appliedFilters.city,
                date: appliedFilters.date,
                time: appliedFilters.time,
                duration: appliedFilters.duration,
                budget: appliedFilters.budget,
                pricing: appliedFilters.pricing,
                sort: appliedFilters.sort,
              }}
              result={result}
            />
          </>
        )}
'@

if ($content.Contains($alternativesAnchor)) {
  $content = $content.Replace(
    $alternativesAnchor,
    $alternativesReplacement
  )
}
else {
  throw "Bloc alternatives introuvable dans app\search\page.tsx."
}

$emptyAnchor = @'
        {!loading && !errorMessage && result.providers.length === 0 && (
          <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-8 text-center">
'@

$emptyReplacement = @'
        {!loading && !errorMessage && result.providers.length === 0 && (
          <>
            <SearchRecovery
              filters={{
                service: appliedFilters.service,
                city: appliedFilters.city,
                date: appliedFilters.date,
                time: appliedFilters.time,
                duration: appliedFilters.duration,
                budget: appliedFilters.budget,
                pricing: appliedFilters.pricing,
                sort: appliedFilters.sort,
              }}
              result={result}
            />

            <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-8 text-center">
'@

if ($content.Contains($emptyAnchor)) {
  $content = $content.Replace(
    $emptyAnchor,
    $emptyReplacement
  )
}
else {
  throw "Bloc aucun prestataire introuvable."
}

$emptyClosingAnchor = @'
          </div>
        )}

        {!loading && !errorMessage && result.providers.length > 0 && (
'@

$emptyClosingReplacement = @'
            </div>
          </>
        )}

        {!loading && !errorMessage && result.providers.length > 0 && (
'@

if ($content.Contains($emptyClosingAnchor)) {
  $content = $content.Replace(
    $emptyClosingAnchor,
    $emptyClosingReplacement
  )
}
else {
  throw "Fermeture du bloc aucun prestataire introuvable."
}

Set-Content `
  -LiteralPath $page `
  -Value $content `
  -Encoding UTF8

Write-Host ""
Write-Host "Etape 6.1 appliquee avec succes." -ForegroundColor Green
Write-Host "La recherche existante n'a pas ete remplacee."
Write-Host "Aucune reservation et aucun paiement automatiques."
Write-Host "Sauvegarde : app\search\page.tsx.step-6-1.backup"
Write-Host "Execute maintenant : npm run build"
