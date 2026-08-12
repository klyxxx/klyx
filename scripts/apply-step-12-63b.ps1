$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "KLYX 12.63b - Explicit Request Confirmation"
Write-Host ""

$pageCandidates = @(
    (Join-Path $projectRoot "app\assistant\page.tsx"),
    (Join-Path $projectRoot "app\brain\page.tsx")
)

$pagePath = $null

foreach ($candidate in $pageCandidates) {
    if (-not (Test-Path -LiteralPath $candidate)) {
        continue
    }

    $candidateContent = [System.IO.File]::ReadAllText($candidate)

    if (
        $candidateContent.Contains("KLYX_ASSISTANT_READINESS_UI_12_62") -and
        $candidateContent.Contains("/api/brain/respond")
    ) {
        $pagePath = $candidate
        break
    }
}

if (-not $pagePath) {
    throw "Interface KLYX 12.62 introuvable."
}

$pageContent = [System.IO.File]::ReadAllText($pagePath)

Write-Host "Interface detectee : $pagePath"

$pageMarker = "KLYX_EXPLICIT_CONFIRMATION_12_63"

if ($pageContent.Contains($pageMarker)) {
    Write-Host "KLYX 12.63 est deja present dans la page."
}
else {
    if (-not $pageContent.Contains("onConfirm={openResults}")) {
        throw "Connexion onConfirm 12.62 introuvable. Aucun fichier modifie."
    }

    if (-not $pageContent.Contains("const [conversationId")) {
        throw "conversationId introuvable."
    }

    if (-not $pageContent.Contains("const [payload")) {
        throw "payload introuvable."
    }

    if (-not $pageContent.Contains("payload?.readiness")) {
        throw "readiness 12.62 introuvable."
    }
}

$newLine = if ($pageContent.Contains("`r`n")) {
    "`r`n"
}
else {
    "`n"
}

function Get-LineIndent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,

        [Parameter(Mandatory = $true)]
        [int]$Position
    )

    $lineStart = $Text.LastIndexOf("`n", $Position)

    if ($lineStart -lt 0) {
        $lineStart = 0
    }
    else {
        $lineStart++
    }

    $prefix = $Text.Substring(
        $lineStart,
        $Position - $lineStart
    )

    $indent = ""

    foreach ($char in $prefix.ToCharArray()) {
        if ($char -eq " " -or $char -eq "`t") {
            $indent += $char
        }
        else {
            break
        }
    }

    return @{
        LineStart = $lineStart
        Indent = $indent
    }
}

# ============================================================
# API confirm-request
# ============================================================

$apiDirectory = Join-Path `
    $projectRoot `
    "app\api\brain\confirm-request"

$apiPath = Join-Path `
    $apiDirectory `
    "route.ts"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $apiDirectory |
    Out-Null

$apiMarker = "KLYX_CONFIRM_REQUEST_API_12_63"

if (Test-Path -LiteralPath $apiPath) {
    $existingApi = [System.IO.File]::ReadAllText($apiPath)

    if (-not $existingApi.Contains($apiMarker)) {
        throw "confirm-request/route.ts existe deja sans marqueur 12.63."
    }
}

$routeContent = @"
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

// KLYX_CONFIRM_REQUEST_API_12_63

type ConfirmedRequestInput = {
  serviceSlug?: string | null;
  city?: string | null;
  date?: string | null;
  time?: string | null;
  budget?: number | null;
};

type ConfirmRequestBody = {
  conversationId?: string;
  request?: ConfirmedRequestInput;
};

function cleanText(
  value: string | null | undefined
): string {
  return value?.trim() ?? "";
}

