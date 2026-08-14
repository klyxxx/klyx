$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Decode([string]$Value) {
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Value))
}

$newBlock = Decode "ICAgIC8vIEtMWVhfQ0FOT05JQ0FMX0ZJTkFOQ0VfUkVDT05DSUxJQVRJT05fMTNfMTIKCiAgICBjb25zdCBjb21tZXJjaWFsVHJhbnNhY3Rpb25zQWxsMTNfMTIgPQogICAgICBbCiAgICAgICAgLi4uY29tbWVyY2lhbFNpbmdsZXMxM18xMSwKICAgICAgICAuLi5jb21tZXJjaWFsR3JvdXBzMTNfMTEsCiAgICAgIF0KICAgICAgICAuc29ydCgKICAgICAgICAgICgKICAgICAgICAgICAgZmlyc3QsCiAgICAgICAgICAgIHNlY29uZAogICAgICAgICAgKSA9PgogICAgICAgICAgICBuZXcgRGF0ZSgKICAgICAgICAgICAgICBzZWNvbmQuY3JlYXRlZEF0CiAgICAgICAgICAgICkuZ2V0VGltZSgpIC0KICAgICAgICAgICAgbmV3IERhdGUoCiAgICAgICAgICAgICAgZmlyc3QuY3JlYXRlZEF0CiAgICAgICAgICAgICkuZ2V0VGltZSgpCiAgICAgICAgKTsKCiAgICAvKgogICAgICBMJ2ludGVyZmFjZSBjb25zZXJ2ZSBzZXVsZW1lbnQKICAgICAgbGVzIDEwMCB0cmFuc2FjdGlvbnMgbGVzIHBsdXMgcmVjZW50ZXMuCgogICAgICBMYSByZWNvbmNpbGlhdGlvbiB1dGlsaXNlIFRPVVRFUwogICAgICBsZXMgdHJhbnNhY3Rpb25zIGNvbW1lcmNpYWxlcy4KICAgICovCiAgICBjb25zdCB0cmFuc2FjdGlvbnMgPQogICAgICBjb21tZXJjaWFsVHJhbnNhY3Rpb25zQWxsMTNfMTIKICAgICAgICAuc2xpY2UoCiAgICAgICAgICAwLAogICAgICAgICAgMTAwCiAgICAgICAgKTsKCiAgICBsZXQgcmVjb25jaWxlZEdyb3NzUGFpZENlbnRzMTNfMTIgPQogICAgICAwOwoKICAgIGxldCByZWNvbmNpbGVkUGxhdGZvcm1GZWVDZW50czEzXzEyID0KICAgICAgMDsKCiAgICBsZXQgcmVjb25jaWxlZFByb3ZpZGVyQW1vdW50Q2VudHMxM18xMiA9CiAgICAgIDA7CgogICAgbGV0IHJlY29uY2lsZWRSZWZ1bmRlZENlbnRzMTNfMTIgPQogICAgICAwOwoKICAgIGxldCByZWNvbmNpbGVkUHJvY2Vzc2luZ1JlZnVuZENlbnRzMTNfMTIgPQogICAgICAwOwoKICAgIGZvciAoCiAgICAgIGNvbnN0IHRyYW5zYWN0aW9uCiAgICAgIG9mIGNvbW1lcmNpYWxUcmFuc2FjdGlvbnNBbGwxM18xMgogICAgKSB7CiAgICAgIGlmICgKICAgICAgICB0cmFuc2FjdGlvbi5lbnRyeVR5cGUgPT09CiAgICAgICAgICAicGF5bWVudF9zdWNjZWVkZWQiICYmCiAgICAgICAgdHJhbnNhY3Rpb24uc3RhdHVzID09PQogICAgICAgICAgInN1Y2NlZWRlZCIKICAgICAgKSB7CiAgICAgICAgcmVjb25jaWxlZEdyb3NzUGFpZENlbnRzMTNfMTIgKz0KICAgICAgICAgIGNlbnRzKAogICAgICAgICAgICB0cmFuc2FjdGlvbi5ncm9zc0Ftb3VudENlbnRzCiAgICAgICAgICApOwoKICAgICAgICByZWNvbmNpbGVkUGxhdGZvcm1GZWVDZW50czEzXzEyICs9CiAgICAgICAgICBjZW50cygKICAgICAgICAgICAgdHJhbnNhY3Rpb24ucGxhdGZvcm1GZWVDZW50cwogICAgICAgICAgKTsKCiAgICAgICAgcmVjb25jaWxlZFByb3ZpZGVyQW1vdW50Q2VudHMxM18xMiArPQogICAgICAgICAgY2VudHMoCiAgICAgICAgICAgIHRyYW5zYWN0aW9uLnByb3ZpZGVyQW1vdW50Q2VudHMKICAgICAgICAgICk7CgogICAgICAgIGNvbnRpbnVlOwogICAgICB9CgogICAgICBpZiAoCiAgICAgICAgdHJhbnNhY3Rpb24uZW50cnlUeXBlID09PQogICAgICAgICAgInJlZnVuZF9zdWNjZWVkZWQiICYmCiAgICAgICAgdHJhbnNhY3Rpb24uc3RhdHVzID09PQogICAgICAgICAgInN1Y2NlZWRlZCIKICAgICAgKSB7CiAgICAgICAgcmVjb25jaWxlZFJlZnVuZGVkQ2VudHMxM18xMiArPQogICAgICAgICAgY2VudHMoCiAgICAgICAgICAgIHRyYW5zYWN0aW9uLnJlZnVuZEFtb3VudENlbnRzCiAgICAgICAgICApOwoKICAgICAgICBjb250aW51ZTsKICAgICAgfQoKICAgICAgaWYgKAogICAgICAgIHRyYW5zYWN0aW9uLmVudHJ5VHlwZSA9PT0KICAgICAgICAgICJyZWZ1bmRfc3VjY2VlZGVkIiAmJgogICAgICAgIHRyYW5zYWN0aW9uLnN0YXR1cyA9PT0KICAgICAgICAgICJwcm9jZXNzaW5nIgogICAgICApIHsKICAgICAgICByZWNvbmNpbGVkUHJvY2Vzc2luZ1JlZnVuZENlbnRzMTNfMTIgKz0KICAgICAgICAgIGNlbnRzKAogICAgICAgICAgICB0cmFuc2FjdGlvbi5yZWZ1bmRBbW91bnRDZW50cwogICAgICAgICAgKTsKICAgICAgfQogICAgfQoKICAgIGNvbnN0IHJlY29uY2lsaWF0aW9uRGlmZmVyZW5jZXMxM18xMiA9IHsKICAgICAgZ3Jvc3NQYWlkQ2VudHM6CiAgICAgICAgcmVjb25jaWxlZEdyb3NzUGFpZENlbnRzMTNfMTIgLQogICAgICAgIGdyb3NzUGFpZENlbnRzLAoKICAgICAgcGxhdGZvcm1GZWVDZW50czoKICAgICAgICByZWNvbmNpbGVkUGxhdGZvcm1GZWVDZW50czEzXzEyIC0KICAgICAgICBwbGF0Zm9ybUZlZUNlbnRzLAoKICAgICAgcHJvdmlkZXJBbW91bnRDZW50czoKICAgICAgICByZWNvbmNpbGVkUHJvdmlkZXJBbW91bnRDZW50czEzXzEyIC0KICAgICAgICBwcm92aWRlckFtb3VudENlbnRzLAoKICAgICAgcmVmdW5kZWRDZW50czoKICAgICAgICByZWNvbmNpbGVkUmVmdW5kZWRDZW50czEzXzEyIC0KICAgICAgICByZWZ1bmRlZENlbnRzLAoKICAgICAgcmVmdW5kc1Byb2Nlc3NpbmdDZW50czoKICAgICAgICByZWNvbmNpbGVkUHJvY2Vzc2luZ1JlZnVuZENlbnRzMTNfMTIgLQogICAgICAgIHJlZnVuZHNQcm9jZXNzaW5nQ2VudHMsCiAgICB9OwoKICAgIGNvbnN0IHJlY29uY2lsaWF0aW9uT2sxM18xMiA9CiAgICAgIE9iamVjdC52YWx1ZXMoCiAgICAgICAgcmVjb25jaWxpYXRpb25EaWZmZXJlbmNlczEzXzEyCiAgICAgICkuZXZlcnkoCiAgICAgICAgKGRpZmZlcmVuY2UpID0+CiAgICAgICAgICBkaWZmZXJlbmNlID09PQogICAgICAgICAgMAogICAgICApOwoKICAgIGNvbnN0IHJlY29uY2lsaWF0aW9uID0gewogICAgICBjaGVja2VkOgogICAgICAgIHRydWUsCgogICAgICByZWNvbmNpbGVkOgogICAgICAgIHJlY29uY2lsaWF0aW9uT2sxM18xMiwKCiAgICAgIHN0YXR1czoKICAgICAgICByZWNvbmNpbGlhdGlvbk9rMTNfMTIKICAgICAgICAgID8gIm9rIgogICAgICAgICAgOiAicmV2aWV3X3JlcXVpcmVkIiwKCiAgICAgIHNvdXJjZToKICAgICAgICAiY2Fub25pY2FsX3N1bW1hcnlfdnNfY29tbWVyY2lhbF90cmFuc2FjdGlvbnMiLAoKICAgICAgY2Fub25pY2FsU3VtbWFyeTogewogICAgICAgIGdyb3NzUGFpZENlbnRzLAoKICAgICAgICBwbGF0Zm9ybUZlZUNlbnRzLAoKICAgICAgICBwcm92aWRlckFtb3VudENlbnRzLAoKICAgICAgICByZWZ1bmRlZENlbnRzLAoKICAgICAgICByZWZ1bmRzUHJvY2Vzc2luZ0NlbnRzLAogICAgICB9LAoKICAgICAgY29tbWVyY2lhbFRyYW5zYWN0aW9uczogewogICAgICAgIGdyb3NzUGFpZENlbnRzOgogICAgICAgICAgcmVjb25jaWxlZEdyb3NzUGFpZENlbnRzMTNfMTIsCgogICAgICAgIHBsYXRmb3JtRmVlQ2VudHM6CiAgICAgICAgICByZWNvbmNpbGVkUGxhdGZvcm1GZWVDZW50czEzXzEyLAoKICAgICAgICBwcm92aWRlckFtb3VudENlbnRzOgogICAgICAgICAgcmVjb25jaWxlZFByb3ZpZGVyQW1vdW50Q2VudHMxM18xMiwKCiAgICAgICAgcmVmdW5kZWRDZW50czoKICAgICAgICAgIHJlY29uY2lsZWRSZWZ1bmRlZENlbnRzMTNfMTIsCgogICAgICAgIHJlZnVuZHNQcm9jZXNzaW5nQ2VudHM6CiAgICAgICAgICByZWNvbmNpbGVkUHJvY2Vzc2luZ1JlZnVuZENlbnRzMTNfMTIsCiAgICAgIH0sCgogICAgICBkaWZmZXJlbmNlQ2VudHM6CiAgICAgICAgcmVjb25jaWxpYXRpb25EaWZmZXJlbmNlczEzXzEyLAoKICAgICAgY29tbWVyY2lhbEV2ZW50c0NoZWNrZWQ6CiAgICAgICAgY29tbWVyY2lhbFRyYW5zYWN0aW9uc0FsbDEzXzEyLmxlbmd0aCwKCiAgICAgIGNvbW1lcmNpYWxFdmVudHNSZXR1cm5lZDoKICAgICAgICB0cmFuc2FjdGlvbnMubGVuZ3RoLAoKICAgICAgaGlzdG9yeVRydW5jYXRlZEZvckRpc3BsYXk6CiAgICAgICAgY29tbWVyY2lhbFRyYW5zYWN0aW9uc0FsbDEzXzEyLmxlbmd0aCA+CiAgICAgICAgdHJhbnNhY3Rpb25zLmxlbmd0aCwKCiAgICAgIHJlYWRPbmx5OgogICAgICAgIHRydWUsCgogICAgICBsZWRnZXJNb2RpZmllZDoKICAgICAgICBmYWxzZSwKCiAgICAgIHN0cmlwZU1vZGlmaWVkOgogICAgICAgIGZhbHNlLAoKICAgICAgYXV0b21hdGljQ29ycmVjdGlvbjoKICAgICAgICBmYWxzZSwKICAgIH07"

