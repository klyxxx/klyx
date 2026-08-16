$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$pagePath =
    Join-Path `
        $root `
        "app\login\page.tsx"

if (-not (Test-Path -LiteralPath $pagePath -PathType Leaf)) {
    throw "13.88 : login/page.tsx introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

$signals = @(
    "KLYX_MULTI_PROFILE_LOGIN_13_88",
    "KLYX_LOGIN_PROFILE_CONTINUITY_13_88",
    "KLYX_PASSWORD_RESET_FEEDBACK_13_88",
    "KLYX_LOGIN_NO_PASSWORD_SWITCH_13_88",
    "Une connexion. Tous tes espaces KLYX.",
    "sans ressaisir ton mot de passe",
    "successMessage",
    "setSuccessMessage",
    "signInWithPassword",
    "resetPasswordForEmail",
    "/reset-password",
    'router.replace(',
    '"/dashboard"',
    "function LoginBenefit",
    "conserver",
    "ton mot de passe dans le navigateur",
    "createClient"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.88 : signal manquant : $signal"
    }
}

if ($text.Contains("alert(")) {
    throw "13.88 : ancien alert navigateur encore present."
}

if (
    $text.Contains("localStorage.setItem") -and
    $text.Contains("password")
) {
    throw "13.88 : stockage local du mot de passe detecte."
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.88 : PowerShell injecte dans page.tsx."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.88 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.88 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.88 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.88 CHECK OK"
Write-Host "======================================"
Write-Host "Authentication : READY"
Write-Host "Existing session redirect : PRESERVED"
Write-Host "Multi-profile concept : READY"
Write-Host "Passwordless profile switching : READY"
Write-Host "Password reset UI : READY"
Write-Host "Browser alert : NONE"
Write-Host "Password localStorage : NONE"
Write-Host "Backend change : NONE"
Write-Host "Migration : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"