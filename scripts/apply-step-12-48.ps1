$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.48 - BRAIN AMBIGUITY" -ForegroundColor Cyan
Write-Host ""

$path = "app\api\brain\respond\route.ts"
if (-not (Test-Path -LiteralPath $path)) { throw "Fichier manquant : $path" }

$content = Get-Content -LiteralPath $path -Raw

if ($content -match "KLYX_AMBIGUITY_12_48") {
  Write-Host "[OK] 12.48 deja appliquee." -ForegroundColor Green
  exit 0
}

$marker = "function buildReply("
$start = $content.IndexOf($marker)
if ($start -lt 0) { throw "buildReply introuvable. Aucun remplacement force." }

$bodyStart = $content.IndexOf("{", $start)
if ($bodyStart -lt 0) { throw "Debut buildReply introuvable." }

$block = @'

  // KLYX_AMBIGUITY_12_48
  const firstMissing = missing[0] ?? null;

  const guidedQuestions: Record<string, string> = {
    service:
      "De quel service as-tu besoin ? Décris simplement le travail à faire, même si tu ne connais pas le nom exact du métier.",
    ville:
      "Dans quelle ville ou commune la prestation doit-elle avoir lieu ?",
    date:
      "Quel jour souhaites-tu la prestation ? Tu peux répondre naturellement : demain, samedi, lundi prochain ou avec une date.",
    heure:
      "À quel moment souhaites-tu la prestation ? Par exemple : 10h30, midi, le matin, l’après-midi ou le soir.",
  };

  if (firstMissing && guidedQuestions[firstMissing]) {
    const summary =
      typeof knownContextSummary === "function"
        ? knownContextSummary(context)
        : "";

    return summary
      ? `J’ai déjà compris : ${summary}. ${guidedQuestions[firstMissing]}`
      : guidedQuestions[firstMissing];
  }
'@

$content = $content.Insert($bodyStart + 1, $block)

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $path),
  $content,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Une seule question prioritaire" -ForegroundColor Green
Write-Host "[OK] Questions naturelles par information manquante" -ForegroundColor Green
Write-Host "[OK] Contexte deja compris rappele" -ForegroundColor Green
Write-Host "[OK] Confirmation existante conservee" -ForegroundColor Green
Write-Host ""
Write-Host "12.48 appliquee. Aucune migration SQL." -ForegroundColor Cyan