$financePath = Join-Path $root "app\api\provider\finance\route.ts"
$auditPath = Join-Path $root "app\api\provider\finance-audit\route.ts"

foreach ($path in @($financePath, $auditPath)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "13.12 : fichier requis introuvable : $path"
    }
}

$finance = [System.IO.File]::ReadAllText($financePath)
$audit = [System.IO.File]::ReadAllText($auditPath)

if (-not $finance.Contains("KLYX_CANONICAL_FINANCE_TRANSACTIONS_13_11")) {
    throw "13.12 : KLYX 13.11 introuvable."
}

if (-not $finance.Contains("KLYX_GROUP_SCHEMA_RUNTIME_FINANCE_13_05C")) {
    throw "13.12 : finance canonique 13.05c introuvable."
}

if (-not $audit.Contains("KLYX_GROUP_FINANCE_AUDIT_API_13_03")) {
    throw "13.12 : audit 13.03 introuvable."
}

if ($finance.Contains("KLYX_CANONICAL_FINANCE_RECONCILIATION_13_12")) {
    Write-Host "KLYX 13.12 deja applique."
    exit 0
}

$startNeedle = "    const transactions ="
$start = $finance.LastIndexOf($startNeedle)

if ($start -lt 0) {
    throw "13.12 : bloc transactions 13.11 introuvable."
}

