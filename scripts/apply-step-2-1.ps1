$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$bookingPage = Join-Path $root "app\bookings\[id]\page.tsx"
$stripePayments = Join-Path $root "lib\stripe-payments.ts"

if (-not (Test-Path -LiteralPath $bookingPage)) {
  throw "Fichier introuvable : app\bookings\[id]\page.tsx"
}

if (-not (Test-Path -LiteralPath $stripePayments)) {
  throw "Fichier introuvable : lib\stripe-payments.ts"
}

Copy-Item -LiteralPath $bookingPage -Destination "$bookingPage.step-2-1.backup" -Force
Copy-Item -LiteralPath $stripePayments -Destination "$stripePayments.step-2-1.backup" -Force

$page = Get-Content -LiteralPath $bookingPage -Raw

$oldCanCancel = @'
  const canCancel =
    ["pending", "accepted"].includes(booking.status) &&
    booking.payment_status !== "paid" &&
    !(role === "provider" && booking.status === "pending");
'@

$newCanCancel = @'
  const canCancel =
    ["pending", "accepted"].includes(booking.status) &&
    !(role === "provider" && booking.status === "pending");
'@

if (-not $page.Contains($oldCanCancel)) {
  throw "Bloc canCancel attendu introuvable. Aucun changement appliqué."
}

$page = $page.Replace($oldCanCancel, $newCanCancel)
Set-Content -LiteralPath $bookingPage -Value $page -Encoding utf8

$payments = Get-Content -LiteralPath $stripePayments -Raw

$payments = $payments.Replace(
  'type: "payment_client_success"',
  'type: "payment_received"'
)

$payments = $payments.Replace(
  'type: "payment_provider_success"',
  'type: "payment_received"'
)

$payments = $payments.Replace(
  'type: "payment_failed"',
  'type: "system"'
)

Set-Content -LiteralPath $stripePayments -Value $payments -Encoding utf8

Write-Host ""
Write-Host "Étape 2.1 appliquée avec succès." -ForegroundColor Green
Write-Host "Sauvegardes créées avec l’extension .step-2-1.backup"
Write-Host "Exécute maintenant : npm run build"
