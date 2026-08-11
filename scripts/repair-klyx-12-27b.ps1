$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.27B - REPARATION SCRIPT + NOTIFICATIONS MARCHE" -ForegroundColor Cyan
Write-Host ""

$requestsPath = "app\api\market\requests\route.ts"
$offersPath = "app\api\market\requests\[id]\offers\route.ts"
$notificationsPath = "app\notifications\page.tsx"

foreach ($file in @($requestsPath, $offersPath, $notificationsPath)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier manquant : $file"
  }
}

# ------------------------------------------------------------------
# 1) API demandes -> notification prestataires compatibles
# ------------------------------------------------------------------

$requests = Get-Content -LiteralPath $requestsPath -Raw

$requestsImport = 'import { notifyCompatibleProviders } from "@/lib/market-notifications";'
$requestsAnchor = 'import { supabaseAdmin } from "@/lib/supabase-admin";'

if (-not $requests.Contains($requestsImport)) {
  if (-not $requests.Contains($requestsAnchor)) {
    throw "Ancre import requests introuvable."
  }

  $requests = $requests.Replace(
    $requestsAnchor,
    "$requestsAnchor`r`n$requestsImport"
  )
}

if ($requests -notmatch "notifyCompatibleProviders\(") {
  $pattern = '(?s)(const \{ data: created, error \} = await supabaseAdmin\s*\.from\("market_service_requests"\).*?\.single\(\);\s*if \(error\) throw new Error\(error\.message\);)'

  $matches = [regex]::Matches($requests, $pattern)

  if ($matches.Count -ne 1) {
    throw "Creation demande ouverte introuvable."
  }

  $addition = @'

    await notifyCompatibleProviders({
      marketRequestId: created.id,
      serviceId: service.id,
      serviceName: service.name?.trim() || service.slug,
      city,
    });
'@

  $requests = [regex]::Replace(
    $requests,
    $pattern,
    '$1' + $addition,
    1
  )
}

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $requestsPath),
  $requests,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Demande ouverte -> prestataires compatibles" -ForegroundColor Green

# ------------------------------------------------------------------
# 2) API offres -> notification client + prestataire
# ------------------------------------------------------------------

$offers = Get-Content -LiteralPath $offersPath -Raw

$offersImport = 'import { createMarketNotification } from "@/lib/market-notifications";'
$offersAnchor = 'import { supabaseAdmin } from "@/lib/supabase-admin";'

if (-not $offers.Contains($offersImport)) {
  if (-not $offers.Contains($offersAnchor)) {
    throw "Ancre import offers introuvable."
  }

  $offers = $offers.Replace(
    $offersAnchor,
    "$offersAnchor`r`n$offersImport"
  )
}

$offers = $offers.Replace(
  '.select("id, service_id, status")',
  '.select("id, client_profile_id, service_id, status")'
)

if ($offers -notmatch "Nouvelle offre recue") {
  $pattern = '(?s)(const \{ data: offer, error \} = await supabaseAdmin\s*\.from\("market_service_offers"\).*?\.single\(\);\s*if \(error\) throw new Error\(error\.message\);)'

  $matches = [regex]::Matches($offers, $pattern)

  if ($matches.Count -ne 1) {
    throw "Creation offre prestataire introuvable."
  }

  $addition = @'

    await createMarketNotification({
      userId: serviceRequest.client_profile_id,
      marketRequestId: requestId,
      title: "Nouvelle offre recue",
      message: `Un prestataire propose ${Number(amount).toFixed(2)} € pour ta demande.`,
      href: "/requests",
    });
'@

  $offers = [regex]::Replace(
    $offers,
    $pattern,
    '$1' + $addition,
    1
  )
}

if ($offers -notmatch "Offre non retenue") {
  $pattern = '(?s)(if \(action === "reject"\) \{.*?if \(error\) throw new Error\(error\.message\);)'

  $matches = [regex]::Matches($offers, $pattern)

  if ($matches.Count -ne 1) {
    throw "Bloc refus offre introuvable."
  }

  $addition = @'

      await createMarketNotification({
        userId: offer.provider_profile_id,
        marketRequestId: requestId,
        title: "Offre non retenue",
        message: "Ton offre n'a pas ete retenue pour cette demande.",
        href: "/provider/jobs",
      });
'@

  $offers = [regex]::Replace(
    $offers,
    $pattern,
    '$1' + $addition,
    1
  )
}

if ($offers -notmatch "Ton offre a ete acceptee") {
  $anchorCrLf = "    return NextResponse.json({`r`n      quoteId: quote.id,"
  $anchorLf = "    return NextResponse.json({`n      quoteId: quote.id,"

  if ($offers.Contains($anchorCrLf)) {
    $anchor = $anchorCrLf
  }
  elseif ($offers.Contains($anchorLf)) {
    $anchor = $anchorLf
  }
  else {
    throw "Retour acceptation offre introuvable."
  }

  $notification = @'
    await createMarketNotification({
      userId: offer.provider_profile_id,
      marketRequestId: requestId,
      title: "Offre acceptee",
      message: "Ton offre a ete acceptee. Le client peut maintenant finaliser la reservation.",
      href: "/bookings",
    });

'@

  $offers = $offers.Replace(
    $anchor,
    $notification + $anchor
  )
}

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $offersPath),
  $offers,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Nouvelle offre -> client" -ForegroundColor Green
Write-Host "[OK] Acceptation/refus -> prestataire" -ForegroundColor Green

# ------------------------------------------------------------------
# 3) Centre notifications multi-profils
# ------------------------------------------------------------------

$notifications = Get-Content -LiteralPath $notificationsPath -Raw

$notifications = $notifications.Replace(
  'import { getActiveClientProfile } from "@/lib/account-switcher";' + "`r`n",
  ""
)

$notifications = $notifications.Replace(
  'import { getActiveClientProfile } from "@/lib/account-switcher";' + "`n",
  ""
)

$old = '      const activeProfile = await getActiveClientProfile();'

$new = @'
      const profileResponse = await fetch(
        "/api/profiles/active",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const profileBody = (await profileResponse.json()) as {
        profiles?: Array<{
          id: string;
          accountType: "client" | "provider";
        }>;
        activeProfileId?: string | null;
        error?: string;
      };

      if (!profileResponse.ok) {
        throw new Error(
          profileBody.error ||
            "Impossible de determiner le profil actif."
        );
      }

      const activeProfile =
        profileBody.profiles?.find(
          (profile) =>
            profile.id ===
            profileBody.activeProfileId
        ) ?? profileBody.profiles?.[0];

      if (!activeProfile) {
        throw new Error("Profil actif introuvable.");
      }
'@

if ($notifications.Contains($old)) {
  $notifications = $notifications.Replace($old, $new)
}
elseif ($notifications -notmatch '"/api/profiles/active"') {
  throw "Ancienne resolution client notifications introuvable."
}

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $notificationsPath),
  $notifications,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Centre notifications client + prestataire" -ForegroundColor Green
Write-Host ""
Write-Host "12.27B REPARATION APPLIQUEE." -ForegroundColor Cyan
