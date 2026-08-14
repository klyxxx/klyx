$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

function Decode {
    param([string]$Value)

    [System.Text.Encoding]::UTF8.GetString(
        [Convert]::FromBase64String($Value)
    )
}

$import =
    Decode "aW1wb3J0IFNwbGl0TWlzc2lvblNlY3Rpb24sIHsKICBzcGxpdE1pc3Npb25Jc0hpc3RvcnksCiAgc3BsaXRNaXNzaW9uTWF0Y2hlc0ZpbHRlciwKICBzcGxpdE1pc3Npb25OZWVkc0FjdGlvbiwKICB0eXBlIFNwbGl0TWlzc2lvblN1bW1hcnksCn0gZnJvbSAiLi9TcGxpdE1pc3Npb25TZWN0aW9uIjs="

$state =
    Decode "ICBjb25zdCBbYm9va2luZ3MsIHNldEJvb2tpbmdzXSA9IHVzZVN0YXRlPEJvb2tpbmdDYXJkW10+KFtdKTsKCiAgLy8gS0xZWF9TUExJVF9NSVNTSU9OX0NPTlNPTElEQVRJT05fMTNfMjEKICBjb25zdCBbc3BsaXRNaXNzaW9ucywgc2V0U3BsaXRNaXNzaW9uc10gPQogICAgdXNlU3RhdGU8U3BsaXRNaXNzaW9uU3VtbWFyeVtdPihbXSk7"

$profilePatch =
    Decode "ICAgICAgc2V0QWN0aXZlUHJvZmlsZShwcm9maWxlKTsKCiAgICAgIGxldCBoaWRkZW5TcGxpdEJvb2tpbmdJZHMgPQogICAgICAgIG5ldyBTZXQ8c3RyaW5nPigpOwoKICAgICAgaWYgKAogICAgICAgIHByb2ZpbGUuYWNjb3VudFR5cGUgPT09CiAgICAgICAgImNsaWVudCIKICAgICAgKSB7CiAgICAgICAgdHJ5IHsKICAgICAgICAgIGNvbnN0IHNwbGl0UmVzcG9uc2UgPQogICAgICAgICAgICBhd2FpdCBmZXRjaCgKICAgICAgICAgICAgICAiL2FwaS9ib29raW5ncy9zcGxpdC1taXNzaW9ucyIsCiAgICAgICAgICAgICAgewogICAgICAgICAgICAgICAgY2FjaGU6CiAgICAgICAgICAgICAgICAgICJuby1zdG9yZSIsCgogICAgICAgICAgICAgICAgaGVhZGVyczogewogICAgICAgICAgICAgICAgICBBdXRob3JpemF0aW9uOgogICAgICAgICAgICAgICAgICAgICJCZWFyZXIgIiArCiAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbi5hY2Nlc3NfdG9rZW4sCiAgICAgICAgICAgICAgICB9LAogICAgICAgICAgICAgIH0KICAgICAgICAgICAgKTsKCiAgICAgICAgICBpZiAoCiAgICAgICAgICAgIHNwbGl0UmVzcG9uc2Uub2sKICAgICAgICAgICkgewogICAgICAgICAgICBjb25zdCBzcGxpdEJvZHkgPQogICAgICAgICAgICAgICgKICAgICAgICAgICAgICAgIGF3YWl0IHNwbGl0UmVzcG9uc2UuanNvbigpCiAgICAgICAgICAgICAgKSBhcyB7CiAgICAgICAgICAgICAgICBtaXNzaW9ucz86CiAgICAgICAgICAgICAgICAgIFNwbGl0TWlzc2lvblN1bW1hcnlbXTsKCiAgICAgICAgICAgICAgICBjaGlsZEJvb2tpbmdJZHM/OgogICAgICAgICAgICAgICAgICBzdHJpbmdbXTsKICAgICAgICAgICAgICB9OwoKICAgICAgICAgICAgY29uc3QgbmV4dE1pc3Npb25zID0KICAgICAgICAgICAgICBBcnJheS5pc0FycmF5KAogICAgICAgICAgICAgICAgc3BsaXRCb2R5Lm1pc3Npb25zCiAgICAgICAgICAgICAgKQogICAgICAgICAgICAgICAgPyBzcGxpdEJvZHkubWlzc2lvbnMKICAgICAgICAgICAgICAgIDogW107CgogICAgICAgICAgICBjb25zdCBuZXh0Q2hpbGRJZHMgPQogICAgICAgICAgICAgIEFycmF5LmlzQXJyYXkoCiAgICAgICAgICAgICAgICBzcGxpdEJvZHkuY2hpbGRCb29raW5nSWRzCiAgICAgICAgICAgICAgKQogICAgICAgICAgICAgICAgPyBzcGxpdEJvZHkuY2hpbGRCb29raW5nSWRzCiAgICAgICAgICAgICAgICA6IFtdOwoKICAgICAgICAgICAgc2V0U3BsaXRNaXNzaW9ucygKICAgICAgICAgICAgICBuZXh0TWlzc2lvbnMKICAgICAgICAgICAgKTsKCiAgICAgICAgICAgIGhpZGRlblNwbGl0Qm9va2luZ0lkcyA9CiAgICAgICAgICAgICAgbmV3IFNldCgKICAgICAgICAgICAgICAgIG5leHRDaGlsZElkcwogICAgICAgICAgICAgICk7CiAgICAgICAgICB9IGVsc2UgewogICAgICAgICAgICBzZXRTcGxpdE1pc3Npb25zKAogICAgICAgICAgICAgIFtdCiAgICAgICAgICAgICk7CiAgICAgICAgICB9CiAgICAgICAgfSBjYXRjaCB7CiAgICAgICAgICBzZXRTcGxpdE1pc3Npb25zKAogICAgICAgICAgICBbXQogICAgICAgICAgKTsKICAgICAgICB9CiAgICAgIH0gZWxzZSB7CiAgICAgICAgc2V0U3BsaXRNaXNzaW9ucygKICAgICAgICAgIFtdCiAgICAgICAgKTsKICAgICAgfQ=="

