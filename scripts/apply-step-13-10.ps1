$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Decode([string]$Value) {
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Value))
}

$wrapperTemplate = Decode "Ci8vIEtMWVhfTVVMVElfU0xPVF9PRkZFUl9BVE9NSUNfUkVDT1ZFUllfMTNfMTAKCnR5cGUgS2x5eE9mZmVyUm91dGVDb250ZXh0MTNfMTAgPSB7CiAgcGFyYW1zOgogICAgUHJvbWlzZTx7CiAgICAgIGlkOgogICAgICAgIHN0cmluZzsKICAgIH0+Owp9OwoKZnVuY3Rpb24ga2x5eEF0b21pY09mZmVyUmVjb3ZlcnkxM18xMCgKICBtZXNzYWdlOgogICAgc3RyaW5nCikgewogIGNvbnN0IG5vcm1hbGl6ZWQgPQogICAgbWVzc2FnZS50b1VwcGVyQ2FzZSgpOwoKICBpZiAoCiAgICBub3JtYWxpemVkLmluY2x1ZGVzKAogICAgICAiS0xZWF9NVUxUSV9TTE9UX09GRkVSX0FUT01JQ19DT1ZFUkFHRV9SRVFVSVJFRCIKICAgICkKICApIHsKICAgIHJldHVybiBSZXNwb25zZS5qc29uKAogICAgICB7CiAgICAgICAgY29kZToKICAgICAgICAgICJNVUxUSV9TTE9UX09GRkVSX0FWQUlMQUJJTElUWV9DSEFOR0VEIiwKCiAgICAgICAgZXJyb3I6CiAgICAgICAgICAiVG9uIHBsYW5uaW5nIGEgY2hhbmdlIGV0IHR1IG5lIGNvdXZyZXMgcGx1cyB0b3VzIGxlcyBjcmVuZWF1eCBkZSBjZXR0ZSBkZW1hbmRlLiBLTFlYIGEgYmxvcXVlIGwnb2ZmcmUuIiwKCiAgICAgICAgcmVjb3Zlcnk6IHsKICAgICAgICAgIG9mZmVyQ3JlYXRlZDoKICAgICAgICAgICAgZmFsc2UsCgogICAgICAgICAgYm9va2luZ0NyZWF0ZWQ6CiAgICAgICAgICAgIGZhbHNlLAoKICAgICAgICAgIHBheW1lbnRDcmVhdGVkOgogICAgICAgICAgICBmYWxzZSwKCiAgICAgICAgICBhdmFpbGFiaWxpdHlDaGFuZ2VkOgogICAgICAgICAgICB0cnVlLAoKICAgICAgICAgIHJlZnJlc2hKb2JzOgogICAgICAgICAgICB0cnVlLAoKICAgICAgICAgIHJldmlld1BsYW5uaW5nOgogICAgICAgICAgICB0cnVlLAoKICAgICAgICAgIHJldHJ5QWZ0ZXJQbGFubmluZ1VwZGF0ZToKICAgICAgICAgICAgdHJ1ZSwKICAgICAgICB9LAoKICAgICAgICBhdXRvbWF0aWNPZmZlcjoKICAgICAgICAgIGZhbHNlLAoKICAgICAgICBhdXRvbWF0aWNCb29raW5nOgogICAgICAgICAgZmFsc2UsCgogICAgICAgIGF1dG9tYXRpY1BheW1lbnQ6CiAgICAgICAgICBmYWxzZSwKICAgICAgfSwKICAgICAgewogICAgICAgIHN0YXR1czoKICAgICAgICAgIDQwOSwKCiAgICAgICAgaGVhZGVyczogewogICAgICAgICAgImNhY2hlLWNvbnRyb2wiOgogICAgICAgICAgICAibm8tc3RvcmUiLAogICAgICAgIH0sCiAgICAgIH0KICAgICk7CiAgfQoKICBpZiAoCiAgICBub3JtYWxpemVkLmluY2x1ZGVzKAogICAgICAiS0xZWF9NVUxUSV9TTE9UX09GRkVSX0FUT01JQ19SRVFVRVNUX05PVF9PUEVOIgogICAgKQogICkgewogICAgcmV0dXJuIFJlc3BvbnNlLmpzb24oCiAgICAgIHsKICAgICAgICBjb2RlOgogICAgICAgICAgIk1VTFRJX1NMT1RfT0ZGRVJfUkVRVUVTVF9DTE9TRUQiLAoKICAgICAgICBlcnJvcjoKICAgICAgICAgICJDZXR0ZSBkZW1hbmRlIG4nZXN0IHBsdXMgb3V2ZXJ0ZSBhdXggbm91dmVsbGVzIG9mZnJlcy4iLAoKICAgICAgICByZWNvdmVyeTogewogICAgICAgICAgb2ZmZXJDcmVhdGVkOgogICAgICAgICAgICBmYWxzZSwKCiAgICAgICAgICBib29raW5nQ3JlYXRlZDoKICAgICAgICAgICAgZmFsc2UsCgogICAgICAgICAgcGF5bWVudENyZWF0ZWQ6CiAgICAgICAgICAgIGZhbHNlLAoKICAgICAgICAgIHJlZnJlc2hKb2JzOgogICAgICAgICAgICB0cnVlLAoKICAgICAgICAgIHJldHJ5QWxsb3dlZDoKICAgICAgICAgICAgZmFsc2UsCiAgICAgICAgfSwKCiAgICAgICAgYXV0b21hdGljT2ZmZXI6CiAgICAgICAgICBmYWxzZSwKCiAgICAgICAgYXV0b21hdGljQm9va2luZzoKICAgICAgICAgIGZhbHNlLAoKICAgICAgICBhdXRvbWF0aWNQYXltZW50OgogICAgICAgICAgZmFsc2UsCiAgICAgIH0sCiAgICAgIHsKICAgICAgICBzdGF0dXM6CiAgICAgICAgICA0MDksCgogICAgICAgIGhlYWRlcnM6IHsKICAgICAgICAgICJjYWNoZS1jb250cm9sIjoKICAgICAgICAgICAgIm5vLXN0b3JlIiwKICAgICAgICB9LAogICAgICB9CiAgICApOwogIH0KCiAgaWYgKAogICAgbm9ybWFsaXplZC5pbmNsdWRlcygKICAgICAgIktMWVhfTVVMVElfU0xPVF9PRkZFUl9BVE9NSUNfQ09OVEVYVF9SRVFVSVJFRCIKICAgICkKICApIHsKICAgIHJldHVybiBSZXNwb25zZS5qc29uKAogICAgICB7CiAgICAgICAgY29kZToKICAgICAgICAgICJNVUxUSV9TTE9UX09GRkVSX0NPTlRFWFRfUkVRVUlSRUQiLAoKICAgICAgICBlcnJvcjoKICAgICAgICAgICJLTFlYIG5lIHBldXQgcGFzIHByb3V2ZXIgbGUgc2VydmljZSBleGFjdCB1dGlsaXNlIHBvdXIgY2V0dGUgb2ZmcmUuIEwnZW52b2kgYSBldGUgYmxvcXVlLiIsCgogICAgICAgIHJlY292ZXJ5OiB7CiAgICAgICAgICBvZmZlckNyZWF0ZWQ6CiAgICAgICAgICAgIGZhbHNlLAoKICAgICAgICAgIGJvb2tpbmdDcmVhdGVkOgogICAgICAgICAgICBmYWxzZSwKCiAgICAgICAgICBwYXltZW50Q3JlYXRlZDoKICAgICAgICAgICAgZmFsc2UsCgogICAgICAgICAgcmVmcmVzaEpvYnM6CiAgICAgICAgICAgIHRydWUsCgogICAgICAgICAgcmV0cnlBbGxvd2VkOgogICAgICAgICAgICBmYWxzZSwKICAgICAgICB9LAoKICAgICAgICBhdXRvbWF0aWNPZmZlcjoKICAgICAgICAgIGZhbHNlLAoKICAgICAgICBhdXRvbWF0aWNCb29raW5nOgogICAgICAgICAgZmFsc2UsCgogICAgICAgIGF1dG9tYXRpY1BheW1lbnQ6CiAgICAgICAgICBmYWxzZSwKICAgICAgfSwKICAgICAgewogICAgICAgIHN0YXR1czoKICAgICAgICAgIDQwOSwKCiAgICAgICAgaGVhZGVyczogewogICAgICAgICAgImNhY2hlLWNvbnRyb2wiOgogICAgICAgICAgICAibm8tc3RvcmUiLAogICAgICAgIH0sCiAgICAgIH0KICAgICk7CiAgfQoKICBpZiAoCiAgICBub3JtYWxpemVkLmluY2x1ZGVzKAogICAgICAiS0xZWF9NVUxUSV9TTE9UX09GRkVSX0FUT01JQ19JTlZBTElEX1NMT1RfQ09VTlQiCiAgICApCiAgKSB7CiAgICByZXR1cm4gUmVzcG9uc2UuanNvbigKICAgICAgewogICAgICAgIGNvZGU6CiAgICAgICAgICAiTVVMVElfU0xPVF9PRkZFUl9JTlZBTElEX1NMT1RfQ09VTlQiLAoKICAgICAgICBlcnJvcjoKICAgICAgICAgICJMYSBkZW1hbmRlIG11bHRpLWNyZW5lYXV4IGVzdCBpbmNvaGVyZW50ZS4gQXVjdW5lIG9mZnJlIG4nYSBldGUgZW5yZWdpc3RyZWUuIiwKCiAgICAgICAgcmVjb3Zlcnk6IHsKICAgICAgICAgIG9mZmVyQ3JlYXRlZDoKICAgICAgICAgICAgZmFsc2UsCgogICAgICAgICAgYm9va2luZ0NyZWF0ZWQ6CiAgICAgICAgICAgIGZhbHNlLAoKICAgICAgICAgIHBheW1lbnRDcmVhdGVkOgogICAgICAgICAgICBmYWxzZSwKCiAgICAgICAgICByZXRyeUFsbG93ZWQ6CiAgICAgICAgICAgIGZhbHNlLAogICAgICAgIH0sCgogICAgICAgIGF1dG9tYXRpY09mZmVyOgogICAgICAgICAgZmFsc2UsCgogICAgICAgIGF1dG9tYXRpY0Jvb2tpbmc6CiAgICAgICAgICBmYWxzZSwKCiAgICAgICAgYXV0b21hdGljUGF5bWVudDoKICAgICAgICAgIGZhbHNlLAogICAgICB9LAogICAgICB7CiAgICAgICAgc3RhdHVzOgogICAgICAgICAgNDA5LAoKICAgICAgICBoZWFkZXJzOiB7CiAgICAgICAgICAiY2FjaGUtY29udHJvbCI6CiAgICAgICAgICAgICJuby1zdG9yZSIsCiAgICAgICAgfSwKICAgICAgfQogICAgKTsKICB9CgogIHJldHVybiBudWxsOwp9CgpleHBvcnQgYXN5bmMgZnVuY3Rpb24gX19LTFlYX01FVEhPRF9fKAogIHJlcXVlc3Q6CiAgICBSZXF1ZXN0LAoKICBjb250ZXh0OgogICAgS2x5eE9mZmVyUm91dGVDb250ZXh0MTNfMTAKKSB7CiAgLyoKICAgIExlIGhhbmRsZXIgaGlzdG9yaXF1ZSBjb25zZXJ2ZSA6CiAgICAtIGF1dGhlbnRpZmljYXRpb24gcHJlc3RhdGFpcmUKICAgIC0gb3duZXJzaGlwCiAgICAtIHZhbGlkYXRpb24gbW9udGFudAogICAgLSBnYXJkZSAxMi45NAogICAgLSByZXZhbGlkYXRpb24gMTIuOTUKICAgIC0gdXBzZXJ0IGhpc3RvcmlxdWUKCiAgICAxMy4xMCBuZSBtb2RpZmllIHF1ZSBsYSB0cmFkdWN0aW9uCiAgICBkZXMgYmxvY2FnZXMgREIgYXRvbWlxdWVzIDEzLjA5LgogICovCgogIGNvbnN0IHNhZmVSZXF1ZXN0ID0KICAgIHJlcXVlc3QuY2xvbmUoKTsKCiAgdHJ5IHsKICAgIGNvbnN0IHJlc3BvbnNlID0KICAgICAgYXdhaXQga2x5eE9mZmVyQmVmb3JlQXRvbWljUmVjb3ZlcnkxM18xMCgKICAgICAgICBzYWZlUmVxdWVzdCwKICAgICAgICBjb250ZXh0CiAgICAgICk7CgogICAgLyoKICAgICAgTGUgaGFuZGxlciBoaXN0b3JpcXVlIHBldXQgZGVqYSBhdm9pcgogICAgICB0cmFuc2Zvcm1lIGwnZXJyZXVyIFN1cGFiYXNlIGVuIHJlcG9uc2UuCiAgICAqLwogICAgaWYgKAogICAgICByZXNwb25zZS5zdGF0dXMgPj0KICAgICAgNDAwCiAgICApIHsKICAgICAgY29uc3QgaW5zcGVjdGVkID0KICAgICAgICByZXNwb25zZS5jbG9uZSgpOwoKICAgICAgY29uc3QgcmF3ID0KICAgICAgICBhd2FpdCBpbnNwZWN0ZWQudGV4dCgpOwoKICAgICAgY29uc3QgcmVjb3ZlcnkgPQogICAgICAgIGtseXhBdG9taWNPZmZlclJlY292ZXJ5MTNfMTAoCiAgICAgICAgICByYXcKICAgICAgICApOwoKICAgICAgaWYgKHJlY292ZXJ5KSB7CiAgICAgICAgcmV0dXJuIHJlY292ZXJ5OwogICAgICB9CiAgICB9CgogICAgcmV0dXJuIHJlc3BvbnNlOwogIH0gY2F0Y2ggKGVycm9yKSB7CiAgICAvKgogICAgICBPdSBsJ2VycmV1ciBQb3N0Z3JlU1FMIHBldXQgcmVtb250ZXIKICAgICAgZGlyZWN0ZW1lbnQganVzcXUnaWNpLgogICAgKi8KICAgIGNvbnN0IG1lc3NhZ2UgPQogICAgICBlcnJvciBpbnN0YW5jZW9mIEVycm9yCiAgICAgICAgPyBlcnJvci5tZXNzYWdlCiAgICAgICAgOiBTdHJpbmcoCiAgICAgICAgICAgIGVycm9yCiAgICAgICAgICApOwoKICAgIGNvbnN0IHJlY292ZXJ5ID0KICAgICAga2x5eEF0b21pY09mZmVyUmVjb3ZlcnkxM18xMCgKICAgICAgICBtZXNzYWdlCiAgICAgICk7CgogICAgaWYgKHJlY292ZXJ5KSB7CiAgICAgIHJldHVybiByZWNvdmVyeTsKICAgIH0KCiAgICB0aHJvdyBlcnJvcjsKICB9Cn0="

