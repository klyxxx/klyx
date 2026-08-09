$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$file = Join-Path $root "lib\stripe-payments.ts"

if (-not (Test-Path -LiteralPath $file)) {
  throw "Fichier introuvable : lib\stripe-payments.ts"
}

$backup = "$file.step-8-1.backup"
if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item -LiteralPath $file -Destination $backup -Force
}

$content = Get-Content -LiteralPath $file -Raw -Encoding UTF8

$importAnchor = 'import { supabaseAdmin } from "@/lib/supabase-admin";'
$importLine = 'import { upsertFinancialLedgerEntry } from "@/lib/payment-ledger";'

if (-not $content.Contains($importLine)) {
  if (-not $content.Contains($importAnchor)) {
    throw "Import supabaseAdmin introuvable."
  }
  $content = $content.Replace(
    $importAnchor,
    $importAnchor + "`r`n" + $importLine
  )
}

$paidAnchor = @'
  if (updatedBooking) {
    await notifyPaymentSucceeded(updatedBooking as BookingPaymentRow);
    return;
  }
'@

$paidReplacement = @'
  if (updatedBooking) {
    await upsertFinancialLedgerEntry({
      bookingId: booking.id,
      entryKey: `booking:${booking.id}:payment:${session.id}`,
      entryType: "payment_succeeded",
      status: "succeeded",
      currency: booking.currency,
      grossAmountCents: amountTotal,
      platformFeeCents: platformFeeAmount,
      providerAmountCents: providerAmount,
      paymentMode,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId(session),
    });

    await notifyPaymentSucceeded(updatedBooking as BookingPaymentRow);
    return;
  }
'@

if ($content.Contains($paidAnchor)) {
  $content = $content.Replace($paidAnchor, $paidReplacement)
}
elseif (-not $content.Contains('entryType: "payment_succeeded"')) {
  throw "Bloc paiement reussi introuvable."
}

$failureAnchor = @'
  await createPaymentNotification({
    userId: booking.parent_id,
    bookingId: booking.id,
    type: "system",
    title: "Paiement refusé",
'@

$failureReplacement = @'
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

  await createPaymentNotification({
    userId: booking.parent_id,
    bookingId: booking.id,
    type: "system",
    title: "Paiement refusé",
'@

if ($content.Contains($failureAnchor)) {
  $content = $content.Replace($failureAnchor, $failureReplacement)
}
elseif (-not $content.Contains('entryType: "payment_failed"')) {
  throw "Bloc paiement refuse introuvable."
}

Set-Content -LiteralPath $file -Value $content -Encoding UTF8

Write-Host ""
Write-Host "ETAPE 8.1 APPLIQUEE." -ForegroundColor Green
Write-Host "Paiement reussi -> journal financier."
Write-Host "Paiement refuse -> journal financier."
Write-Host ""
Write-Host "IMPORTANT : execute d'abord le SQL Supabase :"
Write-Host "supabase\step-8-1-booking-financial-ledger.sql"
Write-Host ""
Write-Host "Puis : npm run build"
