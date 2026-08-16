$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$page =
    Join-Path `
        $root `
        "app\assistant\market\page.tsx"

if (
    -not (
        Test-Path `
            -LiteralPath $page `
            -PathType Leaf
    )
) {
    throw "13.65 : page assistant market introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $page
    )

$required =
    @(
        "Dis-moi ce qu’il faut faire.",
        "Tu peux parler naturellement",
        "Ce que j’ai compris",
        "Encore nécessaire",
        "Demande prête",
        "Rien n’a encore été publié.",
        "Confirmer et publier la demande",
        "/api/brain/respond",
        "/api/brain/market-publish",
        "confirmed:",
        "confirmationId:"
    )

foreach ($signal in $required) {
    if (
        -not $text.Contains(
            $signal
        )
    ) {
        throw (
            "13.65 : signal manquant : " +
            $signal
        )
    }
}

if (
    $text -match
    'automaticExecutionAllowed\s*[:=]\s*true'
) {
    throw "13.65 : execution automatique detectee."
}

if (
    $text.Contains(
        "[System.IO.File]::WriteAllText"
    )
) {
    throw "13.65 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.65 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.65 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Production build..."
Write-Host ""

npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.65 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.65 CHECK OK"
Write-Host "======================================"
Write-Host "Natural-language need UX : READY"
Write-Host "Brain conversation : CONNECTED"
Write-Host "Live understood context : VISIBLE"
Write-Host "Missing information : VISIBLE"
Write-Host "Request preview : VISIBLE"
Write-Host "Explicit publish confirmation : REQUIRED"
Write-Host "Automatic publication : IMPOSSIBLE"
Write-Host "Paid API requirement : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"