export async function POST(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

    const body =
      (await request.json()) as ConfirmRequestBody;

    const conversationId =
      cleanText(body.conversationId);

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation KLYX manquante." },
        { status: 400 }
      );
    }

    const serviceSlug =
      cleanText(body.request?.serviceSlug);

    const city =
      cleanText(body.request?.city);

    const date =
      cleanText(body.request?.date);

    const time =
      cleanText(body.request?.time);

    const budget =
      body.request?.budget == null
        ? null
        : Number(body.request.budget);

    if (
      !serviceSlug ||
      !city ||
      !date ||
      !time
    ) {
      return NextResponse.json(
        {
          error:
            "La demande doit être complète avant confirmation.",
        },
        { status: 400 }
      );
    }

    if (
      budget != null &&
      (!Number.isFinite(budget) || budget < 0)
    ) {
      return NextResponse.json(
        { error: "Budget invalide." },
        { status: 400 }
      );
    }

    const {
      data: conversation,
      error: conversationError,
    } = await supabaseAdmin
      .from("brain_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (conversationError) {
      throw new Error(conversationError.message);
    }

    if (!conversation) {
      return NextResponse.json(
        {
          error:
            "Conversation KLYX introuvable.",
        },
        { status: 404 }
      );
    }

    const confirmedAt =
      new Date().toISOString();

    const confirmationPayload = {
      action: "confirm_request",
      confirmed: true,
      confirmedAt,
      request: {
        serviceSlug,
        city,
        date,
        time,
        budget,
      },
      nextStep: "review_request",
      automaticExecutionAllowed: false,
    };

    const { error: messageError } =
      await supabaseAdmin
        .from("brain_messages")
        .insert({
          conversation_id: conversationId,
          role: "user",
          content:
            "Confirmation explicite de la demande KLYX.",
          payload: confirmationPayload,
        });

    if (messageError) {
      throw new Error(messageError.message);
    }

    const { error: updateError } =
      await supabaseAdmin
        .from("brain_conversations")
        .update({
          updated_at: confirmedAt,
        })
        .eq("id", conversationId)
        .eq("user_id", profile.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      confirmed: true,
      action: "confirm_request",
      confirmedAt,
      nextStep: "review_request",
      automaticExecutionAllowed: false,
    });
  } catch (error) {
    console.error(
      "KLYX confirm request error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Confirmation KLYX indisponible.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
"@

# ============================================================
# Page assistant
# ============================================================

$newPageContent = $pageContent

if (-not $newPageContent.Contains($pageMarker)) {

    # Recherche structurelle :
    # on ne depend PLUS de l'indentation ni de "()".

    $openResultsToken = "function openResults("

    $openResultsIndex =
        $newPageContent.IndexOf(
            $openResultsToken
        )

    if ($openResultsIndex -lt 0) {
        throw "Fonction openResults introuvable dans la page."
    }

    $location = Get-LineIndent `
        -Text $newPageContent `
        -Position $openResultsIndex

    $insertPosition =
        [int]$location.LineStart

    $indent =
        [string]$location.Indent

    $lines = @(
        ($indent + "// KLYX_EXPLICIT_CONFIRMATION_12_63")
        ($indent + "async function confirmCurrentRequest() {")
        ($indent + "  if (")
        ($indent + "    !payload?.ready ||")
        ($indent + "    !payload.readiness?.isComplete")
        ($indent + "  ) {")
        ($indent + "    setErrorMessage(")
        ($indent + '      "La demande doit être complète avant confirmation."')
        ($indent + "    );")
        ($indent + "    return;")
        ($indent + "  }")
        ""
        ($indent + "  if (!conversationId) {")
        ($indent + "    setErrorMessage(")
        ($indent + '      "Conversation KLYX introuvable."')
        ($indent + "    );")
        ($indent + "    return;")
        ($indent + "  }")
        ""
        ($indent + "  setLoading(true);")
        ($indent + '  setErrorMessage("");')
        ""
        ($indent + "  try {")
        ($indent + "    const {")
        ($indent + "      data: { session },")
        ($indent + "    } = await supabase.auth.getSession();")
        ""
        ($indent + "    if (!session?.access_token) {")
        ($indent + '      router.replace("/login");')
        ($indent + "      return;")
        ($indent + "    }")
        ""
        ($indent + "    const response = await fetch(")
        ($indent + '      "/api/brain/confirm-request",')
        ($indent + "      {")
        ($indent + '        method: "POST",')
        ($indent + "        headers: {")
        ($indent + '          "Content-Type": "application/json",')
        ($indent + "          Authorization:")
        ($indent + '            "Bearer " + session.access_token,')
        ($indent + "        },")
        ($indent + "        body: JSON.stringify({")
        ($indent + "          conversationId,")
        ($indent + "          request: {")
        ($indent + "            serviceSlug: payload.serviceSlug,")
        ($indent + "            city: payload.city,")
        ($indent + "            date: payload.date,")
        ($indent + "            time: payload.time,")
        ($indent + "            budget: payload.budget,")
        ($indent + "          },")
        ($indent + "        }),")
        ($indent + "      }")
        ($indent + "    );")
        ""
        ($indent + "    const result =")
        ($indent + "      (await response.json()) as {")
        ($indent + "        confirmed?: boolean;")
        ($indent + "        error?: string;")
        ($indent + "      };")
        ""
        ($indent + "    if (!response.ok || !result.confirmed) {")
        ($indent + "      throw new Error(")
        ($indent + "        result.error ||")
        ($indent + '          "KLYX n''a pas pu confirmer la demande."')
        ($indent + "      );")
        ($indent + "    }")
        ""
        ($indent + "    openResults();")
        ($indent + "  } catch (error) {")
        ($indent + "    setErrorMessage(")
        ($indent + "      error instanceof Error")
        ($indent + "        ? error.message")
        ($indent + '        : "Confirmation impossible."')
        ($indent + "    );")
        ($indent + "  } finally {")
        ($indent + "    setLoading(false);")
        ($indent + "  }")
        ($indent + "}")
        ""
    )

    $confirmFunction =
        [string]::Join(
            $newLine,
            $lines
        )

    $newPageContent =
        $newPageContent.Substring(
            0,
            $insertPosition
        ) +
        $confirmFunction +
        $newPageContent.Substring(
            $insertPosition
        )

    $oldConfirm =
        "onConfirm={openResults}"

    $newConfirm =
        "onConfirm={() => void confirmCurrentRequest()}"

    if (-not $newPageContent.Contains($oldConfirm)) {
        throw "Connexion onConfirm existante introuvable."
    }

    $newPageContent =
        $newPageContent.Replace(
            $oldConfirm,
            $newConfirm
        )
}

# ============================================================
# Verification
# ============================================================

$pageChecks = @(
    "KLYX_EXPLICIT_CONFIRMATION_12_63",
    "async function confirmCurrentRequest()",
    "/api/brain/confirm-request",
    "payload.readiness?.isComplete",
    "if (!conversationId)",
    "onConfirm={() => void confirmCurrentRequest()}",
    "openResults();"
)

foreach ($check in $pageChecks) {
    if (-not $newPageContent.Contains($check)) {
        throw "Verification page echouee : $check"
    }
}

$apiChecks = @(
    "KLYX_CONFIRM_REQUEST_API_12_63",
    'action: "confirm_request"',
    "confirmed: true",
    "confirmedAt",
    '"review_request"',
    "automaticExecutionAllowed: false",
    '.from("brain_conversations")',
    '.from("brain_messages")'
)

foreach ($check in $apiChecks) {
    if (-not $routeContent.Contains($check)) {
        throw "Verification API echouee : $check"
    }
}

if ($routeContent.Contains("market-publish")) {
    throw "Publication automatique interdite dans 12.63."
}

if ($routeContent.ToLower().Contains("stripe")) {
    throw "Stripe ne doit pas etre utilise dans 12.63."
}

# ============================================================
# Backups et ecriture
# ============================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

$pageBackup =
    "$pagePath.bak-12-63b-$timestamp"

Copy-Item `
    -LiteralPath $pagePath `
    -Destination $pageBackup `
    -Force

$apiBackup = $null

if (Test-Path -LiteralPath $apiPath) {
    $apiBackup =
        "$apiPath.bak-12-63b-$timestamp"

    Copy-Item `
        -LiteralPath $apiPath `
        -Destination $apiBackup `
        -Force
}

Write-Host "Backup page : $pageBackup"

$utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

try {
    [System.IO.File]::WriteAllText(
        $apiPath,
        $routeContent,
        $utf8NoBom
    )

    [System.IO.File]::WriteAllText(
        $pagePath,
        $newPageContent,
        $utf8NoBom
    )
}
catch {
    Write-Host ""
    Write-Host "Erreur pendant KLYX 12.63b."
    Write-Host "Restauration..."

    if (Test-Path -LiteralPath $pageBackup) {
        Copy-Item `
            -LiteralPath $pageBackup `
            -Destination $pagePath `
            -Force
    }

    if ($apiBackup) {
        Copy-Item `
            -LiteralPath $apiBackup `
            -Destination $apiPath `
            -Force
    }
    elseif (Test-Path -LiteralPath $apiPath) {
        Remove-Item `
            -LiteralPath $apiPath `
            -Force
    }

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.63b applique."
Write-Host "OK - confirmation explicite tracee."
Write-Host "OK - openResults detecte structurellement."
Write-Host "OK - aucune transaction automatique."
Write-Host ""