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

    $text = [System.IO.File]::ReadAllText($candidate)

    if ($text.Contains("KLYX_EXPLICIT_CONFIRMATION_12_63")) {
        $assistantPath = $candidate
        break
    }
}

Write-Host ""
Write-Host "KLYX 12.64 - Confirmation Proof Propagation"
Write-Host ""

if (-not $assistantPath) {
    throw "Interface KLYX 12.63 introuvable."
}

if (-not (Test-Path -LiteralPath $apiPath)) {
    throw "API confirm-request 12.63 introuvable."
}

if (-not (Test-Path -LiteralPath $confirmPagePath)) {
    throw "app/request/confirm/page.tsx introuvable."
}

$api = [System.IO.File]::ReadAllText($apiPath)
$assistant = [System.IO.File]::ReadAllText($assistantPath)
$confirmPage = [System.IO.File]::ReadAllText($confirmPagePath)

$marker = "KLYX_CONFIRMATION_PROOF_12_64"

if (
    $api.Contains($marker) -and
    $assistant.Contains($marker) -and
    $confirmPage.Contains($marker)
) {
    Write-Host "KLYX 12.64 est deja present."
    exit 0
}

if (-not $api.Contains("KLYX_CONFIRM_REQUEST_API_12_63")) {
    throw "Prerequis API 12.63 absent."
}

if (-not $assistant.Contains("KLYX_EXPLICIT_CONFIRMATION_12_63")) {
    throw "Prerequis interface 12.63 absent."
}

$newLine = if ($api.Contains("`r`n")) {
    "`r`n"
}
else {
    "`n"
}

# =========================================================
# 1. API : recuperer l'id du message de confirmation
# =========================================================

if (-not $api.Contains($marker)) {

    $oldInsertStart =
        "const { error: messageError } ="

    $insertIndex = $api.IndexOf($oldInsertStart)

    if ($insertIndex -lt 0) {
        throw "Bloc insertion brain_messages 12.63 introuvable."
    }

    $insertEndToken = "        });"

    $insertEnd = $api.IndexOf(
        $insertEndToken,
        $insertIndex
    )

    if ($insertEnd -lt 0) {
        throw "Fin insertion confirmation introuvable."
    }

    $insertEnd += $insertEndToken.Length

    $oldInsert = $api.Substring(
        $insertIndex,
        $insertEnd - $insertIndex
    )

    $newInsertLines = @(
        "// KLYX_CONFIRMATION_PROOF_12_64"
        "const {"
        "  data: confirmationMessage,"
        "  error: messageError,"
        "} = await supabaseAdmin"
        '  .from("brain_messages")'
        "  .insert({"
        "    conversation_id: conversationId,"
        '    role: "user",'
        "    content:"
        '      "Confirmation explicite de la demande KLYX.",'
        "    payload: confirmationPayload,"
        "  })"
        '  .select("id")'
        "  .single();"
    )

    $newInsert = [string]::Join(
        $newLine,
        $newInsertLines
    )

    $api =
        $api.Substring(0, $insertIndex) +
        $newInsert +
        $api.Substring($insertEnd)

    $errorAnchor = @"
    if (messageError) {
      throw new Error(messageError.message);
    }
"@

    if (-not $api.Contains($errorAnchor)) {
        throw "Bloc messageError introuvable."
    }

    $errorReplacement = @"
    if (messageError) {
      throw new Error(messageError.message);
    }

    const confirmationId =
      (confirmationMessage as { id: string }).id;
"@

    $api = $api.Replace(
        $errorAnchor,
        $errorReplacement
    )

    $responseAnchor =
        "      confirmed: true,"

    $responseIndex = $api.LastIndexOf(
        $responseAnchor
    )

    if ($responseIndex -lt 0) {
        throw "Reponse API confirmation introuvable."
    }

    $afterConfirmed =
        $responseIndex +
        $responseAnchor.Length

    $api =
        $api.Substring(0, $afterConfirmed) +
        $newLine +
        "      confirmationId," +
        $api.Substring($afterConfirmed)
}

# =========================================================
# 2. Assistant : utiliser confirmationId
# =========================================================

