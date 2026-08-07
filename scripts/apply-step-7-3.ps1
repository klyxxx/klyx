$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$route = Join-Path $root "app\api\search\providers\route.ts"

if (-not (Test-Path -LiteralPath $route)) {
  throw "Fichier introuvable : app\api\search\providers\route.ts"
}

$backup = "$route.step-7-3.backup"
if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item -LiteralPath $route -Destination $backup -Force
}

$content = Get-Content -LiteralPath $route -Raw -Encoding UTF8

$typeAnchor = @'
type AvailabilityRow = {
  user_service_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};
'@

$typeBlock = @'
type AvailabilityRow = {
  user_service_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type ProviderZoneRow = {
  profile_id: string;
  user_service_id: string;
  is_active: boolean;
};
'@

if (-not $content.Contains("type ProviderZoneRow")) {
  if (-not $content.Contains($typeAnchor)) {
    throw "Type AvailabilityRow introuvable."
  }
  $content = $content.Replace($typeAnchor, $typeBlock)
}

$oldPromise = @'
  const [profilesResult, providerProfilesResult, serviceProfilesResult, slotsResult] =
    await Promise.all([
'@

$newPromise = @'
  const [
    profilesResult,
    providerProfilesResult,
    serviceProfilesResult,
    slotsResult,
    zonesResult,
  ] = await Promise.all([
'@

if ($content.Contains($oldPromise)) {
  $content = $content.Replace($oldPromise, $newPromise)
}
elseif (-not $content.Contains("zonesResult")) {
  throw "Promise.all principal introuvable."
}

$oldSlotsEnd = @'
      supabaseAdmin
        .from("availability_slots")
        .select("user_service_id, day_of_week, start_time, end_time")
        .in("user_service_id", userServiceIds)
        .eq("is_active", true),
    ]);
'@

$newSlotsEnd = @'
      supabaseAdmin
        .from("availability_slots")
        .select("user_service_id, day_of_week, start_time, end_time")
        .in("user_service_id", userServiceIds)
        .eq("is_active", true),
      supabaseAdmin
        .from("provider_service_zones")
        .select("profile_id, user_service_id, is_active")
        .in("profile_id", profileIds)
        .in("user_service_id", userServiceIds)
        .eq("is_active", true),
    ]);
'@

if ($content.Contains($oldSlotsEnd)) {
  $content = $content.Replace($oldSlotsEnd, $newSlotsEnd)
}
elseif (-not $content.Contains('.from("provider_service_zones")')) {
  throw "Fin Promise.all slots introuvable."
}

$oldErrors = @'
    serviceProfilesResult.error,
    slotsResult.error,
  ].find(Boolean);
'@

$newErrors = @'
    serviceProfilesResult.error,
    slotsResult.error,
    zonesResult.error,
  ].find(Boolean);
'@

if ($content.Contains($oldErrors)) {
  $content = $content.Replace($oldErrors, $newErrors)
}
elseif (-not $content.Contains("zonesResult.error")) {
  throw "Bloc firstError introuvable."
}

$oldRows = @'
  const serviceProfiles = (serviceProfilesResult.data ?? []) as ServiceProfileRow[];
  const slots = (slotsResult.data ?? []) as AvailabilityRow[];
  const serviceById = new Map(services.map((service) => [service.id, service]));
'@

$newRows = @'
  const serviceProfiles = (serviceProfilesResult.data ?? []) as ServiceProfileRow[];
  const slots = (slotsResult.data ?? []) as AvailabilityRow[];
  const zones = (zonesResult.data ?? []) as ProviderZoneRow[];

  const readyUserServiceIds = new Set(
    zones
      .filter((zone) => zone.is_active !== false)
      .map((zone) => zone.user_service_id)
  );

  const serviceById = new Map(services.map((service) => [service.id, service]));
'@

if ($content.Contains($oldRows)) {
  $content = $content.Replace($oldRows, $newRows)
}
elseif (-not $content.Contains("readyUserServiceIds")) {
  throw "Bloc rows introuvable."
}

$oldGuard = @'
      if (!service || !profile || !providerProfile || !serviceProfile) return null;

      return {
'@

$newGuard = @'
      if (!service || !profile || !providerProfile || !serviceProfile) return null;

      if (!readyUserServiceIds.has(userService.id)) return null;

      return {
'@

if ($content.Contains($oldGuard)) {
  $content = $content.Replace($oldGuard, $newGuard)
}
elseif (-not $content.Contains("readyUserServiceIds.has(userService.id)")) {
  throw "Guard candidat introuvable."
}

Set-Content -LiteralPath $route -Value $content -Encoding UTF8

Write-Host ""
Write-Host "ETAPE 7.3 appliquee avec succes." -ForegroundColor Green
Write-Host "Recherche client : zone active maintenant obligatoire."
Write-Host "Prestataire incomplet : reste configurable mais n'est pas expose."
Write-Host "Verification/KYC : reste un niveau de confiance separe."
Write-Host "Aucun SQL, Stripe, schema Supabase ou account-switcher modifie."
Write-Host ""
Write-Host "Execute maintenant : npm run build"
