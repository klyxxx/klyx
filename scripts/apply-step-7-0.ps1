$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$signup = Join-Path $root "app\signup\page.tsx"
$onboarding = Join-Path $root "app\onboarding\page.tsx"

foreach ($file in @($signup, $onboarding)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier introuvable : $file"
  }
}

$backup = "$signup.step-7-0.backup"

if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item `
    -LiteralPath $signup `
    -Destination $backup `
    -Force
}

$content = Get-Content `
  -LiteralPath $signup `
  -Raw `
  -Encoding UTF8

$content = $content.Replace(
  'emailRedirectTo: `${window.location.origin}/dashboard`,',
  'emailRedirectTo: `${window.location.origin}/onboarding`,'
)

$content = $content.Replace(
  'router.replace(accountType === "provider" ? "/provider" : "/dashboard");',
  'router.replace("/onboarding");'
)

Set-Content `
  -LiteralPath $signup `
  -Value $content `
  -Encoding UTF8

Write-Host ""
Write-Host "ETAPE 7.0 appliquee avec succes." -ForegroundColor Green
Write-Host "Nouvelle route : /onboarding"
Write-Host "Nouvelle inscription client -> /onboarding"
Write-Host "Nouvelle inscription prestataire -> /onboarding"
Write-Host "Confirmation email -> /onboarding"
Write-Host "Aucun SQL, Stripe ou schema Supabase modifie."
Write-Host ""
Write-Host "Execute maintenant : npm run build"