$routePath = Join-Path $root "app\api\market\requests\[id]\offers\route.ts"
$migration09 = Join-Path $root "supabase\migrations\20260813105500_klyx_multi_slot_offer_atomic_13_09.sql"
$jobsRoute = Join-Path $root "app\api\provider\jobs\route.ts"

foreach ($path in @($routePath, $migration09, $jobsRoute)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "13.10 : fichier requis introuvable : $path"
    }
}

$route = [System.IO.File]::ReadAllText($routePath)
$sql09 = [System.IO.File]::ReadAllText($migration09)
$jobs = [System.IO.File]::ReadAllText($jobsRoute)

if (-not $route.Contains("KLYX_MULTI_SLOT_LIVE_OFFER_GUARD_12_95")) {
    throw "13.10 : garde API 12.95 introuvable."
}

if (-not $sql09.Contains("KLYX_MULTI_SLOT_OFFER_ATOMIC_GUARD_13_09")) {
    throw "13.10 : KLYX 13.09 introuvable."
}

if (-not $jobs.Contains("KLYX_PROVIDER_JOBS_LIVE_ROUTE_13_08")) {
    throw "13.10 : KLYX 13.08 introuvable."
}

if ($route.Contains("KLYX_MULTI_SLOT_OFFER_ATOMIC_RECOVERY_13_10")) {
    Write-Host "KLYX 13.10 deja applique."
    exit 0
}

