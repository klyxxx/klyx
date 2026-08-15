$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$reportDir =
    Join-Path $root "reports"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $reportDir |
    Out-Null

$jsonPath =
    Join-Path `
        $reportDir `
        "client-provider-flow-audit-13-63.json"

$txtPath =
    Join-Path `
        $reportDir `
        "client-provider-flow-audit-13-63.txt"

# ============================================================
# HELPERS
# ============================================================

function Test-KlyxPath {
    param(
        [string[]]$Candidates
    )

    foreach ($candidate in $Candidates) {
        $full =
            Join-Path $root $candidate

        if (
            Test-Path `
                -LiteralPath $full
        ) {
            return [PSCustomObject]@{
                Found = $true
                Path  = $candidate.Replace("\", "/")
            }
        }
    }

    return [PSCustomObject]@{
        Found = $false
        Path  = $null
    }
}

function Search-KlyxSource {
    param(
        [string[]]$Patterns
    )

    $roots =
        @(
            (Join-Path $root "app"),
            (Join-Path $root "lib")
        )

    $files =
        @()

    foreach ($sourceRoot in $roots) {
        if (
            Test-Path `
                -LiteralPath $sourceRoot
        ) {
            $files +=
                Get-ChildItem `
                    -LiteralPath $sourceRoot `
                    -Recurse `
                    -File `
                    -ErrorAction SilentlyContinue |
                Where-Object {
                    $_.Extension -in @(
                        ".ts",
                        ".tsx"
                    )
                }
        }
    }

    $hits =
        New-Object `
            System.Collections.Generic.List[string]

    foreach ($file in $files) {
        try {
            $text =
                [System.IO.File]::ReadAllText(
                    $file.FullName
                )
        }
        catch {
            continue
        }

        foreach ($pattern in $Patterns) {
            if (
                $text -match $pattern
            ) {
                $relative =
                    $file.FullName.Substring(
                        $root.Length + 1
                    ).Replace(
                        "\",
                        "/"
                    )

                if (
                    -not $hits.Contains(
                        $relative
                    )
                ) {
                    $hits.Add(
                        $relative
                    )
                }

                break
            }
        }
    }

    return @($hits)
}

function Build-Stage {
    param(
        [string]$Name,
        [string]$Purpose,
        [string[]]$Paths,
        [string[]]$Patterns
    )

    $pathResult =
        Test-KlyxPath `
            -Candidates $Paths

    $sourceHits =
        Search-KlyxSource `
            -Patterns $Patterns

    $implemented =
        $pathResult.Found -or
        $sourceHits.Count -gt 0

    return [ordered]@{
        name =
            $Name

        purpose =
            $Purpose

        implementedSignal =
            $implemented

        directPath =
            $pathResult.Path

        sourceHits =
            $sourceHits

        sourceHitCount =
            $sourceHits.Count

        status =
            if ($implemented) {
                "FOUND_REVIEW_REQUIRED"
            }
            else {
                "MISSING"
            }
    }
}

# ============================================================
# REAL USER JOURNEY
# ============================================================

$stages =
    @()

$stages +=
    Build-Stage `
        -Name "need_capture" `
        -Purpose "Client describes a service need." `
        -Paths @(
            "app\assistant\page.tsx"
        ) `
        -Patterns @(
            'api/brain/respond',
            'brain/respond',
            'message'
        )

$stages +=
    Build-Stage `
        -Name "brain_understanding" `
        -Purpose "KLYX understands service, city, date, time, budget and missing information." `
        -Paths @(
            "app\api\brain\respond\route.ts"
        ) `
        -Patterns @(
            'buildMissingFields',
            'buildReadinessPayload',
            'serviceSlug',
            'memoryUsed'
        )

$stages +=
    Build-Stage `
        -Name "market_publication" `
        -Purpose "Confirmed need can become a market request." `
        -Paths @(
            "app\api\brain\market-publish\route.ts",
            "app\assistant\market\page.tsx"
        ) `
        -Patterns @(
            'market-publish',
            'confirm_request',
            'market_request'
        )

$stages +=
    Build-Stage `
        -Name "provider_matching" `
        -Purpose "KLYX finds suitable providers for the need." `
        -Paths @(
            "app\api\brain\recommend\route.ts"
        ) `
        -Patterns @(
            'recommend',
            'matching',
            'service_profiles',
            'provider'
        )

$stages +=
    Build-Stage `
        -Name "provider_offer" `
        -Purpose "Provider can see and accept or refuse a mission." `
        -Paths @(
            "app\assistant\market\[id]\page.tsx"
        ) `
        -Patterns @(
            'accept',
            'reject',
            'provider_offer',
            'mission'
        )

$stages +=
    Build-Stage `
        -Name "client_confirmation" `
        -Purpose "Client explicitly confirms provider or booking choice." `
        -Paths @(
            "app\assistant\market\[id]\page.tsx",
            "app\book\[id]\page.tsx"
        ) `
        -Patterns @(
            'confirm',
            'confirmation',
            'explicit'
        )

$stages +=
    Build-Stage `
        -Name "booking_creation" `
        -Purpose "Confirmed service becomes a booking." `
        -Paths @(
            "app\book\[id]\page.tsx",
            "app\bookings\page.tsx"
        ) `
        -Patterns @(
            'bookings',
            'create_booking',
            'booking'
        )

$stages +=
    Build-Stage `
        -Name "payment" `
        -Purpose "Client can pay exactly once under confirmation and idempotency rules." `
        -Paths @(
            "app\api\stripe\checkout\route.ts"
        ) `
        -Patterns @(
            'checkout',
            'payment_intent',
            'idempot',
            'Stripe'
        )

$stages +=
    Build-Stage `
        -Name "service_tracking" `
        -Purpose "Booking lifecycle can move through execution and completion." `
        -Paths @(
            "app\bookings\[id]\page.tsx"
        ) `
        -Patterns @(
            'completed',
            'in_progress',
            'status',
            'lifecycle'
        )

$stages +=
    Build-Stage `
        -Name "verified_review" `
        -Purpose "Client can review a completed real booking." `
        -Paths @(
            "app\reviews\page.tsx"
        ) `
        -Patterns @(
            'reviews',
            'rating',
            'completed booking',
            'verified'
        )

# ============================================================
# PROVIDER ONBOARDING
# ============================================================

$providerChecks =
    [ordered]@{
        profile =
            Build-Stage `
                -Name "provider_profile" `
                -Purpose "Provider profile." `
                -Paths @(
                    "app\profile\page.tsx"
                ) `
                -Patterns @(
                    'service_profiles',
                    'provider'
                )

        services =
            Build-Stage `
                -Name "provider_services" `
                -Purpose "Provider defines services." `
                -Paths @(
                    "app\provider\services\page.tsx"
                ) `
                -Patterns @(
                    'user_services',
                    'service_profiles'
                )

        pricing =
            Build-Stage `
                -Name "provider_pricing" `
                -Purpose "Provider defines pricing." `
                -Paths @() `
                -Patterns @(
                    'hourly_rate',
                    'price',
                    'pricing'
                )

        areas =
            Build-Stage `
                -Name "provider_area" `
                -Purpose "Provider defines service area." `
                -Paths @() `
                -Patterns @(
                    'service_area',
                    'radius',
                    'city',
                    'zone'
                )

        availability =
            Build-Stage `
                -Name "provider_availability" `
                -Purpose "Provider defines availability." `
                -Paths @() `
                -Patterns @(
                    'availability',
                    'schedule',
                    'calendar'
                )
    }

# ============================================================
# SUMMARY
# ============================================================

$found =
    @(
        $stages |
        Where-Object {
            $_.implementedSignal
        }
    ).Count

$missing =
    $stages.Count -
    $found

$inventory =
    [ordered]@{
        generatedAt =
            (Get-Date).ToString(
                "yyyy-MM-dd HH:mm:ss"
            )

        step =
            "13.63"

        mode =
            "AUDIT_ONLY"

        productionWrites =
            $false

        paidApiCalls =
            $false

        automaticExecutionAllowed =
            $false

        journey =
            $stages

        providerOnboarding =
            $providerChecks

        summary =
            [ordered]@{
                totalJourneyStages =
                    $stages.Count

                stagesWithImplementationSignals =
                    $found

                stagesMissingSignals =
                    $missing
            }
    }

$json =
    $inventory |
    ConvertTo-Json -Depth 20

[System.IO.File]::WriteAllText(
    $jsonPath,
    $json,
    (
        New-Object `
            System.Text.UTF8Encoding($false)
    )
)

