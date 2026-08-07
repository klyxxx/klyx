$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

$verificationRoute = Join-Path $root "app\api\provider\verification\route.ts"
$readiness = Join-Path $root "app\components\ProviderReadinessStatus.tsx"

foreach ($file in @($verificationRoute, $readiness)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier introuvable : $file"
  }
}

Write-Host ""
Write-Host "KLYX - CORRECTIF VERIFICATION + SESSION" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# FIX 1 - VERIFICATION DOCUMENT
# ============================================================

$verificationBackup = "$verificationRoute.fix-verification.backup"

if (-not (Test-Path -LiteralPath $verificationBackup)) {
  Copy-Item `
    -LiteralPath $verificationRoute `
    -Destination $verificationBackup `
    -Force
}

$content = Get-Content `
  -LiteralPath $verificationRoute `
  -Raw `
  -Encoding UTF8

if ($content.Contains("const folderPath = pathParts.join")) {
  Write-Host "[OK] Chemin Storage deja corrige." -ForegroundColor Yellow
}
else {
  $oldBlock = @'
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

  $newBlock = @'
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

  if (-not $content.Contains($oldBlock)) {
    throw "Bloc Storage introuvable dans app\api\provider\verification\route.ts"
  }

  $content = $content.Replace(
    $oldBlock,
    $newBlock
  )

  Set-Content `
    -LiteralPath $verificationRoute `
    -Value $content `
    -Encoding UTF8

  Write-Host "[OK] Verification : chemin Storage corrige." -ForegroundColor Green
}

# ============================================================
# FIX 2 - PROVIDER READINESS SESSION
# ============================================================

$readinessBackup = "$readiness.fix-session.backup"

if (-not (Test-Path -LiteralPath $readinessBackup)) {
  Copy-Item `
    -LiteralPath $readiness `
    -Destination $readinessBackup `
    -Force
}

$content = Get-Content `
  -LiteralPath $readiness `
  -Raw `
  -Encoding UTF8

$reactImport = 'import { useCallback, useEffect, useMemo, useState } from "react";'
$supabaseImport = 'import { supabase } from "@/lib/supabase";'

if (-not $content.Contains($supabaseImport)) {
  if (-not $content.Contains($reactImport)) {
    throw "Import React introuvable dans ProviderReadinessStatus.tsx"
  }

  $content = $content.Replace(
    $reactImport,
    $reactImport + "`r`n" + $supabaseImport
  )
}

$oldFetchBlock = @'
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

$newFetchBlock = @'
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

if ($content.Contains("const headers = {")) {
  Write-Host "[OK] Statut de visibilite : session deja corrigee." -ForegroundColor Yellow
}
else {
  if (-not $content.Contains($oldFetchBlock)) {
    throw "Bloc fetch readiness introuvable dans ProviderReadinessStatus.tsx"
  }

  $content = $content.Replace(
    $oldFetchBlock,
    $newFetchBlock
  )

  Set-Content `
    -LiteralPath $readiness `
    -Value $content `
    -Encoding UTF8

  Write-Host "[OK] Statut de visibilite : token de session ajoute." -ForegroundColor Green
}

Write-Host ""
Write-Host "CORRECTIF APPLIQUE AVEC SUCCES." -ForegroundColor Green
Write-Host "JPG / PNG / WEBP / PDF restent acceptes."
Write-Host "Aucun SQL ni schema Supabase modifie."
Write-Host ""
Write-Host "Execute maintenant : npm run build"
