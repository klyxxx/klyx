$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

function Decode {
    param(
        [string]$Value
    )

    return [System.Text.Encoding]::UTF8.GetString(
        [Convert]::FromBase64String(
            $Value
        )
    )
}

$importBlock =
    Decode "aW1wb3J0IFNwbGl0TWlzc2lvblNlY3Rpb24sIHsKICBzcGxpdE1pc3Npb25Jc0hpc3RvcnksCiAgc3BsaXRNaXNzaW9uTWF0Y2hlc0ZpbHRlciwKICBzcGxpdE1pc3Npb25OZWVkc0FjdGlvbiwKICB0eXBlIFNwbGl0TWlzc2lvblN1bW1hcnksCn0gZnJvbSAiLi9TcGxpdE1pc3Npb25TZWN0aW9uIjs="

$stateBlock =
    Decode "CiAgLy8gS0xZWF9TUExJVF9NSVNTSU9OX0NPTlNPTElEQVRJT05fMTNfMjEKICBjb25zdCBbCiAgICBzcGxpdE1pc3Npb25zLAogICAgc2V0U3BsaXRNaXNzaW9ucywKICBdID0KICAgIHVzZVN0YXRlPAogICAgICBTcGxpdE1pc3Npb25TdW1tYXJ5W10KICAgID4oW10pOw=="

