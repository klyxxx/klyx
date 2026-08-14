$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Decode([string]$Value) {
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Value))
}

$wrapperTemplate = Decode "Ci8vIEtMWVhfR1JPVVBfUFJPVklERVJfQUNDRVBUX1JFQ09WRVJZXzEzXzA3Cgp0eXBlIEtseXhQcm92aWRlckdyb3VwQ29udGV4dDEzXzA3ID0gewogIHBhcmFtczoKICAgIFByb21pc2U8ewogICAgICBpZDoKICAgICAgICBzdHJpbmc7CiAgICB9PjsKfTsKCmZ1bmN0aW9uIGtseXhQcm92aWRlckFjY2VwdFJlY292ZXJ5MTNfMDcoCiAgbWVzc2FnZToKICAgIHN0cmluZwopIHsKICBjb25zdCBub3JtYWxpemVkID0KICAgIG1lc3NhZ2UudG9VcHBlckNhc2UoKTsKCiAgLyoKICAgIExlIGNvbnRleHRlIGV4YWN0IG4nYSBwYXMgcHUgZXRyZSBwcm91dmUuCiAgICBGYWlsIGNsb3NlZC4KICAqLwogIGlmICgKICAgIG5vcm1hbGl6ZWQuaW5jbHVkZXMoCiAgICAgICJLTFlYX0dST1VQX0FDQ0VQVF9MSVZFX0NPTlRFWFRfUkVRVUlSRUQiCiAgICApCiAgKSB7CiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oCiAgICAgIHsKICAgICAgICBjb2RlOgogICAgICAgICAgIlBST1ZJREVSX0dST1VQX0xJVkVfQ09OVEVYVF9SRVFVSVJFRCIsCgogICAgICAgIGVycm9yOgogICAgICAgICAgIktMWVggbmUgcGV1dCBwYXMgcmV2YWxpZGVyIGNldHRlIG1pc3Npb24gYXZlYyBzdWZmaXNhbW1lbnQgZGUgcHJldXZlcy4gTCdhY2NlcHRhdGlvbiBhIGV0ZSBibG9xdWVlLiIsCgogICAgICAgIHJlY292ZXJ5OiB7CiAgICAgICAgICBncm91cEFjY2VwdGVkOgogICAgICAgICAgICBmYWxzZSwKCiAgICAgICAgICBib29raW5nQ3JlYXRlZDoKICAgICAgICAgICAgZmFsc2UsCgogICAgICAgICAgcGF5bWVudENyZWF0ZWQ6CiAgICAgICAgICAgIGZhbHNlLAoKICAgICAgICAgIGF2YWlsYWJpbGl0eUNoYW5nZWQ6CiAgICAgICAgICAgIGZhbHNlLAoKICAgICAgICAgIHJldmlld1BsYW5uaW5nOgogICAgICAgICAgICB0cnVlLAoKICAgICAgICAgIHJldHJ5QWxsb3dlZDoKICAgICAgICAgICAgZmFsc2UsCiAgICAgICAgfSwKCiAgICAgICAgYXV0b21hdGljQWNjZXB0YW5jZToKICAgICAgICAgIGZhbHNlLAoKICAgICAgICBhdXRvbWF0aWNCb29raW5nOgogICAgICAgICAgZmFsc2UsCgogICAgICAgIGF1dG9tYXRpY1BheW1lbnQ6CiAgICAgICAgICBmYWxzZSwKICAgICAgfSwKICAgICAgewogICAgICAgIHN0YXR1czoKICAgICAgICAgIDQwOSwKICAgICAgfQogICAgKTsKICB9CgogIC8qCiAgICBMZSBwcmVzdGF0YWlyZSBuZSBjb3V2cmUgcGx1cyBOL04gc2xvdHMuCiAgKi8KICBpZiAoCiAgICBub3JtYWxpemVkLmluY2x1ZGVzKAogICAgICAiS0xZWF9HUk9VUF9BQ0NFUFRfTElWRV9DT1ZFUkFHRV9SRVFVSVJFRCIKICAgICkKICApIHsKICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbigKICAgICAgewogICAgICAgIGNvZGU6CiAgICAgICAgICAiUFJPVklERVJfR1JPVVBfQVZBSUxBQklMSVRZX0NIQU5HRUQiLAoKICAgICAgICBlcnJvcjoKICAgICAgICAgICJUb24gcGxhbm5pbmcgYSBjaGFuZ2UgZXQgdHUgbmUgY291dnJlcyBwbHVzIHRvdXMgbGVzIGNyZW5lYXV4IGRlIGNldHRlIG1pc3Npb24uIEtMWVggYSBibG9xdWUgbCdhY2NlcHRhdGlvbi4iLAoKICAgICAgICByZWNvdmVyeTogewogICAgICAgICAgZ3JvdXBBY2NlcHRlZDoKICAgICAgICAgICAgZmFsc2UsCgogICAgICAgICAgYm9va2luZ0NyZWF0ZWQ6CiAgICAgICAgICAgIGZhbHNlLAoKICAgICAgICAgIHBheW1lbnRDcmVhdGVkOgogICAgICAgICAgICBmYWxzZSwKCiAgICAgICAgICBhdmFpbGFiaWxpdHlDaGFuZ2VkOgogICAgICAgICAgICB0cnVlLAoKICAgICAgICAgIHJldmlld1BsYW5uaW5nOgogICAgICAgICAgICB0cnVlLAoKICAgICAgICAgIHJldHJ5QWxsb3dlZDoKICAgICAgICAgICAgdHJ1ZSwKCiAgICAgICAgICByZWplY3Rpb25TdGlsbEFsbG93ZWQ6CiAgICAgICAgICAgIHRydWUsCiAgICAgICAgfSwKCiAgICAgICAgYXV0b21hdGljQWNjZXB0YW5jZToKICAgICAgICAgIGZhbHNlLAoKICAgICAgICBhdXRvbWF0aWNCb29raW5nOgogICAgICAgICAgZmFsc2UsCgogICAgICAgIGF1dG9tYXRpY1BheW1lbnQ6CiAgICAgICAgICBmYWxzZSwKICAgICAgfSwKICAgICAgewogICAgICAgIHN0YXR1czoKICAgICAgICAgIDQwOSwKICAgICAgfQogICAgKTsKICB9CgogIHJldHVybiBudWxsOwp9CgpleHBvcnQgYXN5bmMgZnVuY3Rpb24gX19LTFlYX0hUVFBfTUVUSE9EX18oCiAgcmVxdWVzdDoKICAgIFJlcXVlc3QsCgogIGNvbnRleHQ6CiAgICBLbHl4UHJvdmlkZXJHcm91cENvbnRleHQxM18wNwopIHsKICAvKgogICAgTGUgaGFuZGxlciBoaXN0b3JpcXVlIHJlc3RlIGxhIHNvdXJjZQogICAgZGUgdmVyaXRlIHBvdXIgOgogICAgLSBhdXRoZW50aWZpY2F0aW9uCiAgICAtIG93bmVyc2hpcAogICAgLSBhY3Rpb24gZGVtYW5kZWUKICAgIC0gUlBDIDEyLjg1CiAgICAtIHJlZnVzCiAgICAtIGFjY2VwdGF0aW9uIGV4cGxpY2l0ZQogICovCgogIGNvbnN0IHNhZmVSZXF1ZXN0ID0KICAgIHJlcXVlc3QuY2xvbmUoKTsKCiAgdHJ5IHsKICAgIGNvbnN0IHJlc3BvbnNlID0KICAgICAgYXdhaXQga2x5eEJvb2tpbmdHcm91cEJlZm9yZUFjY2VwdFJlY292ZXJ5MTNfMDcoCiAgICAgICAgc2FmZVJlcXVlc3QsCiAgICAgICAgY29udGV4dAogICAgICApOwoKICAgIC8qCiAgICAgIExlIGhhbmRsZXIgaGlzdG9yaXF1ZSBwZXV0IGRlamEgYXZvaXIKICAgICAgY2FwdHVyZSBsJ2VycmV1ciBTdXBhYmFzZSBldCByZXRvdXJuZQogICAgICB1bmUgcmVwb25zZSBKU09OIDR4eC81eHguCgogICAgICBPbiBpbnNwZWN0ZSB1bmUgQ09QSUUgZGUgbGEgcmVwb25zZS4KICAgICovCiAgICBpZiAoCiAgICAgIHJlc3BvbnNlLnN0YXR1cyA+PQogICAgICA0MDAKICAgICkgewogICAgICBjb25zdCBpbnNwZWN0ZWQgPQogICAgICAgIHJlc3BvbnNlLmNsb25lKCk7CgogICAgICBjb25zdCByYXcgPQogICAgICAgIGF3YWl0IGluc3BlY3RlZC50ZXh0KCk7CgogICAgICBjb25zdCByZWNvdmVyeSA9CiAgICAgICAga2x5eFByb3ZpZGVyQWNjZXB0UmVjb3ZlcnkxM18wNygKICAgICAgICAgIHJhdwogICAgICAgICk7CgogICAgICBpZiAocmVjb3ZlcnkpIHsKICAgICAgICByZXR1cm4gcmVjb3Zlcnk7CiAgICAgIH0KICAgIH0KCiAgICByZXR1cm4gcmVzcG9uc2U7CiAgfSBjYXRjaCAoZXJyb3IpIHsKICAgIC8qCiAgICAgIFNpIGwnZXJyZXVyIERCIHJlbW9udGUgZGlyZWN0ZW1lbnQsCiAgICAgIGVsbGUgZXN0IGVnYWxlbWVudCBub3JtYWxpc2VlLgogICAgKi8KICAgIGNvbnN0IG1lc3NhZ2UgPQogICAgICBlcnJvciBpbnN0YW5jZW9mIEVycm9yCiAgICAgICAgPyBlcnJvci5tZXNzYWdlCiAgICAgICAgOiBTdHJpbmcoCiAgICAgICAgICAgIGVycm9yCiAgICAgICAgICApOwoKICAgIGNvbnN0IHJlY292ZXJ5ID0KICAgICAga2x5eFByb3ZpZGVyQWNjZXB0UmVjb3ZlcnkxM18wNygKICAgICAgICBtZXNzYWdlCiAgICAgICk7CgogICAgaWYgKHJlY292ZXJ5KSB7CiAgICAgIHJldHVybiByZWNvdmVyeTsKICAgIH0KCiAgICB0aHJvdyBlcnJvcjsKICB9Cn0="