if (-not $assistant.Contains($marker)) {

    $assistantMarker =
        "  // KLYX_CONFIRMATION_PROOF_12_64" +
        $newLine

    $handlerMarker =
        "async function confirmCurrentRequest()"

    $handlerIndex =
        $assistant.IndexOf($handlerMarker)

    if ($handlerIndex -lt 0) {
        throw "confirmCurrentRequest introuvable."
    }

    $lineStart =
        $assistant.LastIndexOf(
            "`n",
            $handlerIndex
        )

    if ($lineStart -lt 0) {
        $lineStart = 0
    }
    else {
        $lineStart++
    }

    $assistant =
        $assistant.Substring(0, $lineStart) +
        $assistantMarker +
        $assistant.Substring($lineStart)

    $confirmedType =
        "          confirmed?: boolean;"

    if (-not $assistant.Contains($confirmedType)) {
        throw "Type result.confirmed introuvable."
    }

    $assistant = $assistant.Replace(
        $confirmedType,
        $confirmedType +
        $newLine +
        "          confirmationId?: string;"
    )

    $handlerIndex =
        $assistant.IndexOf(
            "async function confirmCurrentRequest()"
        )

    $openCallIndex =
        $assistant.IndexOf(
            "openResults();",
            $handlerIndex
        )

    if ($openCallIndex -lt 0) {
        throw "openResults() apres confirmation introuvable."
    }

    $replacementLines = @(
        "if (!result.confirmationId) {"
        "      throw new Error("
        '        "Preuve de confirmation KLYX manquante."'
        "      );"
        "    }"
        ""
        "    openResults(result.confirmationId);"
    )

    $replacement =
        [string]::Join(
            $newLine,
            $replacementLines
        )

    $assistant =
        $assistant.Substring(0, $openCallIndex) +
        $replacement +
        $assistant.Substring(
            $openCallIndex +
            "openResults();".Length
        )

    $functionToken = "function openResults("
    $openFunctionIndex =
        $assistant.IndexOf($functionToken)

    if ($openFunctionIndex -lt 0) {
        throw "function openResults introuvable."
    }

    $signatureEnd =
        $assistant.IndexOf(
            ")",
            $openFunctionIndex
        )

    if ($signatureEnd -lt 0) {
        throw "Signature openResults invalide."
    }

    $oldSignature =
        $assistant.Substring(
            $openFunctionIndex,
            $signatureEnd - $openFunctionIndex + 1
        )

    $assistant =
        $assistant.Substring(0, $openFunctionIndex) +
        "function openResults(confirmationId?: string)" +
        $assistant.Substring($signatureEnd + 1)

    $routerIndex =
        $assistant.IndexOf(
            "router.push(",
            $openFunctionIndex
        )

    if ($routerIndex -lt 0) {
        throw "router.push de openResults introuvable."
    }

    $proofLines = @(
        "    if (conversationId) {"
        '      params.set("conversationId", conversationId);'
        "    }"
        ""
        "    if (confirmationId) {"
        '      params.set("confirmationId", confirmationId);'
        "    }"
        ""
    )

    $proofBlock =
        [string]::Join(
            $newLine,
            $proofLines
        )

    $assistant =
        $assistant.Substring(0, $routerIndex) +
        $proofBlock +
        $assistant.Substring($routerIndex)
}

# =========================================================
# 3. /request/confirm : conserver la preuve
# =========================================================

if (-not $confirmPage.Contains($marker)) {

    $minimumAnchor =
        "  const minimumDate = todayInBrussels();"

    if (-not $confirmPage.Contains($minimumAnchor)) {
        throw "minimumDate introuvable dans request/confirm."
    }

    $proofStateLines = @(
        "  // KLYX_CONFIRMATION_PROOF_12_64"
        "  const conversationId ="
        '    searchParams.get("conversationId")?.trim() ?? "";'
        "  const confirmationId ="
        '    searchParams.get("confirmationId")?.trim() ?? "";'
    )

    $proofState =
        [string]::Join(
            $newLine,
            $proofStateLines
        )

    $confirmPage = $confirmPage.Replace(
        $minimumAnchor,
        $minimumAnchor +
        $newLine +
        $newLine +
        $proofState
    )

    $routerIndex =
        $confirmPage.IndexOf(
            "router.push(`/recommendations?"
        )

    if ($routerIndex -lt 0) {
        throw "Navigation recommendations introuvable."
    }

    $preserveLines = @(
        "    if (conversationId) {"
        '      params.set("conversationId", conversationId);'
        "    }"
        ""
        "    if (confirmationId) {"
        '      params.set("confirmationId", confirmationId);'
        "    }"
        ""
    )

    $preserveBlock =
        [string]::Join(
            $newLine,
            $preserveLines
        )

    $confirmPage =
        $confirmPage.Substring(0, $routerIndex) +
        $preserveBlock +
        $confirmPage.Substring($routerIndex)
}

# =========================================================
# Verification
# =========================================================

$apiChecks = @(
    "KLYX_CONFIRMATION_PROOF_12_64",
    "data: confirmationMessage",
    '.select("id")',
    "const confirmationId =",
    "confirmationId,"
)

$assistantChecks = @(
    "KLYX_CONFIRMATION_PROOF_12_64",
    "confirmationId?: string;",
    "openResults(result.confirmationId);",
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
    if (-not $api.Contains($check)) {
        throw "Verification API echouee : $check"
    }
}

foreach ($check in $assistantChecks) {
    if (-not $assistant.Contains($check)) {
        throw "Verification assistant echouee : $check"
    }
}

foreach ($check in $confirmChecks) {
    if (-not $confirmPage.Contains($check)) {
        throw "Verification request/confirm echouee : $check"
    }
}

# =========================================================
# Backups
# =========================================================

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

$apiBackup = "$apiPath.bak-12-64-$timestamp"
$assistantBackup = "$assistantPath.bak-12-64-$timestamp"
$confirmBackup = "$confirmPagePath.bak-12-64-$timestamp"

Copy-Item $apiPath $apiBackup -Force
Copy-Item $assistantPath $assistantBackup -Force
Copy-Item $confirmPagePath $confirmBackup -Force

$utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

try {
    [System.IO.File]::WriteAllText(
        $apiPath,
        $api,
        $utf8NoBom
    )

    [System.IO.File]::WriteAllText(
        $assistantPath,
        $assistant,
        $utf8NoBom
    )

    [System.IO.File]::WriteAllText(
        $confirmPagePath,
        $confirmPage,
        $utf8NoBom
    )
}
catch {
    Write-Host "Erreur 12.64 - restauration..."

    Copy-Item $apiBackup $apiPath -Force
    Copy-Item $assistantBackup $assistantPath -Force
    Copy-Item $confirmBackup $confirmPagePath -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.64 applique."
Write-Host "OK - confirmationId genere."
Write-Host "OK - preuve transportee vers request/confirm."
Write-Host "OK - preuve transportee vers recommendations."
Write-Host "OK - aucune publication automatique."
Write-Host ""