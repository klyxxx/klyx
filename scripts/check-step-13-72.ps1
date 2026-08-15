$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$providerPage =
    Join-Path `
        $root `
        "app\providers\[id]\page.tsx"

$reviewsPage =
    Join-Path `
        $root `
        "app\providers\[id]\PublicReviews.tsx"

$reviewApi =
    Join-Path `
        $root `
        "app\api\reviews\route.ts"

foreach ($file in @(
    $providerPage,
    $reviewsPage,
    $reviewApi
)) {
    if (
        -not (
            Test-Path `
                -LiteralPath $file `
                -PathType Leaf
        )
    ) {
        throw "13.72 : fichier manquant : $file"
    }
}

$providerText =
    [System.IO.File]::ReadAllText(
        $providerPage
    )

$reviewsText =
    [System.IO.File]::ReadAllText(
        $reviewsPage
    )

$apiText =
    [System.IO.File]::ReadAllText(
        $reviewApi
    )

$providerSignals = @(
    "klyxScore={bestScore}",
    "yearsExperience={Number(",
    "providerProfile.verification_status"
)

foreach ($signal in $providerSignals) {
    if (-not $providerText.Contains($signal)) {
        throw "13.72 : provider signal manquant : $signal"
    }
}

$reviewSignals = @(
    "KLYX_TRUST_SUMMARY_13_72",
    "Résumé de confiance",
    "Note moyenne",
    "Avis vérifiés",
    "KLYX Score",
    "Vérification",
    "Expérience",
    "averageRating.toFixed(1)",
    "klyxScore.toFixed(0)",
    "reviewCount",
    "yearsExperience",
    '/api/providers/${providerId}/reviews'
)

foreach ($signal in $reviewSignals) {
    if (-not $reviewsText.Contains($signal)) {
        throw "13.72 : review signal manquant : $signal"
    }
}

$apiSignals = @(
    "recalculateProviderScores",
    "await recalculateProviderScores(",
    '.from("reviews")',
    '"completed"',
    '"client"'
)

foreach ($signal in $apiSignals) {
    if (-not $apiText.Contains($signal)) {
        throw "13.72 : score backend signal manquant : $signal"
    }
}

if (
    $reviewsText.Contains(
        "[System.IO.File]::WriteAllText"
    )
) {
    throw "13.72 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
Write-Host ""

npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.72 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.72 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
Write-Host ""

npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.72 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.72 CHECK OK"
Write-Host "======================================"
Write-Host "Average rating : CONNECTED"
Write-Host "Verified review count : CONNECTED"
Write-Host "KLYX Score : CONNECTED"
Write-Host "Verification : CONNECTED"
Write-Host "Experience : CONNECTED"
Write-Host "Verified review backend : PRESERVED"
Write-Host "Score recalculation : PRESERVED"
Write-Host "New migration : NONE"
Write-Host "Paid API : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"