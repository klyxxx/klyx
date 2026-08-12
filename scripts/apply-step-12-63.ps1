$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "KLYX 12.63 - Explicit Request Confirmation"
Write-Host ""

# =========================================================
# Detection de la vraie interface assistant locale
# =========================================================

$pageCandidates = @(
    (Join-Path $projectRoot "app\assistant\page.tsx"),
    (Join-Path $projectRoot "app\brain\page.tsx")
)

$pagePath = $null

foreach ($candidate in $pageCandidates) {
    if (-not (Test-Path -LiteralPath $candidate)) {
        continue
    }

    $candidateContent = [System.IO.File]::ReadAllText(
        $candidate
    )

    if (
        $candidateContent.Contains(
            "KLYX_ASSISTANT_READINESS_UI_12_62"
        ) -and
        $candidateContent.Contains(
            "/api/brain/respond"
        )
    ) {
        $pagePath = $candidate
        break
    }
}

if (-not $pagePath) {
    throw "Interface KLYX 12.62 introuvable."
}

Write-Host "Interface : $pagePath"

$pageContent = [System.IO.File]::ReadAllText(
    $pagePath
)

$pageMarker = "KLYX_EXPLICIT_CONFIRMATION_12_63"

if ($pageContent.Contains($pageMarker)) {
    Write-Host "KLYX 12.63 est deja present dans l'interface."
}
else {
    if (-not $pageContent.Contains(
        "onConfirm={openResults}"
    )) {
        throw "Connexion Confirmer 12.62 introuvable. Aucun fichier modifie."
    }

    if (-not $pageContent.Contains(
        "function openResults()"
    )) {
        throw "openResults introuvable. Aucun fichier modifie."
    }

    if (-not $pageContent.Contains(
        "const [conversationId"
    )) {
        throw "conversationId introuvable."
    }

    if (-not $pageContent.Contains(
        "const [payload"
    )) {
        throw "payload introuvable."
    }
}

# =========================================================
# Endpoint /api/brain/confirm-request
# =========================================================

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
    $existingApi = [System.IO.File]::ReadAllText(
        $apiPath
    )

    if (-not $existingApi.Contains($apiMarker)) {
        throw "confirm-request/route.ts existe deja sans marqueur KLYX 12.63. Aucun ecrasement force."
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
        {
          error: "Conversation KLYX manquante.",
        },
        {
          status: 400,
        }
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
        {
          status: 400,
        }
      );
    }

    if (
      budget != null &&
      (
        !Number.isFinite(budget) ||
        budget < 0
      )
    ) {
      return NextResponse.json(
        {
          error: "Budget invalide.",
        },
        {
          status: 400,
        }
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
      throw new Error(
        conversationError.message
      );
    }

    if (!conversation) {
      return NextResponse.json(
        {
          error:
            "Conversation KLYX introuvable.",
        },
        {
          status: 404,
        }
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
      nextStep:
        "review_request",
      automaticExecutionAllowed: false,
    };

    const {
      error: messageError,
    } = await supabaseAdmin
      .from("brain_messages")
      .insert({
        conversation_id:
          conversationId,
        role: "user",
        content:
          "Confirmation explicite de la demande KLYX.",
        payload:
          confirmationPayload,
      });

    if (messageError) {
      throw new Error(
        messageError.message
      );
    }

    const {
      error: conversationUpdateError,
    } = await supabaseAdmin
      .from("brain_conversations")
      .update({
        updated_at: confirmedAt,
      })
      .eq("id", conversationId)
      .eq("user_id", profile.id);

    if (conversationUpdateError) {
      throw new Error(
        conversationUpdateError.message
      );
    }

    return NextResponse.json({
      confirmed: true,
      action: "confirm_request",
      confirmedAt,
      nextStep:
        "review_request",
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
      {
        error: message,
      },
      {
        status:
          apiErrorStatus(message),
      }
    );
  }
}
"@

# =========================================================
# Modification de la page assistant
# =========================================================

$newPageContent = $pageContent

if (-not $newPageContent.Contains($pageMarker)) {
    $openResultsAnchor =
        "  function openResults()"

    $openResultsIndex =
        $newPageContent.IndexOf(
            $openResultsAnchor
        )

    if ($openResultsIndex -lt 0) {
        throw "Point d'insertion openResults introuvable."
    }

    $confirmFunction = @"
  // KLYX_EXPLICIT_CONFIRMATION_12_63
  async function confirmCurrentRequest() {
    if (
      !payload?.ready ||
      !payload.readiness?.isComplete
    ) {
      setErrorMessage(
        "La demande doit être complète avant confirmation."
      );
      return;
    }

    if (!conversationId) {
      setErrorMessage(
        "Conversation KLYX introuvable."
      );
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(
        "/api/brain/confirm-request",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              "Bearer " +
              session.access_token,
          },
          body: JSON.stringify({
            conversationId,
            request: {
              serviceSlug:
                payload.serviceSlug,
              city:
                payload.city,
              date:
                payload.date,
              time:
                payload.time,
              budget:
                payload.budget,
            },
          }),
        }
      );

      const result =
        (await response.json()) as {
          confirmed?: boolean;
          error?: string;
        };

      if (
        !response.ok ||
        !result.confirmed
      ) {
        throw new Error(
          result.error ||
            "KLYX n'a pas pu confirmer la demande."
        );
      }

      openResults();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Confirmation impossible."
      );
    } finally {
      setLoading(false);
    }
  }

