$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$failed = $false

function Ok([string]$Message) {
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Missing([string]$Message) {
  Write-Host "[MANQUANT] $Message" -ForegroundColor Red
  $script:failed = $true
}

function Check-File(
  [string]$RelativePath,
  [string]$Label
) {
  $path = Join-Path $root $RelativePath

  if (Test-Path -LiteralPath $path) {
    Ok $Label
    return $true
  }

  Missing $Label
  return $false
}

function Check-Text(
  [string]$RelativePath,
  [string]$Pattern,
  [string]$Label
) {
  $path = Join-Path $root $RelativePath

  if (-not (Test-Path -LiteralPath $path)) {
    Missing "$Label (fichier absent)"
    return
  }

  $content = Get-Content -LiteralPath $path -Raw -Encoding UTF8

  if ($content.Contains($Pattern)) {
    Ok $Label
  }
  else {
    Missing $Label
  }
}

Write-Host ""
Write-Host "KLYX ETAPE 10.3 - PRECHECK FINAL" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# 1. ENTREE PUBLIQUE
# ============================================================

Check-File "app\page.tsx" "Accueil public /"
Check-Text "app\page.tsx" 'href="/install"' "Accueil : accès Installer"
Check-Text "app\page.tsx" "PublicSessionActions" "Accueil : actions selon session"

# ============================================================
# 2. AUTHENTIFICATION
# ============================================================

Check-File "app\login\page.tsx" "Page Login"
Check-Text "app\login\page.tsx" 'signInWithPassword' "Login : connexion Supabase"
Check-Text "app\login\page.tsx" 'router.replace("/dashboard")' "Login : redirection Dashboard"

Check-File "app\signup\page.tsx" "Page Signup"
Check-Text "app\signup\page.tsx" 'auth.signUp' "Signup : création Supabase"
Check-Text "app\signup\page.tsx" 'router.replace("/onboarding")' "Signup : onboarding après inscription"

# 10.1 peut avoir été appliqué ou non.
if (Test-Path -LiteralPath (Join-Path $root "app\components\PublicSessionActions.tsx")) {
  Ok "10.1 : PublicSessionActions présent"

  Check-Text `
    "app\signup\page.tsx" `
    "checkingSession" `
    "10.1 : Signup protège une session déjà active"
}
else {
  Missing "10.1 : PublicSessionActions présent"
}

# ============================================================
# 3. INSTALLATION / PWA
# ============================================================

Check-File "app\install\page.tsx" "Page Installer KLYX"
Check-File "app\manifest.ts" "Manifest PWA"
Check-Text "app\manifest.ts" 'start_url: "/"' "Manifest : démarrage sur /"
Check-Text "app\manifest.ts" 'display: "standalone"' "Manifest : mode standalone"

Check-File "app\components\InstallKlyxButton.tsx" "Bouton installation PWA"
Check-Text `
  "app\components\InstallKlyxButton.tsx" `
  "beforeinstallprompt" `
  "Installation : événement beforeinstallprompt"

Check-File "app\components\PwaRegistrar.tsx" "Enregistrement service worker"
Check-Text `
  "app\components\PwaRegistrar.tsx" `
  'register("/sw.js"' `
  "PWA : /sw.js enregistré"

Check-File "public\sw.js" "Service worker /sw.js"

# ============================================================
# 4. MODE HORS LIGNE 10.2
# ============================================================

Check-File "app\offline\page.tsx" "10.2 : page hors ligne"
Check-File `
  "app\components\OfflineRetryButton.tsx" `
  "10.2 : bouton Réessayer"

if (Test-Path -LiteralPath (Join-Path $root "public\sw.js")) {
  Check-Text "public\sw.js" "/offline" "Service worker : fallback hors ligne"
  Check-Text "public\sw.js" "/api/" "Service worker : exclusion API"
  Check-Text "public\sw.js" "/payment/" "Service worker : exclusion paiement"
  Check-Text "public\sw.js" 'request.method !== "GET"' "Service worker : pas de cache POST"
}

# ============================================================
# 5. ICONES
# ============================================================

Check-File "public\icon.svg" "Icône SVG KLYX"
Check-File "public\icons\icon-192.png" "Icône PWA 192"
Check-File "public\icons\icon-512.png" "Icône PWA 512"
Check-File "public\icons\icon-maskable-512.png" "Icône PWA maskable"
Check-File "public\icons\apple-touch-icon.png" "Icône Apple"

# ============================================================
# 6. LAYOUT
# ============================================================

Check-File "app\layout.tsx" "Root layout"
Check-Text "app\layout.tsx" "<PwaRegistrar />" "Layout : PwaRegistrar monté"
Check-Text "app\layout.tsx" 'manifest: "/manifest.webmanifest"' "Layout : manifest déclaré"

# ============================================================
# RESULTAT PRECHECK FICHIERS
# ============================================================

Write-Host ""

if ($failed) {
  Write-Host "PRECHECK 10.3 NON VALIDE." -ForegroundColor Red
  Write-Host "Corrige les éléments MANQUANT avant le build final."
  exit 1
}

Write-Host "PRECHECK FICHIERS VALIDE." -ForegroundColor Green
Write-Host ""
Write-Host "Lancement du build final..." -ForegroundColor Cyan
Write-Host ""

# ============================================================
# 7. BUILD FINAL
# ============================================================

& npm run build

if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "BUILD FINAL ECHEC." -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "KLYX ETAPE 10 VALIDEE." -ForegroundColor Green
Write-Host "Accueil / Login / Signup / Installation / PWA : OK" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Etape suivante : 11.0" -ForegroundColor Cyan