$routePath = Join-Path $root "app\api\booking-groups\[id]\route.ts"
$migration13 = Join-Path $root "supabase\migrations\20260813102500_klyx_group_provider_accept_live_13_06.sql"
$migration85 = Join-Path $root "supabase\migrations\20260812202000_klyx_booking_groups_12_85.sql"

foreach ($path in @($routePath, $migration13, $migration85)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "13.07 : fichier requis introuvable : $path"
    }
}

$content = [System.IO.File]::ReadAllText($routePath)
$sql13 = [System.IO.File]::ReadAllText($migration13)
$sql85 = [System.IO.File]::ReadAllText($migration85)

if (-not $sql13.Contains("KLYX_GROUP_PROVIDER_ACCEPT_LIVE_GUARD_13_06")) {
    throw "13.07 : KLYX 13.06 introuvable."
}

if (-not $sql85.Contains("klyx_provider_group_decision")) {
    throw "13.07 : RPC 12.85 introuvable."
}

if (-not $content.Contains("klyx_provider_group_decision")) {
    throw "13.07 : appel provider decision introuvable dans la route."
}

if ($content.Contains("KLYX_GROUP_PROVIDER_ACCEPT_RECOVERY_13_07")) {
    Write-Host "KLYX 13.07 deja applique."
    exit 0
}

