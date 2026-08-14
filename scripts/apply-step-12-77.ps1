$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$phoneApiPath = Join-Path `
    $projectRoot `
    "app\api\profile\phone\route.ts"

$phoneUiPath = Join-Path `
    $projectRoot `
    "app\settings\PhoneSettingsInline.tsx"

Write-Host ""
Write-Host "KLYX 12.77 - FINAL PHONE CONSOLIDATION"
Write-Host ""

foreach ($path in @(
    $phoneApiPath,
    $phoneUiPath
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Fichier introuvable : $path"
    }
}

$utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

# ============================================================
# FINAL PHONE API
# - preserve privacy
# - preserve verification if same phone
# - reset verification only when phone actually changes
# ============================================================

$apiLines = @(
'import { NextResponse } from "next/server";'
'import { supabaseAdmin } from "@/lib/supabase-admin";'
'import {'
'  apiErrorStatus,'
'  getAuthenticatedProfile,'
'} from "@/lib/api-auth";'
''
'// KLYX_PHONE_FINAL_12_77'
''
'type PhoneBody = {'
'  phoneNumber?: string | null;'
'};'
''
'type Visibility ='
'  | "private"'
'  | "transaction_participants";'
''
'type PhoneRow = {'
'  phone_number: string | null;'
'  phone_verified_at: string | null;'
'  phone_visibility: string | null;'
'};'
''
'function normalizePhone('
'  value: string | null | undefined'
'): string | null {'
'  if (value == null) return null;'
''
'  let cleaned = value'
'    .trim()'
'    .replace(/[()\s.\-]/g, "");'
''
'  if (!cleaned) return null;'
''
'  if (cleaned.startsWith("00")) {'
'    cleaned = "+" + cleaned.slice(2);'
'  }'
''
'  return cleaned;'
'}'
''
'function normalizeVisibility('
'  value: string | null | undefined'
'): Visibility {'
'  return value === "private"'
'    ? "private"'
'    : "transaction_participants";'
'}'
''
'function isValidInternationalPhone('
'  value: string'
') {'
'  return /^\+[1-9]\d{7,14}$/.test(value);'
'}'
''
'export async function GET(request: Request) {'
'  try {'
'    const { profile } ='
'      await getAuthenticatedProfile(request);'
''
'    const { data, error } ='
'      await supabaseAdmin'
'        .from("profiles")'
'        .select('
'          "phone_number, phone_verified_at, phone_visibility"'
'        )'
'        .eq("id", profile.id)'
'        .single();'
''
'    if (error) {'
'      throw new Error(error.message);'
'    }'
''
'    const row = data as PhoneRow;'
''
'    return NextResponse.json({'
'      phoneNumber: row.phone_number,'
'      verified: Boolean('
'        row.phone_verified_at'
'      ),'
'      verifiedAt:'
'        row.phone_verified_at,'
'      visibility:'
'        normalizeVisibility('
'          row.phone_visibility'
'        ),'
'    });'
'  } catch (error) {'
'    const message ='
'      error instanceof Error'
'        ? error.message'
'        : "Telephone KLYX indisponible.";'
''
'    return NextResponse.json('
'      { error: message },'
'      { status: apiErrorStatus(message) }'
'    );'
'  }'
'}'
''
'export async function PUT(request: Request) {'
'  try {'
'    const { profile } ='
'      await getAuthenticatedProfile(request);'
''
'    const body ='
'      (await request.json()) as PhoneBody;'
''
'    const phoneNumber ='
'      normalizePhone(body.phoneNumber);'
''
'    if ('
'      phoneNumber &&'
'      !isValidInternationalPhone(phoneNumber)'
'    ) {'
'      return NextResponse.json('
'        {'
'          error:'
'            "Utilise un numero international, par exemple +32471503513.",'
'        },'
'        { status: 400 }'
'      );'
'    }'
''
'    const {'
'      data: currentData,'
'      error: currentError,'
'    } = await supabaseAdmin'
'      .from("profiles")'
'      .select('
'        "phone_number, phone_verified_at, phone_visibility"'
'      )'
'      .eq("id", profile.id)'
'      .single();'
''
'    if (currentError) {'
'      throw new Error('
'        currentError.message'
'      );'
'    }'
''
'    const current ='
'      currentData as PhoneRow;'
''
'    const previousPhone ='
'      normalizePhone('
'        current.phone_number'
'      );'
''
'    const phoneChanged ='
'      previousPhone !== phoneNumber;'
''
'    const visibility ='
'      normalizeVisibility('
'        current.phone_visibility'
'      );'
''
'    const updatePayload: {'
'      phone_number: string | null;'
'      phone_visibility: Visibility;'
'      phone_verified_at?: null;'
'    } = {'
'      phone_number: phoneNumber,'
'      phone_visibility: visibility,'
'    };'
''
'    if (phoneChanged) {'
'      updatePayload.phone_verified_at = null;'
'    }'
''
'    const { data, error } ='
'      await supabaseAdmin'
'        .from("profiles")'
'        .update(updatePayload)'
'        .eq("id", profile.id)'
'        .select('
'          "phone_number, phone_verified_at, phone_visibility"'
'        )'
'        .single();'
''
'    if (error) {'
'      throw new Error(error.message);'
'    }'
''
'    const row = data as PhoneRow;'
''
'    return NextResponse.json({'
'      saved: true,'
'      phoneChanged,'
'      phoneNumber: row.phone_number,'
'      verified: Boolean('
'        row.phone_verified_at'
'      ),'
'      verifiedAt:'
'        row.phone_verified_at,'
'      visibility:'
'        normalizeVisibility('
'          row.phone_visibility'
'        ),'
'    });'
'  } catch (error) {'
'    const message ='
'      error instanceof Error'
'        ? error.message'
'        : "Enregistrement du telephone impossible.";'
''
'    return NextResponse.json('
'      { error: message },'
'      { status: apiErrorStatus(message) }'
'    );'
'  }'
'}'
)

