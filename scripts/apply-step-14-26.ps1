$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$utf8 =
    [System.Text.UTF8Encoding]::new(
        $false
    )

$paymentPath =
    Join-Path `
        $root `
        "lib\stripe-payments.ts"

$groupPath =
    Join-Path `
        $root `
        "lib\stripe-group-payments.ts"

foreach ($path in @(
    $paymentPath,
    $groupPath
)) {
    if (
        -not (
            Test-Path `
                -LiteralPath $path `
                -PathType Leaf
        )
    ) {
        throw "14.26 : fichier introuvable : $path"
    }
}

function Backup-KlyxFile(
    [string]$Path
) {
    $backup =
        "$Path.14-26.bak"

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
Write-Host "KLYX 14.26"
Write-Host "Stripe currency integrity..."
Write-Host ""

# ==================================================
# STANDARD PAYMENT CONFIRMATION
# ==================================================

$paymentText =
    [System.IO.File]::ReadAllText(
        $paymentPath
    )

if (
    -not $paymentText.Contains(
        "KLYX_PAYMENT_CURRENCY_INTEGRITY_14_26"
    )
) {
    Backup-KlyxFile $paymentPath

    if (
        -not $paymentText.Contains(
            "currency_code: string | null;"
        )
    ) {
        $paymentText =
            $paymentText.Replace(
                "  currency: string | null;",
                "  currency: string | null;`r`n  currency_code: string | null;"
            )
    }

    if (
        -not $paymentText.Contains(
            "amount_total, currency, currency_code, payment_mode"
        )
    ) {
        $paymentText =
            $paymentText.Replace(
                "amount_total, currency, payment_mode",
                "amount_total, currency, currency_code, payment_mode"
            )
    }

    $formatAnchor =
        "function formatAmount("

    $formatIndex =
        $paymentText.IndexOf(
            $formatAnchor
        )

    if (
        $formatIndex -lt 0
    ) {
        throw "14.26 : ancre formatAmount introuvable."
    }

    $currencyHelper = @"
// KLYX_PAYMENT_CURRENCY_INTEGRITY_14_26
function normalizeKlyxPaymentCurrency(
  value: string | null | undefined
): string {
  const currency =
    value
      ?.trim()
      .toUpperCase() ??
    "";

  if (
    !/^[A-Z]{3}$/.test(
      currency
    )
  ) {
    throw new Error(
      "Devise KLYX invalide ou absente."
    );
  }

  return currency;
}

function bookingCurrencyCode(
  booking: BookingPaymentRow
): string {
  return normalizeKlyxPaymentCurrency(
    booking.currency_code ??
    booking.currency
  );
}

"@

    $paymentText =
        $paymentText.Insert(
            $formatIndex,
            $currencyHelper
        )

    $paymentText =
        [regex]::Replace(
            $paymentText,
            'const expectedCurrency\s*=\s*\(\s*booking\.currency\s*\|\|\s*"EUR"\s*\)\.toLowerCase\(\);',
            'const expectedCurrency = bookingCurrencyCode(booking).toLowerCase();'
        )

    $paymentText =
        [regex]::Replace(
            $paymentText,
            'formatAmount\(\s*amount,\s*booking\.currency\s*\)',
            'formatAmount(amount, bookingCurrencyCode(booking))'
        )

    $paymentText =
        [regex]::Replace(
            $paymentText,
            'currency:\s*\(currency\s*\|\|\s*"EUR"\)\.toUpperCase\(\),',
            'currency: normalizeKlyxPaymentCurrency(currency),'
        )

    $paymentText =
        [regex]::Replace(
            $paymentText,
            'currency:\s*booking\.currency,',
            'currency: bookingCurrencyCode(booking),'
        )

    if (
        $paymentText -match
        'booking\.currency\s*\|\|\s*"EUR"'
    ) {
        throw "14.26 : fallback EUR standard encore present."
    }

    [System.IO.File]::WriteAllText(
        $paymentPath,
        $paymentText,
        $utf8
    )

    Write-Host "[OK] Confirmation standard protegee"
}
else {
    Write-Host "[OK] Confirmation standard deja 14.26"
}

# ==================================================
# GROUP PAYMENT CONFIRMATION
# ==================================================

$groupText =
    [System.IO.File]::ReadAllText(
        $groupPath
    )

if (
    -not $groupText.Contains(
        "KLYX_GROUP_CURRENCY_INTEGRITY_14_26"
    )
) {
    Backup-KlyxFile $groupPath

    if (
        -not $groupText.Contains(
            "currency_code: string | null;"
        )
    ) {
        $groupText =
            $groupText.Replace(
                "  currency: string | null;`r`n};",
                "  currency: string | null;`r`n  currency_code: string | null;`r`n};"
            )
    }

    if (
        -not $groupText.Contains(
            '"id, amount_total, currency, currency_code"'
        )
    ) {
        $groupText =
            $groupText.Replace(
                '"id, amount_total, currency"',
                '"id, amount_total, currency, currency_code"'
            )
    }

    $groupAnchor =
        "async function findGroupFromSession("

    $groupIndex =
        $groupText.IndexOf(
            $groupAnchor
        )

    if (
        $groupIndex -lt 0
    ) {
        throw "14.26 : ancre group helper introuvable."
    }

    $groupHelper = @"
// KLYX_GROUP_CURRENCY_INTEGRITY_14_26
function normalizeGroupCurrency(
  value: string | null | undefined
): string {
  const currency =
    value
      ?.trim()
      .toUpperCase() ??
    "";

  if (
    !/^[A-Z]{3}$/.test(
      currency
    )
  ) {
    throw new Error(
      "Devise du groupe KLYX invalide ou absente."
    );
  }

  return currency;
}

function groupCurrencyCode(
  group: GroupRow
): string {
  return normalizeGroupCurrency(
    group.currency
  );
}

function childCurrencyCode(
  child: ChildBooking,
  fallback: string
): string {
  const raw =
    child.currency_code ??
    child.currency;

  if (!raw) {
    return fallback;
  }

  return normalizeGroupCurrency(
    raw
  );
}

function formatGroupAmount(
  amountCents: number,
  currency: string
): string {
  return new Intl.NumberFormat(
    "fr",
    {
      style: "currency",
      currency,
    }
  ).format(
    amountCents / 100
  );
}

"@

    $groupText =
        $groupText.Insert(
            $groupIndex,
            $groupHelper
        )

    $groupText =
        [regex]::Replace(
            $groupText,
            'const currency\s*=\s*\(\s*group\.currency\s*\|\|\s*"EUR"\s*\)\.toLowerCase\(\);',
            'const currency = groupCurrencyCode(group).toLowerCase();'
        )

    $childrenUpdateAnchor = @"
  const {
    error:
      childrenUpdateError,
"@

    $childrenIndex =
        $groupText.IndexOf(
            $childrenUpdateAnchor
        )

    if (
        $childrenIndex -lt 0
    ) {
        throw "14.26 : ancre validation enfants introuvable."
    }

    $childrenGuard = @"
  // KLYX_GROUP_CHILD_CURRENCY_GUARD_14_26
  const canonicalGroupCurrency =
    groupCurrencyCode(
      group
    );

  for (
    const child
    of childRows
  ) {
    const childCurrency =
      childCurrencyCode(
        child,
        canonicalGroupCurrency
      );

    if (
      childCurrency !==
      canonicalGroupCurrency
    ) {
      throw new Error(
        "La devise d'une réservation ne correspond pas à la devise du groupe."
      );
    }
  }

"@

    $groupText =
        $groupText.Insert(
            $childrenIndex,
            $childrenGuard
        )

    $groupText =
        [regex]::Replace(
            $groupText,
            'currency:\s*child\.currency\s*\?\?\s*group\.currency,',
            "currency:`r`n          childCurrencyCode(child, canonicalGroupCurrency),"
        )

    $oldMessage = @"
      message:
        "Le paiement unique de " +
        (
          amountTotal /
          100
        ).toFixed(2) +
        " EUR couvre tous les creneaux.",
"@

    $newMessage = @"
      message:
        "Le paiement unique de " +
        formatGroupAmount(
          amountTotal,
          canonicalGroupCurrency
        ) +
        " couvre tous les creneaux.",
"@

    if (
        $groupText.Contains(
            $oldMessage
        )
    ) {
        $groupText =
            $groupText.Replace(
                $oldMessage,
                $newMessage
            )
    }
    else {
        $groupText =
            [regex]::Replace(
                $groupText,
                '" EUR couvre tous les creneaux\."',
                '" couvre tous les creneaux."'
            )
    }

    if (
        $groupText -match
        'group\.currency\s*\|\|\s*"EUR"'
    ) {
        throw "14.26 : fallback EUR groupe encore present."
    }

    if (
        $groupText.Contains(
            " EUR couvre tous les creneaux."
        )
    ) {
        throw "14.26 : notification groupe EUR encore hardcode."
    }

    [System.IO.File]::WriteAllText(
        $groupPath,
        $groupText,
        $utf8
    )

    Write-Host "[OK] Confirmation groupe protegee"
}
else {
    Write-Host "[OK] Confirmation groupe deja 14.26"
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.26 APPLIED"
Write-Host "======================================"
Write-Host "Stripe confirmation : CURRENCY GUARDED"
Write-Host "Standard webhook    : DYNAMIC"
Write-Host "Group webhook       : DYNAMIC"
Write-Host "Ledger currency     : CANONICAL"
Write-Host "EUR notification    : REMOVED"
Write-Host "Automatic payment   : NONE"
Write-Host "======================================"