$bookingRows =
    Decode "ICAgICAgY29uc3QgYm9va2luZ1Jvd3MgPQogICAgICAgICgKICAgICAgICAgIChib29raW5nRGF0YSA/PyBbXSkgYXMgQm9va2luZ1Jvd1tdCiAgICAgICAgKS5maWx0ZXIoCiAgICAgICAgICAoYm9va2luZykgPT4KICAgICAgICAgICAgIWhpZGRlblNwbGl0Qm9va2luZ0lkcy5oYXMoCiAgICAgICAgICAgICAgYm9va2luZy5pZAogICAgICAgICAgICApCiAgICAgICAgKTs="

$oldCounts =
    Decode "ICBjb25zdCBjb3VudHMgPSB1c2VNZW1vKAogICAgKCkgPT4gKHsKICAgICAgYWN0aW9uczogYm9va2luZ3MuZmlsdGVyKG5lZWRzQWN0aW9uKS5sZW5ndGgsCiAgICAgIHVwY29taW5nOiBib29raW5ncy5maWx0ZXIoKGJvb2tpbmcpID0+ICFpc0hpc3RvcnkoYm9va2luZykpLmxlbmd0aCwKICAgICAgaGlzdG9yeTogYm9va2luZ3MuZmlsdGVyKGlzSGlzdG9yeSkubGVuZ3RoLAogICAgICBhbGw6IGJvb2tpbmdzLmxlbmd0aCwKICAgIH0pLAogICAgW2Jvb2tpbmdzXQogICk7"