$apiContent =
    [string]::Join(
        "`n",
        $apiLines
    )

# ============================================================
# FINAL PHONE UI SMALL CONSOLIDATION
# Prevent verified badge on an unsaved edited phone
# ============================================================

$phoneUi =
    [System.IO.File]::ReadAllText(
        $phoneUiPath
    )

$uiMarker =
    "KLYX_PHONE_FINAL_UI_12_77"

if (-not $phoneUi.Contains($uiMarker)) {

    $unsavedAnchor =
        "  const unsaved = phoneNumber !== savedPhone;"

    if (-not $phoneUi.Contains(
        $unsavedAnchor
    )) {
        throw "Ancre unsaved PhoneSettingsInline introuvable."
    }

    $replacementLines = @(
        "  const unsaved = phoneNumber !== savedPhone;"
        "  const displayVerified = verified && !unsaved;"
        ""
        "  // KLYX_PHONE_FINAL_UI_12_77"
    )

    $replacement =
        [string]::Join(
            "`n",
            $replacementLines
        )

    $phoneUi =
        $phoneUi.Replace(
            $unsavedAnchor,
            $replacement
        )

    $phoneUi =
        $phoneUi.Replace(
            "{verified ? (",
            "{displayVerified ? ("
        )

    $phoneUi =
        $phoneUi.Replace(
            "{verified && (",
            "{displayVerified && ("
        )
}

# ============================================================
# VALIDATION BEFORE WRITE
# ============================================================

$checks = @(
    @{
        Name = "final API marker"
        Value = $apiContent.Contains(
            "KLYX_PHONE_FINAL_12_77"
        )
    },
    @{
        Name = "detect actual phone change"
        Value = $apiContent.Contains(
            "const phoneChanged ="
        )
    },
    @{
        Name = "preserve privacy"
        Value = $apiContent.Contains(
            "phone_visibility: visibility"
        )
    },
    @{
        Name = "conditional verification reset"
        Value =
            $apiContent.Contains(
                "if (phoneChanged)"
            ) -and
            $apiContent.Contains(
                "updatePayload.phone_verified_at = null"
            )
    },
    @{
        Name = "final UI marker"
        Value = $phoneUi.Contains(
            "KLYX_PHONE_FINAL_UI_12_77"
        )
    },
    @{
        Name = "verified display safe"
        Value = $phoneUi.Contains(
            "displayVerified = verified && !unsaved"
        )
    }
)

foreach ($check in $checks) {
    if (-not $check.Value) {
        throw "12.77 validation failed : $($check.Name)"
    }
}

# ============================================================
# BACKUPS
# ============================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

foreach ($path in @(
    $phoneApiPath,
    $phoneUiPath
)) {
    Copy-Item `
        -LiteralPath $path `
        -Destination (
            $path +
            ".bak-12-77-" +
            $timestamp
        ) `
        -Force
}

# ============================================================
# WRITE
# ============================================================

[System.IO.File]::WriteAllText(
    $phoneApiPath,
    $apiContent,
    $utf8NoBom
)

[System.IO.File]::WriteAllText(
    $phoneUiPath,
    $phoneUi,
    $utf8NoBom
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.77 APPLIQUE"
Write-Host "======================================"
Write-Host "Verification preservee si meme numero."
Write-Host "Confidentialite preservee."
Write-Host "Badge verification consolide."
Write-Host "Partie telephone gelee apres ce step."
Write-Host ""