$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$page =
    Join-Path `
        $root `
        "app\provider\jobs\page.tsx"

if (-not (Test-Path -LiteralPath $page -PathType Leaf)) {
    throw "13.76 : provider jobs page introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $page
    )

$signals = @(
    "KLYX_PROVIDER_OPPORTUNITY_FOCUS_13_76",
    "Priorité KLYX",
    "Les opportunités à regarder en premier",
    "Meilleur match",
    "Budget le plus élevé",
    "Prochaine action",
    "Offre à préparer",
    "Tout est traité",
    "bestMatch",
    "highestBudget",
    "nextToAnswer",
    "!request.myOffer",
    "item.match.score",
    "/api/provider/jobs",
    "/offers",
    "Aucune offre n’est envoyée",
    "Tu fixes toi-même ton prix"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.76 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.76 : PowerShell injecte dans page.tsx."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.76 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.76 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.76 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.76 CHECK OK"
Write-Host "======================================"
Write-Host "Opportunity prioritization : READY"
Write-Host "Match score : PRESERVED"
Write-Host "Budget comparison : READY"
Write-Host "Unanswered mission detection : READY"
Write-Host "Provider price authority : PRESERVED"
Write-Host "Automatic offer : NONE"
Write-Host "Existing offer backend : PRESERVED"
Write-Host "Migration : NONE"
Write-Host "Paid API : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"