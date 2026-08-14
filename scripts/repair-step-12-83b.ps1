$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$brainPath =
    Join-Path `
        $root `
        "app\brain\page.tsx"

$respondPath =
    Join-Path `
        $root `
        "app\api\brain\respond\route.ts"

foreach ($path in @(
    $brainPath,
    $respondPath
)) {
    if (-not (
        Test-Path -LiteralPath $path
    )) {
        throw "Fichier introuvable : $path"
    }
}

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

Copy-Item `
    -LiteralPath $brainPath `
    -Destination (
        $brainPath +
        ".bak-12-83b-" +
        $timestamp
    ) `
    -Force

Copy-Item `
    -LiteralPath $respondPath `
    -Destination (
        $respondPath +
        ".bak-12-83b-" +
        $timestamp
    ) `
    -Force

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$brain =
    [System.IO.File]::ReadAllText(
        $brainPath
    )

# ============================================================
# 1. TYPES MULTI SLOT
# ============================================================

if (
    -not $brain.Contains(
        "type BrainMultiSlotSchedule ="
    )
) {
    $anchor =
        "type BrainPayload = {"

    if (
        -not $brain.Contains(
            $anchor
        )
    ) {
        throw "BrainPayload introuvable."
    }

    $typeLines = @(
        'type BrainSlot = {'
        '  date: string;'
        '  startTime: string | null;'
        '  endTime: string | null;'
        '  budget: number | null;'
        '};'
        ''
        'type BrainMultiSlotSchedule = {'
        '  multiSlot: true;'
        '  slots: BrainSlot[];'
        '  needsExactTimes: boolean;'
        '  readyForMatching: boolean;'
        '};'
        ''
    )

    $types =
        [string]::Join(
            "`n",
            $typeLines
        )

    $brain =
        $brain.Replace(
            $anchor,
            $types +
            "`n" +
            $anchor
        )
}

# ============================================================
# 2. SCHEDULE DANS BrainPayload
# ============================================================

if (
    -not $brain.Contains(
        "schedule?: BrainMultiSlotSchedule | null;"
    )
) {
    $payloadStart =
        $brain.IndexOf(
            "type BrainPayload = {"
        )

    if (
        $payloadStart -lt 0
    ) {
        throw "Debut BrainPayload introuvable."
    }

    $payloadEnd =
        $brain.IndexOf(
            "};",
            $payloadStart
        )

    if (
        $payloadEnd -lt 0
    ) {
        throw "Fin BrainPayload introuvable."
    }

    $brain =
        $brain.Insert(
            $payloadEnd,
            "  schedule?: BrainMultiSlotSchedule | null;`n"
        )
}

# ============================================================
# 3. NE PAS ECRASER LE MULTI SLOT COTE CLIENT
# ============================================================

if (
    -not $brain.Contains(
        "KLYX_MULTI_SLOT_BRAIN_UI_12_83"
    )
) {
    $needle =
        "  if (!payload) return null;"

    if (
        -not $brain.Contains(
            $needle
        )
    ) {
        throw "Ancre mergeLocalUnderstanding introuvable."
    }

    $insertLines = @(
        '  // KLYX_MULTI_SLOT_BRAIN_UI_12_83'
        '  if (payload.schedule?.multiSlot) {'
        '    return payload;'
        '  }'
    )

    $insert =
        [string]::Join(
            "`n",
            $insertLines
        )

    $brain =
        $brain.Replace(
            $needle,
            $needle +
            "`n`n" +
            $insert
        )
}

# ============================================================
# 4. REPONSE NATURELLE : GARDER LE RESUME MULTI SLOT
# ============================================================

if (
    -not $brain.Contains(
        "understoodPayload?.schedule?.multiSlot"
    )
) {
    $pattern =
        '(?ms)      let finalReply =\r?\n' +
        '        understoodPayload\?\.ready\r?\n' +
        '          \? buildNaturalConfirmation\(understoodPayload\)\r?\n' +
        '          : structuredResult\.reply;'

    $matches =
        [regex]::Matches(
            $brain,
            $pattern
        )

    if (
        $matches.Count -ne 1
    ) {
        throw "Bloc finalReply introuvable ou ambigu."
    }

    $replacementLines = @(
        '      let finalReply ='
        '        understoodPayload?.schedule?.multiSlot'
        '          ? structuredResult.reply'
        '          : understoodPayload?.ready'
        '            ? buildNaturalConfirmation(understoodPayload)'
        '            : structuredResult.reply;'
    )

    $replacement =
        [string]::Join(
            "`n",
            $replacementLines
        )

    $brain =
        [regex]::Replace(
            $brain,
            $pattern,
            $replacement
        )
}

# ============================================================
# 5. ENVOYER LE SCHEDULE LORS DE LA CONFIRMATION
# ============================================================

if (
    -not $brain.Contains(
        "schedule: payload.schedule ?? null,"
    )
) {
    $needle =
        "            budget: payload.budget,"

    if (
        -not $brain.Contains(
            $needle
        )
    ) {
        throw "Ancre confirmation budget introuvable."
    }

    $brain =
        $brain.Replace(
            $needle,
            $needle +
            "`n" +
            "            schedule: payload.schedule ?? null,"
        )
}

