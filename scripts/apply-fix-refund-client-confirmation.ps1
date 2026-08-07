$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$file = Join-Path $root "app\api\bookings\status\route.ts"

if (-not (Test-Path -LiteralPath $file)) {
  throw "Fichier introuvable : app\api\bookings\status\route.ts"
}

$backup = "$file.fix-refund-confirmation.backup"
if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item -LiteralPath $file -Destination $backup -Force
}

$content = Get-Content -LiteralPath $file -Raw -Encoding UTF8

# 1) Add a flag beside refundCompleted.
$oldFlag = '    let refundCompleted = false;'
$newFlag = @'
    let refundCompleted = false;
    let refundConfirmed = false;
'@

if ($content.Contains($oldFlag) -and -not $content.Contains("let refundConfirmed = false;")) {
  $content = $content.Replace($oldFlag, $newFlag)
}

# 2) After refundPaidBooking, read the real booking refund status.
$oldCall = @'
        await refundPaidBooking({
          booking,
          actorId: profile.id,
          reason: note,
        });
        refundCompleted = true;
'@

$newCall = @'
        await refundPaidBooking({
          booking,
          actorId: profile.id,
          reason: note,
        });
        refundCompleted = true;

        const { data: refundState, error: refundStateError } =
          await supabaseAdmin
            .from("bookings")
            .select("refund_status")
            .eq("id", booking.id)
            .maybeSingle();

        if (refundStateError) {
          throw new Error(refundStateError.message);
        }

        refundConfirmed =
          refundState?.refund_status === "succeeded";
'@

if ($content.Contains($oldCall)) {
  $content = $content.Replace($oldCall, $newCall)
}
elseif (-not $content.Contains("refundConfirmed =")) {
  throw "Bloc refundPaidBooking introuvable."
}

# 3) Replace only the notification sent to the CLIENT after refund.
$oldNotification = @'
      if (refundCompleted) {
        await createNotification({
          userId: booking.parent_id,
          bookingId: booking.id,
          type: "system",
          title: "Remboursement lancé",
          message:
            "Stripe a reçu la demande de remboursement. Le délai bancaire peut varier.",
          deduplicationKey:
            `booking:${booking.id}:refund`,
        });
      }
'@

$newNotification = @'
      if (refundCompleted) {
        await createNotification({
          userId: booking.parent_id,
          bookingId: booking.id,
          type: "system",
          title: refundConfirmed
            ? "Remboursement confirmé"
            : "Remboursement lancé",
          message: refundConfirmed
            ? "Stripe a confirmé le remboursement de cette réservation."
            : "Stripe a reçu la demande de remboursement. Le délai bancaire peut varier.",
          deduplicationKey: refundConfirmed
            ? `booking:${booking.id}:refund-confirmed`
            : `booking:${booking.id}:refund`,
        });
      }
'@

if ($content.Contains($oldNotification)) {
  $content = $content.Replace($oldNotification, $newNotification)
}
elseif (-not $content.Contains('title: refundConfirmed')) {
  throw "Notification remboursement introuvable."
}

Set-Content -LiteralPath $file -Value $content -Encoding UTF8

Write-Host ""
Write-Host "CORRECTIF CONFIRMATION REMBOURSEMENT APPLIQUE." -ForegroundColor Green
Write-Host "Si Stripe confirme immediatement : le client recoit Remboursement confirme."
Write-Host "Sinon : le client recoit Remboursement lance puis le webhook confirme plus tard."
Write-Host ""
Write-Host "Execute maintenant : npm run build"
