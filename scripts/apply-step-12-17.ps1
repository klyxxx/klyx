$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.17 - TRANSACTION INTEGRITY" -ForegroundColor Cyan
Write-Host ""

# Nouvel audit Founder
$files = @(
  "app\api\founder\transaction-readiness\route.ts",
  "app\founder\transaction-test\page.tsx"
)

foreach ($relative in $files) {
  $source = Join-Path $payload $relative
  $target = Join-Path $root $relative
  $parent = Split-Path -Parent $target
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
  Write-Host "[OK] $relative" -ForegroundColor Green
}

# Checkout Stripe : plus jamais de fallback silencieux vers babysitting.
$checkoutPath = "app\api\stripe\create-checkout-session\route.ts"
$checkout = Get-Content -LiteralPath $checkoutPath -Raw

if ($checkout -notmatch 'ancienne réservation.*métier') {
  $anchor = @'
async function resolveService(
  booking: BookingRow,
  providerId: string
): Promise<{
'@

  $replacement = @'
async function resolveService(
  booking: BookingRow,
  providerId: string
): Promise<{
'@

  if (-not $checkout.Contains($anchor)) {
    throw "Ancre resolveService checkout introuvable."
  }

  # Insert after function return type closing by targeting the first live condition.
  $condition = @'
  if (booking.service_id && booking.user_service_id) {
'@

  $guard = @'
  if (!booking.service_id || !booking.user_service_id) {
    throw new Error(
      "Cette ancienne réservation ne contient pas de métier complet. Recrée la réservation avant de payer."
    );
  }

  if (booking.service_id && booking.user_service_id) {
'@

  if (-not $checkout.Contains($condition)) {
    throw "Condition service checkout introuvable."
  }

  $checkout = $checkout.Replace($condition, $guard)
}

# Nom Stripe dynamique depuis services.name
$checkout = $checkout.Replace(
  'type ServiceRow = {' + "`r`n" + '  id: string;' + "`r`n" + '  slug: string;' + "`r`n" + '};',
  'type ServiceRow = {' + "`r`n" + '  id: string;' + "`r`n" + '  slug: string;' + "`r`n" + '  name: string | null;' + "`r`n" + '};'
)
$checkout = $checkout.Replace(
  'type ServiceRow = {' + "`n" + '  id: string;' + "`n" + '  slug: string;' + "`n" + '};',
  'type ServiceRow = {' + "`n" + '  id: string;' + "`n" + '  slug: string;' + "`n" + '  name: string | null;' + "`n" + '};'
)
$checkout = $checkout.Replace('.select("id, slug")', '.select("id, slug, name")')

$checkout = [regex]::Replace(
  $checkout,
  '(?s)function serviceLabel\(slug: string\): string \{.*?\n\}',
  @'
function serviceLabel(service: ServiceRow): string {
  return service.name?.trim() || service.slug || "Service KLYX";
}
'@,
  1
)

$checkout = $checkout.Replace('serviceLabel(' + "`r`n" + '                  service.slug' + "`r`n" + '                )',
                              'serviceLabel(service)')
$checkout = $checkout.Replace('serviceLabel(' + "`n" + '                  service.slug' + "`n" + '                )',
                              'serviceLabel(service)')
$checkout = $checkout.Replace('serviceLabel(service.slug)', 'serviceLabel(service)')

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $checkoutPath),
  $checkout,
  [Text.UTF8Encoding]::new($false)
)
Write-Host "[OK] Stripe checkout sans fallback baby-sitting" -ForegroundColor Green

# Booking create : libellé dynamique depuis le vrai service.
$bookingPath = "app\api\bookings\create\route.ts"
$booking = Get-Content -LiteralPath $bookingPath -Raw

$booking = [regex]::Replace(
  $booking,
  '(?s)function serviceLabel\(slug: string\): string \{.*?\n\}',
  @'
function serviceLabel(service: {
  slug: string;
  name?: string | null;
}): string {
  return service.name?.trim() || service.slug || "Service KLYX";
}
'@,
  1
)

$booking = $booking.Replace('.select("id, slug")', '.select("id, slug, name")')
$booking = $booking.Replace('serviceLabel(serviceSlug)', 'serviceLabel(service)')
$booking = $booking.Replace('serviceLabel(service.slug)', 'serviceLabel(service)')

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $bookingPath),
  $booking,
  [Text.UTF8Encoding]::new($false)
)
Write-Host "[OK] Booking create libelle de service dynamique" -ForegroundColor Green

Write-Host ""
Write-Host "12.17 appliquee. Aucune migration SQL." -ForegroundColor Cyan
