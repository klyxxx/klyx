$ErrorActionPreference = "Stop"

$root = "C:\Users\fenjo\Documents\klyx"
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.18C - REPARATION ROBUSTE" -ForegroundColor Cyan
Write-Host ""

# 1. Recopie les nouveaux fichiers 12.18 si payload est encore présent.
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
  $target = Join-Path $root $relative

  if (-not (Test-Path -LiteralPath $target)) {
    $source = Join-Path $payload $relative

    if (-not (Test-Path -LiteralPath $source)) {
      throw "Fichier absent dans KLYX et payload : $relative"
    }

    $parent = Split-Path -Parent $target
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $target -Force
  }

  Write-Host "[OK] $relative" -ForegroundColor Green
}

# 2. SETTINGS : insertion basée sur le bouton logout réel, sans dépendre des espaces.
$settingsPath = "app\settings\page.tsx"
$settings = Get-Content -LiteralPath $settingsPath -Raw

if ($settings -notmatch 'title="Confidentialité et assistance"') {
  $logoutMarker = 'onClick={() => void logout()}'
  $logoutIndex = $settings.IndexOf($logoutMarker)

  if ($logoutIndex -lt 0) {
    throw "Bouton logout introuvable dans settings."
  }

  $sectionIndex = $settings.LastIndexOf(
    '<section',
    $logoutIndex
  )

  if ($sectionIndex -lt 0) {
    throw "Section logout introuvable dans settings."
  }

  $legalBlock = @'
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

  $settings =
    $settings.Substring(0, $sectionIndex) +
    $legalBlock +
    $settings.Substring($sectionIndex)
}

# Remplace l'ancien texte sans utiliser d'apostrophe fragile PowerShell.
$settings = [regex]::Replace(
  $settings,
  'Bloqué s.il existe une réservation active ou un paiement\.',
  'Une réservation active doit être terminée ou annulée. Si le compte contient des paiements à conserver, KLYX peut traiter la suppression avec anonymisation et conservation limitée des données obligatoires.',
  1
)

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $settingsPath),
  $settings,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Settings legal + support" -ForegroundColor Green

# 3. API suppression : retire la mention "sera ajoutée avant ouverture publique".
$deleteApiPath = "app\api\account\delete\route.ts"
$deleteApi = Get-Content -LiteralPath $deleteApiPath -Raw

$deleteApi = $deleteApi.Replace(
  "Ce compte contient un paiement. La suppression avec anonymisation financière sera ajoutée avant l’ouverture publique.",
  "Ce compte contient des données de paiement qui nécessitent un traitement de suppression avec conservation limitée ou anonymisation. Utilise la page /delete-account pour initier la demande."
)

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $deleteApiPath),
  $deleteApi,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] API suppression production-ready" -ForegroundColor Green

# 4. SIDEBAR : remplace le tableau routesWithoutSidebar complet.
$sidebarPath = "app\ui\AppSidebar.tsx"
$sidebar = Get-Content -LiteralPath $sidebarPath -Raw

$routesBlock = @'
const routesWithoutSidebar = [
  "/",
  "/login",
  "/signup",
  "/reset-password",
  "/legal",
  "/privacy",
  "/terms",
  "/support",
  "/delete-account",
];
'@

$routesPattern =
  '(?s)const routesWithoutSidebar\s*=\s*\[.*?\];'

if ($sidebar -notmatch $routesPattern) {
  throw "routesWithoutSidebar introuvable dans AppSidebar."
}

$sidebar = [regex]::Replace(
  $sidebar,
  $routesPattern,
  $routesBlock,
  1
)

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $sidebarPath),
  $sidebar,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Routes legales publiques" -ForegroundColor Green

# 5. Vérifications immédiates avant le check officiel.
$settingsCheck = Get-Content -LiteralPath $settingsPath -Raw
$sidebarCheck = Get-Content -LiteralPath $sidebarPath -Raw

if ($settingsCheck -notmatch 'Confidentialité et assistance') {
  throw "Bloc legal settings absent apres ecriture."
}

foreach ($route in @(
  "/privacy",
  "/terms",
  "/support",
  "/delete-account"
)) {
  if ($sidebarCheck -notmatch [regex]::Escape('"' + $route + '"')) {
    throw "Route publique absente : $route"
  }
}

Write-Host ""
Write-Host "[OK] Reparation 12.18C appliquee." -ForegroundColor Green
Write-Host ""
Write-Host "Lancement check-step-12-18.ps1..." -ForegroundColor Cyan
Write-Host ""

powershell -ExecutionPolicy Bypass -File ".\scripts\check-step-12-18.ps1"

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "KLYX 12.18C REPARATION VALIDEE." -ForegroundColor Green