$returnNeedle = "    return NextResponse.json({"
$returnIndex = $finance.LastIndexOf($returnNeedle)

if ($returnIndex -lt 0 -or $returnIndex -le $start) {
    throw "13.12 : retour final finance introuvable."
}

$before = $finance.Substring(0, $start)
$after = $finance.Substring($returnIndex)

$finance = $before + $newBlock.TrimEnd() + "`r`n`r`n" + $after

# ------------------------------------------------------------
# Expose reconciliation dans le payload final.
# ------------------------------------------------------------

$pattern = '(?m)^(\s{6}transactions,\s*)$'
$matches = [regex]::Matches($finance, $pattern)

if ($matches.Count -ne 1) {
    throw "13.12 : emplacement transactions du payload ambigu : $($matches.Count)"
}

$match = $matches[0]
$replacement = $match.Value + "`r`n`r`n      reconciliation,"

$finance =
    $finance.Remove(
        $match.Index,
        $match.Length
    ).Insert(
        $match.Index,
        $replacement
    )

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

Copy-Item -LiteralPath $financePath -Destination ($financePath + ".bak-13-12-" + $timestamp) -Force

[System.IO.File]::WriteAllText($financePath, $finance, $utf8)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.12 APPLIQUE"
Write-Host "======================================"
Write-Host "Resume financier : RECONCILIE"
Write-Host "Transactions commerciales : RECONCILIEES"
Write-Host "Limite UI 100 : HORS CALCUL TOTAL"
Write-Host "Incoherence : SIGNALEE"
Write-Host "Correction automatique : NON"
Write-Host "Ledger : INCHANGE"
Write-Host "Stripe : INCHANGE"
Write-Host "Migration : AUCUNE"
Write-Host "======================================"
