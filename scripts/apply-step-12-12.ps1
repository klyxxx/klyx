$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$packageRoot = Split-Path -Parent $PSScriptRoot
$payload = Join-Path $packageRoot "payload"

Set-Location $root

Write-Host ""
Write-Host "KLYX 12.12 - KLYX SCORE GENERIQUE" -ForegroundColor Cyan
Write-Host ""

$copyFiles = @(
  "lib\provider-score.ts",
  "app\api\scores\recalculate\route.ts",
  "app\scores\page.tsx"
)

foreach ($relative in $copyFiles) {
  $source = Join-Path $payload $relative
  $target = Join-Path $root $relative
  $directory = Split-Path -Parent $target

  if (-not (Test-Path -LiteralPath $source)) {
    throw "Source manquante : $source"
  }

  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force

  Write-Host "[OK] $relative" -ForegroundColor Green
}

$reviewPath = "app\api\reviews\route.ts"

if (-not (Test-Path -LiteralPath $reviewPath)) {
  throw "$reviewPath introuvable. 12.11 doit etre installee."
}

$review = Get-Content -LiteralPath $reviewPath -Raw

$importLine = 'import { recalculateProviderScores } from "@/lib/provider-score";'

if ($review -notmatch [regex]::Escape($importLine)) {
  $anchor = 'import { supabaseAdmin } from "@/lib/supabase-admin";'

  if (-not $review.Contains($anchor)) {
    throw "Import supabaseAdmin introuvable dans reviews."
  }

  $review = $review.Replace(
    $anchor,
    "$anchor`r`n$importLine"
  )
}

$recalcBlock = @'
    try {
      await recalculateProviderScores(providerId);
    } catch (scoreError) {
      console.error(
        "Review score recalculation error:",
        scoreError instanceof Error
          ? scoreError.message
          : scoreError
      );
    }

'@

$anchorReturn = '    return NextResponse.json({'

# Insert only in POST, immediately after notification handling.
$notificationMarker = @'
    if (notificationError) {
      console.error(
        "Review notification error:",
        notificationError.message
      );
    }

'@

if ($review -notmatch "Review score recalculation error") {
  if (-not $review.Contains($notificationMarker)) {
    throw "Bloc notification reviews introuvable."
  }

  $review = $review.Replace(
    $notificationMarker,
    $notificationMarker + $recalcBlock
  )
}

[System.IO.File]::WriteAllText(
  (Resolve-Path $reviewPath),
  $review,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Avis -> recalcul automatique KLYX Score" -ForegroundColor Green
Write-Host ""
Write-Host "12.12 appliquee. Aucune migration SQL necessaire." -ForegroundColor Cyan
