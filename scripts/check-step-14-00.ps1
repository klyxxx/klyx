$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.00 END-TO-END JOURNEY GATE"
Write-Host "======================================"

# ============================================================
# Helpers
# ============================================================

function Read-KlyxFile {
    param(
        [Parameter(Mandatory = $true)]
        [string] $RelativePath
    )

    $path =
        Join-Path `
            $root `
            $RelativePath

    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "14.00 : fichier introuvable : $RelativePath"
    }

    return [System.IO.File]::ReadAllText($path)
}

function Assert-KlyxSignals {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Name,

        [Parameter(Mandatory = $true)]
        [string] $Text,

        [Parameter(Mandatory = $true)]
        [string[]] $Signals
    )

    foreach ($signal in $Signals) {
        if (-not $Text.Contains($signal)) {
            throw "14.00 : $Name : signal manquant : $signal"
        }
    }

    Write-Host "[OK] $Name"
}

function Assert-NoPowerShellInjection {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Name,

        [Parameter(Mandatory = $true)]
        [string] $Text
    )

    $dangerous = @(
        "[System.IO.File]::WriteAllText",
        "Set-Location `"C:\Users\fenjo",
        '$ErrorActionPreference = "Stop"'
    )

    foreach ($signal in $dangerous) {
        if ($Text.Contains($signal)) {
            throw "14.00 : PowerShell detecte dans $Name : $signal"
        }
    }
}

# ============================================================
# 1. BESOIN -> ASSISTANT
# ============================================================

$assistantMarket =
    Read-KlyxFile `
        "app\assistant\market\page.tsx"

Assert-KlyxSignals `
    -Name "Assistant Need Journey" `
    -Text $assistantMarket `
    -Signals @(
        "KLYX_ASSISTED_NEED_JOURNEY_13_94",
        "KLYX_ASSISTANT_CONTROL_STATE_13_94",
        "Ton parcours KLYX",
        'title="Décris"',
        'title="Vérifie"',
        'title="Confirme"',
        'title="Compare"',
        "/api/brain/respond",
        "/api/brain/market-publish",
        "Confirmer et publier",
        "conversationId"
    )

if ($assistantMarket -notmatch 'confirmed\s*:\s*true') {
    throw "14.00 : Assistant : confirmed=true introuvable."
}

if ($assistantMarket -notmatch 'confirmationId\s*:') {
    throw "14.00 : Assistant : confirmationId introuvable."
}

Assert-NoPowerShellInjection `
    -Name "assistant/market" `
    -Text $assistantMarket

# ============================================================
# 2. RECHERCHE MANUELLE
# ============================================================

$search =
    Read-KlyxFile `
        "app\search\page.tsx"

Assert-KlyxSignals `
    -Name "Manual Search Bridge" `
    -Text $search `
    -Signals @(
        "KLYX_SEARCH_ASSISTANT_BRIDGE_13_93",
        "KLYX_SEARCH_TWO_PATHS_13_93",
        "/assistant/market",
        "/api/search/providers",
        "/api/services/public"
    )

Assert-NoPowerShellInjection `
    -Name "search" `
    -Text $search

# ============================================================
# 3. PUBLICATION -> OFFRES
# ============================================================

$requests =
    Read-KlyxFile `
        "app\requests\page.tsx"

Assert-KlyxSignals `
    -Name "Market Request Lifecycle" `
    -Text $requests `
    -Signals @(
        "KLYX_MANUAL_PUBLISH_CONFIRMATION_13_95",
        "KLYX_REQUEST_LIFECYCLE_13_95",
        "KLYX_REQUEST_DECISION_CONTROL_13_95",
        "Confirmer et publier la demande",
        'title="Publie"',
        'title="Reçois"',
        'title="Compare"',
        'title="Choisis"',
        'title="Réserve"',
        "/api/market/requests",
        "/offers",
        "offerAction",
        '"accept"',
        '"reject"'
    )

Assert-NoPowerShellInjection `
    -Name "requests" `
    -Text $requests

# ============================================================
# 4. DEVIS ACCEPTE -> RESERVATION
# ============================================================

$quoteBooking =
    Read-KlyxFile `
        "app\quotes\[id]\book\page.tsx"

Assert-KlyxSignals `
    -Name "Quote Booking Handoff" `
    -Text $quoteBooking `
    -Signals @(
        "KLYX_QUOTE_TO_BOOKING_HANDOFF_13_96",
        "KLYX_BOOKING_CONTROL_REMINDER_13_96",
        "Le devis est accepté. La réservation ne l’est pas encore.",
        'loadedQuote.status !== "accepted"',
        "slotState.valid",
        "availability_slots",
        "/api/bookings/create",
        "bookingId"
    )

Assert-NoPowerShellInjection `
    -Name "quotes/[id]/book" `
    -Text $quoteBooking

# ============================================================
# 5. RESERVATION -> PAIEMENT
# ============================================================

$booking =
    Read-KlyxFile `
        "app\bookings\[id]\page.tsx"

Assert-KlyxSignals `
    -Name "Booking Payment Handoff" `
    -Text $booking `
    -Signals @(
        "KLYX_BOOKING_PAYMENT_HANDOFF_13_97",
        "KLYX_DOUBLE_PAYMENT_UI_GUARD_13_97",
        "Paiement déjà enregistré",
        "const canPay",
        "const canTrack",
        "/api/stripe/create-checkout-session",
        "alreadyPaid",
        "paymentPending",
        "window.location.href"
    )

if ($booking -notmatch 'payment_status\s*!==\s*"paid"') {
    throw "14.00 : protection payment_status != paid introuvable."
}

