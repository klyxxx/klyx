$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$routePath = Join-Path `
    $projectRoot `
    "app\api\brain\market-publish\route.ts"

$helperPath = Join-Path `
    $projectRoot `
    "lib\brain-market-confirmation.ts"

Write-Host ""
Write-Host "KLYX 12.65 - Market Publish Confirmation Gate"
Write-Host ""

if (-not (Test-Path -LiteralPath $routePath)) {
    throw "app/api/brain/market-publish/route.ts introuvable."
}

$route = [System.IO.File]::ReadAllText($routePath)

$marker = "KLYX_MARKET_CONFIRMATION_GATE_12_65"

if (
    $route.Contains($marker) -and
    (Test-Path -LiteralPath $helperPath)
) {
    $helperExisting =
        [System.IO.File]::ReadAllText($helperPath)

    if ($helperExisting.Contains(
        "KLYX_MARKET_CONFIRMATION_HELPER_12_65"
    )) {
        Write-Host "KLYX 12.65 est deja applique."
        exit 0
    }
}

$newLine = if ($route.Contains("`r`n")) {
    "`r`n"
}
else {
    "`n"
}

# ============================================================
# HELPER DE SECURITE
# ============================================================

$helperLines = @(
    'import { supabaseAdmin } from "@/lib/supabase-admin";'
    'import {'
    '  getAuthenticatedProfile,'
    '  requireAccountType,'
    '} from "@/lib/api-auth";'
    ''
    '// KLYX_MARKET_CONFIRMATION_HELPER_12_65'
    ''
    'type UnknownRecord = Record<string, unknown>;'
    ''
    'type RequestSnapshot = {'
    '  serviceSlug: string;'
    '  city: string;'
    '  date: string;'
    '  time: string;'
    '  budget: number | null;'
    '};'
    ''
    'type ConfirmationRow = {'
    '  id: string;'
    '  payload: unknown;'
    '};'
    ''
    'function asRecord('
    '  value: unknown'
    '): UnknownRecord | null {'
    '  if ('
    '    typeof value !== "object" ||'
    '    value === null ||'
    '    Array.isArray(value)'
    '  ) {'
    '    return null;'
    '  }'
    ''
    '  return value as UnknownRecord;'
    '}'
    ''
    'function readString('
    '  record: UnknownRecord | null,'
    '  keys: string[]'
    '): string | null {'
    '  if (!record) return null;'
    ''
    '  for (const key of keys) {'
    '    const value = record[key];'
    ''
    '    if (typeof value !== "string") {'
    '      continue;'
    '    }'
    ''
    '    const cleaned = value.trim();'
    ''
    '    if (cleaned) {'
    '      return cleaned;'
    '    }'
    '  }'
    ''
    '  return null;'
    '}'
    ''
    'function readBudget('
    '  record: UnknownRecord | null'
    '): number | null {'
    '  if (!record) return null;'
    ''
    '  const value ='
    '    record.budget ??'
    '    record.maxBudget ??'
    '    record.max_budget;'
    ''
    '  if (value == null || value === "") {'
    '    return null;'
    '  }'
    ''
    '  const parsed ='
    '    typeof value === "number"'
    '      ? value'
    '      : typeof value === "string"'
    '        ? Number(value)'
    '        : Number.NaN;'
    ''
    '  if (!Number.isFinite(parsed) || parsed < 0) {'
    '    return null;'
    '  }'
    ''
    '  return parsed;'
    '}'
    ''
    'function extractSnapshot('
    '  value: unknown'
    '): RequestSnapshot | null {'
    '  const root = asRecord(value);'
    ''
    '  if (!root) return null;'
    ''
    '  const nested ='
    '    asRecord(root.request) ??'
    '    asRecord(root.requestSnapshot) ??'
    '    asRecord(root.snapshot) ??'
    '    root;'
    ''
    '  const serviceSlug = readString('
    '    nested,'
    '    ['
    '      "serviceSlug",'
    '      "service_slug",'
    '      "service",'
    '    ]'
    '  );'
    ''
    '  const city = readString('
    '    nested,'
    '    ["city", "ville"]'
    '  );'
    ''
    '  const date = readString('
    '    nested,'
    '    ["date"]'
    '  );'
    ''
    '  const time = readString('
    '    nested,'
    '    ["time", "heure"]'
    '  );'
    ''
    '  if ('
    '    !serviceSlug ||'
    '    !city ||'
    '    !date ||'
    '    !time'
    '  ) {'
    '    return null;'
    '  }'
    ''
    '  return {'
    '    serviceSlug,'
    '    city,'
    '    date,'
    '    time,'
    '    budget: readBudget(nested),'
    '  };'
    '}'
    ''
    'function readProofValue('
    '  root: UnknownRecord,'
    '  keys: string[]'
    '): string | null {'
    '  const direct = readString(root, keys);'
    ''
    '  if (direct) return direct;'
    ''
    '  const proof ='
    '    asRecord(root.proof) ??'
    '    asRecord(root.confirmation);'
    ''
    '  return readString(proof, keys);'
    '}'
    ''
    'function normalizedText(value: string) {'
    '  return value.trim().toLocaleLowerCase("fr-BE");'
    '}'
    ''
    'function budgetsMatch('
    '  left: number | null,'
    '  right: number | null'
    ') {'
    '  if (left == null && right == null) {'
    '    return true;'
    '  }'
    ''
    '  if (left == null || right == null) {'
    '    return false;'
    '  }'
    ''
    '  return Math.abs(left - right) < 0.01;'
    '}'
    ''
    'function snapshotsMatch('
    '  confirmed: RequestSnapshot,'
    '  requested: RequestSnapshot'
    ') {'
    '  return ('
    '    normalizedText(confirmed.serviceSlug) ==='
    '      normalizedText(requested.serviceSlug) &&'
    '    normalizedText(confirmed.city) ==='
    '      normalizedText(requested.city) &&'
    '    confirmed.date === requested.date &&'
    '    confirmed.time === requested.time &&'
    '    budgetsMatch('
    '      confirmed.budget,'
    '      requested.budget'
    '    )'
    '  );'
    '}'
    ''
    'export async function requireBrainMarketConfirmation('
    '  params: {'
    '    request: Request;'
    '    body: unknown;'
    '  }'
    ') {'
    '  const { profile } ='
    '    await getAuthenticatedProfile(params.request);'
    ''
    '  requireAccountType(profile, "client");'
    ''
    '  const root = asRecord(params.body);'
    ''
    '  if (!root) {'
    '    throw new Error('
    '      "Corps de publication KLYX invalide."'
    '    );'
    '  }'
    ''
    '  const conversationId = readProofValue('
    '    root,'
    '    ['
    '      "conversationId",'
    '      "conversation_id",'
    '    ]'
    '  );'
    ''
    '  const confirmationId = readProofValue('
    '    root,'
    '    ['
    '      "confirmationId",'
    '      "confirmation_id",'
    '    ]'
    '  );'
    ''
    '  if (!conversationId || !confirmationId) {'
    '    throw new Error('
    '      "Confirmation explicite KLYX requise avant publication."'
    '    );'
    '  }'
    ''
    '  const requestedSnapshot ='
    '    extractSnapshot(root);'
    ''
    '  if (!requestedSnapshot) {'
    '    throw new Error('
    '      "La demande a publier doit etre complete."'
    '    );'
    '  }'
    ''
    '  const {'
    '    data: conversation,'
    '    error: conversationError,'
    '  } = await supabaseAdmin'
    '    .from("brain_conversations")'
    '    .select("id")'
    '    .eq("id", conversationId)'
    '    .eq("user_id", profile.id)'
    '    .maybeSingle();'
    ''
    '  if (conversationError) {'
    '    throw new Error('
    '      conversationError.message'
    '    );'
    '  }'
    ''
    '  if (!conversation) {'
    '    throw new Error('
    '      "Conversation KLYX invalide pour cette publication."'
    '    );'
    '  }'
    ''
    '  const {'
    '    data: confirmationData,'
    '    error: confirmationError,'
    '  } = await supabaseAdmin'
    '    .from("brain_messages")'
    '    .select("id, payload")'
    '    .eq("id", confirmationId)'
    '    .eq("conversation_id", conversationId)'
    '    .eq("role", "user")'
    '    .maybeSingle();'
    ''
    '  if (confirmationError) {'
    '    throw new Error('
    '      confirmationError.message'
    '    );'
    '  }'
    ''
    '  if (!confirmationData) {'
    '    throw new Error('
    '      "Preuve de confirmation KLYX invalide."'
    '    );'
    '  }'
    ''
    '  const confirmation ='
    '    confirmationData as ConfirmationRow;'
    ''
    '  const payload ='
    '    asRecord(confirmation.payload);'
    ''
    '  if ('
    '    !payload ||'
    '    payload.action !== "confirm_request" ||'
    '    payload.confirmed !== true'
    '  ) {'
    '    throw new Error('
    '      "Cette preuve ne correspond pas a une confirmation explicite."'
    '    );'
    '  }'
    ''
    '  if (payload.automaticExecutionAllowed !== false) {'
    '    throw new Error('
    '      "Politique de confirmation KLYX invalide."'
    '    );'
    '  }'
    ''
    '  const confirmedSnapshot ='
    '    extractSnapshot(payload);'
    ''
    '  if (!confirmedSnapshot) {'
    '    throw new Error('
    '      "La confirmation KLYX ne contient pas de demande complete."'
    '    );'
    '  }'
    ''
    '  if ('
    '    !snapshotsMatch('
    '      confirmedSnapshot,'
    '      requestedSnapshot'
    '    )'
    '  ) {'
    '    throw new Error('
    '      "La demande a change depuis sa confirmation. Confirme-la de nouveau."'
    '    );'
    '  }'
    ''
    '  return {'
    '    profileId: profile.id,'
    '    conversationId,'
    '    confirmationId,'
    '    request: requestedSnapshot,'
    '  };'
    '}'
)

