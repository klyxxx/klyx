$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$file = Join-Path $root "app\api\bookings\status\route.ts"

if (-not (Test-Path -LiteralPath $file)) {
  throw "Fichier introuvable : app\api\bookings\status\route.ts"
}

$backup = "$file.step-8-2.backup"
if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item -LiteralPath $file -Destination $backup -Force
}

$content = Get-Content -LiteralPath $file -Raw -Encoding UTF8

$importAnchor = 'import { isPastBookingStart } from "@/lib/brussels-time";'
$importLine = 'import { upsertFinancialLedgerEntry } from "@/lib/payment-ledger";'

if (-not $content.Contains($importLine)) {
  if (-not $content.Contains($importAnchor)) {
    throw "Import brussels-time introuvable."
  }
  $content = $content.Replace($importAnchor, $importAnchor + "`r`n" + $importLine)
}

$content = $content.Replace(
@'
  amount_total: number | null;
  stripe_payment_intent_id: string | null;
'@,
@'
  amount_total: number | null;
  currency: string | null;
  stripe_payment_intent_id: string | null;
'@
)

$content = $content.Replace(
'payment_mode, amount_total, stripe_payment_intent_id',
'payment_mode, amount_total, currency, stripe_payment_intent_id'
)

$successAnchor = @'
    if (updateError) throw new Error(updateError.message);

    return {
      refundId: refund.id,
      amount: refund.amount,
      alreadyRefunded: false,
    };
'@

$successReplacement = @'
    if (updateError) throw new Error(updateError.message);

    await upsertFinancialLedgerEntry({
      bookingId: booking.id,
      entryKey: `booking:${booking.id}:refund:${refund.id}`,
      entryType: "refund_succeeded",
      status:
        refund.status === "succeeded"
          ? "succeeded"
          : "processing",
      currency: booking.currency,
      grossAmountCents: booking.amount_total,
      refundAmountCents: refund.amount,
      paymentMode: booking.payment_mode,
      stripePaymentIntentId: booking.stripe_payment_intent_id,
      stripeRefundId: refund.id,
    });

    return {
      refundId: refund.id,
      amount: refund.amount,
      alreadyRefunded: false,
    };
'@

if ($content.Contains($successAnchor)) {
  $content = $content.Replace($successAnchor, $successReplacement)
}
elseif (-not $content.Contains('entryKey: `booking:${booking.id}:refund:${refund.id}`')) {
  throw "Bloc succes remboursement introuvable."
}

$catchAnchor = @'
  } catch (error) {
    await supabaseAdmin
      .from("bookings")
      .update({
        refund_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id)
      .eq("refund_status", "processing");

    throw error;
  }
'@

$catchReplacement = @'
  } catch (error) {
    await supabaseAdmin
      .from("bookings")
      .update({
        refund_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id)
      .eq("refund_status", "processing");

    const failureMessage =
      error instanceof Error
        ? error.message
        : "Remboursement Stripe impossible.";

    await upsertFinancialLedgerEntry({
      bookingId: booking.id,
      entryKey: `booking:${booking.id}:refund-failed`,
      entryType: "refund_failed",
      status: "failed",
      currency: booking.currency,
      grossAmountCents: booking.amount_total,
      refundAmountCents: booking.amount_total,
      paymentMode: booking.payment_mode,
      stripePaymentIntentId: booking.stripe_payment_intent_id,
      failureCode: "refund_failed",
      failureMessage,
    });

    throw error;
  }
'@

if ($content.Contains($catchAnchor)) {
  $content = $content.Replace($catchAnchor, $catchReplacement)
}
elseif (-not $content.Contains('entryKey: `booking:${booking.id}:refund-failed`')) {
  throw "Bloc echec remboursement introuvable."
}

Set-Content -LiteralPath $file -Value $content -Encoding UTF8

Write-Host ""
Write-Host "ETAPE 8.2 APPLIQUEE." -ForegroundColor Green
Write-Host "Succes remboursement -> refund_succeeded."
Write-Host "Echec remboursement -> refund_failed."
Write-Host "Aucun nouveau SQL necessaire."
Write-Host ""
Write-Host "Execute maintenant : npm run build"