$markerIndex = $route.IndexOf("KLYX_MULTI_SLOT_LIVE_OFFER_GUARD_12_95")

if ($markerIndex -lt 0) {
    throw "13.10 : marker 12.95 introuvable."
}

$pattern = 'export\s+async\s+function\s+(POST|PATCH|PUT)\s*\('
$matches = [regex]::Matches($route, $pattern)

$selected = $null

foreach ($match in $matches) {
    if ($match.Index -lt $markerIndex) {
        if ($null -eq $selected -or $match.Index -gt $selected.Index) {
            $selected = $match
        }
    }
}

if ($null -eq $selected) {
    throw "13.10 : methode HTTP de creation offre introuvable."
}

$method = $selected.Groups[1].Value

$replacement = "async function klyxOfferBeforeAtomicRecovery13_10("

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

Copy-Item -LiteralPath $routePath -Destination ($routePath + ".bak-13-10-" + $timestamp) -Force

$route =
    $route.Remove(
        $selected.Index,
        $selected.Length
    ).Insert(
        $selected.Index,
        $replacement
    )

$wrapper =
    $wrapperTemplate.Replace(
        "__KLYX_METHOD__",
        $method
    )

if ($wrapper.Contains("__KLYX_METHOD__")) {
    throw "13.10 : placeholder HTTP non remplace."
}

$route =
    $route.TrimEnd() +
    "`r`n`r`n" +
    $wrapper.Trim() +
    "`r`n"

[System.IO.File]::WriteAllText($routePath, $route, $utf8)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.10 APPLIQUE"
Write-Host "======================================"
Write-Host ("Methode offre : " + $method)
Write-Host "Erreur DB brute : NORMALISEE"
Write-Host "Disponibilite changee : HTTP 409"
Write-Host "Demande fermee : HTTP 409"
Write-Host "Contexte incomplet : HTTP 409"
Write-Host "Offre creee sur echec : NON"
Write-Host "Booking automatique : NON"
Write-Host "Paiement automatique : NON"
Write-Host "Migration : AUCUNE"
Write-Host "======================================"