$helperContent = [string]::Join(
    $newLine,
    $helperLines
)

# ============================================================
# PATCH STRUCTUREL DE market-publish
# ============================================================

$newRoute = $route

if (-not $newRoute.Contains($marker)) {

    $postToken = "export async function POST"

    $postIndex =
        $newRoute.IndexOf($postToken)

    if ($postIndex -lt 0) {
        throw "export async function POST introuvable dans market-publish."
    }

    $paramsOpen =
        $newRoute.IndexOf(
            "(",
            $postIndex
        )

    if ($paramsOpen -lt 0) {
        throw "Parametres POST introuvables."
    }

    $paramsClose =
        $newRoute.IndexOf(
            ")",
            $paramsOpen
        )

    if ($paramsClose -lt 0) {
        throw "Fin des parametres POST introuvable."
    }

    $paramsText =
        $newRoute.Substring(
            $paramsOpen + 1,
            $paramsClose - $paramsOpen - 1
        ).Trim()

    if (-not $paramsText) {
        throw "POST ne contient aucun parametre Request."
    }

    $colonIndex =
        $paramsText.IndexOf(":")

    if ($colonIndex -ge 0) {
        $requestName =
            $paramsText.Substring(
                0,
                $colonIndex
            ).Trim()
    }
    else {
        $requestName =
            $paramsText.Split(",")[0].Trim()
    }

    if (-not $requestName) {
        throw "Nom du parametre Request introuvable."
    }

    Write-Host "Parametre Request detecte : $requestName"

    # Import ajoute juste avant POST.
    $importLine =
        'import { requireBrainMarketConfirmation } from "@/lib/brain-market-confirmation";'

    if (-not $newRoute.Contains($importLine)) {
        $newRoute =
            $newRoute.Substring(0, $postIndex) +
            $importLine +
            $newLine +
            $newLine +
            $newRoute.Substring($postIndex)
    }

    # Recalculer apres ajout import.
    $postIndex =
        $newRoute.IndexOf($postToken)

    $paramsOpen =
        $newRoute.IndexOf(
            "(",
            $postIndex
        )

    $paramsClose =
        $newRoute.IndexOf(
            ")",
            $paramsOpen
        )

    $functionOpen =
        $newRoute.IndexOf(
            "{",
            $paramsClose
        )

    if ($functionOpen -lt 0) {
        throw "Ouverture de POST introuvable."
    }

    # Si POST contient un try initial, le gate est place
    # dedans afin de reutiliser le catch existant.
    $searchLimit = [Math]::Min(
        $newRoute.Length,
        $functionOpen + 1200
    )

    $nearStart =
        $newRoute.Substring(
            $functionOpen + 1,
            $searchLimit - $functionOpen - 1
        )

    $relativeTry =
        $nearStart.IndexOf("try {")

    if ($relativeTry -ge 0) {
        $tryIndex =
            $functionOpen +
            1 +
            $relativeTry

        $insertPosition =
            $newRoute.IndexOf(
                "{",
                $tryIndex
            ) + 1

        Write-Host "Gate insere dans le try existant."
    }
    else {
        $insertPosition =
            $functionOpen + 1

        Write-Host "Gate insere au debut de POST."
    }

    $gateLines = @(
        ""
        "    // KLYX_MARKET_CONFIRMATION_GATE_12_65"
        "    const klyxConfirmationGateRequest ="
        "      $requestName.clone();"
        ""
        "    const klyxConfirmationGateBody ="
        "      await klyxConfirmationGateRequest.json();"
        ""
        "    await requireBrainMarketConfirmation({"
        "      request: $requestName,"
        "      body: klyxConfirmationGateBody,"
        "    });"
        ""
    )

    $gateBlock =
        [string]::Join(
            $newLine,
            $gateLines
        )

    $newRoute =
        $newRoute.Substring(
            0,
            $insertPosition
        ) +
        $gateBlock +
        $newRoute.Substring(
            $insertPosition
        )
}

