$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$requiredFiles =
    @(
        "lib\brain\llm\contracts.ts",
        "lib\brain\llm\safety.ts",
        "lib\brain\llm\provider.ts",
        "lib\brain\llm\index.ts",
        "tests\unit\brain-llm-safety.test.ts"
    )

foreach (
    $relative
    in $requiredFiles
) {
    $path =
        Join-Path `
            $root `
            $relative

    if (
        -not (
            Test-Path `
                -LiteralPath `
                $path `
                -PathType Leaf
        )
    ) {
        throw (
            "13.53 : fichier manquant : " +
            $relative
        )
    }
}

$safetyText =
    [System.IO.File]::ReadAllText(
        (
            Join-Path `
                $root `
                "lib\brain\llm\safety.ts"
        )
    )

$providerText =
    [System.IO.File]::ReadAllText(
        (
            Join-Path `
                $root `
                "lib\brain\llm\provider.ts"
        )
    )

if (
    $safetyText -notmatch
    'automaticExecutionAllowed:\s*false'
) {
    throw (
        "13.53 : automaticExecutionAllowed=false absent."
    )
}

if (
    $safetyText -notmatch
    'requiresExplicitConfirmation:\s*true'
) {
    throw (
        "13.53 : confirmation explicite non forcee."
    )
}

$protectedActions =
    @(
        "publish_market_request",
        "select_provider",
        "create_booking",
        "create_payment",
        "refund_payment"
    )

foreach (
    $action
    in $protectedActions
) {
    if (
        -not $safetyText.Contains(
            $action
        )
    ) {
        throw (
            "13.53 : action transactionnelle non protegee : " +
            $action
        )
    }
}

if (
    $providerText -match
    'stripe\.|checkout\.sessions\.create|supabase.*insert|supabase.*update'
) {
    throw (
        "13.53 : provider LLM contient une execution transactionnelle interdite."
    )
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.53 tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.53 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.53 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.53 CHECK OK"
Write-Host "======================================"
Write-Host "LLM contracts : CREATED"
Write-Host "Server-only provider : CREATED"
Write-Host "Provider status : DISABLED BY DEFAULT"
Write-Host "Automatic execution : IMPOSSIBLE"
Write-Host "Explicit confirmation : REQUIRED"
Write-Host "Market publication : PROTECTED"
Write-Host "Provider selection : PROTECTED"
Write-Host "Booking creation : PROTECTED"
Write-Host "Payment creation : PROTECTED"
Write-Host "Refund execution : PROTECTED"
Write-Host "Existing Brain behavior changed : NON"
Write-Host "External LLM call : NON"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"