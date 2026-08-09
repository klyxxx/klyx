$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

$verificationRoute = Join-Path $root "app\api\provider\verification\route.ts"
$readiness = Join-Path $root "app\components\ProviderReadinessStatus.tsx"

foreach ($file in @($verificationRoute, $readiness)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier introuvable : $file"
  }
}

# ============================================================
# FIX 1 - VERIFICATION DOCUMENT : chercher dans le bon dossier
# ============================================================

$verificationBackup = "$verificationRoute.fix-verification.backup"
if (-not (Test-Path -LiteralPath $verificationBackup)) {
  Copy-Item -LiteralPath $verificationRoute -Destination $verificationBackup -Force
}

$content = Get-Content -LiteralPath $verificationRoute -Raw -Encoding UTF8

$old = @'
    const { data: objects, error: listError } =
      await supabaseAdmin.storage
        .from("provider-verification")
        .list(profile.id, {
          search: storagePath.split("/").pop(),
          limit: 10,
        });

    if (listError) throw new Error(listError.message);

    const expectedName = storagePath.split("/").pop();

    if (!objects?.some((object) => object.name === expectedName)) {
'@

$new = @'
    const pathParts = storagePath.split("/");
    const expectedName = pathParts.pop() ?? "";
    const folderPath = pathParts.join("/");

    const { data: objects, error: listError } =
      await supabaseAdmin.storage
        .from("provider-verification")
        .list(folderPath, {
          search: expectedName,
          limit: 10,
        });

    if (listError) throw new Error(listError.message);

    if (!objects?.some((object) => object.name === expectedName)) {
'@

if ($content.Contains($old)) {
  $content = $content.Replace($old, $new)
}
elseif (-not $content.Contains("const folderPath = pathParts.join")) {
  throw "Bloc de verification Storage introuvable."
}

Set-Content -LiteralPath $verificationRoute -Value $content -Encoding UTF8

# ============================================================
# FIX 2 - PROVIDER READINESS : envoyer le token Authorization
# ============================================================

$readinessBackup = "$readiness.fix-session.backup"
if (-not (Test-Path -LiteralPath $readinessBackup)) {
  Copy-Item -LiteralPath $readiness -Destination $readinessBackup -Force
}

$content = Get-Content -LiteralPath $readiness -Raw -Encoding UTF8

$importAnchor = 'import { useCallback, useEffect, useMemo, useState } from "react";'
$importLine = 'import { supabase } from "@/lib/supabase";'

if (-not $content.Contains($importLine)) {
  if (-not $content.Contains($importAnchor)) {
    throw "Import React introuvable dans ProviderReadinessStatus."
  }

  $content = $content.Replace(
    $importAnchor,
    $importAnchor + "`r`n" + $importLine
  )
}

$oldFetch = @'
    try {
      const [studioResponse, zonesResponse] = await Promise.all([
        fetch("/api/provider/studio", {
          cache: "no-store",
        }),
        fetch("/api/provider/zones", {
          cache: "no-store",
        }),
      ]);
'@

$newFetch = @'
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Session manquante.");
      }

      const headers = {
        Authorization: `Bearer ${session.access_token}`,
      };

      const [studioResponse, zonesResponse] = await Promise.all([
        fetch("/api/provider/studio", {
          cache: "no-store",
          headers,
        }),
        fetch("/api/provider/zones", {
          cache: "no-store",
          headers,
        }),
      ]);
'@

if ($content.Contains($oldFetch)) {
  $content = $content.Replace($oldFetch, $newFetch)
}
elseif (-not $content.Contains("Authorization: `Bearer ${session.access_token}`")) {
  throw "Bloc fetch readiness introuvable."
}

Set-Content -LiteralPath $readiness -Value $content -Encoding UTF8

Write-Host ""
Write-Host "CORRECTIF VERIFICATION + SESSION APPLIQUE." -ForegroundColor Green
Write-Host ""
Write-Host "[OK] Documents : recherche dans le vrai sous-dossier Storage."
Write-Host "[OK] JPG / PNG / WEBP / PDF restent acceptes."
Write-Host "[OK] Statut de visibilite : token de session envoye."
Write-Host "[OK] Aucun SQL ni schema Supabase modifie."
Write-Host ""
Write-Host "Execute maintenant : npm run build"
