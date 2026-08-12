$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.44 - GUIDED BRAIN" -ForegroundColor Cyan
Write-Host ""

$path = "app\api\brain\respond\route.ts"
if (-not (Test-Path -LiteralPath $path)) { throw "Fichier manquant : $path" }

$content = Get-Content -LiteralPath $path -Raw

$old = @'
function buildReply(
  context: BrainContext,
  missing: string[]
): string {
  if (missing.length > 0) {
    const questions: Record<string, string> = {
      service:
        "Quel service souhaites-tu réserver ? Tu peux écrire par exemple : baby-sitting, ménage, déménagement ou bricolage.",
      ville:
        "Dans quelle ville as-tu besoin de ce service ?",
      date:
        "Pour quelle date ? Tu peux écrire par exemple : demain ou 15/09/2026.",
      heure:
        "À quelle heure souhaites-tu la prestation ?",
    };

    return questions[missing[0]];
  }

  const budgetText =
    context.budget != null
      ? `, avec un budget maximum de ${context.budget.toFixed(
          2
        )} €`
      : "";

  return `J’ai compris : ${serviceLabel(
    context.serviceSlug
  )} à ${context.city}, le ${context.date} à ${
    context.time
  }${budgetText}. Je peux maintenant chercher les meilleurs prestataires.`;
}
'@

$new = @'
function knownContextSummary(context: BrainContext): string {
  const parts: string[] = [];

  if (context.serviceSlug) {
    parts.push(serviceLabel(context.serviceSlug));
  }

  if (context.city) {
    parts.push(`à ${context.city}`);
  }

  if (context.date) {
    parts.push(`le ${context.date}`);
  }

  if (context.time) {
    parts.push(`à ${context.time}`);
  }

  if (context.budget != null) {
    parts.push(`budget max ${context.budget.toFixed(2)} €`);
  }

  return parts.join(", ");
}

function buildReply(
  context: BrainContext,
  missing: string[]
): string {
  if (missing.length > 0) {
    const questions: Record<string, string> = {
      service:
        "Quel service souhaites-tu ? Tu peux écrire par exemple : baby-sitting, ménage, déménagement ou bricolage.",
      ville:
        "Dans quelle ville dois-je chercher le prestataire ?",
      date:
        "Pour quelle date souhaites-tu la prestation ? Tu peux répondre par exemple : demain ou 15/09/2026.",
      heure:
        "À quelle heure souhaites-tu que la prestation commence ?",
    };

    const summary = knownContextSummary(context);
    const prefix = summary
      ? `J’ai déjà compris : ${summary}. `
      : "";

    return `${prefix}${questions[missing[0]]}`;
  }

  const budgetText =
    context.budget != null
      ? `, avec un budget maximum de ${context.budget.toFixed(
          2
        )} €`
      : "";

  return `J’ai tout ce qu’il faut : ${serviceLabel(
    context.serviceSlug
  )} à ${context.city}, le ${context.date} à ${
    context.time
  }${budgetText}. Vérifie le résumé puis confirme avant que KLYX publie ta demande.`;
}
'@

if ($content.Contains($old)) {
  $content = $content.Replace($old, $new)
} elseif ($content -notmatch 'knownContextSummary') {
  throw "Bloc buildReply actuel introuvable. Aucun remplacement force."
}

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $path),
  $content,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Contexte deja compris rappele" -ForegroundColor Green
Write-Host "[OK] Une question manquante a la fois" -ForegroundColor Green
Write-Host "[OK] Resume final avant confirmation" -ForegroundColor Green
Write-Host "[OK] Aucune publication automatique" -ForegroundColor Green
Write-Host ""
Write-Host "12.44 appliquee. Aucune migration SQL." -ForegroundColor Cyan
