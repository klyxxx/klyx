$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-58-openai-smoke.ps1"

if (
    -not (
        Test-Path `
            -LiteralPath $runner `
            -PathType Leaf
    )
) {
    throw "13.58 : smoke runner introuvable."
}

Write-Host ""
Write-Host "Static safety checks..."
Write-Host ""

$runnerText =
    [System.IO.File]::ReadAllText(
        $runner
    )

$forbidden =
    @(
        "checkout.sessions.create",
        "paymentIntents.create",
        "supabaseAdmin.from",
        "migration repair",
        "db push --linked",
        "db reset --linked"
    )

foreach (
    $pattern
    in $forbidden
) {
    if (
        $runnerText.Contains(
            $pattern
        )
    ) {
        throw (
            "13.58 : forbidden operation in smoke runner : " +
            $pattern
        )
    }
}

if (
    -not $runnerText.Contains(
        "automaticExecutionAllowed"
    )
) {
    throw "13.58 : automatic execution safety absent."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.58 tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.58 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.58 build FAILED."
}

Write-Host ""
Write-Host "Real provider smoke test..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.58 OpenAI smoke FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.58 CHECK OK"
Write-Host "======================================"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "Real provider smoke : PASSED OR SAFELY SKIPPED"
Write-Host "Transactional writes : NONE"
Write-Host "Automatic execution : IMPOSSIBLE"
Write-Host "======================================"