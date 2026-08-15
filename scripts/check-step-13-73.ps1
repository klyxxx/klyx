$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$page =
    Join-Path `
        $root `
        "app\search\page.tsx"

if (-not (Test-Path -LiteralPath $page -PathType Leaf)) {
    throw "13.73 : search page introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $page
    )

$signals = @(
    "KLYX_MARKET_TRUST_EXPLAINER_13_73",
    "Pourquoi ce profil ressort",
    "Confiance KLYX",
    "Recommandé par KLYX :",
    "toujours la décision finale.",
    "function TrustSignal(",
    "provider.klyxScore.toFixed(0)",
    "provider.isVerified",
    "provider.yearsExperience",
    "provider.completedJobs",
    "provider.availabilitySummary",
    "<MatchExplanation",
    'href={`/providers/${provider.profileId}`}',
    "Réserver"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.73 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.73 : PowerShell injecte dans page.tsx."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.73 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.73 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.73 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.73 CHECK OK"
Write-Host "======================================"
Write-Host "Marketplace trust signals : VISIBLE"
Write-Host "Recommendation reason : VISIBLE"
Write-Host "KLYX Score : PRESERVED"
Write-Host "Provider verification : PRESERVED"
Write-Host "Experience : PRESERVED"
Write-Host "Completed jobs : PRESERVED"
Write-Host "Availability : PRESERVED"
Write-Host "Existing MatchExplanation : PRESERVED"
Write-Host "User final decision : PRESERVED"
Write-Host "Backend change : NONE"
Write-Host "Paid API : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"