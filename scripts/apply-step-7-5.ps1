$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$route = Join-Path $root "app\api\bookings\create\route.ts"

if (-not (Test-Path -LiteralPath $route)) {
  throw "Fichier introuvable : app\api\bookings\create\route.ts"
}

$backup = "$route.step-7-5.backup"
if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item -LiteralPath $route -Destination $backup -Force
}

$content = Get-Content -LiteralPath $route -Raw -Encoding UTF8

$anchor = @'
    if (!userService) {
      return NextResponse.json(
        {
          error:
            "Ce prestataire ne propose pas ce service.",
        },
        { status: 404 }
      );
    }

    let acceptedQuote: AcceptedQuoteRow | null = null;
'@

$replacement = @'
    if (!userService) {
      return NextResponse.json(
        {
          error:
            "Ce prestataire ne propose pas ce service.",
        },
        { status: 404 }
      );
    }

    /*
     * Production readiness:
     * même si quelqu'un possède directement l'URL de réservation,
     * un métier prestataire sans zone active ne peut pas recevoir
     * de nouvelle réservation.
     */
    const {
      data: activeZone,
      error: activeZoneError,
    } = await supabaseAdmin
      .from("provider_service_zones")
      .select("id")
      .eq("profile_id", providerId)
      .eq("user_service_id", userService.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (activeZoneError) {
      throw new Error(activeZoneError.message);
    }

    if (!activeZone) {
      return NextResponse.json(
        {
          error:
            "Ce prestataire n'accepte pas encore de réservation pour ce service dans une zone active.",
        },
        { status: 409 }
      );
    }

    let acceptedQuote: AcceptedQuoteRow | null = null;
'@

if ($content.Contains($anchor)) {
  $content = $content.Replace($anchor, $replacement)
}
elseif (-not $content.Contains("provider_service_zones")) {
  throw "Point d'insertion après userService introuvable."
}

Set-Content -LiteralPath $route -Value $content -Encoding UTF8

Write-Host ""
Write-Host "ETAPE 7.5 appliquee avec succes." -ForegroundColor Green
Write-Host "Reservation directe : zone active maintenant obligatoire."
Write-Host "Les URLs directes ne contournent plus la readiness de recherche."
Write-Host "Prestataire incomplet : reste libre de configurer son compte."
Write-Host "Aucun SQL, Stripe, schema Supabase ou account-switcher modifie."
Write-Host ""
Write-Host "Execute maintenant : npm run build"
