$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$page = Join-Path $root "app\provider\page.tsx"

if (-not (Test-Path -LiteralPath $page)) {
  throw "Fichier introuvable : app\provider\page.tsx"
}

$backup = "$page.step-7-4.backup"
if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item -LiteralPath $page -Destination $backup -Force
}

$content = Get-Content -LiteralPath $page -Raw -Encoding UTF8

$importLine = 'import ProviderReadinessStatus from "@/app/components/ProviderReadinessStatus";'
$anchor = 'import ProviderStudio from "@/app/components/ProviderStudio";'

if (-not $content.Contains($importLine)) {
  if (-not $content.Contains($anchor)) {
    throw "Import ProviderStudio introuvable."
  }

  $content = $content.Replace(
    $anchor,
    $anchor + "`r`n" + $importLine
  )
}

$oldReturn = '  return <ProviderStudio profileId={profile.id} />;'

$newReturn = @'
  return (
    <>
      <ProviderReadinessStatus />
      <ProviderStudio profileId={profile.id} />
    </>
  );
'@

if ($content.Contains($oldReturn)) {
  $content = $content.Replace($oldReturn, $newReturn)
}
elseif (-not $content.Contains("<ProviderReadinessStatus")) {
  throw "Return ProviderStudio introuvable."
}

Set-Content -LiteralPath $page -Value $content -Encoding UTF8

Write-Host ""
Write-Host "ETAPE 7.4 appliquee avec succes." -ForegroundColor Green
Write-Host "Statut prestataire ajoute dans /provider."
Write-Host "Visibilite : publication + service complet + zone active."
Write-Host "Verification identite : signal de confiance supplementaire."
Write-Host "Aucun SQL, Stripe, schema Supabase ou account-switcher modifie."
Write-Host ""
Write-Host "Execute maintenant : npm run build"
