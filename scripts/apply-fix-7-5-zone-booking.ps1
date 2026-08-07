$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$route = Join-Path $root "app\api\bookings\create\route.ts"

if (-not (Test-Path -LiteralPath $route)) {
  throw "Fichier introuvable : app\api\bookings\create\route.ts"
}

$backup = "$route.step-7-5-zone.backup"
if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item -LiteralPath $route -Destination $backup -Force
}

$content = Get-Content -LiteralPath $route -Raw -Encoding UTF8

if ($content.Contains('from("provider_service_zones")')) {
  Write-Host "Le verrou zone active est deja present." -ForegroundColor Yellow
  exit 0
}

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
            "Ce prestataire n’accepte pas encore de réservation pour ce service dans une zone active.",
        },
        { status: 409 }
      );
    }

    let acceptedQuote: AcceptedQuoteRow | null = null;
'@

if (-not $content.Contains($anchor)) {
  throw "Point d'insertion introuvable. Aucun fichier n'a ete modifie."
}

$content = $content.Replace($anchor, $replacement)
Set-Content -LiteralPath $route -Value $content -Encoding UTF8

Write-Host ""
Write-Host "CORRECTIF 7.5 APPLIQUE." -ForegroundColor Green
Write-Host "Reservation directe : zone active obligatoire."
Write-Host ""
Write-Host "Execute maintenant :"
Write-Host "powershell -ExecutionPolicy Bypass -File .\scripts\check-step-7-7.ps1"
Write-Host "npm run build"
