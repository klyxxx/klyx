$ErrorActionPreference = "Stop"

Set-Location "C:\Users\fenjo\Documents\klyx"

$target = ".\app\api\brain\respond\route.ts"

if (-not (Test-Path -LiteralPath $target)) {
    throw "Fichier manquant : $target"
}

$content = Get-Content -LiteralPath $target -Raw

if ($content -match "knownContextSummary") {
    Write-Host "[OK] Guided Brain 12.44 deja applique." -ForegroundColor Green
    exit 0
}

$startMarker = "function buildReply("
$endMarker = "async function insertBrainMessage"

$startIndex = $content.IndexOf($startMarker)
$endIndex = $content.IndexOf($endMarker)

if ($startIndex -lt 0) {
    throw "Debut buildReply introuvable."
}

if ($endIndex -lt 0 -or $endIndex -le $startIndex) {
    throw "Fin buildReply introuvable ou invalide."
}

$before = $content.Substring(0, $startIndex)
$after = $content.Substring($endIndex)

$newBlock = @'
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
      ? `, avec un budget maximum de ${context.budget.toFixed(2)} €`
      : "";

  return `J’ai tout ce qu’il faut : ${serviceLabel(
    context.serviceSlug
  )} à ${context.city}, le ${context.date} à ${
    context.time
  }${budgetText}. Vérifie le résumé puis confirme avant que KLYX publie ta demande.`;
}

'@

$newContent = $before + $newBlock + $after

[System.IO.File]::WriteAllText(
    (Resolve-Path -LiteralPath $target),
    $newContent,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Guided Brain 12.44 repare." -ForegroundColor Green
