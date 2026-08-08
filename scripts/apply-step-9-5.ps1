$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

function Read-KlyxFile([string]$RelativePath) {
  $file = Join-Path $root $RelativePath

  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier introuvable : $RelativePath"
  }

  $backup = "$file.step-9-5.backup"

  if (-not (Test-Path -LiteralPath $backup)) {
    Copy-Item -LiteralPath $file -Destination $backup -Force
  }

  return $file
}

# 1. RECHERCHE
$searchFile = Read-KlyxFile "app\api\search\providers\route.ts"
$search = Get-Content -LiteralPath $searchFile -Raw -Encoding UTF8

if (-not $search.Contains('from "@/lib/provider-skill-publication"')) {
  $anchor = 'import { supabaseAdmin } from "@/lib/supabase-admin";'
  $search = $search.Replace(
    $anchor,
    $anchor + "`r`n" +
    'import { getApprovedUserServiceIds } from "@/lib/provider-skill-publication";'
  )
}

$old = @'
  const userServices = (userServicesResult.data ?? []) as UserServiceRow[];
  if (userServices.length === 0) return [];

  const profileIds = [...new Set(userServices.map((item) => item.user_id))];
  const userServiceIds = userServices.map((item) => item.id);
'@

$new = @'
  const allUserServices =
    (userServicesResult.data ?? []) as UserServiceRow[];

  if (allUserServices.length === 0) return [];

  const approvedUserServiceIds =
    await getApprovedUserServiceIds(
      allUserServices.map((item) => item.id)
    );

  const userServices =
    allUserServices.filter((item) =>
      approvedUserServiceIds.has(item.id)
    );

  if (userServices.length === 0) return [];

  const profileIds = [
    ...new Set(userServices.map((item) => item.user_id)),
  ];
  const userServiceIds =
    userServices.map((item) => item.id);
'@

if (-not $search.Contains("approvedUserServiceIds")) {
  if (-not $search.Contains($old)) {
    throw "Bloc userServices introuvable dans search/providers."
  }

  $search = $search.Replace($old, $new)
}

Set-Content -LiteralPath $searchFile -Value $search -Encoding UTF8
Write-Host "[OK] Recherche publique filtree" -ForegroundColor Green

# 2. RESERVATION
$bookingFile = Read-KlyxFile "app\api\bookings\create\route.ts"
$booking = Get-Content -LiteralPath $bookingFile -Raw -Encoding UTF8

if (-not $booking.Contains('from "@/lib/provider-skill-publication"')) {
  $anchor = 'import { supabaseAdmin } from "@/lib/supabase-admin";'
  $booking = $booking.Replace(
    $anchor,
    $anchor + "`r`n" +
    'import { isUserServiceApproved } from "@/lib/provider-skill-publication";'
  )
}

$zoneAnchor = @'
    const {
      data: activeZone,
      error: activeZoneError,
    } = await supabaseAdmin
'@

$approvalBlock = @'
    const skillApproved =
      await isUserServiceApproved({
        profileId: providerId,
        userServiceId: userService.id,
      });

    if (!skillApproved) {
      return NextResponse.json(
        {
          error:
            "Ce métier n’est pas encore vérifié par KLYX et ne peut pas être réservé.",
        },
        { status: 409 }
      );
    }

    const {
      data: activeZone,
      error: activeZoneError,
    } = await supabaseAdmin
'@

if (-not $booking.Contains("skillApproved")) {
  if (-not $booking.Contains($zoneAnchor)) {
    throw "Point d'insertion introuvable dans bookings/create."
  }

  $booking = $booking.Replace($zoneAnchor, $approvalBlock)
}

Set-Content -LiteralPath $bookingFile -Value $booking -Encoding UTF8
Write-Host "[OK] Reservation protegee" -ForegroundColor Green

# 3. FICHE PUBLIQUE
$providerFile = Read-KlyxFile "app\providers\[id]\page.tsx"
$provider = Get-Content -LiteralPath $providerFile -Raw -Encoding UTF8

if (-not $provider.Contains("verifiedServicesResponse")) {
  $provider = $provider.Replace(
@'
        const [profileResult, providerProfileResult, userServicesResult, galleryResult] =
          await Promise.all([
'@,
@'
        const [
          profileResult,
          providerProfileResult,
          userServicesResult,
          galleryResult,
          verifiedServicesResponse,
        ] = await Promise.all([
'@
  )

  $provider = $provider.Replace(
@'
            supabase
              .from("provider_gallery")
              .select("id, public_url, caption")
              .eq("profile_id", providerId)
              .order("position", { ascending: true })
              .limit(8),
          ]);
'@,
@'
            supabase
              .from("provider_gallery")
              .select("id, public_url, caption")
              .eq("profile_id", providerId)
              .order("position", { ascending: true })
              .limit(8),
            fetch(
              `/api/providers/${providerId}/verified-services`,
              { cache: "no-store" }
            ),
          ]);
'@
  )

  $provider = $provider.Replace(
@'
        const profileData = profileResult.data as ProfileRow;
        const commercialData = providerProfileResult.data as ProviderProfileRow;
        const userServices = (userServicesResult.data ?? []) as UserServiceRow[];
'@,
@'
        const profileData = profileResult.data as ProfileRow;
        const commercialData = providerProfileResult.data as ProviderProfileRow;

        if (!verifiedServicesResponse.ok) {
          throw new Error(
            "Impossible de vérifier les métiers publiables."
          );
        }

        const verifiedServicesBody =
          (await verifiedServicesResponse.json()) as {
            userServiceIds?: string[];
          };

        const approvedUserServiceIds =
          new Set(verifiedServicesBody.userServiceIds ?? []);

        const userServices =
          ((userServicesResult.data ?? []) as UserServiceRow[])
            .filter((item) =>
              approvedUserServiceIds.has(item.id)
            );
'@
  )
}

if (-not $provider.Contains("verifiedServicesResponse")) {
  throw "Patch fiche publique non applique."
}

Set-Content -LiteralPath $providerFile -Value $provider -Encoding UTF8
Write-Host "[OK] Fiche publique filtree" -ForegroundColor Green

Write-Host ""
Write-Host "ETAPE 9.5 APPLIQUEE." -ForegroundColor Green
Write-Host "Execute maintenant : npm run build"
