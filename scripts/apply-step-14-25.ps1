$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$utf8 =
    [System.Text.UTF8Encoding]::new(
        $false
    )

$standardPath =
    Join-Path `
        $root `
        "app\api\stripe\create-checkout-session\route.ts"

$groupPath =
    Join-Path `
        $root `
        "app\api\stripe\create-group-checkout-session\route.ts"

foreach ($path in @(
    $standardPath,
    $groupPath
)) {
    if (
        -not (
            Test-Path `
                -LiteralPath $path `
                -PathType Leaf
        )
    ) {
        throw "14.25 : fichier introuvable : $path"
    }
}

function Backup-KlyxFile(
    [string]$Path
) {
    $backup =
        "$Path.14-25.bak"

    if (
        -not (
            Test-Path `
                -LiteralPath $backup
        )
    ) {
        Copy-Item `
            -LiteralPath $Path `
            -Destination $backup
    }
}

Write-Host ""
Write-Host "KLYX 14.25"
Write-Host "Stripe dynamic currency..."
Write-Host ""

# STANDARD CHECKOUT

$standardText =
    [System.IO.File]::ReadAllText(
        $standardPath
    )

if (
    -not $standardText.Contains(
        "KLYX_STRIPE_BOOKING_CURRENCY_14_25"
    )
) {
    Backup-KlyxFile $standardPath

    if (
        -not $standardText.Contains(
            "currency_code: string | null;"
        )
    ) {
        $standardText =
            [regex]::Replace(
                $standardText,
                '  payment_status: string \| null;\r?\n  pricing_type_snapshot:',
                "  payment_status: string | null;`r`n  currency_code: string | null;`r`n  pricing_type_snapshot:",
                1
            )
    }

    if (
        -not $standardText.Contains(
            "currency_code: string | null;"
        )
    ) {
        throw "14.25 : BookingRow currency_code non ajoute."
    }

    $oldSelect =
        "payment_status, pricing_type_snapshot"

    $newSelect =
        "payment_status, currency_code, pricing_type_snapshot"

    if (
        -not $standardText.Contains(
            $newSelect
        )
    ) {
        if (
            -not $standardText.Contains(
                $oldSelect
            )
        ) {
            throw "14.25 : select booking introuvable."
        }

        $standardText =
            $standardText.Replace(
                $oldSelect,
                $newSelect
            )
    }

    $economicsMarker =
        "    const economics = calculateKlyxEconomics("

    if (
        -not $standardText.Contains(
            $economicsMarker
        )
    ) {
        throw "14.25 : ancre economics introuvable."
    }

    $currencyBlock = @"
    // KLYX_STRIPE_BOOKING_CURRENCY_14_25
    const checkoutCurrency =
      booking.currency_code
        ?.trim()
        .toLowerCase() ??
      "";

    if (
      !/^[a-z]{3}$/.test(
        checkoutCurrency
      )
    ) {
      throw new Error(
        "Devise de réservation invalide."
      );
    }

"@

    $standardText =
        $standardText.Replace(
            $economicsMarker,
            $currencyBlock +
            $economicsMarker
        )

    $standardText =
        [regex]::Replace(
            $standardText,
            'currency\s*:\s*"eur",',
            'currency: checkoutCurrency,',
            1
        )

    if (
        $standardText -match
        '(?i)currency\s*:\s*"eur"'
    ) {
        throw "14.25 : EUR Stripe standard encore hardcode."
    }

    [System.IO.File]::WriteAllText(
        $standardPath,
        $standardText,
        $utf8
    )

    Write-Host "[OK] Checkout standard dynamique"
}
else {
    Write-Host "[OK] Checkout standard deja 14.25"
}

# GROUP CHECKOUT

$groupText =
    [System.IO.File]::ReadAllText(
        $groupPath
    )

if (
    -not $groupText.Contains(
        "KLYX_STRIPE_GROUP_CURRENCY_14_25"
    )
) {
    Backup-KlyxFile $groupPath

    $groupBlock = @"
    // KLYX_STRIPE_GROUP_CURRENCY_14_25
    const groupCurrency =
      String(
        group.currency ??
        ""
      )
        .trim()
        .toUpperCase();

    if (
      !/^[A-Z]{3}$/.test(
        groupCurrency
      )
    ) {
      throw new Error(
        "Devise du groupe invalide."
      );
    }

    const checkoutCurrency =
      groupCurrency.toLowerCase();

"@

    $userServiceMatch =
        [regex]::Match(
            $groupText,
            '(?m)^    const \{\r?\n      data:\r?\n        userService,'
        )

    if (
        -not $userServiceMatch.Success
    ) {
        throw "14.25 : ancre userService groupe introuvable."
    }

    $groupText =
        $groupText.Insert(
            $userServiceMatch.Index,
            $groupBlock
        )

    $groupText =
        [regex]::Replace(
            $groupText,
            'currency\s*:\s*"eur",',
            "currency:`r`n                checkoutCurrency,",
            1
        )

    if (
        $groupText -match
        '(?i)currency\s*:\s*"eur"'
    ) {
        throw "14.25 : EUR Stripe groupe encore hardcode."
    }

    [System.IO.File]::WriteAllText(
        $groupPath,
        $groupText,
        $utf8
    )

    Write-Host "[OK] Checkout groupe dynamique"
}
else {
    Write-Host "[OK] Checkout groupe deja 14.25"
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.25 APPLIED"
Write-Host "======================================"
Write-Host "Standard checkout : DYNAMIC CURRENCY"
Write-Host "Group checkout    : DYNAMIC CURRENCY"
Write-Host "Split checkout    : UNCHANGED"
Write-Host "Automatic payment : NONE"
Write-Host "======================================"