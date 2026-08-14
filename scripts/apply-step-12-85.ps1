$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$payloadPath =
    Join-Path `
        $PSScriptRoot `
        "apply-step-12-85.payload.ps1"

if (-not (
    Test-Path -LiteralPath $payloadPath
)) {
    throw "Payload KLYX 12.85 introuvable."
}

$raw =
    [System.IO.File]::ReadAllText(
        $payloadPath
    )

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

function ExtractPayload {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $pattern =
        '(?m)^\$' +
        [regex]::Escape($Name) +
        '\s*=\s*Decode\s+"([^"]+)"\s*$'

    $match =
        [regex]::Match(
            $raw,
            $pattern
        )

    if (-not $match.Success) {
        throw (
            "Payload 12.85 introuvable : " +
            $Name
        )
    }

    return $match.Groups[1].Value
}

function DecodePayload {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $base64 =
        ExtractPayload $Name

    return [System.Text.Encoding]::UTF8.GetString(
        [Convert]::FromBase64String(
            $base64
        )
    )
}

function DecodeLiteral {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    return [System.Text.Encoding]::UTF8.GetString(
        [Convert]::FromBase64String(
            $Value
        )
    )
}

# ============================================================
# RECUPERATION DES VRAIS FICHIERS 12.85
# ============================================================

$migration =
    DecodePayload "migration"

$createApi =
    DecodePayload "createApi"

$groupApi =
    DecodePayload "groupApi"

$groupPage =
    DecodePayload "groupPage"

$adviceFunctions =
    DecodePayload "adviceFunctions"

$oldMultiButton =
    DecodePayload "oldMultiButton"

$newMultiButton =
    DecodePayload "newMultiButton"

# Snippets corriges.
# Aucun code TS sensible n est parse par PowerShell.

$clientGroupSnippet =
    DecodeLiteral "ICAgICAgICAvLyBLTFlYX0dST1VQX0FDVElPTlNfMTJfODUKICAgICAgICBpZiAoCiAgICAgICAgICBib29raW5nLmJvb2tpbmdfZ3JvdXBfaWQgJiYKICAgICAgICAgIGJvb2tpbmcuc3RhdHVzID09PSAiYWNjZXB0ZWQiICYmCiAgICAgICAgICBib29raW5nLnBheW1lbnRfc3RhdHVzICE9PSAicGFpZCIKICAgICAgICApIHsKICAgICAgICAgIGFkZEFjdGlvbihhY3Rpb25zLCB7CiAgICAgICAgICAgIGlkOiAicGF5bWVudC1ncm91cC0iICsgYm9va2luZy5ib29raW5nX2dyb3VwX2lkLAogICAgICAgICAgICBraW5kOiAicGF5bWVudF9wZW5kaW5nIiwKICAgICAgICAgICAgcHJpb3JpdHk6IDExMCwKICAgICAgICAgICAgdGl0bGU6ICJQYWllbWVudCBncm91cGUgYSBmaW5hbGlzZXIiLAogICAgICAgICAgICBkZXNjcmlwdGlvbjogIlRvdXMgbGVzIGNyZW5lYXV4IHNvbnQgYWNjZXB0ZXMuIExlIGdyb3VwZSBhdHRlbmQgdW4gcGFpZW1lbnQgdW5pcXVlLiIsCiAgICAgICAgICAgIGhyZWY6ICIvYm9va2luZy1ncm91cHMvIiArIGJvb2tpbmcuYm9va2luZ19ncm91cF9pZCwKICAgICAgICAgICAgbGFiZWw6ICJWb2lyIGxlIGdyb3VwZSIsCiAgICAgICAgICB9KTsKICAgICAgICAgIGNvbnRpbnVlOwogICAgICAgIH0KCg=="

