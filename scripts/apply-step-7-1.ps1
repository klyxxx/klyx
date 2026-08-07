$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$onboarding = Join-Path $root "app\onboarding\page.tsx"

if (-not (Test-Path -LiteralPath $onboarding)) {
  throw "Fichier introuvable : app\onboarding\page.tsx"
}

$backup = "$onboarding.step-7-1.backup"

if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item `
    -LiteralPath $onboarding `
    -Destination $backup `
    -Force
}

$content = Get-Content `
  -LiteralPath $onboarding `
  -Raw `
  -Encoding UTF8

$importLine = 'import FirstProfileSetup from "./FirstProfileSetup";'
$anchor = 'import { createClient } from "@/lib/supabase/server";'

if (-not $content.Contains($importLine)) {
  if (-not $content.Contains($anchor)) {
    throw "Import createClient introuvable dans onboarding."
  }

  $content = $content.Replace(
    $anchor,
    $anchor + "`r`n" + $importLine
  )
}

$old = @'
  if (!profile) {
    redirect("/accounts");
  }
'@

$new = @'
  if (!profile) {
    const metadata =
      (user.user_metadata ?? {}) as Record<string, unknown>;

    const fullName =
      typeof metadata.full_name === "string"
        ? metadata.full_name
        : "";

    const accountType =
      metadata.account_type === "provider"
        ? "provider"
        : "client";

    return (
      <FirstProfileSetup
        initialFullName={fullName}
        initialAccountType={accountType}
      />
    );
  }
'@

if (-not $content.Contains($old)) {
  if (-not $content.Contains("<FirstProfileSetup")) {
    throw "Bloc profile null introuvable dans onboarding."
  }
}
else {
  $content = $content.Replace(
    $old,
    $new
  )
}

Set-Content `
  -LiteralPath $onboarding `
  -Value $content `
  -Encoding UTF8

Write-Host ""
Write-Host "ETAPE 7.1 appliquee avec succes." -ForegroundColor Green
Write-Host "Onboarding sans profil -> configuration initiale."
Write-Host "Client -> premier profil client."
Write-Host "Prestataire -> premier profil + premier metier."
Write-Host "API existante /api/profiles/manage reutilisee."
Write-Host "Aucun SQL, Stripe ou schema Supabase modifie."
Write-Host ""
Write-Host "Execute maintenant : npm run build"
