$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$page = Join-Path $root "app\bookings\page.tsx"

if (-not (Test-Path -LiteralPath $page)) {
  throw "Fichier introuvable : app\bookings\page.tsx"
}

$backup = "$page.step-8-0.backup"

if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item -LiteralPath $page -Destination $backup -Force
}

$content = Get-Content -LiteralPath $page -Raw -Encoding UTF8

$oldSort = @'
        .order("booking_date", { ascending: false })
        .order("start_time", { ascending: false });
'@

$newSort = @'
        .order("created_at", { ascending: true });
'@

if ($content.Contains($oldSort)) {
  $content = $content.Replace(
    $oldSort,
    $newSort
  )
}
elseif (-not $content.Contains('.order("created_at", { ascending: true })')) {
  throw "Tri actuel des reservations introuvable."
}

$oldDescription =
  'Demandes, confirmations, rendez-vous et historique au même endroit.'

$newDescription =
  'Demandes classées par ordre d’arrivée, confirmations, rendez-vous et historique au même endroit.'

if ($content.Contains($oldDescription)) {
  $content = $content.Replace(
    $oldDescription,
    $newDescription
  )
}

Set-Content -LiteralPath $page -Value $content -Encoding UTF8

Write-Host ""
Write-Host "ETAPE 8.0 - FIFO RESERVATIONS APPLIQUE." -ForegroundColor Green
Write-Host "Les reservations sont triees par created_at, plus ancienne recue en premier."
Write-Host ""
Write-Host "IMPORTANT : execute aussi le SQL Supabase avant de deployer le webhook 8.0."
Write-Host "Fichier : supabase\step-8-0-stripe-webhook-events.sql"
Write-Host ""
Write-Host "Puis : npm run build"