# ============================================================
# VERIFICATIONS
# ============================================================

$helperChecks = @(
    "KLYX_MARKET_CONFIRMATION_HELPER_12_65",
    "requireBrainMarketConfirmation",
    '"confirm_request"',
    "payload.confirmed !== true",
    "automaticExecutionAllowed !== false",
    '.from("brain_conversations")',
    '.from("brain_messages")',
    '.eq("conversation_id", conversationId)',
    "snapshotsMatch",
    "La demande a change depuis sa confirmation"
)

$routeChecks = @(
    "KLYX_MARKET_CONFIRMATION_GATE_12_65",
    "requireBrainMarketConfirmation",
    ".clone();",
    "klyxConfirmationGateBody",
    "await requireBrainMarketConfirmation({"
)

foreach ($check in $helperChecks) {
    if (-not $helperContent.Contains($check)) {
        throw "Verification helper echouee : $check"
    }
}

foreach ($check in $routeChecks) {
    if (-not $newRoute.Contains($check)) {
        throw "Verification route echouee : $check"
    }
}

# Le gate ne doit rien executer lui-meme.
if ($helperContent.ToLower().Contains("stripe")) {
    throw "Le helper 12.65 ne doit pas appeler Stripe."
}

if ($helperContent.Contains(
    '.from("bookings")'
)) {
    throw "Le helper 12.65 ne doit pas creer de reservation."
}