$loaderBlock =
    Decode "ICAgICAgICAgIC8vIEtMWVhfU1BMSVRfTUlTU0lPTl9DSElMRF9GSUxURVJfMTNfMjFECiAgICAgICAgICBjb25zdCBvdmVydmlld0NhcmRzID0KICAgICAgICAgICAgYm9keS5jYXJkcyA/PwogICAgICAgICAgICBbXTsKCiAgICAgICAgICBsZXQgbmV4dFNwbGl0TWlzc2lvbnM6CiAgICAgICAgICAgIFNwbGl0TWlzc2lvblN1bW1hcnlbXSA9CiAgICAgICAgICAgIFtdOwoKICAgICAgICAgIGxldCBoaWRkZW5TcGxpdEJvb2tpbmdJZHMgPQogICAgICAgICAgICBuZXcgU2V0PHN0cmluZz4oKTsKCiAgICAgICAgICBpZiAoCiAgICAgICAgICAgICgKICAgICAgICAgICAgICBib2R5LmFjY291bnRUeXBlID8/CiAgICAgICAgICAgICAgImNsaWVudCIKICAgICAgICAgICAgKSA9PT0KICAgICAgICAgICAgImNsaWVudCIKICAgICAgICAgICkgewogICAgICAgICAgICB0cnkgewogICAgICAgICAgICAgIGNvbnN0IHNwbGl0UmVzcG9uc2UgPQogICAgICAgICAgICAgICAgYXdhaXQgZmV0Y2goCiAgICAgICAgICAgICAgICAgICIvYXBpL2Jvb2tpbmdzL3NwbGl0LW1pc3Npb25zIiwKICAgICAgICAgICAgICAgICAgewogICAgICAgICAgICAgICAgICAgIGNhY2hlOgogICAgICAgICAgICAgICAgICAgICAgIm5vLXN0b3JlIiwKCiAgICAgICAgICAgICAgICAgICAgaGVhZGVyczogewogICAgICAgICAgICAgICAgICAgICAgQXV0aG9yaXphdGlvbjoKICAgICAgICAgICAgICAgICAgICAgICAgIkJlYXJlciAiICsKICAgICAgICAgICAgICAgICAgICAgICAgdG9rZW4sCiAgICAgICAgICAgICAgICAgICAgfSwKICAgICAgICAgICAgICAgICAgfQogICAgICAgICAgICAgICAgKTsKCiAgICAgICAgICAgICAgaWYgKAogICAgICAgICAgICAgICAgc3BsaXRSZXNwb25zZS5vawogICAgICAgICAgICAgICkgewogICAgICAgICAgICAgICAgY29uc3Qgc3BsaXRCb2R5ID0KICAgICAgICAgICAgICAgICAgKAogICAgICAgICAgICAgICAgICAgIGF3YWl0IHNwbGl0UmVzcG9uc2UuanNvbigpCiAgICAgICAgICAgICAgICAgICkgYXMgewogICAgICAgICAgICAgICAgICAgIG1pc3Npb25zPzoKICAgICAgICAgICAgICAgICAgICAgIFNwbGl0TWlzc2lvblN1bW1hcnlbXTsKCiAgICAgICAgICAgICAgICAgICAgY2hpbGRCb29raW5nSWRzPzoKICAgICAgICAgICAgICAgICAgICAgIHN0cmluZ1tdOwogICAgICAgICAgICAgICAgICB9OwoKICAgICAgICAgICAgICAgIG5leHRTcGxpdE1pc3Npb25zID0KICAgICAgICAgICAgICAgICAgQXJyYXkuaXNBcnJheSgKICAgICAgICAgICAgICAgICAgICBzcGxpdEJvZHkubWlzc2lvbnMKICAgICAgICAgICAgICAgICAgKQogICAgICAgICAgICAgICAgICAgID8gc3BsaXRCb2R5Lm1pc3Npb25zCiAgICAgICAgICAgICAgICAgICAgOiBbXTsKCiAgICAgICAgICAgICAgICBoaWRkZW5TcGxpdEJvb2tpbmdJZHMgPQogICAgICAgICAgICAgICAgICBuZXcgU2V0KAogICAgICAgICAgICAgICAgICAgIEFycmF5LmlzQXJyYXkoCiAgICAgICAgICAgICAgICAgICAgICBzcGxpdEJvZHkuY2hpbGRCb29raW5nSWRzCiAgICAgICAgICAgICAgICAgICAgKQogICAgICAgICAgICAgICAgICAgICAgPyBzcGxpdEJvZHkuY2hpbGRCb29raW5nSWRzCiAgICAgICAgICAgICAgICAgICAgICA6IFtdCiAgICAgICAgICAgICAgICAgICk7CiAgICAgICAgICAgICAgfQogICAgICAgICAgICB9IGNhdGNoIHsKICAgICAgICAgICAgICBuZXh0U3BsaXRNaXNzaW9ucyA9CiAgICAgICAgICAgICAgICBbXTsKCiAgICAgICAgICAgICAgaGlkZGVuU3BsaXRCb29raW5nSWRzID0KICAgICAgICAgICAgICAgIG5ldyBTZXQ8c3RyaW5nPigpOwogICAgICAgICAgICB9CiAgICAgICAgICB9CgogICAgICAgICAgc2V0U3BsaXRNaXNzaW9ucygKICAgICAgICAgICAgbmV4dFNwbGl0TWlzc2lvbnMKICAgICAgICAgICk7CgogICAgICAgICAgc2V0Qm9va2luZ3MoCiAgICAgICAgICAgIG92ZXJ2aWV3Q2FyZHMuZmlsdGVyKAogICAgICAgICAgICAgICgKICAgICAgICAgICAgICAgIGNhcmQKICAgICAgICAgICAgICApID0+CiAgICAgICAgICAgICAgICAhaGlkZGVuU3BsaXRCb29raW5nSWRzLmhhcygKICAgICAgICAgICAgICAgICAgY2FyZC5pZAogICAgICAgICAgICAgICAgKQogICAgICAgICAgICApCiAgICAgICAgICApOw=="

$countsBlock =
    Decode "CiAgLy8gS0xZWF9TUExJVF9NSVNTSU9OX0NPVU5UU18xM18yMUQKICBjb25zdCBzcGxpdE1pc3Npb25Db3VudHMgPQogICAgdXNlTWVtbygKICAgICAgKCkgPT4gKHsKICAgICAgICBhY3Rpb25zOgogICAgICAgICAgc3BsaXRNaXNzaW9ucy5maWx0ZXIoCiAgICAgICAgICAgIHNwbGl0TWlzc2lvbk5lZWRzQWN0aW9uCiAgICAgICAgICApLmxlbmd0aCwKCiAgICAgICAgdXBjb21pbmc6CiAgICAgICAgICBzcGxpdE1pc3Npb25zLmZpbHRlcigKICAgICAgICAgICAgKAogICAgICAgICAgICAgIG1pc3Npb24KICAgICAgICAgICAgKSA9PgogICAgICAgICAgICAgICFzcGxpdE1pc3Npb25Jc0hpc3RvcnkoCiAgICAgICAgICAgICAgICBtaXNzaW9uCiAgICAgICAgICAgICAgKQogICAgICAgICAgKS5sZW5ndGgsCgogICAgICAgIGhpc3Rvcnk6CiAgICAgICAgICBzcGxpdE1pc3Npb25zLmZpbHRlcigKICAgICAgICAgICAgc3BsaXRNaXNzaW9uSXNIaXN0b3J5CiAgICAgICAgICApLmxlbmd0aCwKCiAgICAgICAgYWxsOgogICAgICAgICAgc3BsaXRNaXNzaW9ucy5sZW5ndGgsCiAgICAgIH0pLAogICAgICBbCiAgICAgICAgc3BsaXRNaXNzaW9ucywKICAgICAgXQogICAgKTsK"

