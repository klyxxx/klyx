$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "KLYX 12.61b - Brain Response Metadata"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "route.ts introuvable : $targetPath"
}

$content = [System.IO.File]::ReadAllText($targetPath)

$marker = "KLYX_RESPONSE_METADATA_12_61"

if ($content.Contains($marker)) {
    Write-Host "KLYX 12.61 est deja present. Aucune duplication."
    exit 0
}

if (-not $content.Contains("KLYX_VISIBLE_READINESS_12_60")) {
    throw "KLYX 12.60 introuvable. Aucun fichier modifie."
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

# --------------------------------------------------
# 1. Ajouter le type BrainReadinessPayload
# --------------------------------------------------

$brainPayloadAnchor = "type BrainPayload = BrainContext & {"
$typeIndex = $content.IndexOf($brainPayloadAnchor)

if ($typeIndex -lt 0) {
    throw "Type BrainPayload introuvable. Aucun fichier modifie."
}

$typeLines = @(
    "type BrainReadinessPayload = {"
    "  score: number;"
    "  label: string;"
    "  isComplete: boolean;"
    "  remainingCount: number;"
    "  missing: string[];"
    "  nextMissing: string | null;"
    "  nextStep:"
    '    | "confirm_request"'
    '    | "collect_missing_information";'
    "  requiresConfirmation: boolean;"
    "  confirmationState:"
    '    | "awaiting_user_confirmation"'
    '    | "not_ready";'
    "  confirmationOptions: Array<{"
    '    id: "confirm" | "edit";'
    '    action: "confirm_request" | "edit_request";'
    '    label: "Confirmer" | "Modifier";'
    "  }>;"
    "  summary: {"
    "    service: string;"
    "    city: string;"
    "    date: string;"
    "    time: string;"
    "  } | null;"
    "  automaticExecutionAllowed: false;"
    "};"
    ""
)

$typeBlock = [string]::Join($newLine, $typeLines)

$newContent =
    $content.Substring(0, $typeIndex) +
    $typeBlock +
    $content.Substring($typeIndex)

# --------------------------------------------------
# 2. Ajouter readiness au type BrainPayload
# --------------------------------------------------

$typeIndex = $newContent.IndexOf($brainPayloadAnchor)

if ($typeIndex -lt 0) {
    throw "BrainPayload perdu pendant la preparation."
}

$typeOpen = $newContent.IndexOf("{", $typeIndex)

if ($typeOpen -lt 0) {
    throw "Ouverture BrainPayload introuvable."
}

$typeClose = Find-MatchingBrace `
    -Text $newContent `
    -OpenIndex $typeOpen

if ($typeClose -lt 0) {
    throw "Fin BrainPayload introuvable."
}

$brainPayloadSection = $newContent.Substring(
    $typeOpen,
    $typeClose - $typeOpen + 1
)

if ($brainPayloadSection.Contains("readiness: BrainReadinessPayload;")) {
    throw "BrainPayload contient deja readiness sans marqueur 12.61."
}

$readinessProperty =
    "  readiness: BrainReadinessPayload;" +
    $newLine

$newContent =
    $newContent.Substring(0, $typeClose) +
    $readinessProperty +
    $newContent.Substring($typeClose)

# --------------------------------------------------
# 3. Ajouter le builder readiness avant buildReply
# --------------------------------------------------

$buildReplyIndex = $newContent.IndexOf("function buildReply(")

if ($buildReplyIndex -lt 0) {
    throw "buildReply introuvable. Aucun fichier modifie."
}

$helperLines = @(
    "// KLYX_RESPONSE_METADATA_12_61"
    "function buildReadinessPayload("
    "  context: BrainContext,"
    "  missing: string[]"
    "): BrainReadinessPayload {"
    "  const remainingCount = missing.length;"
    "  const score = Math.round("
    "    ((4 - remainingCount) / 4) * 100"
    "  );"
    ""
    "  const label ="
    "    score === 100"
    '      ? "Demande complète"'
    "      : score >= 75"
    '        ? "Presque prête"'
    "        : score >= 50"
    '          ? "Demande en cours"'
    '          : "Je précise ton besoin";'
    ""
    "  const isComplete = score === 100;"
    "  const nextMissing = missing[0] ?? null;"
    ""
    "  const summary ="
    "    isComplete &&"
    "    context.serviceSlug &&"
    "    context.city &&"
    "    context.date &&"
    "    context.time"
    "      ? {"
    "          service: context.serviceSlug,"
    "          city: context.city,"
    "          date: context.date,"
    "          time: context.time,"
    "        }"
    "      : null;"
    ""
    "  return {"
    "    score,"
    "    label,"
    "    isComplete,"
    "    remainingCount,"
    "    missing: [...missing],"
    "    nextMissing,"
    "    nextStep: isComplete"
    '      ? "confirm_request"'
    '      : "collect_missing_information",'
    "    requiresConfirmation: isComplete,"
    "    confirmationState: isComplete"
    '      ? "awaiting_user_confirmation"'
    '      : "not_ready",'
    "    confirmationOptions: isComplete"
    "      ? ["
    "          {"
    '            id: "confirm",'
    '            action: "confirm_request",'
    '            label: "Confirmer",'
    "          },"
    "          {"
    '            id: "edit",'
    '            action: "edit_request",'
    '            label: "Modifier",'
    "          },"
    "        ]"
    "      : [],"
    "    summary,"
    "    automaticExecutionAllowed: false,"
    "  };"
    "}"
    ""
)

$helperBlock = [string]::Join(
    $newLine,
    $helperLines
)

$newContent =
    $newContent.Substring(0, $buildReplyIndex) +
    $helperBlock +
    $newContent.Substring($buildReplyIndex)

# --------------------------------------------------
# 4. Calculer readiness dans POST
# --------------------------------------------------

$payloadAnchor = "const payload: BrainPayload = {"
$payloadIndex = $newContent.IndexOf($payloadAnchor)

if ($payloadIndex -lt 0) {
    throw "Creation du payload API introuvable."
}

$payloadLineStart = $newContent.LastIndexOf(
    "`n",
    $payloadIndex
)

if ($payloadLineStart -lt 0) {
    $payloadLineStart = 0
}
else {
    $payloadLineStart++
}

$payloadPrefix = $newContent.Substring(
    $payloadLineStart,
    $payloadIndex - $payloadLineStart
)

$indent = ""

foreach ($char in $payloadPrefix.ToCharArray()) {
    if ($char -eq " " -or $char -eq "`t") {
        $indent += $char
    }
    else {
        break
    }
}

$readinessLines = @(
    ($indent + "const readiness = buildReadinessPayload(")
    ($indent + "  context,")
    ($indent + "  missing")
    ($indent + ");")
    ""
)

$readinessBlock = [string]::Join(
    $newLine,
    $readinessLines
)

$newContent =
    $newContent.Substring(0, $payloadIndex) +
    $readinessBlock +
    $newContent.Substring($payloadIndex)

# --------------------------------------------------
# 5. Ajouter readiness dans l'objet payload
# --------------------------------------------------

$payloadIndex = $newContent.IndexOf($payloadAnchor)

if ($payloadIndex -lt 0) {
    throw "Payload perdu apres insertion readiness."
}

$payloadOpen = $newContent.IndexOf("{", $payloadIndex)

if ($payloadOpen -lt 0) {
    throw "Ouverture payload introuvable."
}

$payloadClose = Find-MatchingBrace `
    -Text $newContent `
    -OpenIndex $payloadOpen

if ($payloadClose -lt 0) {
    throw "Fin payload introuvable."
}

$payloadSection = $newContent.Substring(
    $payloadOpen,
    $payloadClose - $payloadOpen + 1
)

if ($payloadSection.Contains("readiness,")) {
    throw "Payload contient deja readiness sans marqueur 12.61."
}

$payloadProperty =
    $indent +
    "  readiness," +
    $newLine

$newContent =
    $newContent.Substring(0, $payloadClose) +
    $payloadProperty +
    $newContent.Substring($payloadClose)

# --------------------------------------------------
# Verification avant ecriture
# --------------------------------------------------

$requiredChecks = @(
    "KLYX_RESPONSE_METADATA_12_61",
    "type BrainReadinessPayload = {",
    "readiness: BrainReadinessPayload;",
    "function buildReadinessPayload(",
    "const readiness = buildReadinessPayload(",
    "automaticExecutionAllowed: false;"
)

foreach ($check in $requiredChecks) {
    if (-not $newContent.Contains($check)) {
        throw "Verification avant ecriture echouee : $check"
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$targetPath.bak-12-61b-$timestamp"

Copy-Item `
    -LiteralPath $targetPath `
    -Destination $backupPath `
    -Force

Write-Host "Sauvegarde : $backupPath"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

try {
    [System.IO.File]::WriteAllText(
        $targetPath,
        $newContent,
        $utf8NoBom
    )

    $verification = [System.IO.File]::ReadAllText(
        $targetPath
    )

    foreach ($check in $requiredChecks) {
        if (-not $verification.Contains($check)) {
            throw "Verification apres ecriture echouee : $check"
        }
    }
}
catch {
    Write-Host ""
    Write-Host "Erreur pendant 12.61b."
    Write-Host "Restauration automatique..."

    if (Test-Path -LiteralPath $backupPath) {
        Copy-Item `
            -LiteralPath $backupPath `
            -Destination $targetPath `
            -Force
    }

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.61 Brain Response Metadata ajoute."
Write-Host "OK - readiness stocke dans payload."
Write-Host "OK - score et progression exposes."
Write-Host "OK - confirmationOptions exposees."
Write-Host "OK - aucune execution automatique ajoutee."
Write-Host ""