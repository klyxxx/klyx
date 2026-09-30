param(
    [string]$OffsiteDirectory = "C:\Users\fenjo\OneDrive\KLYX-DR",
    [int]$RetentionDays = 30,
    [int]$MinimumCopies = 3,
    [int]$SupabaseMaxAttempts = 4,
    [int]$RetryBaseSeconds = 2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Implementation = Join-Path $PSScriptRoot "backup-klyx-supabase-dr-resilient.ps1"
if (-not (Test-Path -LiteralPath $Implementation -PathType Leaf)) {
    throw "Resilient DR backup implementation missing: $Implementation"
}

& $Implementation `
    -OffsiteDirectory $OffsiteDirectory `
    -RetentionDays $RetentionDays `
    -MinimumCopies $MinimumCopies `
    -SupabaseMaxAttempts $SupabaseMaxAttempts `
    -RetryBaseSeconds $RetryBaseSeconds