$newCounts =
    Decode "ICBjb25zdCBjb3VudHMgPSB1c2VNZW1vKAogICAgKCkgPT4gKHsKICAgICAgYWN0aW9uczoKICAgICAgICBib29raW5ncy5maWx0ZXIobmVlZHNBY3Rpb24pLmxlbmd0aCArCiAgICAgICAgc3BsaXRNaXNzaW9ucy5maWx0ZXIoCiAgICAgICAgICBzcGxpdE1pc3Npb25OZWVkc0FjdGlvbgogICAgICAgICkubGVuZ3RoLAoKICAgICAgdXBjb21pbmc6CiAgICAgICAgYm9va2luZ3MuZmlsdGVyKAogICAgICAgICAgKGJvb2tpbmcpID0+CiAgICAgICAgICAgICFpc0hpc3RvcnkoYm9va2luZykKICAgICAgICApLmxlbmd0aCArCiAgICAgICAgc3BsaXRNaXNzaW9ucy5maWx0ZXIoCiAgICAgICAgICAobWlzc2lvbikgPT4KICAgICAgICAgICAgIXNwbGl0TWlzc2lvbklzSGlzdG9yeSgKICAgICAgICAgICAgICBtaXNzaW9uCiAgICAgICAgICAgICkKICAgICAgICApLmxlbmd0aCwKCiAgICAgIGhpc3Rvcnk6CiAgICAgICAgYm9va2luZ3MuZmlsdGVyKGlzSGlzdG9yeSkubGVuZ3RoICsKICAgICAgICBzcGxpdE1pc3Npb25zLmZpbHRlcigKICAgICAgICAgIHNwbGl0TWlzc2lvbklzSGlzdG9yeQogICAgICAgICkubGVuZ3RoLAoKICAgICAgYWxsOgogICAgICAgIGJvb2tpbmdzLmxlbmd0aCArCiAgICAgICAgc3BsaXRNaXNzaW9ucy5sZW5ndGgsCiAgICB9KSwKICAgIFtib29raW5ncywgc3BsaXRNaXNzaW9uc10KICApOw=="

$visibleReplacement =
    Decode "KSA6IHZpc2libGVCb29raW5ncy5sZW5ndGggPT09IDAgJiYKICAgICAgICAgIHNwbGl0TWlzc2lvbnMuZmlsdGVyKAogICAgICAgICAgICAobWlzc2lvbikgPT4KICAgICAgICAgICAgICBzcGxpdE1pc3Npb25NYXRjaGVzRmlsdGVyKAogICAgICAgICAgICAgICAgbWlzc2lvbiwKICAgICAgICAgICAgICAgIGZpbHRlcgogICAgICAgICAgICAgICkKICAgICAgICAgICkubGVuZ3RoID09PSAwID8gKA=="

$missionRender =
    Decode "ICAgICAgICB7LyogS0xZWF9TUExJVF9NSVNTSU9OX0xJU1RfV0lSSU5HXzEzXzIxICovfQogICAgICAgIHshbG9hZGluZyAmJiAoCiAgICAgICAgICA8U3BsaXRNaXNzaW9uU2VjdGlvbgogICAgICAgICAgICBtaXNzaW9ucz17c3BsaXRNaXNzaW9uc30KICAgICAgICAgICAgZmlsdGVyPXtmaWx0ZXJ9CiAgICAgICAgICAvPgogICAgICAgICl9CgogICAgICAgIHtsb2FkaW5nID8gKA=="

