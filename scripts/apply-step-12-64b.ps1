$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$apiPath = Join-Path `
    $projectRoot `
    "app\api\brain\confirm-request\route.ts"

$confirmPagePath = Join-Path `
    $projectRoot `
    "app\request\confirm\page.tsx"

$pageCandidates = @(
    (Join-Path $projectRoot "app\assistant\page.tsx"),
    (Join-Path $projectRoot "app\brain\page.tsx")
)

$assistantPath = $null

foreach ($candidate in $pageCandidates) {
    if (-not (Test-Path -LiteralPath $candidate)) {
        continue
    }

    $candidateContent =
        [System.IO.File]::ReadAllText($candidate)

    if ($candidateContent.Contains(
        "KLYX_EXPLICIT_CONFIRMATION_12_63"
    )) {
        $assistantPath = $candidate
        break
    }
}

Write-Host ""
Write-Host "KLYX 12.64b - Confirmation Proof Propagation"
Write-Host ""

if (-not $assistantPath) {
    throw "Interface KLYX 12.63 introuvable."
}

if (-not (Test-Path -LiteralPath $apiPath)) {
    throw "API confirm-request introuvable."
}

if (-not (Test-Path -LiteralPath $confirmPagePath)) {
    throw "request/confirm introuvable."
}

$assistant =
    [System.IO.File]::ReadAllText($assistantPath)

$confirmPage =
    [System.IO.File]::ReadAllText($confirmPagePath)

$existingApi =
    [System.IO.File]::ReadAllText($apiPath)

if (-not $existingApi.Contains(
    "KLYX_CONFIRM_REQUEST_API_12_63"
)) {
    throw "API KLYX 12.63 attendue introuvable."
}

$marker = "KLYX_CONFIRMATION_PROOF_12_64"

if (
    $assistant.Contains($marker) -and
    $confirmPage.Contains($marker) -and
    $existingApi.Contains($marker)
) {
    Write-Host "KLYX 12.64 est deja present."
    exit 0
}

$newLine = if ($assistant.Contains("`r`n")) {
    "`r`n"
}
else {
    "`n"
}

# ============================================================
# 1. REECRITURE SURE DE L'API 12.63 -> 12.64
# ============================================================

