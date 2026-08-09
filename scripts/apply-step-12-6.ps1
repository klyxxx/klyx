$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.6 - BETA JOURNEY GATE" -ForegroundColor Cyan
Write-Host ""

$apiPath = Join-Path $root "app\api\founder\test-center\route.ts"
$pagePath = Join-Path $root "app\founder\test\page.tsx"

foreach ($path in @($apiPath, $pagePath)) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Fichier introuvable : $path"
  }
}

# Sauvegardes uniques
if (-not (Test-Path -LiteralPath "$apiPath.12-6.bak")) {
  Copy-Item -LiteralPath $apiPath -Destination "$apiPath.12-6.bak"
  Write-Host "[BACKUP] app\api\founder\test-center\route.ts" -ForegroundColor DarkGray
}

if (-not (Test-Path -LiteralPath "$pagePath.12-6.bak")) {
  Copy-Item -LiteralPath $pagePath -Destination "$pagePath.12-6.bak"
  Write-Host "[BACKUP] app\founder\test\page.tsx" -ForegroundColor DarkGray
}

$content = Get-Content -LiteralPath $apiPath -Raw

if ($content -notmatch '"beta-client-provider"') {
  $marker = @'
    const blockers = checks.filter(
'@

  if (-not $content.Contains($marker)) {
    throw "Point d'insertion introuvable dans test-center/route.ts. Aucun remplacement force."
  }

  $block = @'
    const hasOk = (id: string): boolean =>
      checks.some(
        (check) =>
          check.id === id &&
          check.status === "ok"
      );

    const clientJourneyReady =
      hasOk("client-profile") &&
      hasOk("favorites-table") &&
      hasOk("bookings") &&
      hasOk("quotes");

    checks.push(
      clientJourneyReady
        ? ok(
            "beta-client-provider",
            "Beta 12.6",
            "Parcours Client → Prestataire",
            "Profil Client, favoris, devis et réservations sont disponibles."
          )
        : error(
            "beta-client-provider",
            "Beta 12.6",
            "Parcours Client → Prestataire",
            "Le socle Client → Prestataire n'est pas entièrement disponible."
          )
    );

    const providerJourneyReady =
      hasOk("provider-profile") &&
      hasOk("provider-services") &&
      hasOk("pricing-columns") &&
      hasOk("pricing-values");

    checks.push(
      providerJourneyReady
        ? ok(
            "beta-provider-ready",
            "Beta 12.6",
            "Parcours Prestataire",
            "Profil Prestataire, services et structure tarifaire sont disponibles."
          )
        : warning(
            "beta-provider-ready",
            "Beta 12.6",
            "Parcours Prestataire",
            "Le parcours Prestataire nécessite encore une configuration complète."
          )
    );

    const securityReady =
      hasOk("security-rls");

    checks.push(
      securityReady
        ? ok(
            "beta-security-gate",
            "Beta 12.6",
            "Barrière sécurité",
            "L'audit RLS ne détecte aucun blocage sur les tables critiques existantes."
          )
        : error(
            "beta-security-gate",
            "Beta 12.6",
            "Barrière sécurité",
            "La Beta ne doit pas être ouverte tant que l'audit RLS n'est pas vert."
          )
    );

    const paymentReady =
      checks.some(
        (check) =>
          check.id === "stripe-runtime" &&
          check.status === "ok"
      );

    checks.push(
      paymentReady
        ? ok(
            "beta-payment-gate",
            "Beta 12.6",
            "Paiement test",
            "La configuration Stripe du mode actuel est prête."
          )
        : warning(
            "beta-payment-gate",
            "Beta 12.6",
            "Paiement test",
            "Stripe n'est pas encore entièrement prêt. Aucun paiement réel n'est lancé par ce contrôle."
          )
    );

'@

  $content = $content.Replace(
    $marker,
    $block + $marker
  )

  Write-Host "[OK] Beta Journey Gate ajoute." -ForegroundColor Green
}
else {
  Write-Host "[OK] Beta Journey Gate deja present." -ForegroundColor Green
}

if ($content -notmatch 'version:\s*"12\.6"') {
  $oldResponse = @'
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
'@

  $newResponse = @'
    return NextResponse.json({
      version: "12.6",
      stage: "beta-readiness",
      generatedAt: new Date().toISOString(),
'@

  if (-not $content.Contains($oldResponse)) {
    throw "Bloc de retour JSON introuvable dans test-center/route.ts."
  }

  $content = $content.Replace(
    $oldResponse,
    $newResponse
  )

  Write-Host "[OK] Version API Test Center = 12.6" -ForegroundColor Green
}
else {
  Write-Host "[OK] Version API Test Center deja en 12.6" -ForegroundColor Green
}

[System.IO.File]::WriteAllText(
  $apiPath,
  $content,
  [System.Text.UTF8Encoding]::new($false)
)

$page = Get-Content -LiteralPath $pagePath -Raw

if ($page -match '>12\.3<') {
  $page = $page.Replace(">12.3<", ">12.6<")
}
elseif ($page -match '"12\.3"') {
  $page = $page.Replace('"12.3"', '"12.6"')
}
elseif ($page -match '12\.3') {
  $page = $page.Replace("12.3", "12.6")
}

[System.IO.File]::WriteAllText(
  $pagePath,
  $page,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Badge visible Test Center synchronise en 12.6." -ForegroundColor Green
Write-Host ""
Write-Host "Aucune donnee utilisateur n'a ete modifiee." -ForegroundColor DarkGray
