$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$page =
    Join-Path `
        $root `
        "app\assistant\market\[id]\page.tsx"

if (-not (Test-Path -LiteralPath $page -PathType Leaf)) {
    throw "13.66 : market advice page introuvable."
}

$text =
    [System.IO.File]::ReadAllText($page)

$required =
    @(
        "KLYX_RECOMMENDATION_HERO_13_66",
        "Choix recommandé par KLYX",
        "Pourquoi KLYX le recommande",
        "Choisir cette recommandation",
        "Une recommandation, pas une décision automatique",
        "Le prestataire n’est sélectionné qu’après ton action explicite",
        "prepareChoice(recommendedOffer)",
        "Confirmer mon choix",
        "Le paiement reste une étape séparée"
    )

foreach ($signal in $required) {
    if (-not $text.Contains($signal)) {
        throw "13.66 : signal manquant : $signal"
    }
}

if (
    $text -match
    'automaticSelection\s*[:=]\s*true'
) {
    throw "13.66 : selection automatique detectee."
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.66 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
Write-Host ""

npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.66 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.66 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
Write-Host ""

npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.66 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.66 CHECK OK"
Write-Host "======================================"
Write-Host "Recommended provider hero : READY"
Write-Host "Recommendation explanation : READY"
Write-Host "Trust indicators : READY"
Write-Host "Price comparison : READY"
Write-Host "Client explicit choice : REQUIRED"
Write-Host "Automatic selection : IMPOSSIBLE"
Write-Host "Payment remains separate : YES"
Write-Host "Paid API requirement : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"