"@

    $newPageContent =
        $newPageContent.Substring(
            0,
            $openResultsIndex
        ) +
        $confirmFunction +
        $newPageContent.Substring(
            $openResultsIndex
        )

    $oldConfirm =
        "onConfirm={openResults}"

    $newConfirm =
        "onConfirm={() => void confirmCurrentRequest()}"

    if (-not $newPageContent.Contains(
        $oldConfirm
    )) {
        throw "Ancienne connexion Confirmer introuvable."
    }

    $newPageContent =
        $newPageContent.Replace(
            $oldConfirm,
            $newConfirm
        )
}

# =========================================================
# Verification avant ecriture
# =========================================================

$pageChecks = @(
    "KLYX_EXPLICIT_CONFIRMATION_12_63",
    "async function confirmCurrentRequest()",
    "/api/brain/confirm-request",
    "payload.readiness?.isComplete",
    "conversationId",
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
    'nextStep:',
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
    throw "12.63 ne doit pas publier automatiquement."
}

if ($routeContent.Contains("payment")) {
    throw "12.63 ne doit pas declencher de paiement."
}

# =========================================================
# Backups
# =========================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

$pageBackup =
    "$pagePath.bak-12-63-$timestamp"

Copy-Item `
    -LiteralPath $pagePath `
    -Destination $pageBackup `
    -Force

$apiBackup = $null

if (Test-Path -LiteralPath $apiPath) {
    $apiBackup =
        "$apiPath.bak-12-63-$timestamp"

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

    $pageVerification =
        [System.IO.File]::ReadAllText(
            $pagePath
        )

    $apiVerification =
        [System.IO.File]::ReadAllText(
            $apiPath
        )

    foreach ($check in $pageChecks) {
        if (-not $pageVerification.Contains(
            $check
        )) {
            throw "Verification apres ecriture page : $check"
        }
    }

    foreach ($check in $apiChecks) {
        if (-not $apiVerification.Contains(
            $check
        )) {
            throw "Verification apres ecriture API : $check"
        }
    }
}
catch {
    Write-Host ""
    Write-Host "Erreur pendant KLYX 12.63."
    Write-Host "Restauration automatique..."

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
Write-Host "OK - KLYX 12.63 applique."
Write-Host "OK - confirmation utilisateur enregistree."
Write-Host "OK - conversation verifiee."
Write-Host "OK - aucune publication automatique."
Write-Host "OK - aucune reservation automatique."
Write-Host "OK - aucun paiement automatique."
Write-Host ""