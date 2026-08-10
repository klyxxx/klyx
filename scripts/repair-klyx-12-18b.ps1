$ErrorActionPreference = "Stop"

$root = "C:\Users\fenjo\Documents\klyx"
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.18B - REPARATION INSTALLATION" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# 1. Copier les nouveaux fichiers depuis payload
# ------------------------------------------------------------
$files = @(
  "lib\klyx-public-config.ts",
  "app\components\KlyxPublicFooter.tsx",
  "app\legal\page.tsx",
  "app\privacy\page.tsx",
  "app\terms\page.tsx",
  "app\support\page.tsx",
  "app\delete-account\page.tsx"
)

foreach ($relative in $files) {
  $source = Join-Path $payload $relative
  $target = Join-Path $root $relative

  if (-not (Test-Path -LiteralPath $source)) {
    throw "Fichier payload manquant : $source"
  }

  $parent = Split-Path -Parent $target
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force

  Write-Host "[OK] $relative" -ForegroundColor Green
}

# ------------------------------------------------------------
# 2. Parametres : ajouter le bloc legal avant deconnexion
# ------------------------------------------------------------
$settingsPath = "app\settings\page.tsx"

if (-not (Test-Path -LiteralPath $settingsPath)) {
  throw "Fichier introuvable : $settingsPath"
}

$settings = Get-Content -LiteralPath $settingsPath -Raw

if ($settings -notmatch 'title="Confidentialité et assistance"') {
  $anchor = @'
          <section className="rounded-3xl border border-border bg-card p-6">
            <button
'@

  $block = @'
          <Section icon={<ShieldAlert />} title="Confidentialité et assistance">
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/privacy"
                className="rounded-2xl border border-border p-4 font-bold transition hover:bg-muted"
              >
                Politique de confidentialité
              </Link>
              <Link
                href="/terms"
                className="rounded-2xl border border-border p-4 font-bold transition hover:bg-muted"
              >
                Conditions d’utilisation
              </Link>
              <Link
                href="/support"
                className="rounded-2xl border border-border p-4 font-bold transition hover:bg-muted"
              >
                Assistance KLYX
              </Link>
              <Link
                href="/delete-account"
                className="rounded-2xl border border-border p-4 font-bold transition hover:bg-muted"
              >
                Suppression du compte sur le web
              </Link>
            </div>
          </Section>

'@

  if (-not $settings.Contains($anchor)) {
    throw "Ancre deconnexion introuvable dans settings."
  }

  $settings = $settings.Replace($anchor, $block + $anchor)
}

# Remplacement du texte, via regex pour eviter les problemes d'apostrophes PowerShell.
$settings = [regex]::Replace(
  $settings,
  'Bloqué s.il existe une réservation active ou un paiement\.',
  'Une réservation active doit être terminée ou annulée. Si le compte contient des paiements à conserver, KLYX peut traiter la suppression avec anonymisation et conservation limitée des données obligatoires.',
  1
)

[System.IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $settingsPath),
  $settings,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Parametres legal + assistance" -ForegroundColor Green

# ------------------------------------------------------------
# 3. API suppression : message production-ready
# ------------------------------------------------------------
$deleteApiPath = "app\api\account\delete\route.ts"

if (-not (Test-Path -LiteralPath $deleteApiPath)) {
  throw "Fichier introuvable : $deleteApiPath"
}

$deleteApi = Get-Content -LiteralPath $deleteApiPath -Raw

$deleteApi = $deleteApi.Replace(
  "Ce compte contient un paiement. La suppression avec anonymisation financière sera ajoutée avant l’ouverture publique.",
  "Ce compte contient des données de paiement qui nécessitent un traitement de suppression avec conservation limitée ou anonymisation. Utilise la page /delete-account pour initier la demande."
)

[System.IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $deleteApiPath),
  $deleteApi,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] API suppression compte" -ForegroundColor Green

# ------------------------------------------------------------
# 4. Sidebar : rendre les routes legales publiques
# ------------------------------------------------------------
$sidebarPath = "app\ui\AppSidebar.tsx"

if (-not (Test-Path -LiteralPath $sidebarPath)) {
  throw "Fichier introuvable : $sidebarPath"
}

$sidebar = Get-Content -LiteralPath $sidebarPath -Raw
$routes = @(
  "/legal",
  "/privacy",
  "/terms",
  "/support",
  "/delete-account"
)

foreach ($route in $routes) {
  if ($sidebar -notmatch [regex]::Escape('"' + $route + '"')) {
    $pattern = '("/reset-password"\s*,?)'
    if ($sidebar -notmatch $pattern) {
      throw "Ancre /reset-password introuvable dans AppSidebar."
    }

    $replacement = '$1' + "`r`n  `"$route`","
    $sidebar = [regex]::Replace(
      $sidebar,
      $pattern,
      $replacement,
      1
    )
  }
}

[System.IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $sidebarPath),
  $sidebar,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Routes legales publiques" -ForegroundColor Green

Write-Host ""
Write-Host "KLYX 12.18B appliquee." -ForegroundColor Cyan
Write-Host "Lancement du check 12.18..." -ForegroundColor Cyan
Write-Host ""

powershell -ExecutionPolicy Bypass -File ".\scripts\check-step-12-18.ps1"

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "KLYX 12.18B REPARATION VALIDEE." -ForegroundColor Green
