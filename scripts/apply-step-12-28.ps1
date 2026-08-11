$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.28 - SMART MARKET MATCHING" -ForegroundColor Cyan
Write-Host ""

foreach ($relative in @(
  "lib\market-matching.ts",
  "app\provider\jobs\page.tsx"
)) {
  $source = Join-Path $payload $relative
  $target = Join-Path $root $relative

  if (-not (Test-Path -LiteralPath $source)) {
    throw "Payload manquant : $relative"
  }

  New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
  Write-Host "[OK] $relative" -ForegroundColor Green
}

$apiPath = "app\api\market\requests\route.ts"
$api = Get-Content -LiteralPath $apiPath -Raw

$import = 'import { calculateMarketMatch } from "@/lib/market-matching";'
$anchor = 'import { notifyCompatibleProviders } from "@/lib/market-notifications";'

if (-not $api.Contains($import)) {
  if (-not $api.Contains($anchor)) {
    throw "Ancre import market notifications introuvable."
  }
  $api = $api.Replace($anchor, "$anchor`r`n$import")
}

$oldProviderSelect = @'
      .from("user_services")
      .select("id, service_id")
'@
$newProviderSelect = @'
      .from("user_services")
      .select("id, service_id")
'@
# Conservé volontairement : les détails viennent des tables métier ci-dessous.

$insertAnchor = @'
    const serviceMap = new Map(
      (services ?? []).map((item) => [item.id, item])
    );
'@

if ($api -notmatch "calculateMarketMatch\(") {
  if (-not $api.Contains($insertAnchor)) {
    throw "Ancre serviceMap provider introuvable."
  }

  $block = @'
    const userServiceIds = (providerServices ?? []).map((item) => item.id);

    const [
      { data: serviceProfiles, error: serviceProfileError },
      { data: providerProfiles, error: providerProfileError },
      { data: slots, error: slotError },
    ] = await Promise.all([
      userServiceIds.length
        ? supabaseAdmin
            .from("service_profiles")
            .select(
              "user_service_id, pricing_type, price, city, service_area, klyx_score, rating, review_count"
            )
            .in("user_service_id", userServiceIds)
        : Promise.resolve({ data: [], error: null }),
      supabaseAdmin
        .from("provider_profiles")
        .select(
          "profile_id, years_experience, verification_status"
        )
        .eq("profile_id", profile.id)
        .maybeSingle(),
      userServiceIds.length
        ? supabaseAdmin
            .from("availability_slots")
            .select(
              "user_service_id, day_of_week, start_time, end_time"
            )
            .in("user_service_id", userServiceIds)
            .eq("is_active", true)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (serviceProfileError) {
      throw new Error(serviceProfileError.message);
    }
    if (providerProfileError) {
      throw new Error(providerProfileError.message);
    }
    if (slotError) {
      throw new Error(slotError.message);
    }

    const userServiceByServiceId = new Map(
      (providerServices ?? []).map((item) => [
        item.service_id,
        item.id,
      ])
    );

    const serviceProfileByUserServiceId = new Map(
      (serviceProfiles ?? []).map((item) => [
        item.user_service_id,
        item,
      ])
    );

    const slotsByUserServiceId = new Map<string, typeof slots>();

    for (const slot of slots ?? []) {
      const current =
        slotsByUserServiceId.get(slot.user_service_id) ?? [];
      current.push(slot);
      slotsByUserServiceId.set(slot.user_service_id, current);
    }

'@

  $api = $api.Replace($insertAnchor, $block + $insertAnchor)
}

$oldMap = @'
      requests: (requests ?? []).map((item) => ({
        ...item,
        service: serviceMap.get(item.service_id) ?? null,
        myOffer: offerMap.get(item.id) ?? null,
      })),
'@

$newMap = @'
      requests: (requests ?? [])
        .map((item) => {
          const userServiceId =
            userServiceByServiceId.get(item.service_id);
          const serviceProfile = userServiceId
            ? serviceProfileByUserServiceId.get(userServiceId)
            : null;

          const match = calculateMarketMatch({
            requestCity: item.city,
            requestedDate: item.requested_date,
            requestedTime: item.requested_time,
            budgetMax:
              item.budget_max === null
                ? null
                : Number(item.budget_max),
            providerCity: serviceProfile?.city ?? "",
            serviceArea: serviceProfile?.service_area ?? [],
            providerPrice:
              serviceProfile?.price === null ||
              serviceProfile?.price === undefined
                ? null
                : Number(serviceProfile.price),
            pricingType:
              serviceProfile?.pricing_type === "fixed"
                ? "fixed"
                : "hourly",
            klyxScore: Number(serviceProfile?.klyx_score ?? 50),
            rating: Number(serviceProfile?.rating ?? 0),
            reviewCount: Number(serviceProfile?.review_count ?? 0),
            yearsExperience: Number(
              providerProfiles?.years_experience ?? 0
            ),
            isVerified:
              providerProfiles?.verification_status === "verified",
            availability: userServiceId
              ? slotsByUserServiceId.get(userServiceId) ?? []
              : [],
          });

          return {
            ...item,
            service: serviceMap.get(item.service_id) ?? null,
            myOffer: offerMap.get(item.id) ?? null,
            match,
          };
        })
        .sort(
          (first, second) =>
            (second.match?.score ?? 0) -
            (first.match?.score ?? 0)
        ),
'@

if ($api.Contains($oldMap)) {
  $api = $api.Replace($oldMap, $newMap)
}
elseif ($api -notmatch "second\.match\?\.score") {
  throw "Bloc retour provider requests introuvable."
}

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $apiPath),
  $api,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] API market classe les missions" -ForegroundColor Green
Write-Host "[OK] Score explicable ajoute" -ForegroundColor Green
Write-Host ""
Write-Host "12.28 appliquee." -ForegroundColor Cyan