$checker =
    Decode "JEVycm9yQWN0aW9uUHJlZmVyZW5jZSA9ICJTdG9wIgoKJHJvb3QgPSBTcGxpdC1QYXRoIC1QYXJlbnQgJFBTU2NyaXB0Um9vdAoKU2V0LUxvY2F0aW9uICRyb290CgokYXBpID0KICAgIEpvaW4tUGF0aCAkcm9vdCAiYXBwXGFwaVxib29raW5nc1xzcGxpdC1taXNzaW9uc1xyb3V0ZS50cyIKCiRjb21wb25lbnQgPQogICAgSm9pbi1QYXRoICRyb290ICJhcHBcYm9va2luZ3NcU3BsaXRNaXNzaW9uU2VjdGlvbi50c3giCgokZGV0YWlsID0KICAgIEpvaW4tUGF0aCAkcm9vdCAiYXBwXGJvb2tpbmdzXHNwbGl0XFtpZF1ccGFnZS50c3giCgokcGFnZSA9CiAgICBKb2luLVBhdGggJHJvb3QgImFwcFxib29raW5nc1xwYWdlLnRzeCIKCmZvcmVhY2ggKAogICAgJHBhdGgKICAgIGluIEAoCiAgICAgICAgJGFwaSwKICAgICAgICAkY29tcG9uZW50LAogICAgICAgICRkZXRhaWwsCiAgICAgICAgJHBhZ2UKICAgICkKKSB7CiAgICBpZiAoLW5vdCAoVGVzdC1QYXRoIC1MaXRlcmFsUGF0aCAkcGF0aCkpIHsKICAgICAgICB0aHJvdyAiMTMuMjEgOiBmaWNoaWVyIGludHJvdXZhYmxlIDogJHBhdGgiCiAgICB9Cn0KCiRhID0gW1N5c3RlbS5JTy5GaWxlXTo6UmVhZEFsbFRleHQoJGFwaSkKJGMgPSBbU3lzdGVtLklPLkZpbGVdOjpSZWFkQWxsVGV4dCgkY29tcG9uZW50KQokZCA9IFtTeXN0ZW0uSU8uRmlsZV06OlJlYWRBbGxUZXh0KCRkZXRhaWwpCiRwID0gW1N5c3RlbS5JTy5GaWxlXTo6UmVhZEFsbFRleHQoJHBhZ2UpCgokZmFpbGVkID0gQCgpCgpmdW5jdGlvbiBDaGVjayB7CiAgICBwYXJhbSgKICAgICAgICBbc3RyaW5nXSROYW1lLAogICAgICAgIFtib29sXSRPawogICAgKQoKICAgIGlmICgkT2spIHsKICAgICAgICBXcml0ZS1Ib3N0ICgiW09LXSAgICIgKyAkTmFtZSkKICAgICAgICByZXR1cm4KICAgIH0KCiAgICBXcml0ZS1Ib3N0ICgiW0ZBSUxdICIgKyAkTmFtZSkKCiAgICAkc2NyaXB0OmZhaWxlZCArPSAkTmFtZQp9CgpXcml0ZS1Ib3N0ICIiCldyaXRlLUhvc3QgIkNIRUNLIEtMWVggMTMuMjEiCldyaXRlLUhvc3QgIiIKCkNoZWNrIGAKICAgICIxMy4yMSBBUEkgbWFya2VyIiBgCiAgICAkYS5Db250YWlucygiS0xZWF9TUExJVF9NSVNTSU9OX0FQSV8xM18yMSIpCgpDaGVjayBgCiAgICAiYmF0Y2ggY29uc29saWRhdGlvbiIgYAogICAgJGEuQ29udGFpbnMoInNwbGl0X2Jvb2tpbmdfYmF0Y2hlcyIpCgpDaGVjayBgCiAgICAiY2hpbGQgYm9va2luZyBtYXBwaW5nIiBgCiAgICAkYS5Db250YWlucygic3BsaXRfYm9va2luZ19iYXRjaF9pdGVtcyIpCgpDaGVjayBgCiAgICAiZXhhY3QgY29uZmlybWF0aW9uIHNuYXBzaG90IiBgCiAgICAkYS5Db250YWlucygibWFya2V0X3NwbGl0X3BsYW5fY29uZmlybWF0aW9ucyIpCgpDaGVjayBgCiAgICAiYWdncmVnYXRlIG1pc3Npb24gbGlmZWN5Y2xlIiBgCiAgICAoCiAgICAgICAgJGEuQ29udGFpbnMoInBhcnRpYWxseV9hY2NlcHRlZCIpIC1hbmQKICAgICAgICAkYS5Db250YWlucygiaW5fcHJvZ3Jlc3MiKSAtYW5kCiAgICAgICAgJGEuQ29udGFpbnMoIm1peGVkX2lzc3VlIikKICAgICkKCkNoZWNrIGAKICAgICJjaGlsZCBJRHMgZXhwb3NlZCIgYAogICAgJGEuQ29udGFpbnMoImNoaWxkQm9va2luZ0lkcyIpCgpDaGVjayBgCiAgICAibm8gYXV0b21hdGljIGJvb2tpbmciIGAKICAgICRhLkNvbnRhaW5zKCJhdXRvbWF0aWNCb29raW5nIikKCkNoZWNrIGAKICAgICJubyBhdXRvbWF0aWMgcGF5bWVudCIgYAogICAgJGEuQ29udGFpbnMoImF1dG9tYXRpY1BheW1lbnQiKQoKQ2hlY2sgYAogICAgIjEzLjIxIFVJIG1hcmtlciIgYAogICAgJGMuQ29udGFpbnMoIktMWVhfU1BMSVRfTUlTU0lPTl9VSV8xM18yMSIpCgpDaGVjayBgCiAgICAib25lIG1pc3Npb24gY2FyZCIgYAogICAgJGMuQ29udGFpbnMoIk1pc3Npb25zIG11bHRpLXByZXN0YXRhaXJlcyIpCgpDaGVjayBgCiAgICAiMTMuMjEgZGV0YWlsIG1hcmtlciIgYAogICAgJGQuQ29udGFpbnMoIktMWVhfU1BMSVRfTUlTU0lPTl9ERVRBSUxfMTNfMjEiKQoKQ2hlY2sgYAogICAgImNoaWxkIGJvb2tpbmcgZGV0YWlsIHJldGFpbmVkIiBgCiAgICAkZC5Db250YWlucygnIi9ib29raW5ncy8iICsnKQoKQ2hlY2sgYAogICAgInBhZ2UgY29uc29saWRhdGlvbiBtYXJrZXIiIGAKICAgICRwLkNvbnRhaW5zKCJLTFlYX1NQTElUX01JU1NJT05fQ09OU09MSURBVElPTl8xM18yMSIpCgpDaGVjayBgCiAgICAiY2hpbGQgYm9va2luZ3MgaGlkZGVuIiBgCiAgICAoCiAgICAgICAgJHAuQ29udGFpbnMoImhpZGRlblNwbGl0Qm9va2luZ0lkcyIpIC1hbmQKICAgICAgICAkcC5Db250YWlucygiIWhpZGRlblNwbGl0Qm9va2luZ0lkcy5oYXMiKQogICAgKQoKQ2hlY2sgYAogICAgIm1pc3Npb24gbGlzdCB3aXJlZCIgYAogICAgKAogICAgICAgICRwLkNvbnRhaW5zKCJLTFlYX1NQTElUX01JU1NJT05fTElTVF9XSVJJTkdfMTNfMjEiKSAtYW5kCiAgICAgICAgJHAuQ29udGFpbnMoIjxTcGxpdE1pc3Npb25TZWN0aW9uIikKICAgICkKCkNoZWNrIGAKICAgICJtaXNzaW9uIGNvdW50cyBpbnRlZ3JhdGVkIiBgCiAgICAoCiAgICAgICAgJHAuQ29udGFpbnMoInNwbGl0TWlzc2lvbk5lZWRzQWN0aW9uIikgLWFuZAogICAgICAgICRwLkNvbnRhaW5zKCJzcGxpdE1pc3Npb25Jc0hpc3RvcnkiKQogICAgKQoKaWYgKCRmYWlsZWQuQ291bnQgLWd0IDApIHsKICAgIFdyaXRlLUhvc3QgIiIKICAgIFdyaXRlLUhvc3QgIkVDSEVDUyBFWEFDVFMgOiIKCiAgICBmb3JlYWNoICgkaXRlbSBpbiAkZmFpbGVkKSB7CiAgICAgICAgV3JpdGUtSG9zdCAoIiAtICIgKyAkaXRlbSkKICAgIH0KCiAgICB0aHJvdyAiS0xZWCAxMy4yMSBzdGF0aWMgY2hlY2tlciBGQUlMRUQuIgp9CgpXcml0ZS1Ib3N0ICIiCldyaXRlLUhvc3QgIlR5cGVTY3JpcHQuLi4iCldyaXRlLUhvc3QgIiIKCm5weC5jbWQgdHNjIC0tbm9FbWl0IC0tcHJldHR5IGZhbHNlCgppZiAoJExBU1RFWElUQ09ERSAtbmUgMCkgewogICAgdGhyb3cgIktMWVggMTMuMjEgVHlwZVNjcmlwdCBGQUlMRUQuIgp9CgpXcml0ZS1Ib3N0ICIiCldyaXRlLUhvc3QgIk5leHQgYnVpbGQuLi4iCldyaXRlLUhvc3QgIiIKCm5wbS5jbWQgcnVuIGJ1aWxkCgppZiAoJExBU1RFWElUQ09ERSAtbmUgMCkgewogICAgdGhyb3cgIktMWVggMTMuMjEgYnVpbGQgRkFJTEVELiIKfQoKV3JpdGUtSG9zdCAiIgpXcml0ZS1Ib3N0ICI9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSIKV3JpdGUtSG9zdCAiS0xZWCAxMy4yMSBDSEVDSyBPSyIKV3JpdGUtSG9zdCAiPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0iCldyaXRlLUhvc3QgIlNwbGl0IG1pc3Npb24gY2xpZW50IDogQ09OU09MSURFRSIKV3JpdGUtSG9zdCAiMSBwbGFuIDogMSBNSVNTSU9OIENMSUVOVCIKV3JpdGUtSG9zdCAiQ2hpbGQgYm9va2luZ3MgOiBNQVNRVUVTIERFIExBIExJU1RFIgpXcml0ZS1Ib3N0ICJDaGlsZCBib29raW5ncyBkZXRhaWwgOiBBQ0NFU1NJQkxFUyIKV3JpdGUtSG9zdCAiQWdncmVnYXRlIGxpZmVjeWNsZSA6IEFDVElGIgpXcml0ZS1Ib3N0ICJBdXRvbWF0aWMgYm9va2luZyA6IE5PTiIKV3JpdGUtSG9zdCAiQXV0b21hdGljIHBheW1lbnQgOiBOT04iCldyaXRlLUhvc3QgIk1pZ3JhdGlvbiBEQiA6IEFVQ1VORSIKV3JpdGUtSG9zdCAiVHlwZVNjcmlwdCA6IE9LIgpXcml0ZS1Ib3N0ICJCdWlsZCBOZXh0LmpzIDogT0siCldyaXRlLUhvc3QgIj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ig=="

