$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$routePath =
    Join-Path `
        $root `
        "app\api\brain\respond\route.ts"

$backupPath =
    $routePath + ".bak"

if (
    -not (
        Test-Path `
            -LiteralPath `
            $routePath `
            -PathType Leaf
    )
) {
    throw "13.55 : route Brain introuvable."
}

$source =
    [System.IO.File]::ReadAllText(
        $routePath
    )

if (
    [string]::IsNullOrWhiteSpace(
        $source
    )
) {
    throw "13.55 : route Brain vide."
}

if (
    $source.Contains(
        "KLYX_LLM_SHADOW_13_55"
    ) -and
    $source.Contains(
        "await runKlyxLlmShadow"
    )
) {
    Write-Host "13.55 deja applique."
    exit 0
}

# ============================================================
# BACKUP ORIGINAL
# ============================================================

if (
    -not (
        Test-Path `
            -LiteralPath `
            $backupPath `
            -PathType Leaf
    )
) {
    Copy-Item `
        -LiteralPath `
        $routePath `
        -Destination `
        $backupPath

    Write-Host "Backup cree : route.ts.bak"
}

# ============================================================
# LOCATE POST()
# ============================================================

$postAnchor =
    "export async function POST"

$postIndex =
    $source.IndexOf(
        $postAnchor,
        [System.StringComparison]::Ordinal
    )

if (
    $postIndex -lt 0
) {
    throw "13.55 : fonction POST introuvable."
}

# ============================================================
# IMPORT
# ============================================================

if (
    -not $source.Contains(
        'from "@/lib/brain/llm/shadow"'
    )
) {
    $supabaseImport =
        'import { supabaseAdmin } from "@/lib/supabase-admin";'

    $importIndex =
        $source.IndexOf(
            $supabaseImport,
            [System.StringComparison]::Ordinal
        )

    if (
        $importIndex -lt 0
    ) {
        throw "13.55 : import supabaseAdmin introuvable."
    }

    $importReplacement =
        'import { supabaseAdmin } from "@/lib/supabase-admin";' +
        [Environment]::NewLine +
        'import {' +
        [Environment]::NewLine +
        '  runKlyxLlmShadow,' +
        [Environment]::NewLine +
        '  type KlyxLlmShadowResult,' +
        [Environment]::NewLine +
        '} from "@/lib/brain/llm/shadow";'

    $source =
        $source.Remove(
            $importIndex,
            $supabaseImport.Length
        ).Insert(
            $importIndex,
            $importReplacement
        )
}

# ============================================================
# BRAIN PAYLOAD TYPE
# ============================================================

if (
    -not $source.Contains(
        "llmShadow?: KlyxLlmShadowResult"
    )
) {
    $typePattern =
        '(?s)type\s+BrainPayload\s*=\s*BrainContext\s*&\s*\{.*?\};'

    $typeHit =
        [regex]::Match(
            $source,
            $typePattern
        )

    if (
        -not $typeHit.Success
    ) {
        throw "13.55 : type BrainPayload introuvable."
    }

    $typeBlock =
        $typeHit.Value

    $closeIndex =
        $typeBlock.LastIndexOf(
            "};",
            [System.StringComparison]::Ordinal
        )

    if (
        $closeIndex -lt 0
    ) {
        throw "13.55 : fermeture BrainPayload introuvable."
    }

    $addition =
        [Environment]::NewLine +
        [Environment]::NewLine +
        "  // KLYX_LLM_SHADOW_13_55" +
        [Environment]::NewLine +
        "  llmShadow?: KlyxLlmShadowResult;" +
        [Environment]::NewLine

    $newTypeBlock =
        $typeBlock.Insert(
            $closeIndex,
            $addition
        )

    $source =
        $source.Remove(
            $typeHit.Index,
            $typeHit.Length
        ).Insert(
            $typeHit.Index,
            $newTypeBlock
        )
}

# Recalculate POST location because source length changed.
$postIndex =
    $source.IndexOf(
        $postAnchor,
        [System.StringComparison]::Ordinal
    )

# ============================================================
# FIND buildMissingFields INSIDE POST
# ============================================================

$missingCallIndex =
    $source.IndexOf(
        "buildMissingFields(",
        $postIndex,
        [System.StringComparison]::Ordinal
    )

if (
    $missingCallIndex -lt 0
) {
    throw "13.55 : appel buildMissingFields absent dans POST."
}

# Go back to beginning of the statement line.
$logicStart =
    $source.LastIndexOf(
        [char]10,
        $missingCallIndex
    )

