$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$envPath =
    Join-Path `
        $root `
        ".env.local"

if (
    -not (
        Test-Path `
            -LiteralPath $envPath `
            -PathType Leaf
    )
) {
    throw "13.58 : .env.local introuvable."
}

$envLines =
    Get-Content `
        -LiteralPath $envPath

foreach (
    $line
    in $envLines
) {
    if (
        $line -match
        '^\s*OPENAI_API_KEY=(.+)$'
    ) {
        $value =
            $Matches[1].Trim()

        if ($value) {
            $env:OPENAI_API_KEY =
                $value
        }
    }

    if (
        $line -match
        '^\s*KLYX_OPENAI_MODEL=(.+)$'
    ) {
        $value =
            $Matches[1].Trim()

        if ($value) {
            $env:KLYX_OPENAI_MODEL =
                $value
        }
    }

    if (
        $line -match
        '^\s*KLYX_OPENAI_TIMEOUT_MS=(.+)$'
    ) {
        $value =
            $Matches[1].Trim()

        if ($value) {
            $env:KLYX_OPENAI_TIMEOUT_MS =
                $value
        }
    }
}

if (
    [string]::IsNullOrWhiteSpace(
        $env:OPENAI_API_KEY
    )
) {
    Write-Host ""
    Write-Host "======================================"
    Write-Host "KLYX 13.58 OPENAI SMOKE SKIPPED"
    Write-Host "======================================"
    Write-Host "OPENAI_API_KEY : NOT CONFIGURED"
    Write-Host "Real API call : NON"
    Write-Host "Application changed : NON"
    Write-Host "======================================"

    exit 0
}

$model =
    if (
        [string]::IsNullOrWhiteSpace(
            $env:KLYX_OPENAI_MODEL
        )
    ) {
        "gpt-5.6-terra"
    }
    else {
        $env:KLYX_OPENAI_MODEL
    }

$timeoutMs =
    15000

if (
    -not [string]::IsNullOrWhiteSpace(
        $env:KLYX_OPENAI_TIMEOUT_MS
    )
) {
    $parsed =
        0

    if (
        [int]::TryParse(
            $env:KLYX_OPENAI_TIMEOUT_MS,
            [ref]$parsed
        )
    ) {
        $timeoutMs =
            $parsed
    }
}

$body =
    @{
        model =
            $model

        reasoning =
            @{
                effort =
                    "low"
            }

        instructions =
            @"
You are a KLYX smoke-test reasoning engine.
Return analysis only.
Never claim to publish a request.
Never select a provider.
Never create a booking.
Never create or charge a payment.
Never issue a refund.
Automatic execution is forbidden.
"@

        input =
            @(
                @{
                    role =
                        "user"

                    content =
                        @(
                            @{
                                type =
                                    "input_text"

                                text =
                                    "Je cherche quelqu'un pour nettoyer mon appartement a Bruxelles demain matin. Analyse uniquement mon intention."
                            }
                        )
                }
            )

        text =
            @{
                format =
                    @{
                        type =
                            "json_schema"

                        name =
                            "klyx_smoke_test"

                        strict =
                            $true

                        schema =
                            @{
                                type =
                                    "object"

                                additionalProperties =
                                    $false

                                properties =
                                    @{
                                        text =
                                            @{
                                                type =
                                                    "string"
                                            }

                                        intent =
                                            @{
                                                type =
                                                    "string"

                                                enum =
                                                    @(
                                                        "service_request",
                                                        "conversation",
                                                        "recommendation",
                                                        "memory",
                                                        "clarification",
                                                        "unknown"
                                                    )
                                            }

                                        confidence =
                                            @{
                                                type =
                                                    "number"

                                                minimum =
                                                    0

                                                maximum =
                                                    1
                                            }

                                        automaticExecutionAllowed =
                                            @{
                                                type =
                                                    "boolean"

                                                const =
                                                    $false
                                            }
                                    }

                                required =
                                    @(
                                        "text",
                                        "intent",
                                        "confidence",
                                        "automaticExecutionAllowed"
                                    )
                            }
                    }
            }
    }

$jsonBody =
    $body |
    ConvertTo-Json -Depth 30

$headers =
    @{
        Authorization =
            "Bearer $($env:OPENAI_API_KEY)"

        "Content-Type" =
            "application/json"
    }

Write-Host ""
Write-Host "KLYX 13.58 - Real OpenAI isolated smoke test..."
Write-Host (
    "Model : " +
    $model
)
Write-Host ""

try {
    $response =
        Invoke-RestMethod `
            -Method Post `
            -Uri "https://api.openai.com/v1/responses" `
            -Headers $headers `
            -Body $jsonBody `
            -TimeoutSec (
                [math]::Ceiling(
                    $timeoutMs / 1000
                )
            )
}
catch {
    throw (
        "13.58 : OpenAI smoke test FAILED : " +
        $_.Exception.Message
    )
}

$raw =
    $null

if (
    $response.output_text
) {
    $raw =
        [string]$response.output_text
}

if (
    [string]::IsNullOrWhiteSpace(
        $raw
    )
) {
    $pieces =
        @()

    foreach (
        $item
        in @($response.output)
    ) {
        foreach (
            $entry
            in @($item.content)
        ) {
            if ($entry.text) {
                $pieces +=
                    [string]$entry.text
            }
        }
    }

    $raw =
        $pieces -join "`n"
}

if (
    [string]::IsNullOrWhiteSpace(
        $raw
    )
) {
    throw "13.58 : OpenAI returned no output text."
}

try {
    $parsed =
        $raw |
        ConvertFrom-Json
}
catch {
    throw (
        "13.58 : structured JSON invalid : " +
        $raw
    )
}

if (
    $parsed.automaticExecutionAllowed -ne
    $false
) {
    throw (
        "13.58 : SECURITY FAILURE - automatic execution was not false."
    )
}

if (
    $parsed.intent -ne
    "service_request"
) {
    throw (
        "13.58 : unexpected intent : " +
        $parsed.intent
    )
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.58 OPENAI SMOKE OK"
Write-Host "======================================"
Write-Host (
    "Model : " +
    $model
)
Write-Host (
    "Intent : " +
    $parsed.intent
)
Write-Host (
    "Confidence : " +
    $parsed.confidence
)
Write-Host "Structured output : OK"
Write-Host "Automatic execution : FALSE"
Write-Host "Booking created : NON"
Write-Host "Payment created : NON"
Write-Host "Market publication : NON"
Write-Host "Production data write : NON"
Write-Host "======================================"