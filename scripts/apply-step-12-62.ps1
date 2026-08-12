$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "KLYX 12.62 - Assistant Readiness UI"
Write-Host ""

$candidates = @(
    (Join-Path $projectRoot "app\assistant\page.tsx"),
    (Join-Path $projectRoot "app\brain\page.tsx")
)

$targetPath = $null

foreach ($candidate in $candidates) {
    if (-not (Test-Path -LiteralPath $candidate)) {
        continue
    }

    $candidateContent = [System.IO.File]::ReadAllText($candidate)

    if ($candidateContent.Contains("/api/brain/respond")) {
        $targetPath = $candidate
        break
    }
}

if (-not $targetPath) {
    throw "Aucune page assistant utilisant /api/brain/respond n'a ete trouvee."
}

Write-Host "Interface detectee : $targetPath"

$content = [System.IO.File]::ReadAllText($targetPath)

$pageMarker = "KLYX_ASSISTANT_READINESS_UI_12_62"
$componentMarker = "KLYX_READINESS_CARD_12_62"

$componentPath = Join-Path `
    $projectRoot `
    "app\components\BrainReadinessCard.tsx"

if (
    $content.Contains($pageMarker) -and
    (Test-Path -LiteralPath $componentPath)
) {
    $componentExisting = [System.IO.File]::ReadAllText(
        $componentPath
    )

    if ($componentExisting.Contains($componentMarker)) {
        Write-Host "KLYX 12.62 est deja present. Aucune duplication."
        exit 0
    }
}

if (-not $content.Contains('"use client";')) {
    throw "La page detectee n'est pas un composant client attendu."
}

if (-not $content.Contains("type BrainPayload = {")) {
    throw "Type BrainPayload introuvable. Aucun fichier modifie."
}

if (-not $content.Contains("const [payload")) {
    throw "Etat payload introuvable. Aucun fichier modifie."
}

if (-not $content.Contains("function openResults(")) {
    throw "openResults introuvable. Aucun fichier modifie."
}

if (-not $content.Contains("setInput(")) {
    throw "Etat input introuvable. Aucun fichier modifie."
}

$newLine = if ($content.Contains("`r`n")) {
    "`r`n"
}
else {
    "`n"
}

function Find-MatchingBrace {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,

        [Parameter(Mandatory = $true)]
        [int]$OpenIndex
    )

    $depth = 0
    $quote = [char]0
    $escaped = $false

    for ($i = $OpenIndex; $i -lt $Text.Length; $i++) {
        $char = $Text[$i]

        if ($quote -ne [char]0) {
            if ($escaped) {
                $escaped = $false
                continue
            }

            if ($char -eq "\") {
                $escaped = $true
                continue
            }

            if ($char -eq $quote) {
                $quote = [char]0
            }

            continue
        }

        if (
            $char -eq "'" -or
            $char -eq '"' -or
            $char -eq '`'
        ) {
            $quote = $char
            continue
        }

        if ($char -eq "{") {
            $depth++
            continue
        }

        if ($char -eq "}") {
            $depth--

            if ($depth -eq 0) {
                return $i
            }
        }
    }

    return -1
}

# ---------------------------------------------
# Composant Readiness
# ---------------------------------------------

