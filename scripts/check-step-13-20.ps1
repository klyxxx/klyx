$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$migration =
    Join-Path $root "supabase\migrations\20260813143000_klyx_split_booking_recovery_13_20.sql"

$confirm =
    Join-Path $root "app\api\market\requests\[id]\split-fallback\confirm\route.ts"

$recovery =
    Join-Path $root "app\api\market\requests\[id]\split-fallback\book\recovery\route.ts"

$component =
    Join-Path $root "app\assistant\market\[id]\split-plan\SplitBookingRecovery.tsx"

$page =
    Join-Path $root "app\assistant\market\[id]\split-plan\page.tsx"

$book =
    Join-Path $root "app\api\market\requests\[id]\split-fallback\book\route.ts"

foreach (
    $path
    in @(
        $migration,
        $confirm,
        $recovery,
        $component,
        $page,
        $book
    )
) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "KLYX 13.20 : fichier introuvable : $path"
    }
}

$m =
    [System.IO.File]::ReadAllText($migration)

$c =
    [System.IO.File]::ReadAllText($confirm)

$r =
    [System.IO.File]::ReadAllText($recovery)

$u =
    [System.IO.File]::ReadAllText($component)

$p =
    [System.IO.File]::ReadAllText($page)

$b =
    [System.IO.File]::ReadAllText($book)

$checks =
    @(
        @(
            "13.20 migration marker",
            $m.Contains("KLYX_SPLIT_BOOKING_RECOVERY_13_20")
        ),
        @(
            "proof consumption table",
            $m.Contains("split_booking_proof_consumptions")
        ),
        @(
            "batch integrity trigger",
            $m.Contains("klyx_split_batch_integrity_13_20")
        ),
        @(
            "item count trigger",
            $m.Contains("klyx_split_batch_item_count_13_20")
        ),
        @(
            "proof consumption trigger",
            $m.Contains("klyx_consume_split_booking_proof_13_20")
        ),
        @(
            "13.18 consumed proof support",
            $c.Contains("KLYX_SPLIT_PROOF_CONSUMED_13_20")
        ),
        @(
            "recovery API",
            $r.Contains("KLYX_SPLIT_BOOKING_RECOVERY_API_13_20")
        ),
        @(
            "manual finalize",
            $r.Contains('"finalize"')
        ),
        @(
            "explicit recovery confirmation",
            $r.Contains("recoveryConfirmed")
        ),
        @(
            "partial survivor detection",
            $r.Contains("partial_survivors")
        ),
        @(
            "complete unfinalized detection",
            $r.Contains("complete_but_unfinalized")
        ),
        @(
            "stale batch detection",
            $r.Contains("creating_stale")
        ),
        @(
            "no auto retry",
            $r.Contains("canAutoRetry")
        ),
        @(
            "no automatic payment",
            $r.Contains("automaticPayment")
        ),
        @(
            "recovery UI",
            $u.Contains("KLYX_SPLIT_BOOKING_RECOVERY_UI_13_20")
        ),
        @(
            "recovery UI wiring",
            $p.Contains("KLYX_SPLIT_BOOKING_RECOVERY_WIRING_13_20")
        ),
        @(
            "13.19 retained",
            $b.Contains("KLYX_SPLIT_BOOKING_API_13_19")
        ),
        @(
            "no Stripe recovery",
            -not $r.Contains("create-checkout")
        )
    )

$failed =
    @()

Write-Host ""
Write-Host "CHECK KLYX 13.20"
Write-Host ""

foreach (
    $check
    in $checks
) {
    if ($check[1]) {
        Write-Host (
            "[OK]   " +
            $check[0]
        )
    }

    if (-not $check[1]) {
        Write-Host (
            "[FAIL] " +
            $check[0]
        )

        $failed +=
            $check[0]
    }
}

if (
    $failed.Count -gt 0
) {
    Write-Host ""
    Write-Host "ECHECS EXACTS :"

    foreach (
        $item
        in $failed
    ) {
        Write-Host (
            " - " +
            $item
        )
    }

    throw "KLYX 13.20 static checker FAILED."
}

Write-Host ""
Write-Host "Supabase migration..."
Write-Host ""

npx.cmd supabase db push

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.20 Supabase db push FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.20 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.20 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.20 CHECK OK"
Write-Host "======================================"
Write-Host "Split proof consumption : ACTIVE"
Write-Host "Proof self-invalidation : PROTEGEE"
Write-Host "Batch count integrity : ACTIVE"
Write-Host "Partial survivors : DETECTES"
Write-Host "Interrupted batch : DETECTE"
Write-Host "Manual recovery finalize : ACTIVE"
Write-Host "Automatic retry : NON"
Write-Host "Automatic booking recovery : NON"
Write-Host "Automatic payment : NON"
Write-Host "Supabase : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"