if (
    $logicStart -lt 0
) {
    $logicStart =
        $missingCallIndex
}

if (
    $logicStart -ge 0
) {
    $logicStart += 1
}

# ============================================================
# FIND FIRST MESSAGE INSERT AFTER THAT POINT
# ============================================================

$insertIndex =
    $source.IndexOf(
        "await insertBrainMessage(",
        $missingCallIndex,
        [System.StringComparison]::Ordinal
    )

if (
    $insertIndex -lt 0
) {
    throw "13.55 : insertBrainMessage introuvable apres analyse Brain."
}

$logicEnd =
    $source.LastIndexOf(
        [char]10,
        $insertIndex
    )

if (
    $logicEnd -lt
    $logicStart
) {
    throw "13.55 : bornes de remplacement invalides."
}

$existingSection =
    $source.Substring(
        $logicStart,
        $logicEnd - $logicStart
    )

# ============================================================
# SAFETY: EXPECT ESSENTIAL BRAIN OPERATIONS
# ============================================================

if (
    -not $existingSection.Contains(
        "buildMissingFields"
    )
) {
    throw "13.55 : buildMissingFields hors zone."
}

if (
    -not $existingSection.Contains(
        "buildReply"
    )
) {
    throw "13.55 : buildReply absent de la zone Brain."
}

if (
    -not $existingSection.Contains(
        "buildReadinessPayload"
    )
) {
    throw "13.55 : buildReadinessPayload absent de la zone Brain."
}

# ============================================================
# REBUILD CONTROLLED SECTION
# ============================================================

$newLogic =
    @(
        "    const missing = buildMissingFields(context);",
        "    const ready = missing.length === 0;",
        "",
        "    // Deterministic Brain remains authoritative.",
        "    const reply = buildReply(",
        "      context,",
        "      missing",
        "    );",
        "",
        "    const readiness = buildReadinessPayload(",
        "      context,",
        "      missing",
        "    );",
        "",
        "    // KLYX_LLM_SHADOW_13_55",
        "    // Internal comparison only.",
        "    // LLM output never replaces the user-visible deterministic reply.",
        "    const llmShadow = await runKlyxLlmShadow({",
        "      message,",
        "      deterministicReply: reply,",
        "      context: {",
        "        serviceSlug: context.serviceSlug,",
        "        city: context.city,",
        "        date: context.date,",
        "        time: context.time,",
        "        budget: context.budget,",
        "        memoryUsed: context.memoryUsed,",
        "      },",
        "    });",
        "",
        "    const payload: BrainPayload = {",
        "      ...context,",
        "      missing,",
        "      ready,",
        "      readiness,",
        "      llmShadow,",
        "    };",
        ""
    ) -join [Environment]::NewLine

$source =
    $source.Remove(
        $logicStart,
        $logicEnd - $logicStart
    ).Insert(
        $logicStart,
        $newLogic
    )

# ============================================================
# FINAL SAFETY VALIDATION
# ============================================================

$required =
    @(
        "KLYX_LLM_SHADOW_13_55",
        'from "@/lib/brain/llm/shadow"',
        "type KlyxLlmShadowResult",
        "llmShadow?: KlyxLlmShadowResult",
        "const missing = buildMissingFields(context)",
        "const reply = buildReply",
        "const readiness = buildReadinessPayload",
        "await runKlyxLlmShadow",
        "deterministicReply: reply",
        "llmShadow,",
        "await insertBrainMessage("
    )

foreach (
    $needle
    in $required
) {
    if (
        -not $source.Contains(
            $needle
        )
    ) {
        throw (
            "13.55 : validation finale echouee : " +
            $needle
        )
    }
}

if (
    $source.Contains(
        "reply: llmShadow"
    )
) {
    throw "13.55 : shadow tente de remplacer reply."
}

if (
    $source.Contains(
        "reply = llmShadow"
    )
) {
    throw "13.55 : shadow tente de remplacer reply."
}

# ============================================================
# WRITE
# ============================================================

[System.IO.File]::WriteAllText(
    $routePath,
    $source,
    $utf8
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.55 PATCH OK"
Write-Host "======================================"
Write-Host "POST function : FOUND"
Write-Host "buildMissingFields : FOUND"
Write-Host "buildReply : PRESERVED"
Write-Host "buildReadinessPayload : PRESERVED"
Write-Host "LLM shadow : INSERTED"
Write-Host "User reply authority : DETERMINISTIC"
Write-Host "Backup : route.ts.bak"
Write-Host "======================================"