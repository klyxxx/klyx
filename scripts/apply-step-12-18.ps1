$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.18 - STORE LEGAL READINESS" -ForegroundColor Cyan
Write-Host ""

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
  $parent = Split-Path -Parent $target

  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
  Write-Host "[OK] $relative" -ForegroundColor Green
}

# Settings : ajoute un bloc légal visible dans l'app.
$settingsPath = "app\settings\page.tsx"
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
    throw "Ancre paramètres introuvable."
  }

  $settings = $settings.Replace($anchor, $block + $anchor)
}

$settings = $settings.Replace(
  'Bloqué s’il existe une réservation active ou un paiement.',
  'Une réservation active doit être terminée ou annulée. Si le compte contient des paiements à conserver, KLYX peut traiter la suppression avec anonymisation et conservation limitée des données obligatoires.'
)

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $settingsPath),
  $settings,
  [Text.UTF8Encoding]::new($false)
)
Write-Host "[OK] Paramètres -> confidentialité/assistance" -ForegroundColor Green

# Account deletion : ne dit plus que la fonction sera ajoutée "avant ouverture publique".
$deleteApiPath = "app\api\account\delete\route.ts"
$deleteApi = Get-Content -LiteralPath $deleteApiPath -Raw

$oldPaid = @'
        error:
          "Ce compte contient un paiement. La suppression avec anonymisation financière sera ajoutée avant l’ouverture publique.",
'@

$newPaid = @'
        error:
          "Ce compte contient des données de paiement qui nécessitent un traitement de suppression avec conservation limitée ou anonymisation. Utilise la page /delete-account pour initier la demande.",
        code: "DELETION_REVIEW_REQUIRED",
        requestUrl: "/delete-account",
'@

if ($deleteApi.Contains($oldPaid)) {
  $deleteApi = $deleteApi.Replace($oldPaid, $newPaid)
}
else {
  $deleteApi = $deleteApi.Replace(
    '"Ce compte contient un paiement. La suppression avec anonymisation financière sera ajoutée avant l’ouverture publique."',
    '"Ce compte contient des données de paiement qui nécessitent un traitement de suppression avec conservation limitée ou anonymisation. Utilise la page /delete-account pour initier la demande."'
  )
}

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $deleteApiPath),
  $deleteApi,
  [Text.UTF8Encoding]::new($false)
)
Write-Host "[OK] API suppression : parcours externe disponible" -ForegroundColor Green

# Les pages publiques ne doivent pas exiger la sidebar / session.
$sidebarPath = "app\ui\AppSidebar.tsx"
$sidebar = Get-Content -LiteralPath $sidebarPath -Raw

foreach ($route in @("/legal", "/privacy", "/terms", "/support", "/delete-account")) {
  if ($sidebar -notmatch [regex]::Escape("`"$route`"")) {
    $sidebar = $sidebar.Replace(
      '  "/reset-password",',
      "  `"/reset-password`",`r`n  `"$route`","
    )
  }
}

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $sidebarPath),
  $sidebar,
  [Text.UTF8Encoding]::new($false)
)
Write-Host "[OK] Pages légales accessibles hors sidebar" -ForegroundColor Green

Write-Host ""
Write-Host "12.18 appliquee. Aucune migration SQL." -ForegroundColor Cyan
Write-Host "IMPORTANT : configure NEXT_PUBLIC_SUPPORT_EMAIL avec une vraie adresse avant les stores." -ForegroundColor Yellow