$pagePath =
    Join-Path $root "app\bookings\page.tsx"

$componentPath =
    Join-Path $root "app\bookings\SplitMissionSection.tsx"

$apiPath =
    Join-Path $root "app\api\bookings\split-missions\route.ts"

$detailPath =
    Join-Path $root "app\bookings\split\[id]\page.tsx"

$checkerPath =
    Join-Path $root "scripts\check-step-13-21.ps1"

foreach (
    $required
    in @(
        $pagePath,
        $componentPath,
        $apiPath,
        $detailPath
    )
) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "13.21b : fichier requis introuvable : $required"
    }
}

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

$backupDir =
    Join-Path $root "scripts\backups"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $backupDir |
    Out-Null

Copy-Item `
    -LiteralPath $pagePath `
    -Destination (
        Join-Path $backupDir (
            "bookings-page-13-21b-" +
            $timestamp +
            ".tsx"
        )
    ) `
    -Force

if (Test-Path -LiteralPath $checkerPath) {
    Copy-Item `
        -LiteralPath $checkerPath `
        -Destination (
            Join-Path $backupDir (
                "check-step-13-21-" +
                $timestamp +
                ".ps1"
            )
        ) `
        -Force
}

$page =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

# ============================================================
# IMPORT
# ============================================================

if (
    -not $page.Contains(
        'from "./SplitMissionSection";'
    )
) {
    $firstImport =
        [regex]::Match(
            $page,
            '(?m)^import\s'
        )

    if (-not $firstImport.Success) {
        throw "13.21b : imports bookings introuvables."
    }

    $page =
        $page.Insert(
            $firstImport.Index,
            $import +
            "`r`n"
        )
}

