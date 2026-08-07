$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$route = Join-Path $root "app\api\quotes\route.ts"

if (-not (Test-Path -LiteralPath $route)) {
  throw "Fichier introuvable : app\api\quotes\route.ts"
}

$backup = "$route.step-7-6.backup"

if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item -LiteralPath $route -Destination $backup -Force
}

$content = Get-Content -LiteralPath $route -Raw -Encoding UTF8

# -------------------------------------------------
# 1. user_services doit être réellement actif
# -------------------------------------------------

$oldUserServiceQuery = @'
        .eq("id", userServiceId)
        .eq("user_id", providerProfileId)
        .eq("provider_enabled", true)
        .maybeSingle();
'@

$newUserServiceQuery = @'
        .eq("id", userServiceId)
        .eq("user_id", providerProfileId)
        .eq("active", true)
        .eq("provider_enabled", true)
        .maybeSingle();
'@

if ($content.Contains($oldUserServiceQuery)) {
  $content = $content.Replace(
    $oldUserServiceQuery,
    $newUserServiceQuery
  )
}
elseif (-not $content.Contains('.eq("active", true)')) {
  throw "Requête user_services introuvable."
}

# -------------------------------------------------
# 2. Publication + zone active obligatoires
# -------------------------------------------------

$anchor = @'
    if (!userService) {
      return NextResponse.json(
        {
          error:
            "Ce métier n’est pas actif pour ce prestataire.",
        },
        { status: 404 }
      );
    }

    const { data: serviceProfile, error: serviceError } =
'@

$replacement = @'
    if (!userService) {
      return NextResponse.json(
        {
          error:
            "Ce métier n’est pas actif pour ce prestataire.",
        },
        { status: 404 }
      );
    }

    /*
     * Readiness production :
     * une URL directe ne doit pas permettre de demander un devis
     * à un prestataire qui n'est pas encore publiquement prêt.
     */
    const [
      providerProfileResult,
      activeZoneResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("provider_profiles")
        .select("profile_id")
        .eq("profile_id", providerProfileId)
        .eq("is_published", true)
        .maybeSingle(),
      supabaseAdmin
        .from("provider_service_zones")
        .select("id")
        .eq("profile_id", providerProfileId)
        .eq("user_service_id", userServiceId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
    ]);

    if (providerProfileResult.error) {
      throw new Error(
        providerProfileResult.error.message
      );
    }

    if (activeZoneResult.error) {
      throw new Error(
        activeZoneResult.error.message
      );
    }

    if (!providerProfileResult.data) {
      return NextResponse.json(
        {
          error:
            "Cette fiche prestataire n’est pas publiée.",
        },
        { status: 409 }
      );
    }

    if (!activeZoneResult.data) {
      return NextResponse.json(
        {
          error:
            "Ce prestataire n’accepte pas encore de demandes de devis pour ce métier dans une zone active.",
        },
        { status: 409 }
      );
    }

    const { data: serviceProfile, error: serviceError } =
'@

if ($content.Contains($anchor)) {
  $content = $content.Replace(
    $anchor,
    $replacement
  )
}
elseif (-not $content.Contains("activeZoneResult")) {
  throw "Point d'insertion readiness devis introuvable."
}

Set-Content `
  -LiteralPath $route `
  -Value $content `
  -Encoding UTF8

Write-Host ""
Write-Host "ETAPE 7.6 appliquee avec succes." -ForegroundColor Green
Write-Host "Devis direct : user_service actif obligatoire."
Write-Host "Devis direct : profil prestataire publie obligatoire."
Write-Host "Devis direct : zone active obligatoire."
Write-Host "Recherche, devis et reservation utilisent maintenant la meme readiness."
Write-Host "Aucun SQL, Stripe, schema Supabase ou account-switcher modifie."
Write-Host ""
Write-Host "Execute maintenant : npm run build"