$componentLines = @(
    '"use client";'
    ""
    'import { CheckCircle2, CircleAlert, Pencil } from "lucide-react";'
    ""
    "// KLYX_READINESS_CARD_12_62"
    "export type BrainReadinessViewModel = {"
    "  score: number;"
    "  label: string;"
    "  isComplete: boolean;"
    "  remainingCount: number;"
    "  missing: string[];"
    "  nextMissing: string | null;"
    "  requiresConfirmation: boolean;"
    "  confirmationState:"
    '    | "awaiting_user_confirmation"'
    '    | "not_ready";'
    "  confirmationOptions?: Array<{"
    "    id: string;"
    "    action: string;"
    "    label: string;"
    "  }>;"
    "  summary: {"
    "    service: string;"
    "    city: string;"
    "    date: string;"
    "    time: string;"
    "  } | null;"
    "  automaticExecutionAllowed: boolean;"
    "};"
    ""
    "type Props = {"
    "  readiness: BrainReadinessViewModel;"
    "  onConfirm?: () => void;"
    "  onEdit?: () => void;"
    "};"
    ""
    "const fieldLabels: Record<string, string> = {"
    '  service: "service",'
    '  ville: "ville",'
    '  date: "date",'
    '  heure: "heure",'
    "};"
    ""
    "export default function BrainReadinessCard({"
    "  readiness,"
    "  onConfirm,"
    "  onEdit,"
    "}: Props) {"
    "  const safeScore = Math.max("
    "    0,"
    "    Math.min(100, readiness.score)"
    "  );"
    ""
    "  return ("
    '    <section className="rounded-[1.6rem] border border-border bg-card p-5 shadow-sm">'
    '      <div className="flex items-start justify-between gap-4">'
    "        <div>"
    '          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">'
    "            Préparation de la demande"
    "          </p>"
    '          <h3 className="mt-1 text-base font-black text-foreground">'
    "            {readiness.label}"
    "          </h3>"
    "        </div>"
    ""
    '        <div className="rounded-full border border-border bg-background px-3 py-1 text-sm font-black">'
    "          {safeScore} %"
    "        </div>"
    "      </div>"
    ""
    '      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">'
    "        <div"
    '          className="h-full rounded-full bg-violet-600 transition-all duration-500"'
    "          style={{ width: `${safeScore}%` }}"
    "        />"
    "      </div>"
    ""
    "      {!readiness.isComplete && ("
    '        <div className="mt-4 flex gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">'
    '          <CircleAlert className="mt-0.5 shrink-0 text-amber-600" size={18} />'
    '          <div className="text-sm">'
    '            <p className="font-bold">'
    "              {readiness.remainingCount} information"
    '              {readiness.remainingCount > 1 ? "s" : ""} restante'
    '              {readiness.remainingCount > 1 ? "s" : ""}'
    "            </p>"
    ""
    '            <p className="mt-1 text-muted-foreground">'
    "              {readiness.missing"
    "                .map((field) => fieldLabels[field] ?? field)"
    '                .join(" • ")}'
    "            </p>"
    "          </div>"
    "        </div>"
    "      )}"
    ""
    "      {readiness.isComplete && readiness.summary && ("
    '        <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">'
    '          <div className="flex items-center gap-2 font-black text-emerald-700 dark:text-emerald-300">'
    "            <CheckCircle2 size={18} />"
    "            Demande complète"
    "          </div>"
    ""
    '          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">'
    "            <div>"
    '              <dt className="text-muted-foreground">Service</dt>'
    '              <dd className="font-bold">{readiness.summary.service}</dd>'
    "            </div>"
    "            <div>"
    '              <dt className="text-muted-foreground">Ville</dt>'
    '              <dd className="font-bold">{readiness.summary.city}</dd>'
    "            </div>"
    "            <div>"
    '              <dt className="text-muted-foreground">Date</dt>'
    '              <dd className="font-bold">{readiness.summary.date}</dd>'
    "            </div>"
    "            <div>"
    '              <dt className="text-muted-foreground">Heure</dt>'
    '              <dd className="font-bold">{readiness.summary.time}</dd>'
    "            </div>"
    "          </dl>"
    ""
    "          {readiness.requiresConfirmation && ("
    '            <p className="mt-4 text-xs font-semibold text-muted-foreground">'
    "              KLYX attend ta confirmation avant toute action."
    "            </p>"
    "          )}"
    ""
    '          <div className="mt-4 grid gap-2 sm:grid-cols-2">'
    "            <button"
    '              type="button"'
    "              onClick={onEdit}"
    '              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold transition hover:bg-muted"'
    "            >"
    "              <Pencil size={16} />"
    "              Modifier"
    "            </button>"
    ""
    "            <button"
    '              type="button"'
    "              onClick={onConfirm}"
    '              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700"'
    "            >"
    "              <CheckCircle2 size={16} />"
    "              Confirmer"
    "            </button>"
    "          </div>"
    "        </div>"
    "      )}"
    "    </section>"
    "  );"
    "}"
)

$componentContent = [string]::Join(
    $newLine,
    $componentLines
)

# ---------------------------------------------
# Import
# ---------------------------------------------

$importLine = 'import BrainReadinessCard, { type BrainReadinessViewModel } from "@/app/components/BrainReadinessCard";'

$newContent = $content

if (-not $newContent.Contains($importLine)) {
    $clientAnchor = '"use client";'
    $clientIndex = $newContent.IndexOf($clientAnchor)

    if ($clientIndex -lt 0) {
        throw "use client introuvable."
    }

    $importPosition = $clientIndex + $clientAnchor.Length

    $newContent =
        $newContent.Substring(0, $importPosition) +
        $newLine +
        $newLine +
        $importLine +
        $newContent.Substring($importPosition)
}

# ---------------------------------------------
# BrainPayload.readiness
# ---------------------------------------------

$payloadTypeIndex = $newContent.IndexOf(
    "type BrainPayload = {"
)

if ($payloadTypeIndex -lt 0) {
    throw "BrainPayload perdu apres ajout import."
}

$payloadTypeOpen = $newContent.IndexOf(
    "{",
    $payloadTypeIndex
)

$payloadTypeClose = Find-MatchingBrace `
    -Text $newContent `
    -OpenIndex $payloadTypeOpen

if ($payloadTypeClose -lt 0) {
    throw "Fin du type BrainPayload introuvable."
}

$payloadTypeSection = $newContent.Substring(
    $payloadTypeOpen,
    $payloadTypeClose - $payloadTypeOpen + 1
)