$routeLines = @(
    'import { NextResponse } from "next/server";'
    'import { supabaseAdmin } from "@/lib/supabase-admin";'
    'import {'
    '  apiErrorStatus,'
    '  getAuthenticatedProfile,'
    '  requireAccountType,'
    '} from "@/lib/api-auth";'
    ''
    '// KLYX_CONFIRM_REQUEST_API_12_63'
    '// KLYX_CONFIRMATION_PROOF_12_64'
    ''
    'type ConfirmedRequestInput = {'
    '  serviceSlug?: string | null;'
    '  city?: string | null;'
    '  date?: string | null;'
    '  time?: string | null;'
    '  budget?: number | null;'
    '};'
    ''
    'type ConfirmRequestBody = {'
    '  conversationId?: string;'
    '  request?: ConfirmedRequestInput;'
    '};'
    ''
    'type ConfirmationMessageRow = {'
    '  id: string;'
    '};'
    ''
    'function cleanText('
    '  value: string | null | undefined'
    '): string {'
    '  return value?.trim() ?? "";'
    '}'
    ''
    'export async function POST(request: Request) {'
    '  try {'
    '    const { profile } ='
    '      await getAuthenticatedProfile(request);'
    ''
    '    requireAccountType(profile, "client");'
    ''
    '    const body ='
    '      (await request.json()) as ConfirmRequestBody;'
    ''
    '    const conversationId ='
    '      cleanText(body.conversationId);'
    ''
    '    if (!conversationId) {'
    '      return NextResponse.json('
    '        { error: "Conversation KLYX manquante." },'
    '        { status: 400 }'
    '      );'
    '    }'
    ''
    '    const serviceSlug ='
    '      cleanText(body.request?.serviceSlug);'
    ''
    '    const city ='
    '      cleanText(body.request?.city);'
    ''
    '    const date ='
    '      cleanText(body.request?.date);'
    ''
    '    const time ='
    '      cleanText(body.request?.time);'
    ''
    '    const budget ='
    '      body.request?.budget == null'
    '        ? null'
    '        : Number(body.request.budget);'
    ''
    '    if (!serviceSlug || !city || !date || !time) {'
    '      return NextResponse.json('
    '        {'
    '          error:'
    '            "La demande doit être complète avant confirmation.",'
    '        },'
    '        { status: 400 }'
    '      );'
    '    }'
    ''
    '    if ('
    '      budget != null &&'
    '      (!Number.isFinite(budget) || budget < 0)'
    '    ) {'
    '      return NextResponse.json('
    '        { error: "Budget invalide." },'
    '        { status: 400 }'
    '      );'
    '    }'
    ''
    '    const {'
    '      data: conversation,'
    '      error: conversationError,'
    '    } = await supabaseAdmin'
    '      .from("brain_conversations")'
    '      .select("id")'
    '      .eq("id", conversationId)'
    '      .eq("user_id", profile.id)'
    '      .maybeSingle();'
    ''
    '    if (conversationError) {'
    '      throw new Error(conversationError.message);'
    '    }'
    ''
    '    if (!conversation) {'
    '      return NextResponse.json('
    '        { error: "Conversation KLYX introuvable." },'
    '        { status: 404 }'
    '      );'
    '    }'
    ''
    '    const confirmedAt ='
    '      new Date().toISOString();'
    ''
    '    const confirmationPayload = {'
    '      action: "confirm_request",'
    '      confirmed: true,'
    '      confirmedAt,'
    '      request: {'
    '        serviceSlug,'
    '        city,'
    '        date,'
    '        time,'
    '        budget,'
    '      },'
    '      nextStep: "review_request",'
    '      automaticExecutionAllowed: false,'
    '    };'
    ''
    '    const {'
    '      data: confirmationMessage,'
    '      error: messageError,'
    '    } = await supabaseAdmin'
    '      .from("brain_messages")'
    '      .insert({'
    '        conversation_id: conversationId,'
    '        role: "user",'
    '        content:'
    '          "Confirmation explicite de la demande KLYX.",'
    '        payload: confirmationPayload,'
    '      })'
    '      .select("id")'
    '      .single();'
    ''
    '    if (messageError) {'
    '      throw new Error(messageError.message);'
    '    }'
    ''
    '    const confirmationId ='
    '      (confirmationMessage as ConfirmationMessageRow).id;'
    ''
    '    const { error: updateError } ='
    '      await supabaseAdmin'
    '        .from("brain_conversations")'
    '        .update({'
    '          updated_at: confirmedAt,'
    '        })'
    '        .eq("id", conversationId)'
    '        .eq("user_id", profile.id);'
    ''
    '    if (updateError) {'
    '      throw new Error(updateError.message);'
    '    }'
    ''
    '    return NextResponse.json({'
    '      confirmed: true,'
    '      confirmationId,'
    '      action: "confirm_request",'
    '      confirmedAt,'
    '      nextStep: "review_request",'
    '      automaticExecutionAllowed: false,'
    '    });'
    '  } catch (error) {'
    '    console.error('
    '      "KLYX confirm request error:",'
    '      error'
    '    );'
    ''
    '    const message ='
    '      error instanceof Error'
    '        ? error.message'
    '        : "Confirmation KLYX indisponible.";'
    ''
    '    return NextResponse.json('
    '      { error: message },'
    '      { status: apiErrorStatus(message) }'
    '    );'
    '  }'
    '}'
)

$newApi = [string]::Join(
    $newLine,
    $routeLines
)

# ============================================================
# 2. ASSISTANT : PROPAGER confirmationId
# ============================================================

$newAssistant = $assistant