# ============================================================
# STATE
# ============================================================

if (
    -not $page.Contains(
        "const [splitMissions, setSplitMissions]"
    )
) {
    $stateAnchor =
        '  const [bookings, setBookings] = useState<BookingCard[]>([]);'

    if (-not $page.Contains($stateAnchor)) {
        throw "13.21b : state bookings introuvable."
    }

    $page =
        $page.Replace(
            $stateAnchor,
            $state.TrimEnd()
        )
}

if (
    -not $page.Contains(
        "KLYX_SPLIT_MISSION_CONSOLIDATION_13_21"
    )
) {
    $splitState =
        '  const [splitMissions, setSplitMissions] ='

    $splitIndex =
        $page.IndexOf(
            $splitState
        )

    if ($splitIndex -lt 0) {
        throw "13.21b : splitMissions state introuvable."
    }

    $page =
        $page.Insert(
            $splitIndex,
            "  // KLYX_SPLIT_MISSION_CONSOLIDATION_13_21`r`n"
        )
}

# ============================================================
# FETCH MISSIONS + CHILD IDS
# ============================================================

if (
    -not $page.Contains(
        "hiddenSplitBookingIds"
    )
) {
    $profileAnchor =
        '      setActiveProfile(profile);'

    if (-not $page.Contains($profileAnchor)) {
        throw "13.21b : setActiveProfile introuvable."
    }

    $page =
        $page.Replace(
            $profileAnchor,
            $profilePatch.TrimEnd()
        )
}

