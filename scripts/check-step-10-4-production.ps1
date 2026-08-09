param(
  [string]$BaseUrl = ""
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$failed = $false

function Ok([string]$Message) {
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Fail([string]$Message) {
  Write-Host "[ECHEC] $Message" -ForegroundColor Red
  $script:failed = $true
}

function Info([string]$Message) {
  Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Read-EnvValue(
  [string]$File,
  [string]$Name
) {
  if (-not (Test-Path -LiteralPath $File)) {
    return ""
  }

  $line = Get-Content -LiteralPath $File |
    Where-Object {
      $_ -match "^\s*$([regex]::Escape($Name))\s*="
    } |
    Select-Object -First 1

  if (-not $line) {
    return ""
  }

  $value = ($line -split "=", 2)[1].Trim()

  if (
    ($value.StartsWith('"') -and $value.EndsWith('"')) -or
    ($value.StartsWith("'") -and $value.EndsWith("'"))
  ) {
    $value = $value.Substring(
      1,
      $value.Length - 2
    )
  }

  return $value.Trim()
}

function Normalize-BaseUrl(
  [string]$Value
) {
  $urlValue = $Value.Trim().TrimEnd("/")

  if (-not $urlValue) {
    return ""
  }

  if ($urlValue -notmatch "^https?://") {
    $urlValue = "https://$urlValue"
  }

  return $urlValue.TrimEnd("/")
}

function Convert-ResponseContentToText(
  $Content
) {
  if ($Content -is [byte[]]) {
    return [System.Text.Encoding]::UTF8.GetString(
      $Content
    )
  }

  return [string]$Content
}

function Test-Page(
  [string]$Path,
  [string]$Label
) {
  $requestUrl = "$BaseUrl$Path"

  try {
    $response = Invoke-WebRequest `
      -Uri $requestUrl `
      -Method Get `
      -MaximumRedirection 5 `
      -TimeoutSec 25 `
      -UseBasicParsing

    if (
      $response.StatusCode -ge 200 -and
      $response.StatusCode -lt 400
    ) {
      Ok "$Label -> HTTP $($response.StatusCode)"
      return $response
    }

    Fail "$Label -> HTTP $($response.StatusCode)"
    return $null
  }
  catch {
    Fail "$Label -> $($_.Exception.Message)"
    return $null
  }
}

Write-Host ""
Write-Host "KLYX ETAPE 10.4 - PRECHECK PRODUCTION" -ForegroundColor Cyan
Write-Host ""

if (-not $BaseUrl.Trim()) {
  $envLocal = Join-Path $root ".env.local"

  $BaseUrl = Read-EnvValue `
    -File $envLocal `
    -Name "NEXT_PUBLIC_APP_URL"
}

$BaseUrl = Normalize-BaseUrl $BaseUrl

if (-not $BaseUrl) {
  Write-Host ""
  Write-Host "URL de production manquante." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Exemple :" -ForegroundColor Yellow
  Write-Host 'powershell -ExecutionPolicy Bypass -File .\scripts\check-step-10-4-production.ps1 -BaseUrl "https://klyx-ten.vercel.app"'
  Write-Host ""
  exit 2
}

Info "Production testee : $BaseUrl"

if ($BaseUrl -notmatch "^https://") {
  Fail "HTTPS obligatoire"
}
else {
  Ok "HTTPS actif"
}

Write-Host ""
Write-Host "PAGES PUBLIQUES" -ForegroundColor Cyan

$homeResponse = Test-Page "/" "Accueil"
$loginResponse = Test-Page "/login" "Login"
$signupResponse = Test-Page "/signup" "Signup"
$installResponse = Test-Page "/install" "Installer KLYX"
$offlineResponse = Test-Page "/offline" "Page hors ligne"

Write-Host ""
Write-Host "PWA" -ForegroundColor Cyan

$manifestResponse = Test-Page `
  "/manifest.webmanifest" `
  "Manifest"

if ($manifestResponse) {
  try {
    $manifestText =
      Convert-ResponseContentToText `
        $manifestResponse.Content

    $manifest =
      $manifestText |
      ConvertFrom-Json

    if (
      $manifest.name -match "KLYX" -or
      $manifest.short_name -eq "KLYX"
    ) {
      Ok "Manifest : nom KLYX"
    }
    else {
      Fail "Manifest : nom KLYX absent"
    }

    if ($manifest.start_url -eq "/") {
      Ok "Manifest : start_url = /"
    }
    else {
      Fail "Manifest : start_url doit etre /"
    }

    if ($manifest.display -eq "standalone") {
      Ok "Manifest : display standalone"
    }
    else {
      Fail "Manifest : display standalone absent"
    }

    if (
      $manifest.icons -and
      $manifest.icons.Count -ge 2
    ) {
      Ok "Manifest : icones declarees"
    }
    else {
      Fail "Manifest : icones insuffisantes"
    }
  }
  catch {
    Fail "Manifest JSON invalide : $($_.Exception.Message)"
  }
}

$swResponse = Test-Page `
  "/sw.js" `
  "Service worker"

if ($swResponse) {
  $swText =
    Convert-ResponseContentToText `
      $swResponse.Content

  if ($swText.Contains("/offline")) {
    Ok "Service worker : fallback /offline"
  }
  else {
    Fail "Service worker : fallback /offline absent"
  }

  if ($swText.Contains("/api/")) {
    Ok "Service worker : exclusion API presente"
  }
  else {
    Fail "Service worker : exclusion API absente"
  }

  if ($swText.Contains("/payment/")) {
    Ok "Service worker : exclusion paiement presente"
  }
  else {
    Fail "Service worker : exclusion paiement absente"
  }

  if ($swText.Contains('request.method !== "GET"')) {
    Ok "Service worker : POST non cache"
  }
  else {
    Fail "Service worker : protection requetes non-GET absente"
  }
}

Write-Host ""
Write-Host "ICONES PWA" -ForegroundColor Cyan

Test-Page "/icon.svg" "Icone SVG" | Out-Null
Test-Page "/icons/icon-192.png" "Icone 192" | Out-Null
Test-Page "/icons/icon-512.png" "Icone 512" | Out-Null
Test-Page "/icons/icon-maskable-512.png" "Icone maskable" | Out-Null
Test-Page "/icons/apple-touch-icon.png" "Icone Apple" | Out-Null

Write-Host ""
Write-Host "CONTENU PUBLIC" -ForegroundColor Cyan

if ($homeResponse) {
  $homeText =
    Convert-ResponseContentToText `
      $homeResponse.Content

  if ($homeText -match "KLYX") {
    Ok "Accueil : marque KLYX visible"
  }
  else {
    Fail "Accueil : marque KLYX introuvable"
  }

  if (
    $homeText -match "Installer" -or
    $homeText -match "install"
  ) {
    Ok "Accueil : installation visible"
  }
  else {
    Fail "Accueil : installation non visible"
  }
}

if ($loginResponse) {
  if ($loginResponse.StatusCode -eq 200) {
    Ok "Login : page production accessible"
  }
  else {
    Fail "Login : page production inaccessible"
  }
}

if ($signupResponse) {
  if ($signupResponse.StatusCode -eq 200) {
    Ok "Signup : page production accessible"
  }
  else {
    Fail "Signup : page production inaccessible"
  }
}

if ($installResponse) {
  if ($installResponse.StatusCode -eq 200) {
    Ok "Installer : page production accessible"
  }
  else {
    Fail "Installer : page production inaccessible"
  }
}

if ($offlineResponse) {
  if ($offlineResponse.StatusCode -eq 200) {
    Ok "Offline : page production accessible"
  }
  else {
    Fail "Offline : page production inaccessible"
  }
}

Write-Host ""
Write-Host "RESULTAT" -ForegroundColor Cyan
Write-Host ""

if ($failed) {
  Write-Host "PRECHECK 10.4 PRODUCTION NON VALIDE." -ForegroundColor Red
  Write-Host "Ne ferme pas encore l'etape 10."
  exit 1
}

Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX ETAPE 10 PRODUCTION VALIDEE." -ForegroundColor Green
Write-Host "Accueil / Auth / Installation / PWA / HTTPS : OK" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Etape suivante : 11.0" -ForegroundColor Cyan