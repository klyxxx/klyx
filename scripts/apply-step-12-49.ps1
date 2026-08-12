$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.49 - BRAIN COMPLETENESS" -ForegroundColor Cyan
Write-Host ""

$path = "app\api\brain\respond\route.ts"
if (-not (Test-Path -LiteralPath $path)) {
  throw "Fichier manquant : $path"
}

$content = Get-Content -LiteralPath $path -Raw

if ($content -match "KLYX_COMPLETENESS_12_49") {
  Write-Host "[OK] 12.49 deja appliquee." -ForegroundColor Green
  exit 0
}

$marker = "function buildReply("
$start = $content.IndexOf($marker)

if ($start -lt 0) {
  throw "buildReply introuvable. Aucun remplacement force."
}

$bodyStart = $content.IndexOf("{", $start)

if ($bodyStart -lt 0) {
  throw "Debut buildReply introuvable."
}

$block = @'

  // KLYX_COMPLETENESS_12_49
  const completionParts: string[] = [];

  if (context.serviceSlug) {
    completionParts.push("service");
  }

  if (context.city) {
    completionParts.push("ville");
  }

  if (context.date) {
    completionParts.push("date");
  }

  if (context.time) {
    completionParts.push("heure");
  }

  const completionScore = Math.round(
    (completionParts.length / 4) * 100
  );

  const completionLabel =
    completionScore === 100
      ? "Demande complète"
      : completionScore >= 75
        ? "Presque prête"
        : completionScore >= 50
          ? "Demande en cours"
          : "Je précise ton besoin";

'@

$content = $content.Insert($bodyStart + 1, $block)

$readyMarker = "J’ai tout ce qu’il faut :"
if ($content.Contains($readyMarker)) {
  $content = $content.Replace(
    $readyMarker,
    '${completionLabel} (${completionScore} %). J’ai tout ce qu’il faut :'
  )
} else {
  Write-Host "[INFO] Resume final existant non modifie." -ForegroundColor Yellow
}

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $path),
  $content,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Progression de demande calculee" -ForegroundColor Green
Write-Host "[OK] Service / ville / date / heure controles" -ForegroundColor Green
Write-Host "[OK] Etat presque pret ajoute" -ForegroundColor Green
Write-Host "[OK] Publication reste soumise a confirmation" -ForegroundColor Green
Write-Host ""
Write-Host "12.49 appliquee. Aucune migration SQL." -ForegroundColor Cyan