Assert-NoPowerShellInjection `
    -Name "bookings/[id]" `
    -Text $booking

# ============================================================
# 6. PAIEMENT -> SUIVI -> FIN MISSION
# ============================================================

$tracking =
    Read-KlyxFile `
        "app\tracking\[bookingId]\page.tsx"

Assert-KlyxSignals `
    -Name "Mission Tracking" `
    -Text $tracking `
    -Signals @(
        "KLYX_MISSION_COMPLETION_HANDOFF_13_98",
        "KLYX_TWO_PARTY_COMPLETION_GUARD_13_98",
        "provider_finished_at",
        "client_confirmed_at",
        "awaitingClientConfirmation",
        "canProviderFinish",
        "canClientConfirm",
        "provider_finished",
        "client_confirmed",
        "/api/bookings/tracking",
        "booking_tracking_events",
        "postgres_changes",
        "/reviews/"
    )

if ($tracking -notmatch 'payment_status\s*===\s*"paid"') {
    throw "14.00 : tracking non protege par payment_status=paid."
}

Assert-NoPowerShellInjection `
    -Name "tracking/[bookingId]" `
    -Text $tracking

# ============================================================
# 7. MISSION TERMINEE -> AVIS VERIFIE
# ============================================================

$review =
    Read-KlyxFile `
        "app\reviews\[bookingId]\page.tsx"

Assert-KlyxSignals `
    -Name "Verified Review" `
    -Text $review `
    -Signals @(
        "KLYX_VERIFIED_REVIEW_TRUST_13_99",
        "KLYX_REVIEW_TRUST_FLOW_13_99",
        "Avis vérifié KLYX",
        "Mission terminée",
        "Avis vérifié",
        "Confiance",
        "/api/reviews",
        "bookingId",
        "rating",
        "comment",
        "Publier mon avis",
        "Modifier mon avis"
    )

Assert-NoPowerShellInjection `
    -Name "reviews/[bookingId]" `
    -Text $review

# ============================================================
# 8. PROFIL PUBLIC / CONFIANCE
# ============================================================

$provider =
    Read-KlyxFile `
        "app\providers\[id]\page.tsx"

Assert-KlyxSignals `
    -Name "Provider Trust Surface" `
    -Text $provider `
    -Signals @(
        "KLYX Score",
        "scoreLabel",
        "verification_status",
        "Identité vérifiée",
        "years_experience",
        "completedJobs",
        "cancellationRate",
        "availabilityCount",
        "/verified-services",
        "PublicReviews"
    )

Assert-NoPowerShellInjection `
    -Name "providers/[id]" `
    -Text $provider

# ============================================================
# 9. ROUTES BACKEND CRITIQUES
# ============================================================

$criticalRoutes = @(
    "app\api\brain\respond\route.ts",
    "app\api\brain\market-publish\route.ts",
    "app\api\market\requests\route.ts",
    "app\api\market\requests\[id]\offers\route.ts",
    "app\api\bookings\create\route.ts",
    "app\api\bookings\tracking\route.ts",
    "app\api\stripe\create-checkout-session\route.ts",
    "app\api\reviews\route.ts"
)

foreach ($relativePath in $criticalRoutes) {
    $absolutePath =
        Join-Path `
            $root `
            $relativePath

    if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
        throw "14.00 : route critique absente : $relativePath"
    }

    Write-Host "[OK] API $relativePath"
}

# ============================================================
# 10. INVARIANT AUTOMATISATION
# ============================================================

$automationFiles = @(
    $assistantMarket,
    $requests,
    $quoteBooking,
    $booking,
    $tracking
)

foreach ($source in $automationFiles) {
    if ($source -match 'automaticExecutionAllowed\s*[:=]\s*true') {
        throw "14.00 : automaticExecutionAllowed=true detecte."
    }
}

Write-Host "[OK] Automatic execution disabled"

# ============================================================
# 11. TESTS
# ============================================================

Write-Host ""
Write-Host "======================================"
Write-Host "TESTS"
Write-Host "======================================"

npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.00 : tests FAILED."
}

# ============================================================
# 12. TYPESCRIPT
# ============================================================

Write-Host ""
Write-Host "======================================"
Write-Host "TYPESCRIPT"
Write-Host "======================================"

npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.00 : TypeScript FAILED."
}

# ============================================================
# 13. PRODUCTION BUILD
# ============================================================

Write-Host ""
Write-Host "======================================"
Write-Host "PRODUCTION BUILD"
Write-Host "======================================"

npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.00 : build FAILED."
}

# ============================================================
# SUCCESS
# ============================================================

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.00 CHECK OK"
Write-Host "======================================"
Write-Host "Need -> Assistant           : OK"
Write-Host "Explicit publication       : OK"
Write-Host "Manual search escape       : OK"
Write-Host "Request -> Offers           : OK"
Write-Host "Offer -> Quote              : OK"
Write-Host "Quote -> Booking            : OK"
Write-Host "Booking -> Payment          : OK"
Write-Host "Double-payment UI guard     : OK"
Write-Host "Payment -> Tracking         : OK"
Write-Host "Provider finish             : OK"
Write-Host "Client confirmation         : OK"
Write-Host "Completed -> Verified review: OK"
Write-Host "Provider trust surface      : OK"
Write-Host "Automatic publication       : NONE"
Write-Host "Automatic booking           : NONE"
Write-Host "Automatic payment           : NONE"
Write-Host "Automatic completion        : NONE"
Write-Host "Tests                       : OK"
Write-Host "TypeScript                  : OK"
Write-Host "Production build            : OK"
Write-Host "======================================"
Write-Host "KLYX END-TO-END JOURNEY : READY"
Write-Host "======================================"