$lines =
    New-Object `
        System.Collections.Generic.List[string]

$lines.Add(
    "KLYX 13.63 — REAL CLIENT/PROVIDER FLOW AUDIT"
)

$lines.Add(
    "============================================="
)

$lines.Add(
    "Generated: " +
    (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
)

$lines.Add("")
$lines.Add("CLIENT JOURNEY")
$lines.Add("--------------")

foreach ($stage in $stages) {

    $lines.Add("")
    $lines.Add(
        $stage.name +
        " : " +
        $stage.status
    )

    $lines.Add(
        "Purpose : " +
        $stage.purpose
    )

    if ($stage.directPath) {
        $lines.Add(
            "Direct path : " +
            $stage.directPath
        )
    }

    $lines.Add(
        "Source hits : " +
        $stage.sourceHitCount
    )

    foreach (
        $hit
        in $stage.sourceHits
    ) {
        $lines.Add(
            "  - " +
            $hit
        )
    }
}

$lines.Add("")
$lines.Add("PROVIDER ONBOARDING")
$lines.Add("-------------------")

foreach (
    $key
    in $providerChecks.Keys
) {
    $item =
        $providerChecks[$key]

    $lines.Add(
        $item.name +
        " : " +
        $item.status
    )
}

$lines.Add("")
$lines.Add("SUMMARY")
$lines.Add("-------")

$lines.Add(
    "Journey stages : " +
    $stages.Count
)

$lines.Add(
    "Implementation signals found : " +
    $found
)

$lines.Add(
    "Missing signals : " +
    $missing
)

$lines.Add("")
$lines.Add(
    "IMPORTANT: FOUND_REVIEW_REQUIRED does not mean production-ready."
)

$lines.Add(
    "13.64 must inspect the weakest real user-flow stages and choose the first product gap to finish."
)

[System.IO.File]::WriteAllLines(
    $txtPath,
    $lines,
    (
        New-Object `
            System.Text.UTF8Encoding($false)
    )
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.63 AUDIT OK"
Write-Host "======================================"
Write-Host ("Journey stages : " + $stages.Count)
Write-Host ("Signals found : " + $found)
Write-Host ("Signals missing : " + $missing)
Write-Host "Production writes : NONE"
Write-Host "Paid API calls : NONE"
Write-Host "Automatic execution : IMPOSSIBLE"
Write-Host "Report JSON : reports\client-provider-flow-audit-13-63.json"
Write-Host "Report TXT : reports\client-provider-flow-audit-13-63.txt"
Write-Host "======================================"