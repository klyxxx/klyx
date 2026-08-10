$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$packageRoot = Split-Path -Parent $PSScriptRoot
$payload = Join-Path $packageRoot "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.14 - REPUTATION DANS LA RECHERCHE" -ForegroundColor Cyan
Write-Host ""

$source = Join-Path $payload "lib\provider-search.ts"
if (-not (Test-Path -LiteralPath $source)) { throw "payload lib/provider-search.ts manquant." }
Copy-Item -LiteralPath $source -Destination "lib\provider-search.ts" -Force
Write-Host "[OK] lib\provider-search.ts" -ForegroundColor Green

$routePath = "app\api\search\providers\route.ts"
if (-not (Test-Path -LiteralPath $routePath)) { throw "$routePath introuvable." }

$route = Get-Content -LiteralPath $routePath -Raw

$route = $route.Replace(
'  "score_desc",`r`n  "experience_desc",',
'  "score_desc",`r`n  "rating_desc",`r`n  "experience_desc",'
)
$route = $route.Replace(
'  "score_desc",`n  "experience_desc",',
'  "score_desc",`n  "rating_desc",`n  "experience_desc",'
)

$route = $route.Replace(
'  cancellation_rate: number | null;`r`n};',
'  cancellation_rate: number | null;`r`n  rating: number | null;`r`n  review_count: number | null;`r`n};'
)
$route = $route.Replace(
'  cancellation_rate: number | null;`n};',
'  cancellation_rate: number | null;`n  rating: number | null;`n  review_count: number | null;`n};'
)

$route = $route.Replace(
'service_area, travel_radius_km, klyx_score, completed_jobs, cancellation_rate"',
'service_area, travel_radius_km, klyx_score, completed_jobs, cancellation_rate, rating, review_count"'
)

$sortAnchor = @'
  if (sort === "experience_desc") {
'@
$ratingSort = @'
  if (sort === "rating_desc") {
    if (first.rating !== second.rating) {
      return second.rating - first.rating;
    }

    if (first.reviewCount !== second.reviewCount) {
      return second.reviewCount - first.reviewCount;
    }
  }

'@
if ($route -notmatch 'sort === "rating_desc"') {
  if (-not $route.Contains($sortAnchor)) { throw "Ancre tri experience introuvable." }
  $route = $route.Replace($sortAnchor, $ratingSort + $sortAnchor)
}

$candidateAnchor = @'
        cancellationRate: Number(serviceProfile.cancellation_rate ?? 0),
        yearsExperience: Number(providerProfile.years_experience ?? 0),
'@
$candidateNew = @'
        cancellationRate: Number(serviceProfile.cancellation_rate ?? 0),
        rating: Number(serviceProfile.rating ?? 0),
        reviewCount: Number(serviceProfile.review_count ?? 0),
        yearsExperience: Number(providerProfile.years_experience ?? 0),
'@
if ($route -notmatch 'reviewCount: Number\(serviceProfile\.review_count') {
  if (-not $route.Contains($candidateAnchor)) { throw "Ancre candidate reputation introuvable." }
  $route = $route.Replace($candidateAnchor, $candidateNew)
}

[System.IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $routePath),
  $route,
  [System.Text.UTF8Encoding]::new($false)
)
Write-Host "[OK] API recherche : note + nombre avis + tri" -ForegroundColor Green

Write-Host ""
Write-Host "12.14 appliquee. Aucune migration SQL." -ForegroundColor Cyan