if (-not $newAssistant.Contains($marker)) {

    $handlerToken =
        "async function confirmCurrentRequest()"

    $handlerIndex =
        $newAssistant.IndexOf($handlerToken)

    if ($handlerIndex -lt 0) {
        throw "confirmCurrentRequest introuvable."
    }

    $openFunctionToken =
        "function openResults("

    $openFunctionIndex =
        $newAssistant.IndexOf(
            $openFunctionToken,
            $handlerIndex
        )

    if ($openFunctionIndex -lt 0) {
        throw "openResults introuvable apres confirmCurrentRequest."
    }

    $openCallIndex =
        $newAssistant.IndexOf(
            "openResults();",
            $handlerIndex
        )

    if (
        $openCallIndex -lt 0 -or
        $openCallIndex -ge $openFunctionIndex
    ) {
        throw "Appel openResults() de confirmation introuvable."
    }

    # Aucun besoin de modifier le type result.
    # On caste seulement confirmationId localement.

    $proofLines = @(
        "const confirmationId ="
        "      (result as { confirmationId?: string })"
        "        .confirmationId;"
        ""
        "    if (!confirmationId) {"
        "      throw new Error("
        '        "Preuve de confirmation KLYX manquante."'
        "      );"
        "    }"
        ""
        "    openResults(confirmationId);"
    )

    $proofBlock =
        [string]::Join(
            $newLine,
            $proofLines
        )

    $newAssistant =
        $newAssistant.Substring(
            0,
            $openCallIndex
        ) +
        $proofBlock +
        $newAssistant.Substring(
            $openCallIndex +
            "openResults();".Length
        )

    # Marqueur avant confirmCurrentRequest

    $handlerIndex =
        $newAssistant.IndexOf($handlerToken)

    $handlerLineStart =
        $newAssistant.LastIndexOf(
            "`n",
            $handlerIndex
        )

    if ($handlerLineStart -lt 0) {
        $handlerLineStart = 0
    }
    else {
        $handlerLineStart++
    }

    $newAssistant =
        $newAssistant.Substring(
            0,
            $handlerLineStart
        ) +
        "  // KLYX_CONFIRMATION_PROOF_12_64" +
        $newLine +
        $newAssistant.Substring(
            $handlerLineStart
        )

    # Signature openResults
    $openFunctionIndex =
        $newAssistant.IndexOf(
            $openFunctionToken
        )

    if ($openFunctionIndex -lt 0) {
        throw "openResults perdu apres insertion."
    }

    $signatureClose =
        $newAssistant.IndexOf(
            ")",
            $openFunctionIndex
        )

    if ($signatureClose -lt 0) {
        throw "Signature openResults invalide."
    }

    $newAssistant =
        $newAssistant.Substring(
            0,
            $openFunctionIndex
        ) +
        "function openResults(confirmationId?: string)" +
        $newAssistant.Substring(
            $signatureClose + 1
        )

    # Ajouter les IDs aux params avant router.push

    $openFunctionIndex =
        $newAssistant.IndexOf(
            "function openResults(confirmationId?: string)"
        )

    $routerIndex =
        $newAssistant.IndexOf(
            "router.push(",
            $openFunctionIndex
        )

    if ($routerIndex -lt 0) {
        throw "router.push de openResults introuvable."
    }

    $paramsProofLines = @(
        "    if (conversationId) {"
        '      params.set("conversationId", conversationId);'
        "    }"
        ""
        "    if (confirmationId) {"
        '      params.set("confirmationId", confirmationId);'
        "    }"
        ""
    )

    $paramsProof =
        [string]::Join(
            $newLine,
            $paramsProofLines
        )

    $newAssistant =
        $newAssistant.Substring(
            0,
            $routerIndex
        ) +
        $paramsProof +
        $newAssistant.Substring(
            $routerIndex
        )
}

# ============================================================
# 3. REQUEST/CONFIRM : PROPAGER VERS RECOMMENDATIONS
# ============================================================

$newConfirmPage = $confirmPage

if (-not $newConfirmPage.Contains($marker)) {

    $minimumToken =
        "const minimumDate = todayInBrussels();"

    $minimumIndex =
        $newConfirmPage.IndexOf(
            $minimumToken
        )

    if ($minimumIndex -lt 0) {
        throw "minimumDate introuvable."
    }

    $minimumEnd =
        $minimumIndex +
        $minimumToken.Length

    $searchProofLines = @(
        ""
        ""
        "  // KLYX_CONFIRMATION_PROOF_12_64"
        "  const conversationId ="
        '    searchParams.get("conversationId")?.trim() ?? "";'
        "  const confirmationId ="
        '    searchParams.get("confirmationId")?.trim() ?? "";'
    )

    $searchProof =
        [string]::Join(
            $newLine,
            $searchProofLines
        )

    $newConfirmPage =
        $newConfirmPage.Substring(
            0,
            $minimumEnd
        ) +
        $searchProof +
        $newConfirmPage.Substring(
            $minimumEnd
        )

    $routerToken =
        'router.push(`/recommendations?'

    $routerIndex =
        $newConfirmPage.IndexOf(
            $routerToken
        )

    if ($routerIndex -lt 0) {
        throw "Navigation recommendations introuvable."
    }

    $forwardLines = @(
        "    if (conversationId) {"
        '      params.set("conversationId", conversationId);'
        "    }"
        ""
        "    if (confirmationId) {"
        '      params.set("confirmationId", confirmationId);'
        "    }"
        ""
    )

    $forwardBlock =
        [string]::Join(
            $newLine,
            $forwardLines
        )

    $newConfirmPage =
        $newConfirmPage.Substring(
            0,
            $routerIndex
        ) +
        $forwardBlock +
        $newConfirmPage.Substring(
            $routerIndex
        )
}