$providerGroupSnippet =
    DecodeLiteral "ICAgICAgICBpZiAoCiAgICAgICAgICBib29raW5nLmJvb2tpbmdfZ3JvdXBfaWQgJiYKICAgICAgICAgIGJvb2tpbmcuc3RhdHVzID09PSAicGVuZGluZyIKICAgICAgICApIHsKICAgICAgICAgIGFkZEFjdGlvbihhY3Rpb25zLCB7CiAgICAgICAgICAgIGlkOiAicHJvdmlkZXItZ3JvdXAtIiArIGJvb2tpbmcuYm9va2luZ19ncm91cF9pZCwKICAgICAgICAgICAga2luZDogInByb3ZpZGVyX2Jvb2tpbmdfcmVxdWVzdCIsCiAgICAgICAgICAgIHByaW9yaXR5OiAxMjUsCiAgICAgICAgICAgIHRpdGxlOiAiUmVzZXJ2YXRpb24gZ3JvdXBlZSBhIGNvbmZpcm1lciIsCiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAiTGUgY2xpZW50IHQgYSBzZWxlY3Rpb25uZSBwb3VyIHBsdXNpZXVycyBjcmVuZWF1eC4gQ29uZmlybWUgbGUgZ3JvdXBlIGNvbXBsZXQuIiwKICAgICAgICAgICAgaHJlZjogIi9ib29raW5nLWdyb3Vwcy8iICsgYm9va2luZy5ib29raW5nX2dyb3VwX2lkLAogICAgICAgICAgICBsYWJlbDogIlRyYWl0ZXIgbGUgZ3JvdXBlIiwKICAgICAgICAgIH0pOwogICAgICAgICAgY29udGludWU7CiAgICAgICAgfQoK"

$statusGuard =
    DecodeLiteral "ICAgIC8vIEtMWVhfR1JPVVBfU1RBVFVTX0dVQVJEXzEyXzg1CiAgICBpZiAoYm9va2luZy5ib29raW5nX2dyb3VwX2lkKSB7CiAgICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbigKICAgICAgICB7CiAgICAgICAgICBlcnJvcjoKICAgICAgICAgICAgIkNldHRlIHJlc2VydmF0aW9uIGFwcGFydGllbnQgYSB1biBncm91cGUuIE1vZGlmaWUgbGUgZ3JvdXBlIGNvbXBsZXQgZGVwdWlzIEtMWVguIiwKICAgICAgICAgIGNvZGU6ICJHUk9VUF9TVEFUVVNfUkVRVUlSRUQiLAogICAgICAgICAgZ3JvdXBJZDogYm9va2luZy5ib29raW5nX2dyb3VwX2lkLAogICAgICAgIH0sCiAgICAgICAgeyBzdGF0dXM6IDQwOSB9CiAgICAgICk7CiAgICB9Cgo="

$paymentGuard =
    DecodeLiteral "ICAgIC8vIEtMWVhfR1JPVVBfUEFZTUVOVF9HVUFSRF8xMl84NQogICAgaWYgKGJvb2tpbmcuYm9va2luZ19ncm91cF9pZCkgewogICAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oCiAgICAgICAgewogICAgICAgICAgZXJyb3I6CiAgICAgICAgICAgICJDZXR0ZSByZXNlcnZhdGlvbiBhcHBhcnRpZW50IGEgdW4gZ3JvdXBlLiBVdGlsaXNlIGxlIHBhaWVtZW50IGdyb3VwZSBLTFlYLiIsCiAgICAgICAgICBjb2RlOiAiR1JPVVBfUEFZTUVOVF9SRVFVSVJFRCIsCiAgICAgICAgICBncm91cElkOiBib29raW5nLmJvb2tpbmdfZ3JvdXBfaWQsCiAgICAgICAgfSwKICAgICAgICB7IHN0YXR1czogNDA5IH0KICAgICAgKTsKICAgIH0KCg=="

# ============================================================
# PATHS
# ============================================================

$migrationPath =
    Join-Path `
        $root `
        "supabase\migrations\20260812202000_klyx_booking_groups_12_85.sql"

