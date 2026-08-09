$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

# ============================================================
# ADMIN AUTH : Founder = admin complet
# ============================================================

$adminFile = Join-Path $root "lib\admin-auth.ts"

if (-not (Test-Path -LiteralPath $adminFile)) {
  throw "Fichier introuvable : lib\admin-auth.ts"
}

$backup = "$adminFile.step-11-1.backup"

if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item -LiteralPath $adminFile -Destination $backup -Force
}

$content = Get-Content -LiteralPath $adminFile -Raw -Encoding UTF8

$old = @'
function configuredAdminIds(): Set<string> {
  return new Set(
    (process.env.KLYX_ADMIN_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}
'@

$new = @'
function configuredAdminIds(): Set<string> {
  const adminIds =
    (process.env.KLYX_ADMIN_USER_IDS ?? "")
      .split(",");

  const founderIds =
    (process.env.KLYX_FOUNDER_USER_IDS ?? "")
      .split(",");

  return new Set(
    [...adminIds, ...founderIds]
      .map((value) => value.trim())
      .filter(Boolean)
  );
}
'@

if (-not $content.Contains("KLYX_FOUNDER_USER_IDS")) {
  if (-not $content.Contains($old)) {
    throw "Bloc configuredAdminIds introuvable."
  }

  $content = $content.Replace($old, $new)
}

Set-Content -LiteralPath $adminFile -Value $content -Encoding UTF8

Write-Host ""
Write-Host "ETAPE 11.1 APPLIQUEE." -ForegroundColor Green
Write-Host ""
Write-Host "Founder = client + prestataire + admin via une seule connexion."
Write-Host ""
Write-Host "IMPORTANT : configure maintenant KLYX_FOUNDER_USER_IDS."
Write-Host "Puis execute : npm run build"