# ============================================================
# 4. VERIFICATIONS
# ============================================================

$apiChecks = @(
    "KLYX_CONFIRM_REQUEST_API_12_63",
    "KLYX_CONFIRMATION_PROOF_12_64",
    "data: confirmationMessage",
    '.select("id")',
    "ConfirmationMessageRow",
    "confirmationId,"
)

$assistantChecks = @(
    "KLYX_EXPLICIT_CONFIRMATION_12_63",
    "KLYX_CONFIRMATION_PROOF_12_64",
    "result as { confirmationId?: string }",
    "Preuve de confirmation KLYX manquante.",
    "openResults(confirmationId);",
    "function openResults(confirmationId?: string)",
    'params.set("conversationId", conversationId);',
    'params.set("confirmationId", confirmationId);'
)

$confirmChecks = @(
    "KLYX_CONFIRMATION_PROOF_12_64",
    'searchParams.get("conversationId")',
    'searchParams.get("confirmationId")',
    'params.set("conversationId", conversationId);',
    'params.set("confirmationId", confirmationId);'
)

foreach ($check in $apiChecks) {
    if (-not $newApi.Contains($check)) {
        throw "Verification API echouee : $check"
    }
}

foreach ($check in $assistantChecks) {
    if (-not $newAssistant.Contains($check)) {
        throw "Verification assistant echouee : $check"
    }
}

foreach ($check in $confirmChecks) {
    if (-not $newConfirmPage.Contains($check)) {
        throw "Verification request/confirm echouee : $check"
    }
}

if ($newApi.ToLower().Contains("stripe")) {
    throw "Stripe interdit dans KLYX 12.64."
}

if ($newApi.Contains("market-publish")) {
    throw "Publication automatique interdite dans KLYX 12.64."
}

# ============================================================
# 5. BACKUPS + ECRITURE
# ============================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

$apiBackup =
    "$apiPath.bak-12-64b-$timestamp"

$assistantBackup =
    "$assistantPath.bak-12-64b-$timestamp"

$confirmBackup =
    "$confirmPagePath.bak-12-64b-$timestamp"

Copy-Item `
    -LiteralPath $apiPath `
    -Destination $apiBackup `
    -Force

Copy-Item `
    -LiteralPath $assistantPath `
    -Destination $assistantBackup `
    -Force

Copy-Item `
    -LiteralPath $confirmPagePath `
    -Destination $confirmBackup `
    -Force

$utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

try {
    [System.IO.File]::WriteAllText(
        $apiPath,
        $newApi,
        $utf8NoBom
    )

    [System.IO.File]::WriteAllText(
        $assistantPath,
        $newAssistant,
        $utf8NoBom
    )

    [System.IO.File]::WriteAllText(
        $confirmPagePath,
        $newConfirmPage,
        $utf8NoBom
    )
}
catch {
    Write-Host ""
    Write-Host "Erreur pendant 12.64b."
    Write-Host "Restauration automatique..."

    Copy-Item $apiBackup $apiPath -Force
    Copy-Item $assistantBackup $assistantPath -Force
    Copy-Item $confirmBackup $confirmPagePath -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.64b applique."
Write-Host "OK - confirmationId genere par Supabase."
Write-Host "OK - aucun type result exact requis."
Write-Host "OK - preuve transmise a request/confirm."
Write-Host "OK - preuve transmise aux recommandations."
Write-Host "OK - aucune transaction automatique."
Write-Host ""