$createApiPath =
    Join-Path `
        $root `
        "app\api\market\requests\[id]\group-booking\route.ts"

$groupApiPath =
    Join-Path `
        $root `
        "app\api\booking-groups\[id]\route.ts"

$groupPagePath =
    Join-Path `
        $root `
        "app\booking-groups\[id]\page.tsx"

$advicePath =
    Join-Path `
        $root `
        "app\assistant\market\[id]\page.tsx"

$brainPath =
    Join-Path `
        $root `
        "lib\brain-actions.ts"

$statusPath =
    Join-Path `
        $root `
        "app\api\bookings\status\route.ts"

$checkoutPath =
    Join-Path `
        $root `
        "app\api\stripe\create-checkout-session\route.ts"

foreach ($required in @(
    $advicePath,
    $brainPath,
    $statusPath,
    $checkoutPath
)) {
    if (-not (
        Test-Path -LiteralPath $required
    )) {
        throw "Fichier requis introuvable : $required"
    }
}

New-Item `
    -ItemType Directory `
    -Force `
    -Path (
        Split-Path -Parent $migrationPath
    ) |
    Out-Null

New-Item `
    -ItemType Directory `
    -Force `
    -Path (
        Split-Path -Parent $createApiPath
    ) |
    Out-Null

New-Item `
    -ItemType Directory `
    -Force `
    -Path (
        Split-Path -Parent $groupApiPath
    ) |
    Out-Null

New-Item `
    -ItemType Directory `
    -Force `
    -Path (
        Split-Path -Parent $groupPagePath
    ) |
    Out-Null

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

foreach ($path in @(
    $advicePath,
    $brainPath,
    $statusPath,
    $checkoutPath
)) {
    Copy-Item `
        -LiteralPath $path `
        -Destination (
            $path +
            ".bak-12-85c-" +
            $timestamp
        ) `
        -Force
}

# ============================================================
# WRITE NEW 12.85 FILES
# ============================================================

[System.IO.File]::WriteAllText(
    $migrationPath,
    $migration,
    $utf8
)

[System.IO.File]::WriteAllText(
    $createApiPath,
    $createApi,
    $utf8
)

[System.IO.File]::WriteAllText(
    $groupApiPath,
    $groupApi,
    $utf8
)

[System.IO.File]::WriteAllText(
    $groupPagePath,
    $groupPage,
    $utf8
)

# ============================================================
# MARKET ADVICE
# ============================================================

$advice =
    [System.IO.File]::ReadAllText(
        $advicePath
    )

if (-not $advice.Contains(
    "KLYX_GROUP_SELECTION_UI_12_85"
)) {
    $start =
        $advice.IndexOf(
            "  function prepareChoice("
        )

    $end =
        $advice.IndexOf(
            "  if (loading) {",
            $start
        )

    if (
        $start -lt 0 -or
        $end -lt 0
    ) {
        throw "12.85c : fonctions Market introuvables."
    }

    $advice =
        $advice.Substring(
            0,
            $start
        ) +
        $adviceFunctions +
        $advice.Substring(
            $end
        )

    if (-not $advice.Contains(
        $oldMultiButton
    )) {
        throw "12.85c : bouton 12.84 introuvable."
    }

    $advice =
        $advice.Replace(
            $oldMultiButton,
            $newMultiButton
        )
}

[System.IO.File]::WriteAllText(
    $advicePath,
    $advice,
    $utf8
)

# ============================================================
# BRAIN ACTIONS
# ============================================================

$brain =
    [System.IO.File]::ReadAllText(
        $brainPath
    )

if (-not $brain.Contains(
    "booking_group_id: string | null;"
)) {
    $match =
        [regex]::Match(
            $brain,
            '(?m)^(\s*)quote_id:\s*string \| null;\s*$'
        )

    if (-not $match.Success) {
        throw "12.85c : quote_id type introuvable."
    }

    $indent =
        $match.Groups[1].Value

    $replacement =
        $match.Value +
        "`n" +
        $indent +
        "booking_group_id: string | null;"

    $brain =
        $brain.Remove(
            $match.Index,
            $match.Length
        ).Insert(
            $match.Index,
            $replacement
        )
}