$renderBlock =
    Decode "ICAgICAgICB7LyogS0xZWF9TUExJVF9NSVNTSU9OX0xJU1RfV0lSSU5HXzEzXzIxICovfQogICAgICAgIHshbG9hZGluZyAmJiAoCiAgICAgICAgICA8U3BsaXRNaXNzaW9uU2VjdGlvbgogICAgICAgICAgICBtaXNzaW9ucz17CiAgICAgICAgICAgICAgc3BsaXRNaXNzaW9ucwogICAgICAgICAgICB9CiAgICAgICAgICAgIGZpbHRlcj17CiAgICAgICAgICAgICAgZmlsdGVyCiAgICAgICAgICAgIH0KICAgICAgICAgIC8+CiAgICAgICAgKX0K"

$checker =
    Decode "JEVycm9yQWN0aW9uUHJlZmVyZW5jZSA9ICJTdG9wIgoKJHJvb3QgPQogICAgU3BsaXQtUGF0aCAtUGFyZW50ICRQU1NjcmlwdFJvb3QKClNldC1Mb2NhdGlvbiAkcm9vdAoKJGFwaSA9CiAgICBKb2luLVBhdGggYAogICAgICAgICRyb290IGAKICAgICAgICAiYXBwXGFwaVxib29raW5nc1xzcGxpdC1taXNzaW9uc1xyb3V0ZS50cyIKCiRjb21wb25lbnQgPQogICAgSm9pbi1QYXRoIGAKICAgICAgICAkcm9vdCBgCiAgICAgICAgImFwcFxib29raW5nc1xTcGxpdE1pc3Npb25TZWN0aW9uLnRzeCIKCiRkZXRhaWwgPQogICAgSm9pbi1QYXRoIGAKICAgICAgICAkcm9vdCBgCiAgICAgICAgImFwcFxib29raW5nc1xzcGxpdFxbaWRdXHBhZ2UudHN4IgoKJHBhZ2UgPQogICAgSm9pbi1QYXRoIGAKICAgICAgICAkcm9vdCBgCiAgICAgICAgImFwcFxib29raW5nc1xwYWdlLnRzeCIKCmZvcmVhY2ggKAogICAgJHBhdGgKICAgIGluIEAoCiAgICAgICAgJGFwaSwKICAgICAgICAkY29tcG9uZW50LAogICAgICAgICRkZXRhaWwsCiAgICAgICAgJHBhZ2UKICAgICkKKSB7CiAgICBpZiAoCiAgICAgICAgLW5vdCAoCiAgICAgICAgICAgIFRlc3QtUGF0aCBgCiAgICAgICAgICAgICAgICAtTGl0ZXJhbFBhdGggYAogICAgICAgICAgICAgICAgJHBhdGgKICAgICAgICApCiAgICApIHsKICAgICAgICB0aHJvdyAiMTMuMjEgOiBmaWNoaWVyIGludHJvdXZhYmxlIDogJHBhdGgiCiAgICB9Cn0KCiRhID0KICAgIFtTeXN0ZW0uSU8uRmlsZV06OlJlYWRBbGxUZXh0KAogICAgICAgICRhcGkKICAgICkKCiRjID0KICAgIFtTeXN0ZW0uSU8uRmlsZV06OlJlYWRBbGxUZXh0KAogICAgICAgICRjb21wb25lbnQKICAgICkKCiRkID0KICAgIFtTeXN0ZW0uSU8uRmlsZV06OlJlYWRBbGxUZXh0KAogICAgICAgICRkZXRhaWwKICAgICkKCiRwID0KICAgIFtTeXN0ZW0uSU8uRmlsZV06OlJlYWRBbGxUZXh0KAogICAgICAgICRwYWdlCiAgICApCgokZmFpbGVkID0KICAgIEAoKQoKZnVuY3Rpb24gVGVzdC1LbHl4IHsKICAgIHBhcmFtKAogICAgICAgIFtzdHJpbmddJE5hbWUsCiAgICAgICAgW2Jvb2xdJENvbmRpdGlvbgogICAgKQoKICAgIGlmICgKICAgICAgICAkQ29uZGl0aW9uCiAgICApIHsKICAgICAgICBXcml0ZS1Ib3N0ICgKICAgICAgICAgICAgIltPS10gICAiICsKICAgICAgICAgICAgJE5hbWUKICAgICAgICApCgogICAgICAgIHJldHVybgogICAgfQoKICAgIFdyaXRlLUhvc3QgKAogICAgICAgICJbRkFJTF0gIiArCiAgICAgICAgJE5hbWUKICAgICkKCiAgICAkc2NyaXB0OmZhaWxlZCArPQogICAgICAgICROYW1lCn0KCldyaXRlLUhvc3QgIiIKV3JpdGUtSG9zdCAiQ0hFQ0sgS0xZWCAxMy4yMSIKV3JpdGUtSG9zdCAiIgoKVGVzdC1LbHl4IGAKICAgICIxMy4yMSBBUEkgbWFya2VyIiBgCiAgICAkYS5Db250YWlucygKICAgICAgICAiS0xZWF9TUExJVF9NSVNTSU9OX0FQSV8xM18yMSIKICAgICkKClRlc3QtS2x5eCBgCiAgICAic3BsaXQgYmF0Y2hlcyBsb2FkZWQiIGAKICAgICRhLkNvbnRhaW5zKAogICAgICAgICJzcGxpdF9ib29raW5nX2JhdGNoZXMiCiAgICApCgpUZXN0LUtseXggYAogICAgInNwbGl0IGl0ZW1zIGxvYWRlZCIgYAogICAgJGEuQ29udGFpbnMoCiAgICAgICAgInNwbGl0X2Jvb2tpbmdfYmF0Y2hfaXRlbXMiCiAgICApCgpUZXN0LUtseXggYAogICAgImNvbmZpcm1hdGlvbiBzbmFwc2hvdCBsb2FkZWQiIGAKICAgICRhLkNvbnRhaW5zKAogICAgICAgICJtYXJrZXRfc3BsaXRfcGxhbl9jb25maXJtYXRpb25zIgogICAgKQoKVGVzdC1LbHl4IGAKICAgICJhZ2dyZWdhdGUgbGlmZWN5Y2xlIiBgCiAgICAoCiAgICAgICAgJGEuQ29udGFpbnMoCiAgICAgICAgICAgICJwYXJ0aWFsbHlfYWNjZXB0ZWQiCiAgICAgICAgKSAtYW5kCiAgICAgICAgJGEuQ29udGFpbnMoCiAgICAgICAgICAgICJpbl9wcm9ncmVzcyIKICAgICAgICApIC1hbmQKICAgICAgICAkYS5Db250YWlucygKICAgICAgICAgICAgIm1peGVkX2lzc3VlIgogICAgICAgICkKICAgICkKClRlc3QtS2x5eCBgCiAgICAiY2hpbGQgSURzIGV4cG9zZWQiIGAKICAgICRhLkNvbnRhaW5zKAogICAgICAgICJjaGlsZEJvb2tpbmdJZHMiCiAgICApCgpUZXN0LUtseXggYAogICAgImF1dG9tYXRpYyBib29raW5nIGZvcmJpZGRlbiIgYAogICAgJGEuQ29udGFpbnMoCiAgICAgICAgImF1dG9tYXRpY0Jvb2tpbmciCiAgICApCgpUZXN0LUtseXggYAogICAgImF1dG9tYXRpYyBwYXltZW50IGZvcmJpZGRlbiIgYAogICAgJGEuQ29udGFpbnMoCiAgICAgICAgImF1dG9tYXRpY1BheW1lbnQiCiAgICApCgpUZXN0LUtseXggYAogICAgIjEzLjIxIFVJIG1hcmtlciIgYAogICAgJGMuQ29udGFpbnMoCiAgICAgICAgIktMWVhfU1BMSVRfTUlTU0lPTl9VSV8xM18yMSIKICAgICkKClRlc3QtS2x5eCBgCiAgICAiMTMuMjEgZGV0YWlsIG1hcmtlciIgYAogICAgJGQuQ29udGFpbnMoCiAgICAgICAgIktMWVhfU1BMSVRfTUlTU0lPTl9ERVRBSUxfMTNfMjEiCiAgICApCgpUZXN0LUtseXggYAogICAgImV4aXN0aW5nIG92ZXJ2aWV3IHJldGFpbmVkIiBgCiAgICAkcC5Db250YWlucygKICAgICAgICAiL2FwaS9ib29raW5ncy9vdmVydmlldyIKICAgICkKClRlc3QtS2x5eCBgCiAgICAicGFnZSBjb25zb2xpZGF0aW9uIG1hcmtlciIgYAogICAgJHAuQ29udGFpbnMoCiAgICAgICAgIktMWVhfU1BMSVRfTUlTU0lPTl9DT05TT0xJREFUSU9OXzEzXzIxIgogICAgKQoKVGVzdC1LbHl4IGAKICAgICJzcGxpdCBtaXNzaW9uIHN0YXRlIiBgCiAgICAoCiAgICAgICAgJHAuQ29udGFpbnMoCiAgICAgICAgICAgICJzcGxpdE1pc3Npb25zIgogICAgICAgICkgLWFuZAogICAgICAgICRwLkNvbnRhaW5zKAogICAgICAgICAgICAic2V0U3BsaXRNaXNzaW9ucyIKICAgICAgICApCiAgICApCgpUZXN0LUtseXggYAogICAgInNwbGl0IEFQSSB3aXJlZCIgYAogICAgJHAuQ29udGFpbnMoCiAgICAgICAgIi9hcGkvYm9va2luZ3Mvc3BsaXQtbWlzc2lvbnMiCiAgICApCgpUZXN0LUtseXggYAogICAgImNoaWxkIGJvb2tpbmdzIGhpZGRlbiIgYAogICAgKAogICAgICAgICRwLkNvbnRhaW5zKAogICAgICAgICAgICAiaGlkZGVuU3BsaXRCb29raW5nSWRzIgogICAgICAgICkgLWFuZAogICAgICAgICRwLkNvbnRhaW5zKAogICAgICAgICAgICAiIWhpZGRlblNwbGl0Qm9va2luZ0lkcy5oYXMiCiAgICAgICAgKQogICAgKQoKVGVzdC1LbHl4IGAKICAgICJtaXNzaW9uIGxpc3Qgd2lyZWQiIGAKICAgICgKICAgICAgICAkcC5Db250YWlucygKICAgICAgICAgICAgIktMWVhfU1BMSVRfTUlTU0lPTl9MSVNUX1dJUklOR18xM18yMSIKICAgICAgICApIC1hbmQKICAgICAgICAkcC5Db250YWlucygKICAgICAgICAgICAgIjxTcGxpdE1pc3Npb25TZWN0aW9uIgogICAgICAgICkKICAgICkKClRlc3QtS2x5eCBgCiAgICAibWlzc2lvbiBjb3VudHMgaW50ZWdyYXRlZCIgYAogICAgKAogICAgICAgICRwLkNvbnRhaW5zKAogICAgICAgICAgICAic3BsaXRNaXNzaW9uQ291bnRzIgogICAgICAgICkgLWFuZAogICAgICAgICRwLkNvbnRhaW5zKAogICAgICAgICAgICAic3BsaXRNaXNzaW9uTmVlZHNBY3Rpb24iCiAgICAgICAgKSAtYW5kCiAgICAgICAgJHAuQ29udGFpbnMoCiAgICAgICAgICAgICJzcGxpdE1pc3Npb25Jc0hpc3RvcnkiCiAgICAgICAgKQogICAgKQoKVGVzdC1LbHl4IGAKICAgICJleGlzdGluZyBncm91cCBkaXNwbGF5IHJldGFpbmVkIiBgCiAgICAoCiAgICAgICAgJHAuQ29udGFpbnMoCiAgICAgICAgICAgICJncm91cENvdW50IgogICAgICAgICkgLWFuZAogICAgICAgICRwLkNvbnRhaW5zKAogICAgICAgICAgICAiY2hpbGRCb29raW5nc0hpZGRlbiIKICAgICAgICApCiAgICApCgppZiAoCiAgICAkZmFpbGVkLkNvdW50IC1ndCAwCikgewogICAgV3JpdGUtSG9zdCAiIgogICAgV3JpdGUtSG9zdCAiRUNIRUNTIEVYQUNUUyA6IgoKICAgIGZvcmVhY2ggKAogICAgICAgICRpdGVtCiAgICAgICAgaW4gJGZhaWxlZAogICAgKSB7CiAgICAgICAgV3JpdGUtSG9zdCAoCiAgICAgICAgICAgICIgLSAiICsKICAgICAgICAgICAgJGl0ZW0KICAgICAgICApCiAgICB9CgogICAgdGhyb3cgIktMWVggMTMuMjEgc3RhdGljIGNoZWNrZXIgRkFJTEVELiIKfQoKV3JpdGUtSG9zdCAiIgpXcml0ZS1Ib3N0ICJUeXBlU2NyaXB0Li4uIgpXcml0ZS1Ib3N0ICIiCgpucHguY21kIHRzYyAtLW5vRW1pdCAtLXByZXR0eSBmYWxzZQoKaWYgKAogICAgJExBU1RFWElUQ09ERSAtbmUgMAopIHsKICAgIHRocm93ICJLTFlYIDEzLjIxIFR5cGVTY3JpcHQgRkFJTEVELiIKfQoKV3JpdGUtSG9zdCAiIgpXcml0ZS1Ib3N0ICJOZXh0IGJ1aWxkLi4uIgpXcml0ZS1Ib3N0ICIiCgpucG0uY21kIHJ1biBidWlsZAoKaWYgKAogICAgJExBU1RFWElUQ09ERSAtbmUgMAopIHsKICAgIHRocm93ICJLTFlYIDEzLjIxIGJ1aWxkIEZBSUxFRC4iCn0KCldyaXRlLUhvc3QgIiIKV3JpdGUtSG9zdCAiPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0iCldyaXRlLUhvc3QgIktMWVggMTMuMjEgQ0hFQ0sgT0siCldyaXRlLUhvc3QgIj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09IgpXcml0ZS1Ib3N0ICJCb29raW5nIG92ZXJ2aWV3IGhpc3RvcmlxdWUgOiBDT05TRVJWRSIKV3JpdGUtSG9zdCAiQm9va2luZyBncm91cHMgaGlzdG9yaXF1ZXMgOiBDT05TRVJWRVMiCldyaXRlLUhvc3QgIlNwbGl0IG1pc3Npb24gY2xpZW50IDogQ09OU09MSURFRSIKV3JpdGUtSG9zdCAiMSBzcGxpdCBwbGFuIDogMSBNSVNTSU9OIENMSUVOVCIKV3JpdGUtSG9zdCAiU3BsaXQgY2hpbGQgYm9va2luZ3MgOiBNQVNRVUVTIgpXcml0ZS1Ib3N0ICJDaGlsZCBib29raW5nIGRldGFpbCA6IEFDQ0VTU0lCTEUiCldyaXRlLUhvc3QgIkZpbHRyZXMgL2Jvb2tpbmdzIDogSU5URUdSRVMiCldyaXRlLUhvc3QgIkNvbXB0ZXVycyAvYm9va2luZ3MgOiBJTlRFR1JFUyIKV3JpdGUtSG9zdCAiQXV0b21hdGljIGJvb2tpbmcgOiBOT04iCldyaXRlLUhvc3QgIkF1dG9tYXRpYyBwYXltZW50IDogTk9OIgpXcml0ZS1Ib3N0ICJNaWdyYXRpb24gREIgOiBBVUNVTkUiCldyaXRlLUhvc3QgIlR5cGVTY3JpcHQgOiBPSyIKV3JpdGUtSG9zdCAiQnVpbGQgTmV4dC5qcyA6IE9LIgpXcml0ZS1Ib3N0ICI9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSI="