$rpcIndex = $content.IndexOf("klyx_provider_group_decision")

$pattern = 'export\s+async\s+function\s+(PATCH|POST|PUT)\s*\('
$matches = [regex]::Matches($content, $pattern)

$selected = $null

foreach ($match in $matches) {
    if ($match.Index -lt $rpcIndex) {
        if ($null -eq $selected -or $match.Index -gt $selected.Index) {
            $selected = $match
        }
    }
}

if ($null -eq $selected) {
    throw "13.07 : methode HTTP contenant le RPC introuvable."
}

$method = $selected.Groups[1].Value

$replacement = "async function klyxBookingGroupBeforeAcceptRecovery13_07("

$content =
    $content.Remove(
        $selected.Index,
        $selected.Length
    ).Insert(
        $selected.Index,
        $replacement
    )

$wrapper =
    $wrapperTemplate.Replace(
        "__KLYX_HTTP_METHOD__",
        $method
    )

if ($wrapper.Contains("__KLYX_HTTP_METHOD__")) {
    throw "13.07 : placeholder HTTP non remplace."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

Copy-Item -LiteralPath $routePath -Destination ($routePath + ".bak-13-07-" + $timestamp) -Force

$content =
    $content.TrimEnd() +
    "`r`n`r`n" +
    $wrapper.Trim() +
    "`r`n"

[System.IO.File]::WriteAllText($routePath, $content, $utf8)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.07 APPLIQUE"
Write-Host "======================================"
Write-Host ("Methode protegee : " + $method)
Write-Host "Erreur DB brute : NORMALISEE"
Write-Host "Planning change : HTTP 409"
Write-Host "Acceptation sur echec : NON"
Write-Host "Refus provider : CONSERVE"
Write-Host "Booking automatique : NON"
Write-Host "Paiement automatique : NON"
Write-Host "Migration : AUCUNE"
Write-Host "======================================"
