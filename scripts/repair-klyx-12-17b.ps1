$ErrorActionPreference = "Stop"

$root = "C:\Users\fenjo\Documents\klyx"
Set-Location $root

$path = ".\app\api\stripe\create-checkout-session\route.ts"

if (-not (Test-Path -LiteralPath $path)) {
  throw "Fichier introuvable : $path"
}

$content = Get-Content -LiteralPath $path -Raw

# 1) ServiceRow doit contenir name.
if ($content -notmatch 'type ServiceRow\s*=\s*\{[\s\S]*?name:\s*string\s*\|\s*null;[\s\S]*?\};') {
  $content = [regex]::Replace(
    $content,
    '(type ServiceRow\s*=\s*\{\s*id:\s*string;\s*slug:\s*string;)',
    "`$1`r`n  name: string | null;",
    1
  )
}

# 2) Fonction serviceLabel dynamique.
$content = [regex]::Replace(
  $content,
  '(?s)function serviceLabel\([^)]*\):\s*string\s*\{.*?\}\s*(?=async function claimBookingPayment)',
@'
function serviceLabel(service: ServiceRow): string {
  return service.name?.trim() || service.slug || "Service KLYX";
}

'@,
  1
)

# 3) Remplace COMPLETEMENT resolveService pour supprimer tout fallback babysitting.
$resolveService = @'
async function resolveService(
  booking: BookingRow,
  providerId: string
): Promise<{
  service: ServiceRow;
  userServiceId: string;
  serviceProfile: ServiceProfileRow;
}> {
  if (!booking.service_id || !booking.user_service_id) {
    throw new Error(
      "Cette ancienne réservation ne contient pas de métier complet. Recrée la réservation avant de payer."
    );
  }

  const [
    { data: serviceData, error: serviceError },
    { data: userServiceData, error: userServiceError },
    { data: serviceProfileData, error: serviceProfileError },
  ] = await Promise.all([
    supabaseAdmin
      .from("services")
      .select("id, slug, name")
      .eq("id", booking.service_id)
      .maybeSingle(),

    supabaseAdmin
      .from("user_services")
      .select("id, user_id, service_id, active")
      .eq("id", booking.user_service_id)
      .eq("user_id", providerId)
      .eq("service_id", booking.service_id)
      .eq("active", true)
      .maybeSingle(),

    supabaseAdmin
      .from("service_profiles")
      .select("price, pricing_type")
      .eq("user_service_id", booking.user_service_id)
      .maybeSingle(),
  ]);

  if (serviceError) {
    throw new Error(serviceError.message);
  }

  if (userServiceError) {
    throw new Error(userServiceError.message);
  }

  if (serviceProfileError) {
    throw new Error(serviceProfileError.message);
  }

  if (!serviceData) {
    throw new Error("Service introuvable.");
  }

  if (!userServiceData) {
    throw new Error(
      "Le métier de cette réservation ne correspond plus au prestataire."
    );
  }

  if (!serviceProfileData) {
    throw new Error("Profil de service introuvable.");
  }

  return {
    service: serviceData as ServiceRow,
    userServiceId: booking.user_service_id,
    serviceProfile: serviceProfileData as ServiceProfileRow,
  };
}

'@

$pattern = '(?s)async function resolveService\([\s\S]*?\n\}\s*\n\s*export async function POST'

if ($content -notmatch $pattern) {
  throw "Fonction resolveService complète introuvable. Aucun remplacement effectué."
}

$content = [regex]::Replace(
  $content,
  $pattern,
  $resolveService + "export async function POST",
  1
)

# 4) Tous les appels doivent passer l'objet service, pas service.slug.
$content = [regex]::Replace(
  $content,
  'serviceLabel\(\s*service\.slug\s*\)',
  'serviceLabel(service)'
)

[System.IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $path),
  $content,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host ""
Write-Host "[OK] resolveService remplace completement" -ForegroundColor Green
Write-Host "[OK] fallback babysitting supprime" -ForegroundColor Green
Write-Host "[OK] serviceLabel(service) corrige" -ForegroundColor Green
Write-Host ""

Write-Host "Verification des restes..." -ForegroundColor Cyan

$remaining = Select-String `
  -LiteralPath $path `
  -Pattern 'babysitting|cleaning|moving|handyman|serviceLabel\(\s*service\.slug'

if ($remaining) {
  Write-Host "ATTENTION : restes detectes :" -ForegroundColor Yellow
  $remaining
  exit 2
}

Write-Host "[OK] Aucun fallback metier fixe dans Stripe checkout." -ForegroundColor Green
Write-Host ""
Write-Host "Lancement npm run build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "KLYX 12.17B REPARATION VALIDEE." -ForegroundColor Green