$pagePath =
    Join-Path `
        $root `
        "app\bookings\page.tsx"

$checkerPath =
    Join-Path `
        $root `
        "scripts\check-step-13-21.ps1"

if (
    -not (
        Test-Path `
            -LiteralPath `
            $pagePath
    )
) {
    throw "13.21d : app\bookings\page.tsx introuvable."
}

$page =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

if (
    [string]::IsNullOrWhiteSpace(
        $page
    )
) {
    throw "13.21d : page bookings vide."
}

$backupDir =
    Join-Path `
        $root `
        "scripts\backups"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $backupDir |
    Out-Null

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

Copy-Item `
    -LiteralPath $pagePath `
    -Destination (
        Join-Path `
            $backupDir `
            (
                "bookings-page-13-21d-" +
                $timestamp +
                ".tsx"
            )
    ) `
    -Force

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

    if (
        -not $firstImport.Success
    ) {
        throw "13.21d : premier import introuvable."
    }

    $page =
        $page.Insert(
            $firstImport.Index,
            $importBlock +
            "`r`n"
        )
}

# ============================================================
# STATE
# Structure actuelle :
#
# const [
#   bookings,
#   setBookings,
# ] =
#   useState<
#     BookingCard[]
#   >([]);
# ============================================================

if (
    -not $page.Contains(
        "KLYX_SPLIT_MISSION_CONSOLIDATION_13_21"
    )
) {
    $statePattern =
        '(?ms)(  const\s*\[\s*bookings\s*,\s*setBookings\s*,?\s*\]\s*=\s*useState\s*<\s*BookingCard\[\]\s*>\s*\(\s*\[\]\s*\)\s*;)'

    $stateMatch =
        [regex]::Match(
            $page,
            $statePattern
        )

    if (
        -not $stateMatch.Success
    ) {
        throw "13.21d : state bookings actuel introuvable."
    }

    $page =
        $page.Insert(
            $stateMatch.Index +
            $stateMatch.Length,
            $stateBlock
        )
}

# ============================================================
# LOAD SPLIT MISSIONS
# Remplace uniquement setBookings(body.cards ?? [])
# ============================================================

if (
    -not $page.Contains(
        "KLYX_SPLIT_MISSION_CHILD_FILTER_13_21D"
    )
) {
    $setBookingsPattern =
        '(?ms)\s{10}setBookings\s*\(\s*body\.cards\s*\?\?\s*\[\]\s*\)\s*;'

    $setBookingsMatch =
        [regex]::Match(
            $page,
            $setBookingsPattern
        )

    if (
        -not $setBookingsMatch.Success
    ) {
        throw "13.21d : setBookings(body.cards) introuvable."
    }

    $page =
        $page.Remove(
            $setBookingsMatch.Index,
            $setBookingsMatch.Length
        )

    $page =
        $page.Insert(
            $setBookingsMatch.Index,
            "`r`n" +
            $loaderBlock
        )
}

# ============================================================
# hiddenChildren
# Ajoute aussi les réservations split masquées.
# ============================================================

$hiddenPattern =
    '(?ms)setHiddenChildren\s*\(\s*body\.childBookingsHidden\s*\?\?\s*0\s*\)\s*;'

$hiddenMatch =
    [regex]::Match(
        $page,
        $hiddenPattern
    )

if (
    $hiddenMatch.Success -and
    -not $page.Contains(
        "body.childBookingsHidden ?? 0) +"
    )
) {
    $replacement = @"
setHiddenChildren(
            (body.childBookingsHidden ?? 0) +
            hiddenSplitBookingIds.size
          );
"@

    $page =
        $page.Remove(
            $hiddenMatch.Index,
            $hiddenMatch.Length
        )

    $page =
        $page.Insert(
            $hiddenMatch.Index,
            $replacement.Trim()
        )
}

# ============================================================
# SPLIT COUNTS
# ============================================================

if (
    -not $page.Contains(
        "KLYX_SPLIT_MISSION_COUNTS_13_21D"
    )
) {
    $visibleAnchor =
        "  const visibleBookings ="

    $visibleIndex =
        $page.IndexOf(
            $visibleAnchor
        )

    if (
        $visibleIndex -lt 0
    ) {
        throw "13.21d : visibleBookings introuvable."
    }

    $page =
        $page.Insert(
            $visibleIndex,
            $countsBlock
        )
}

# ============================================================
# FILTER COUNTS
# ============================================================

if (
    -not $page.Contains(
        "splitMissionCounts[option.value]"
    )
) {
    $countPattern =
        '\{counts\[\s*option\.value\s*\]\}'

    $countMatch =
        [regex]::Match(
            $page,
            $countPattern
        )

    if (
        $countMatch.Success
    ) {
        $page =
            $page.Remove(
                $countMatch.Index,
                $countMatch.Length
            )

        $page =
            $page.Insert(
                $countMatch.Index,
                "{counts[option.value] + splitMissionCounts[option.value]}"
            )
    }
}

# ============================================================
# EMPTY GLOBAL
# ============================================================

$emptyPattern =
    '\) : bookings\.length ===\s*0 \? \('

$emptyMatch =
    [regex]::Match(
        $page,
        $emptyPattern
    )

if (
    $emptyMatch.Success
) {
    $page =
        $page.Remove(
            $emptyMatch.Index,
            $emptyMatch.Length
        )

    $page =
        $page.Insert(
            $emptyMatch.Index,
            ") : bookings.length === 0 && splitMissions.length === 0 ? ("
        )
}

# ============================================================
# EMPTY FILTRE
# Structure actuelle :
#
# ) : visibleBookings.length ===
#   0 ? (
# ============================================================

$visibleEmptyPattern =
    '\) : visibleBookings\.length ===\s*0 \? \('

$visibleEmptyMatch =
    [regex]::Match(
        $page,
        $visibleEmptyPattern
    )

if (
    $visibleEmptyMatch.Success
) {
    $replacement =
        ') : visibleBookings.length === 0 && splitMissions.filter((mission) => splitMissionMatchesFilter(mission, filter)).length === 0 ? ('

    $page =
        $page.Remove(
            $visibleEmptyMatch.Index,
            $visibleEmptyMatch.Length
        )

    $page =
        $page.Insert(
            $visibleEmptyMatch.Index,
            $replacement
        )
}

# ============================================================
# RENDER MISSIONS
# ============================================================

if (
    -not $page.Contains(
        "KLYX_SPLIT_MISSION_LIST_WIRING_13_21"
    )
) {
    $loadingAnchor =
        "        {loading ? ("

    $loadingIndex =
        $page.IndexOf(
            $loadingAnchor
        )

    if (
        $loadingIndex -lt 0
    ) {
        throw "13.21d : branche loading introuvable."
    }

    $page =
        $page.Insert(
            $loadingIndex,
            $renderBlock
        )
}

# ============================================================
# VALIDATION AVANT ECRITURE
# ============================================================

$requiredMarkers =
    @(
        "KLYX_SPLIT_MISSION_CONSOLIDATION_13_21",
        "KLYX_SPLIT_MISSION_CHILD_FILTER_13_21D",
        "KLYX_SPLIT_MISSION_COUNTS_13_21D",
        "KLYX_SPLIT_MISSION_LIST_WIRING_13_21",
        "/api/bookings/overview",
        "/api/bookings/split-missions",
        "hiddenSplitBookingIds",
        "splitMissions",
        "<SplitMissionSection"
    )

foreach (
    $marker
    in $requiredMarkers
) {
    if (
        -not $page.Contains(
            $marker
        )
    ) {
        throw "13.21d : validation manquante : $marker"
    }
}

[System.IO.File]::WriteAllText(
    $pagePath,
    $page,
    $utf8
)

# Checker entièrement remplacé.
[System.IO.File]::WriteAllText(
    $checkerPath,
    $checker,
    $utf8
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.21d REPARATION OK"
Write-Host "======================================"
Write-Host "/api/bookings/overview : CONSERVE"
Write-Host "cards existants : CONSERVES"
Write-Host "groupCount : CONSERVE"
Write-Host "childBookingsHidden : CONSERVE"
Write-Host "Split missions : AJOUTEES"
Write-Host "Split child bookings : MASQUES"
Write-Host "Filtres : INTEGRES"
Write-Host "Compteurs : INTEGRES"
Write-Host "Ancien repair 13.21b/c : ABANDONNE"
Write-Host "Migration : AUCUNE"
Write-Host "Paiement : INCHANGE"
Write-Host "======================================"