# ============================================================
# 6. REDIRECTION MULTI SLOT
# ============================================================

if (
    -not $brain.Contains(
        "KLYX_MULTI_SLOT_OPEN_RESULTS_12_83"
    )
) {
    $functionIndex =
        $brain.IndexOf(
            "function openResults"
        )

    if (
        $functionIndex -lt 0
    ) {
        throw "Fonction openResults introuvable."
    }

    $needle =
        "    const params = new URLSearchParams();"

    $paramsIndex =
        $brain.IndexOf(
            $needle,
            $functionIndex
        )

    if (
        $paramsIndex -lt 0
    ) {
        throw "URLSearchParams openResults introuvable."
    }

    $insertAt =
        $paramsIndex +
        $needle.Length

    $branchLines = @(
        ''
        ''
        '    // KLYX_MULTI_SLOT_OPEN_RESULTS_12_83'
        '    if (payload.schedule?.multiSlot) {'
        '      if (payload.serviceSlug) {'
        '        params.set("service", payload.serviceSlug);'
        '      }'
        ''
        '      if (payload.city) {'
        '        params.set("city", payload.city);'
        '      }'
        ''
        '      params.set('
        '        "schedule",'
        '        JSON.stringify(payload.schedule)'
        '      );'
        ''
        '      if (conversationId) {'
        '        params.set("conversationId", conversationId);'
        '      }'
        ''
        '      if (confirmationId) {'
        '        params.set("confirmationId", confirmationId);'
        '      }'
        ''
        '      router.push('
        '        "/request/confirm-multi?" +'
        '          params.toString()'
        '      );'
        '      return;'
        '    }'
    )

    $branch =
        [string]::Join(
            "`n",
            $branchLines
        )

    $brain =
        $brain.Insert(
            $insertAt,
            $branch
        )
}

# ============================================================
# 7. RETIRER LE BLOCAGE TEMPORAIRE 12.82
# ============================================================

$respond =
    [System.IO.File]::ReadAllText(
        $respondPath
    )

if (
    $respond.Contains(
        '"publication_multi_creneaux"'
    )
) {
    $markerIndex =
        $respond.IndexOf(
            '"publication_multi_creneaux"'
        )

    $blockStart =
        $respond.LastIndexOf(
            "    // IMPORTANT:",
            $markerIndex
        )

    if (
        $blockStart -lt 0
    ) {
        throw "Debut bloc temporaire 12.82 introuvable."
    }

    $readyIndex =
        $respond.IndexOf(
            "    const ready",
            $markerIndex
        )

    if (
        $readyIndex -lt 0
    ) {
        throw "Bloc ready introuvable apres 12.82."
    }

    $respond =
        $respond.Remove(
            $blockStart,
            $readyIndex -
            $blockStart
        )
}

# ============================================================
# 8. MARQUEUR READINESS 12.83
# ============================================================

if (
    -not $respond.Contains(
        "KLYX_MULTI_SLOT_PUBLISH_READY_12_83"
    )
) {
    $readyIndex =
        $respond.IndexOf(
            "    const ready"
        )

    if (
        $readyIndex -lt 0
    ) {
        throw "const ready introuvable."
    }

    $respond =
        $respond.Insert(
            $readyIndex,
            "    // KLYX_MULTI_SLOT_PUBLISH_READY_12_83`n"
        )
}

# ============================================================
# VALIDATION
# ============================================================

$checks = @(
    @{
        Name = "Brain schedule type"
        Value = $brain.Contains(
            "type BrainMultiSlotSchedule ="
        )
    },
    @{
        Name = "Brain payload schedule"
        Value = $brain.Contains(
            "schedule?: BrainMultiSlotSchedule | null;"
        )
    },
    @{
        Name = "Brain multi marker"
        Value = $brain.Contains(
            "KLYX_MULTI_SLOT_BRAIN_UI_12_83"
        )
    },
    @{
        Name = "Confirmation schedule"
        Value = $brain.Contains(
            "schedule: payload.schedule ?? null,"
        )
    },
    @{
        Name = "Multi results route"
        Value = $brain.Contains(
            "/request/confirm-multi?"
        )
    },
    @{
        Name = "Multi reply preserved"
        Value = $brain.Contains(
            "understoodPayload?.schedule?.multiSlot"
        )
    },
    @{
        Name = "Old blocker removed"
        Value = -not $respond.Contains(
            '"publication_multi_creneaux"'
        )
    },
    @{
        Name = "12.83 readiness"
        Value = $respond.Contains(
            "KLYX_MULTI_SLOT_PUBLISH_READY_12_83"
        )
    }
)

foreach ($check in $checks) {
    if ($check.Value) {
        Write-Host "[OK]   $($check.Name)"
    }
    else {
        throw "12.83b FAILED : $($check.Name)"
    }
}

[System.IO.File]::WriteAllText(
    $brainPath,
    $brain,
    $utf8
)

[System.IO.File]::WriteAllText(
    $respondPath,
    $respond,
    $utf8
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.83b REPAIR OK"
Write-Host "======================================"
Write-Host "Brain multi-creneaux : OK"
Write-Host "Confirmation multi : OK"
Write-Host "Redirection multi : OK"
Write-Host "Blocage temporaire 12.82 retire : OK"
Write-Host ""