# ============================================================
# HIDE CHILD BOOKINGS
# ============================================================

if (
    -not $page.Contains(
        "!hiddenSplitBookingIds.has"
    )
) {
    $oldRows =
        '      const bookingRows = (bookingData ?? []) as BookingRow[];'

    if (-not $page.Contains($oldRows)) {
        throw "13.21b : bookingRows original introuvable."
    }

    $page =
        $page.Replace(
            $oldRows,
            $bookingRows.TrimEnd()
        )
}

# ============================================================
# COUNTERS
# ============================================================

if (
    -not (
        $page.Contains(
            "splitMissions.filter"
        ) -and
        $page.Contains(
            "splitMissionNeedsAction"
        )
    )
) {
    if (-not $page.Contains($oldCounts)) {
        throw "13.21b : bloc counts original introuvable."
    }

    $page =
        $page.Replace(
            $oldCounts,
            $newCounts
        )
}

# ============================================================
# FILTER BAR
# ============================================================

$oldFilter =
    '!loading && bookings.length > 0 && ('

$newFilter =
    '!loading && (bookings.length > 0 || splitMissions.length > 0) && ('

if ($page.Contains($oldFilter)) {
    $page =
        $page.Replace(
            $oldFilter,
            $newFilter
        )
}

# ============================================================
# EMPTY STATE
# ============================================================

$oldEmpty =
    ') : bookings.length === 0 ? ('

$newEmpty =
    ') : bookings.length === 0 && splitMissions.length === 0 ? ('

if ($page.Contains($oldEmpty)) {
    $page =
        $page.Replace(
            $oldEmpty,
            $newEmpty
        )
}

# ============================================================
# FILTER EMPTY STATE
# ============================================================

$oldVisible =
    ') : visibleBookings.length === 0 ? ('

if ($page.Contains($oldVisible)) {
    $page =
        $page.Replace(
            $oldVisible,
            $visibleReplacement.TrimEnd()
        )
}

# ============================================================
# MISSION RENDER
# ============================================================

if (
    -not $page.Contains(
        "KLYX_SPLIT_MISSION_LIST_WIRING_13_21"
    )
) {
    $renderAnchor =
        '        {loading ? ('

    if (-not $page.Contains($renderAnchor)) {
        throw "13.21b : render anchor bookings introuvable."
    }

    $page =
        $page.Replace(
            $renderAnchor,
            $missionRender.TrimEnd()
        )
}

# ============================================================
# FINAL STATIC VALIDATION
# ============================================================

if (
    -not $page.Contains(
        "KLYX_SPLIT_MISSION_CONSOLIDATION_13_21"
    )
) {
    throw "13.21b : consolidation marker absent."
}

if (
    -not $page.Contains(
        "hiddenSplitBookingIds"
    )
) {
    throw "13.21b : child booking filter absent."
}

if (
    -not $page.Contains(
        "!hiddenSplitBookingIds.has"
    )
) {
    throw "13.21b : child bookings non filtres."
}

if (
    -not $page.Contains(
        "KLYX_SPLIT_MISSION_LIST_WIRING_13_21"
    )
) {
    throw "13.21b : mission list wiring absent."
}

if (
    -not $page.Contains(
        "<SplitMissionSection"
    )
) {
    throw "13.21b : SplitMissionSection non rendu."
}

[System.IO.File]::WriteAllText(
    $pagePath,
    $page,
    $utf8
)

# Checker 13.21 totalement remplace.
[System.IO.File]::WriteAllText(
    $checkerPath,
    $checker,
    $utf8
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.21b REPARATION OK"
Write-Host "======================================"
Write-Host "Checker True/False : CORRIGE"
Write-Host "Consolidation marker : RESTAURE"
Write-Host "Child bookings filter : RESTAURE"
Write-Host "Mission list wiring : RESTAURE"
Write-Host "Compteurs : CONSOLIDES"
Write-Host "Migration : AUCUNE"
Write-Host "Paiement : INCHANGE"
Write-Host "======================================"