if (-not $brain.Contains(
    "quote_id, booking_group_id, status, payment_status"
)) {
    if (-not $brain.Contains(
        "quote_id, status, payment_status"
    )) {
        throw "12.85c : select Brain booking introuvable."
    }

    $brain =
        $brain.Replace(
            "quote_id, status, payment_status",
            "quote_id, booking_group_id, status, payment_status"
        )
}

if (-not $brain.Contains(
    "KLYX_GROUP_ACTIONS_12_85"
)) {
    $clientStart =
        $brain.IndexOf(
            "function addClientBookingActions"
        )

    $providerStart =
        $brain.IndexOf(
            "async function addProviderActions"
        )

    if (
        $clientStart -lt 0 -or
        $providerStart -lt 0
    ) {
        throw "12.85c : fonctions Brain introuvables."
    }

    $clientBlock =
        $brain.Substring(
            $clientStart,
            $providerStart -
            $clientStart
        )

    $match =
        [regex]::Match(
            $clientBlock,
            '(?ms)^\s*if\s*\(\s*booking\.status\s*===\s*"accepted"\s*&&\s*booking\.payment_status\s*!==\s*"paid"\s*\)\s*\{'
        )

    if (-not $match.Success) {
        throw "12.85c : action paiement client introuvable."
    }

    $brain =
        $brain.Insert(
            $clientStart +
            $match.Index,
            $clientGroupSnippet
        )
}

if (-not $brain.Contains(
    '"provider-group-"'
)) {
    $providerStart =
        $brain.IndexOf(
            "async function addProviderActions"
        )

    if ($providerStart -lt 0) {
        throw "12.85c : addProviderActions introuvable."
    }

    $providerBlock =
        $brain.Substring(
            $providerStart
        )

    $match =
        [regex]::Match(
            $providerBlock,
            '(?ms)^\s*if\s*\(\s*booking\.status\s*===\s*"pending"\s*\)\s*\{'
        )

    if (-not $match.Success) {
        throw "12.85c : action provider pending introuvable."
    }

    $brain =
        $brain.Insert(
            $providerStart +
            $match.Index,
            $providerGroupSnippet
        )
}

[System.IO.File]::WriteAllText(
    $brainPath,
    $brain,
    $utf8
)

# ============================================================
# BOOKING STATUS GUARD
# ============================================================

$status =
    [System.IO.File]::ReadAllText(
        $statusPath
    )

if (-not $status.Contains(
    "booking_group_id: string | null;"
)) {
    $match =
        [regex]::Match(
            $status,
            '(?m)^(\s*)babysitter_id:\s*string \| null;\s*$'
        )

    if (-not $match.Success) {
        throw "12.85c : BookingRow status introuvable."
    }

    $indent =
        $match.Groups[1].Value

    $replacement =
        $match.Value +
        "`n" +
        $indent +
        "booking_group_id: string | null;"

    $status =
        $status.Remove(
            $match.Index,
            $match.Length
        ).Insert(
            $match.Index,
            $replacement
        )
}

if (-not $status.Contains(
    "babysitter_id, booking_group_id, booking_date"
)) {
    if (-not $status.Contains(
        "babysitter_id, booking_date"
    )) {
        throw "12.85c : select status introuvable."
    }

    $status =
        $status.Replace(
            "babysitter_id, booking_date",
            "babysitter_id, booking_group_id, booking_date"
        )
}

if (-not $status.Contains(
    "KLYX_GROUP_STATUS_GUARD_12_85"
)) {
    $anchor =
        "    const booking = data as BookingRow;"

    $index =
        $status.IndexOf(
            $anchor
        )

    if ($index -lt 0) {
        throw "12.85c : booking status anchor introuvable."
    }

    $index +=
        $anchor.Length

    $status =
        $status.Insert(
            $index,
            "`n`n" +
            $statusGuard
        )
}