# ============================================================
# BACKUPS + ECRITURE
# ============================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

$routeBackup =
    "$routePath.bak-12-65-$timestamp"

Copy-Item `
    -LiteralPath $routePath `
    -Destination $routeBackup `
    -Force

$helperBackup = $null

if (Test-Path -LiteralPath $helperPath) {
    $helperBackup =
        "$helperPath.bak-12-65-$timestamp"

    Copy-Item `
        -LiteralPath $helperPath `
        -Destination $helperBackup `
        -Force
}

$utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

try {
    [System.IO.File]::WriteAllText(
        $helperPath,
        $helperContent,
        $utf8NoBom
    )

    [System.IO.File]::WriteAllText(
        $routePath,
        $newRoute,
        $utf8NoBom
    )
}
catch {
    Write-Host ""
    Write-Host "Erreur pendant KLYX 12.65."
    Write-Host "Restauration automatique..."

    Copy-Item `
        -LiteralPath $routeBackup `
        -Destination $routePath `
        -Force

    if ($helperBackup) {
        Copy-Item `
            -LiteralPath $helperBackup `
            -Destination $helperPath `
            -Force
    }
    elseif (Test-Path -LiteralPath $helperPath) {
        Remove-Item `
            -LiteralPath $helperPath `
            -Force
    }

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.65 applique."
Write-Host "OK - market-publish protege cote serveur."
Write-Host "OK - conversationId obligatoire."
Write-Host "OK - confirmationId obligatoire."
Write-Host "OK - confirmation verifiee dans Supabase."
Write-Host "OK - contenu confirme compare a la publication."
Write-Host "OK - aucun paiement automatique ajoute."
Write-Host ""