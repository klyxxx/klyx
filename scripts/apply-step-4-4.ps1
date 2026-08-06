$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$page = Join-Path $root "app\search\page.tsx"

if (-not (Test-Path -LiteralPath $page)) {
  throw "Fichier introuvable : app\search\page.tsx"
}

Copy-Item -LiteralPath $page -Destination "$page.step-4-4.backup" -Force

$content = Get-Content -LiteralPath $page -Raw

if (-not $content.Contains('import MatchExplanation from "./MatchExplanation";')) {
  $anchor = '} from "@/lib/provider-search";'

  if (-not $content.Contains($anchor)) {
    throw "Import provider-search introuvable."
  }

  $content = $content.Replace(
    $anchor,
    $anchor + "`r`n" +
      'import MatchExplanation from "./MatchExplanation";'
  )
}

$callAnchor = @'
                  bookingUrl={bookingHref(provider, appliedFilters)}
                  recommended={
'@

$callReplacement = @'
                  bookingUrl={bookingHref(provider, appliedFilters)}
                  matchingFilters={{
                    city: appliedFilters.city,
                    date: appliedFilters.date,
                    time: appliedFilters.time,
                    duration: appliedFilters.duration,
                    budget: appliedFilters.budget,
                    pricing: appliedFilters.pricing,
                  }}
                  recommended={
'@

if (
  -not $content.Contains("matchingFilters={{") -and
  $content.Contains($callAnchor)
) {
  $content = $content.Replace(
    $callAnchor,
    $callReplacement
  )
}

$signatureAnchor = @'
function ProviderCardView({
  provider,
  bookingUrl,
  recommended,
}: {
  provider: ProviderSearchItem;
  bookingUrl: string;
  recommended: boolean;
}) {
'@

$signatureReplacement = @'
function ProviderCardView({
  provider,
  bookingUrl,
  matchingFilters,
  recommended,
}: {
  provider: ProviderSearchItem;
  bookingUrl: string;
  matchingFilters: {
    city: string;
    date: string;
    time: string;
    duration: string;
    budget: string;
    pricing: string;
  };
  recommended: boolean;
}) {
'@

if ($content.Contains($signatureAnchor)) {
  $content = $content.Replace(
    $signatureAnchor,
    $signatureReplacement
  )
} elseif (-not $content.Contains("matchingFilters: {")) {
  throw "Signature ProviderCardView introuvable."
}

$displayAnchor = @'
        <p className="mt-5 text-xl font-bold text-violet-400">
          {formatProviderPrice(provider.price, provider.pricingType)}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
'@

$displayReplacement = @'
        <p className="mt-5 text-xl font-bold text-violet-400">
          {formatProviderPrice(provider.price, provider.pricingType)}
        </p>

        <MatchExplanation
          provider={provider}
          filters={matchingFilters}
        />

        <div className="mt-5 grid grid-cols-2 gap-3">
'@

if (
  -not $content.Contains("<MatchExplanation") -and
  $content.Contains($displayAnchor)
) {
  $content = $content.Replace(
    $displayAnchor,
    $displayReplacement
  )
}

if (-not $content.Contains("<MatchExplanation")) {
  throw "Insertion MatchExplanation impossible."
}

Set-Content -LiteralPath $page -Value $content -Encoding utf8

Write-Host ""
Write-Host "Étape 4.4 appliquée avec succès." -ForegroundColor Green
Write-Host "Aucun fichier prestataire n’a été modifié."
Write-Host "Aucune donnée privée client n’est envoyée au prestataire."
Write-Host "Sauvegarde : app\search\page.tsx.step-4-4.backup"
Write-Host "Exécute maintenant : npm run build"