if (-not $payloadTypeSection.Contains("readiness?:")) {
    $readinessTypeProperty =
        "  readiness?: BrainReadinessViewModel;" +
        $newLine

    $newContent =
        $newContent.Substring(0, $payloadTypeClose) +
        $readinessTypeProperty +
        $newContent.Substring($payloadTypeClose)
}

# ---------------------------------------------
# Fonction Modifier
# ---------------------------------------------

$openResultsIndex = $newContent.IndexOf(
    "function openResults("
)

if ($openResultsIndex -lt 0) {
    throw "openResults perdu pendant la preparation."
}

$editFunctionLines = @(
    "  // KLYX_ASSISTANT_READINESS_UI_12_62"
    "  function editCurrentRequest() {"
    '    setInput("");'
    '    setErrorMessage("");'
    ""
    "    requestAnimationFrame(() => {"
    '      document.querySelector<HTMLTextAreaElement>("textarea")?.focus();'
    "    });"
    "  }"
    ""
)

$editFunction = [string]::Join(
    $newLine,
    $editFunctionLines
)

$newContent =
    $newContent.Substring(0, $openResultsIndex) +
    $editFunction +
    $newContent.Substring($openResultsIndex)

# ---------------------------------------------
# Rendu de la carte
# ---------------------------------------------

$renderAnchors = @(
    "                {messages.length === 1 && (",
    "                {loading && (",
    "                <div ref={bottomRef}"
)

$renderIndex = -1

foreach ($anchor in $renderAnchors) {
    $candidateIndex = $newContent.IndexOf($anchor)

    if ($candidateIndex -ge 0) {
        $renderIndex = $candidateIndex
        break
    }
}

if ($renderIndex -lt 0) {
    throw "Point d'insertion UI introuvable. Aucun fichier modifie."
}

$renderLines = @(
    '                {payload?.readiness && ('
    '                  <BrainReadinessCard'
    '                    readiness={payload.readiness}'
    '                    onConfirm={openResults}'
    '                    onEdit={editCurrentRequest}'
    '                  />'
    '                )}'
    ""
)

$renderBlock = [string]::Join(
    $newLine,
    $renderLines
)

$newContent =
    $newContent.Substring(0, $renderIndex) +
    $renderBlock +
    $newContent.Substring($renderIndex)

# ---------------------------------------------
# Verification avant ecriture
# ---------------------------------------------

$pageChecks = @(
    "KLYX_ASSISTANT_READINESS_UI_12_62",
    "BrainReadinessCard",
    "BrainReadinessViewModel",
    "readiness?: BrainReadinessViewModel;",
    "payload?.readiness",
    "readiness={payload.readiness}",
    "onConfirm={openResults}",
    "onEdit={editCurrentRequest}"
)

foreach ($check in $pageChecks) {
    if (-not $newContent.Contains($check)) {
        throw "Verification page echouee : $check"
    }
}

if (-not $componentContent.Contains($componentMarker)) {
    throw "Verification composant echouee."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

$pageBackup = "$targetPath.bak-12-62-$timestamp"
$componentBackup = $null

Copy-Item `
    -LiteralPath $targetPath `
    -Destination $pageBackup `
    -Force

if (Test-Path -LiteralPath $componentPath) {
    $componentBackup =
        "$componentPath.bak-12-62-$timestamp"

    Copy-Item `
        -LiteralPath $componentPath `
        -Destination $componentBackup `
        -Force
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

try {
    [System.IO.File]::WriteAllText(
        $componentPath,
        $componentContent,
        $utf8NoBom
    )

    [System.IO.File]::WriteAllText(
        $targetPath,
        $newContent,
        $utf8NoBom
    )

    $pageVerification =
        [System.IO.File]::ReadAllText($targetPath)

    $componentVerification =
        [System.IO.File]::ReadAllText($componentPath)

    foreach ($check in $pageChecks) {
        if (-not $pageVerification.Contains($check)) {
            throw "Verification apres ecriture echouee : $check"
        }
    }

    if (-not $componentVerification.Contains($componentMarker)) {
        throw "Composant 12.62 invalide apres ecriture."
    }
}
catch {
    Write-Host ""
    Write-Host "Erreur pendant KLYX 12.62."
    Write-Host "Restauration automatique..."

    if (Test-Path -LiteralPath $pageBackup) {
        Copy-Item `
            -LiteralPath $pageBackup `
            -Destination $targetPath `
            -Force
    }

    if ($componentBackup) {
        Copy-Item `
            -LiteralPath $componentBackup `
            -Destination $componentPath `
            -Force
    }
    elseif (Test-Path -LiteralPath $componentPath) {
        Remove-Item `
            -LiteralPath $componentPath `
            -Force
    }

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.62 Assistant Readiness UI ajoute."
Write-Host "OK - progression visible."
Write-Host "OK - resume visible."
Write-Host "OK - bouton Modifier actif."
Write-Host "OK - bouton Confirmer utilise le parcours de confirmation existant."
Write-Host "OK - aucune publication automatique ajoutee."
Write-Host ""