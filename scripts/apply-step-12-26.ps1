$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.26 - ECONOMIE + COMMISSION" -ForegroundColor Cyan
Write-Host ""

$files = @(
  "lib\klyx-economics.ts",
  "app\api\public\economics\route.ts",
  "app\founder\economics\page.tsx"
)

foreach ($relative in $files) {
  $source = Join-Path $payload $relative
  $target = Join-Path $root $relative

  if (-not (Test-Path -LiteralPath $source)) {
    throw "Payload manquant : $relative"
  }

  New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force

  Write-Host "[OK] $relative" -ForegroundColor Green
}

$checkoutPath = "app\api\stripe\create-checkout-session\route.ts"
$checkout = Get-Content -LiteralPath $checkoutPath -Raw

$importAnchor = 'import { markBookingPaidFromSession } from "@/lib/stripe-payments";'
$newImport = 'import { calculateKlyxEconomics, getKlyxCommissionPercent } from "@/lib/klyx-economics";'

if (-not $checkout.Contains($newImport)) {
  if (-not $checkout.Contains($importAnchor)) {
    throw "Ancre import Stripe payments introuvable."
  }

  $checkout = $checkout.Replace(
    $importAnchor,
    "$importAnchor`r`n$newImport"
  )
}

$oldBlock = @'
    const commissionPercent = Number(
      process.env.KLYX_COMMISSION_PERCENT || "15"
    );

    if (
      Number.isNaN(commissionPercent) ||
      commissionPercent < 0 ||
      commissionPercent > 100
    ) {
      throw new Error(
        "KLYX_COMMISSION_PERCENT doit être compris entre 0 et 100."
      );
    }

    const applicationFeeAmount = Math.round(
      amountTotal *
        (commissionPercent / 100)
    );
'@

$newBlock = @'
    const economics = calculateKlyxEconomics(
      amountTotal,
      getKlyxCommissionPercent()
    );

    const applicationFeeAmount =
      economics.platformFeeCents;
'@

if ($checkout.Contains($oldBlock)) {
  $checkout = $checkout.Replace(
    $oldBlock,
    $newBlock
  )
}
elseif (
  $checkout -notmatch 'calculateKlyxEconomics\('
) {
  throw "Bloc commission Stripe actuel introuvable."
}

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $checkoutPath),
  $checkout,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Checkout utilise le moteur economique central" -ForegroundColor Green
Write-Host "[OK] Commission par defaut : 15%" -ForegroundColor Green
Write-Host "[OK] KLYX_COMMISSION_PERCENT reste configurable" -ForegroundColor Green
Write-Host ""
Write-Host "12.26 appliquee. Aucune migration SQL." -ForegroundColor Cyan