[System.IO.File]::WriteAllText(
    $statusPath,
    $status,
    $utf8
)

# ============================================================
# STRIPE CHILD PAYMENT GUARD
# ============================================================

$checkout =
    [System.IO.File]::ReadAllText(
        $checkoutPath
    )

if (-not $checkout.Contains(
    "booking_group_id: string | null;"
)) {
    $match =
        [regex]::Match(
            $checkout,
            '(?m)^(\s*)babysitter_id:\s*string \| null;\s*$'
        )

    if (-not $match.Success) {
        throw "12.85c : BookingRow Stripe introuvable."
    }

    $indent =
        $match.Groups[1].Value

    $replacement =
        $match.Value +
        "`n" +
        $indent +
        "booking_group_id: string | null;"

    $checkout =
        $checkout.Remove(
            $match.Index,
            $match.Length
        ).Insert(
            $match.Index,
            $replacement
        )
}

if (-not $checkout.Contains(
    "babysitter_id, booking_group_id, service_id"
)) {
    if (-not $checkout.Contains(
        "babysitter_id, service_id"
    )) {
        throw "12.85c : select Stripe introuvable."
    }

    $checkout =
        $checkout.Replace(
            "babysitter_id, service_id",
            "babysitter_id, booking_group_id, service_id"
        )
}

if (-not $checkout.Contains(
    "KLYX_GROUP_PAYMENT_GUARD_12_85"
)) {
    $anchor =
        '    if (booking.status !== "accepted") {'

    $index =
        $checkout.IndexOf(
            $anchor
        )

    if ($index -lt 0) {
        throw "12.85c : controle statut Stripe introuvable."
    }

    $checkout =
        $checkout.Insert(
            $index,
            $paymentGuard
        )
}

[System.IO.File]::WriteAllText(
    $checkoutPath,
    $checkout,
    $utf8
)

# ============================================================
# FINAL STATIC CHECK
# ============================================================

$checks = @(
    @{
        Name = "migration"
        Value =
            $migration.Contains(
                "KLYX_BOOKING_GROUPS_12_85"
            )
    },
    @{
        Name = "create API"
        Value =
            $createApi.Contains(
                "KLYX_GROUP_BOOKING_CREATE_12_85"
            )
    },
    @{
        Name = "group API"
        Value =
            $groupApi.Contains(
                "KLYX_BOOKING_GROUP_API_12_85"
            )
    },
    @{
        Name = "group page"
        Value =
            $groupPage.Contains(
                "KLYX_BOOKING_GROUP_PAGE_12_85"
            )
    },
    @{
        Name = "market selection"
        Value =
            $advice.Contains(
                "KLYX_GROUP_SELECTION_UI_12_85"
            )
    },
    @{
        Name = "Brain actions"
        Value =
            $brain.Contains(
                "KLYX_GROUP_ACTIONS_12_85"
            )
    },
    @{
        Name = "status guard"
        Value =
            $status.Contains(
                "KLYX_GROUP_STATUS_GUARD_12_85"
            )
    },
    @{
        Name = "payment guard"
        Value =
            $checkout.Contains(
                "KLYX_GROUP_PAYMENT_GUARD_12_85"
            )
    }
)

foreach ($check in $checks) {
    if (-not $check.Value) {
        throw (
            "12.85c validation FAILED : " +
            $check.Name
        )
    }

    Write-Host (
        "[OK] " +
        $check.Name
    )
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.85c APPLIQUE"
Write-Host "======================================"
Write-Host "Booking groups : OK"
Write-Host "Reservations enfants : OK"
Write-Host "Action Center groupe : OK"
Write-Host "Statut enfant individuel : BLOQUE"
Write-Host "Paiement enfant individuel : BLOQUE"
Write-Host "======================================"
Write-Host ""