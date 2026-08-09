$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$file = Join-Path $root "lib\stripe-payments.ts"

if (-not (Test-Path -LiteralPath $file)) {
  throw "Fichier introuvable : lib\stripe-payments.ts"
}

$backup = "$file.fix-8-1-payment-failed.backup"

if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item `
    -LiteralPath $file `
    -Destination $backup `
    -Force
}

$content = Get-Content `
  -LiteralPath $file `
  -Raw `
  -Encoding UTF8

$badBlock = @'
  await upsertFinancialLedgerEntry({
    bookingId: booking.id,
    entryKey: `booking:${booking.id}:payment-failed:${intent.id}`,
    entryType: "payment_failed",
    status: "failed",
    currency: booking.currency,
    grossAmountCents: intent.amount,
    paymentMode: booking.payment_mode,
    stripeCheckoutSessionId: checkoutSessionId,
    stripePaymentIntentId: intent.id,
    failureCode: failure.code,
    failureMessage: failure.message,
  });
'@

$goodBlock = @'
  await upsertFinancialLedgerEntry({
    bookingId: booking.id,
    entryKey: `booking:${booking.id}:payment-failed:${
      incomingPaymentIntentId ?? session.id
    }`,
    entryType: "payment_failed",
    status: "failed",
    currency: booking.currency,
    grossAmountCents:
      session.amount_total ?? booking.amount_total ?? 0,
    paymentMode: booking.payment_mode,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: incomingPaymentIntentId,
    failureCode: failure.code,
    failureMessage: failure.message,
  });
'@

if ($content.Contains($badBlock)) {
  $content = $content.Replace(
    $badBlock,
    $goodBlock
  )

  Set-Content `
    -LiteralPath $file `
    -Value $content `
    -Encoding UTF8

  Write-Host "[OK] Bloc payment_failed corrige." -ForegroundColor Green
}
elseif (
  $content.Contains(
    'incomingPaymentIntentId ?? session.id'
  ) -and
  $content.Contains(
    'stripeCheckoutSessionId: session.id'
  )
) {
  Write-Host "[OK] Correctif deja present." -ForegroundColor Yellow
}
else {
  throw "Bloc 8.1 fautif introuvable. Aucun fichier modifie."
}

Write-Host ""
Write-Host "CORRECTIF 8.1 APPLIQUE." -ForegroundColor Green
Write-Host "Le journal financier des paiements refuses reste actif."
Write-Host "Variables utilisees : session + incomingPaymentIntentId + failure."
Write-Host ""
Write-Host "Execute maintenant : npm run build"
