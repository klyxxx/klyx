$ErrorActionPreference = "Stop"

Set-Location "C:\Users\fenjo\Documents\klyx"

$target = ".\app\api\brain\respond\route.ts"

if (-not (Test-Path -LiteralPath $target)) {
    throw "Fichier manquant : $target"
}

$content = Get-Content -LiteralPath $target -Raw

if ($content -match "KLYX_COMPLETENESS_12_49") {
    Write-Host "[OK] KLYX 12.49 deja applique." -ForegroundColor Green
    exit 0
}

$marker = "function buildReply("
$start = $content.IndexOf($marker)

if ($start -lt 0) {
    throw "buildReply introuvable."
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
    $replacement = @'
${completionLabel} (${completionScore} %). J’ai tout ce qu’il faut :
'@

    $content = $content.Replace(
        $readyMarker,
        $replacement.Trim()
    )

    Write-Host "[OK] Resume final enrichi" -ForegroundColor Green
}
else {
    Write-Host "[INFO] Resume final existant laisse intact." -ForegroundColor Yellow
}

[System.IO.File]::WriteAllText(
    (Resolve-Path -LiteralPath $target),
    $content,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Progression de demande calculee" -ForegroundColor Green
Write-Host "[OK] Service / ville / date / heure controles" -ForegroundColor Green
Write-Host "[OK] Etat presque pret ajoute" -ForegroundColor Green
Write-Host "[OK] Publication reste soumise a confirmation" -ForegroundColor Green
Write-Host ""
Write-Host "KLYX 12.49B applique." -ForegroundColor Cyan
