$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$page = Join-Path $root "app\bookings\page.tsx"

if (-not (Test-Path -LiteralPath $page)) {
  throw "Fichier introuvable : app\bookings\page.tsx"
}

$backup = "$page.step-8-0.backup"

if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item `
    -LiteralPath $page `
    -Destination $backup `
    -Force
}

$content = Get-Content `
  -LiteralPath $page `
  -Raw `
  -Encoding UTF8

$oldSort = @'
        .order("booking_date", { ascending: false })
        .order("start_time", { ascending: false });
'@

$newSort = @'
        .order("created_at", { ascending: true });
'@

if ($content.Contains($newSort)) {
  Write-Host "[OK] Tri FIFO deja present." -ForegroundColor Yellow
}
elseif ($content.Contains($oldSort)) {
  $content = $content.Replace(
    $oldSort,
    $newSort
  )

  Set-Content `
    -LiteralPath $page `
    -Value $content `
    -Encoding UTF8

  Write-Host "[OK] Reservations triees par ordre d'arrivee." -ForegroundColor Green
}
else {
  throw "Tri actuel des reservations introuvable."
}

Write-Host ""
Write-Host "ETAPE 8.0 V2 APPLIQUEE." -ForegroundColor Green
Write-Host "FIFO actif : created_at ASC."
Write-Host ""
Write-Host "Rappel : le SQL Stripe doit deja etre execute dans Supabase."
Write-Host "Fichier : supabase\step-8-0-stripe-webhook-events.sql"
Write-Host ""
Write-Host "Execute maintenant : npm run build"
