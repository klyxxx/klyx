param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$SupabaseArguments
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# KLYX_DR_SUPABASE_TRANSIENT_RETRY
# Transparent wrapper used only by the automatic DR runner.
# It retries transient Supabase/pooler/network failures and never retries
# deterministic/authentication/configuration errors.

$RealExecutable =
    $env:KLYX_DR_REAL_SUPABASE_EXECUTABLE

if (-not $RealExecutable) {
    throw "KLYX_DR_REAL_SUPABASE_EXECUTABLE missing."
}

if (
    -not (
        Test-Path `
            -LiteralPath $RealExecutable `
            -PathType Leaf
    )
) {
    throw "Real Supabase CLI executable missing."
}

$DelaysSeconds = @(0, 5, 30, 120, 300)
$TransientPattern =
    "server closed the connection unexpectedly|" +
    "connection reset|connection refused|could not connect|" +
    "timeout|timed out|unexpected eof|temporary failure|" +
    "terminating connection|broken pipe|tls handshake|" +
    "HTTP\s+5\d\d|status(?: code)?:?\s+5\d\d|" +
    "(^|\D)429(\D|$)"

$OutputPath =
    $null

for ($Index = 0; $Index -lt $SupabaseArguments.Count; $Index++) {
    if (
        $SupabaseArguments[$Index] -in @("-f", "--file") -and
        ($Index + 1) -lt $SupabaseArguments.Count
    ) {
        $OutputPath =
            $SupabaseArguments[$Index + 1]

        break
    }
}

$LogPath =
    Join-Path `
        ([System.IO.Path]::GetTempPath()) `
        ("klyx-supabase-retry-{0}.log" -f ([guid]::NewGuid().ToString("N")))

try {
    for ($Attempt = 0; $Attempt -lt $DelaysSeconds.Count; $Attempt++) {
        $Delay =
            $DelaysSeconds[$Attempt]

        if ($Delay -gt 0) {
            $Jitter =
                Get-Random `
                    -Minimum 0 `
                    -Maximum 8

            Start-Sleep `
                -Seconds ($Delay + $Jitter)
        }

        if (
            $OutputPath -and
            (
                Test-Path `
                    -LiteralPath $OutputPath `
                    -PathType Leaf
            )
        ) {
            Remove-Item `
                -LiteralPath $OutputPath `
                -Force `
                -ErrorAction SilentlyContinue
        }

        Remove-Item `
            -LiteralPath $LogPath `
            -Force `
            -ErrorAction SilentlyContinue

        $PreviousErrorActionPreference =
            $ErrorActionPreference

        try {
            $ErrorActionPreference =
                "Continue"

            & $RealExecutable @SupabaseArguments 2>&1 |
                Tee-Object `
                    -FilePath $LogPath

            $ExitCode =
                $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference =
                $PreviousErrorActionPreference
        }

        if ($ExitCode -eq 0) {
            if (
                $OutputPath -and
                (
                    -not (
                        Test-Path `
                            -LiteralPath $OutputPath `
                            -PathType Leaf
                    ) -or
                    (
                        Get-Item `
                            -LiteralPath $OutputPath
                    ).Length -le 0
                )
            ) {
                throw "Supabase command returned success but produced no valid dump."
            }

            exit 0
        }

        $LogText =
            if (
                Test-Path `
                    -LiteralPath $LogPath `
                    -PathType Leaf
            ) {
                Get-Content `
                    -LiteralPath $LogPath `
                    -Raw
            }
            else {
                ""
            }

        $IsTransient =
            $LogText -match $TransientPattern

        if (-not $IsTransient) {
            Write-Error "Supabase command failed with a non-transient error; retry refused."
            exit $ExitCode
        }

        if ($Attempt -eq ($DelaysSeconds.Count - 1)) {
            Write-Error "Supabase command exhausted bounded transient retries."
            exit $ExitCode
        }

        Write-Warning (
            "Transient Supabase/pooler failure detected. " +
            "Retrying automatically with bounded backoff."
        )
    }
}
finally {
    Remove-Item `
        -LiteralPath $LogPath `
        -Force `
        -ErrorAction SilentlyContinue
}

exit 1
