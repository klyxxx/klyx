$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

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

$component =
    Decode "InVzZSBjbGllbnQiOwoKaW1wb3J0IHsKICB1c2VDYWxsYmFjaywKICB1c2VFZmZlY3QsCiAgdXNlU3RhdGUsCn0gZnJvbSAicmVhY3QiOwoKaW1wb3J0IHsKICBBbGVydFRyaWFuZ2xlLAogIENoZWNrQ2lyY2xlMiwKICBGaW5nZXJwcmludCwKICBMb2FkZXJDaXJjbGUsCiAgUmVmcmVzaEN3LAogIFNoaWVsZENoZWNrLAp9IGZyb20gImx1Y2lkZS1yZWFjdCI7CgppbXBvcnQgewogIHN1cGFiYXNlLAp9IGZyb20gIkAvbGliL3N1cGFiYXNlIjsKCi8vIEtMWVhfU1BMSVRfUExBTl9DT05GSVJNQVRJT05fVUlfMTNfMTgKLy8gS0xZWF9TUExJVF9QTEFOX0NPTkZJUk1BVElPTl9VSV9DT01QQVRfMTNfMTlFCgp0eXBlIFByb3BzID0gewogIHJlcXVlc3RJZDoKICAgIHN0cmluZzsKCiAgcGxhbjoKICAgIHVua25vd247Cn07Cgp0eXBlIENvbmZpcm1hdGlvblJlc3BvbnNlID0gewogIGNvbmZpcm1lZD86CiAgICBib29sZWFuOwoKICB2YWxpZD86CiAgICBib29sZWFuOwoKICBjb25maXJtYXRpb25JZD86CiAgICBzdHJpbmc7CgogIHBsYW5IYXNoPzoKICAgIHN0cmluZzsKCiAgcmVjb25maXJtYXRpb25SZXF1aXJlZD86CiAgICBib29sZWFuOwoKICBjb2RlPzoKICAgIHN0cmluZzsKCiAgZXJyb3I/OgogICAgc3RyaW5nOwp9OwoKYXN5bmMgZnVuY3Rpb24gYWNjZXNzVG9rZW4oKTogUHJvbWlzZTxzdHJpbmc+IHsKICBjb25zdCB7CiAgICBkYXRhLAogIH0gPQogICAgYXdhaXQgc3VwYWJhc2UuYXV0aC5nZXRTZXNzaW9uKCk7CgogIGNvbnN0IHRva2VuID0KICAgIGRhdGEuc2Vzc2lvbj8uYWNjZXNzX3Rva2VuOwoKICBpZiAoIXRva2VuKSB7CiAgICB0aHJvdyBuZXcgRXJyb3IoCiAgICAgICJTZXNzaW9uIEtMWVggbWFucXVhbnRlLiIKICAgICk7CiAgfQoKICByZXR1cm4gdG9rZW47Cn0KCmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIFNwbGl0UGxhbkNvbmZpcm1hdGlvbih7CiAgcmVxdWVzdElkLAogIHBsYW4sCn06IFByb3BzKSB7CiAgY29uc3QgWwogICAgbG9hZGluZywKICAgIHNldExvYWRpbmcsCiAgXSA9CiAgICB1c2VTdGF0ZSgKICAgICAgdHJ1ZQogICAgKTsKCiAgY29uc3QgWwogICAgY29uZmlybWluZywKICAgIHNldENvbmZpcm1pbmcsCiAgXSA9CiAgICB1c2VTdGF0ZSgKICAgICAgZmFsc2UKICAgICk7CgogIGNvbnN0IFsKICAgIGNvbmZpcm1hdGlvbiwKICAgIHNldENvbmZpcm1hdGlvbiwKICBdID0KICAgIHVzZVN0YXRlPAogICAgICBDb25maXJtYXRpb25SZXNwb25zZSB8CiAgICAgIG51bGwKICAgID4oCiAgICAgIG51bGwKICAgICk7CgogIGNvbnN0IFsKICAgIGVycm9yTWVzc2FnZSwKICAgIHNldEVycm9yTWVzc2FnZSwKICBdID0KICAgIHVzZVN0YXRlKAogICAgICAiIgogICAgKTsKCiAgY29uc3QgY2hlY2sgPQogICAgdXNlQ2FsbGJhY2soCiAgICAgIGFzeW5jICgpID0+IHsKICAgICAgICBpZiAoIXJlcXVlc3RJZCkgewogICAgICAgICAgc2V0TG9hZGluZygKICAgICAgICAgICAgZmFsc2UKICAgICAgICAgICk7CgogICAgICAgICAgcmV0dXJuOwogICAgICAgIH0KCiAgICAgICAgc2V0TG9hZGluZygKICAgICAgICAgIHRydWUKICAgICAgICApOwoKICAgICAgICBzZXRFcnJvck1lc3NhZ2UoCiAgICAgICAgICAiIgogICAgICAgICk7CgogICAgICAgIHRyeSB7CiAgICAgICAgICBjb25zdCB0b2tlbiA9CiAgICAgICAgICAgIGF3YWl0IGFjY2Vzc1Rva2VuKCk7CgogICAgICAgICAgY29uc3QgcmVzcG9uc2UgPQogICAgICAgICAgICBhd2FpdCBmZXRjaCgKICAgICAgICAgICAgICAiL2FwaS9tYXJrZXQvcmVxdWVzdHMvIiArCiAgICAgICAgICAgICAgICBlbmNvZGVVUklDb21wb25lbnQoCiAgICAgICAgICAgICAgICAgIHJlcXVlc3RJZAogICAgICAgICAgICAgICAgKSArCiAgICAgICAgICAgICAgICAiL3NwbGl0LWZhbGxiYWNrL2NvbmZpcm0iLAogICAgICAgICAgICAgIHsKICAgICAgICAgICAgICAgIGNhY2hlOgogICAgICAgICAgICAgICAgICAibm8tc3RvcmUiLAoKICAgICAgICAgICAgICAgIGhlYWRlcnM6IHsKICAgICAgICAgICAgICAgICAgQXV0aG9yaXphdGlvbjoKICAgICAgICAgICAgICAgICAgICAiQmVhcmVyICIgKwogICAgICAgICAgICAgICAgICAgIHRva2VuLAogICAgICAgICAgICAgICAgfSwKICAgICAgICAgICAgICB9CiAgICAgICAgICAgICk7CgogICAgICAgICAgY29uc3QgYm9keSA9CiAgICAgICAgICAgICgKICAgICAgICAgICAgICBhd2FpdCByZXNwb25zZS5qc29uKCkKICAgICAgICAgICAgKSBhcyBDb25maXJtYXRpb25SZXNwb25zZTsKCiAgICAgICAgICBpZiAoCiAgICAgICAgICAgIHJlc3BvbnNlLnN0YXR1cyA9PT0KICAgICAgICAgICAgNDA5CiAgICAgICAgICApIHsKICAgICAgICAgICAgc2V0Q29uZmlybWF0aW9uKHsKICAgICAgICAgICAgICAuLi5ib2R5LAoKICAgICAgICAgICAgICBjb25maXJtZWQ6CiAgICAgICAgICAgICAgICBmYWxzZSwKCiAgICAgICAgICAgICAgdmFsaWQ6CiAgICAgICAgICAgICAgICBmYWxzZSwKCiAgICAgICAgICAgICAgcmVjb25maXJtYXRpb25SZXF1aXJlZDoKICAgICAgICAgICAgICAgIHRydWUsCiAgICAgICAgICAgIH0pOwoKICAgICAgICAgICAgcmV0dXJuOwogICAgICAgICAgfQoKICAgICAgICAgIGlmICgKICAgICAgICAgICAgIXJlc3BvbnNlLm9rCiAgICAgICAgICApIHsKICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKAogICAgICAgICAgICAgIGJvZHkuZXJyb3IgfHwKICAgICAgICAgICAgICAgICJJbXBvc3NpYmxlIGRlIHbDqXJpZmllciBsYSBjb25maXJtYXRpb24uIgogICAgICAgICAgICApOwogICAgICAgICAgfQoKICAgICAgICAgIHNldENvbmZpcm1hdGlvbigKICAgICAgICAgICAgYm9keQogICAgICAgICAgKTsKICAgICAgICB9CiAgICAgICAgY2F0Y2ggKAogICAgICAgICAgZXJyb3IKICAgICAgICApIHsKICAgICAgICAgIHNldENvbmZpcm1hdGlvbigKICAgICAgICAgICAgbnVsbAogICAgICAgICAgKTsKCiAgICAgICAgICBzZXRFcnJvck1lc3NhZ2UoCiAgICAgICAgICAgIGVycm9yIGluc3RhbmNlb2YgRXJyb3IKICAgICAgICAgICAgICA/IGVycm9yLm1lc3NhZ2UKICAgICAgICAgICAgICA6ICJJbXBvc3NpYmxlIGRlIHbDqXJpZmllciBsYSBjb25maXJtYXRpb24uIgogICAgICAgICAgKTsKICAgICAgICB9CiAgICAgICAgZmluYWxseSB7CiAgICAgICAgICBzZXRMb2FkaW5nKAogICAgICAgICAgICBmYWxzZQogICAgICAgICAgKTsKICAgICAgICB9CiAgICAgIH0sCiAgICAgIFsKICAgICAgICByZXF1ZXN0SWQsCiAgICAgIF0KICAgICk7CgogIHVzZUVmZmVjdCgKICAgICgpID0+IHsKICAgICAgdm9pZCBjaGVjaygpOwogICAgfSwKICAgIFsKICAgICAgY2hlY2ssCiAgICBdCiAgKTsKCiAgYXN5bmMgZnVuY3Rpb24gY29uZmlybVBsYW4oKSB7CiAgICBpZiAoCiAgICAgICFyZXF1ZXN0SWQgfHwKICAgICAgY29uZmlybWluZwogICAgKSB7CiAgICAgIHJldHVybjsKICAgIH0KCiAgICBzZXRDb25maXJtaW5nKAogICAgICB0cnVlCiAgICApOwoKICAgIHNldEVycm9yTWVzc2FnZSgKICAgICAgIiIKICAgICk7CgogICAgdHJ5IHsKICAgICAgY29uc3QgdG9rZW4gPQogICAgICAgIGF3YWl0IGFjY2Vzc1Rva2VuKCk7CgogICAgICBjb25zdCByZXNwb25zZSA9CiAgICAgICAgYXdhaXQgZmV0Y2goCiAgICAgICAgICAiL2FwaS9tYXJrZXQvcmVxdWVzdHMvIiArCiAgICAgICAgICAgIGVuY29kZVVSSUNvbXBvbmVudCgKICAgICAgICAgICAgICByZXF1ZXN0SWQKICAgICAgICAgICAgKSArCiAgICAgICAgICAgICIvc3BsaXQtZmFsbGJhY2svY29uZmlybSIsCiAgICAgICAgICB7CiAgICAgICAgICAgIG1ldGhvZDoKICAgICAgICAgICAgICAiUE9TVCIsCgogICAgICAgICAgICBjYWNoZToKICAgICAgICAgICAgICAibm8tc3RvcmUiLAoKICAgICAgICAgICAgaGVhZGVyczogewogICAgICAgICAgICAgIEF1dGhvcml6YXRpb246CiAgICAgICAgICAgICAgICAiQmVhcmVyICIgKwogICAgICAgICAgICAgICAgdG9rZW4sCgogICAgICAgICAgICAgICJDb250ZW50LVR5cGUiOgogICAgICAgICAgICAgICAgImFwcGxpY2F0aW9uL2pzb24iLAogICAgICAgICAgICB9LAoKICAgICAgICAgICAgYm9keToKICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeSh7CiAgICAgICAgICAgICAgICBwbGFuLAogICAgICAgICAgICAgIH0pLAogICAgICAgICAgfQogICAgICAgICk7CgogICAgICBjb25zdCBib2R5ID0KICAgICAgICAoCiAgICAgICAgICBhd2FpdCByZXNwb25zZS5qc29uKCkKICAgICAgICApIGFzIENvbmZpcm1hdGlvblJlc3BvbnNlOwoKICAgICAgaWYgKAogICAgICAgICFyZXNwb25zZS5vawogICAgICApIHsKICAgICAgICBzZXRDb25maXJtYXRpb24oewogICAgICAgICAgLi4uYm9keSwKCiAgICAgICAgICBjb25maXJtZWQ6CiAgICAgICAgICAgIGZhbHNlLAoKICAgICAgICAgIHZhbGlkOgogICAgICAgICAgICBmYWxzZSwKCiAgICAgICAgICByZWNvbmZpcm1hdGlvblJlcXVpcmVkOgogICAgICAgICAgICByZXNwb25zZS5zdGF0dXMgPT09CiAgICAgICAgICAgIDQwOSwKICAgICAgICB9KTsKCiAgICAgICAgdGhyb3cgbmV3IEVycm9yKAogICAgICAgICAgYm9keS5lcnJvciB8fAogICAgICAgICAgICAiTGUgcGxhbiBkb2l0IMOqdHJlIHJldsOpcmlmacOpLiIKICAgICAgICApOwogICAgICB9CgogICAgICBzZXRDb25maXJtYXRpb24oCiAgICAgICAgYm9keQogICAgICApOwogICAgfQogICAgY2F0Y2ggKAogICAgICBlcnJvcgogICAgKSB7CiAgICAgIHNldEVycm9yTWVzc2FnZSgKICAgICAgICBlcnJvciBpbnN0YW5jZW9mIEVycm9yCiAgICAgICAgICA/IGVycm9yLm1lc3NhZ2UKICAgICAgICAgIDogIkNvbmZpcm1hdGlvbiBpbXBvc3NpYmxlLiIKICAgICAgKTsKICAgIH0KICAgIGZpbmFsbHkgewogICAgICBzZXRDb25maXJtaW5nKAogICAgICAgIGZhbHNlCiAgICAgICk7CiAgICB9CiAgfQoKICBpZiAoCiAgICBsb2FkaW5nCiAgKSB7CiAgICByZXR1cm4gKAogICAgICA8c2VjdGlvbiBjbGFzc05hbWU9ImtseXgtY2FyZCBtdC03IGZsZXggaXRlbXMtY2VudGVyIGdhcC0zIHAtNiI+CiAgICAgICAgPExvYWRlckNpcmNsZQogICAgICAgICAgY2xhc3NOYW1lPSJhbmltYXRlLXNwaW4gdGV4dC12aW9sZXQtNjAwIgogICAgICAgICAgc2l6ZT17MjB9CiAgICAgICAgLz4KCiAgICAgICAgPHAgY2xhc3NOYW1lPSJ0ZXh0LXNtIHRleHQtbXV0ZWQtZm9yZWdyb3VuZCI+CiAgICAgICAgICBLTFlYIHbDqXJpZmllIGxhIGNvbmZpcm1hdGlvbiBkZSBjZSBwbGFuLgogICAgICAgIDwvcD4KICAgICAgPC9zZWN0aW9uPgogICAgKTsKICB9CgogIGlmICgKICAgIGNvbmZpcm1hdGlvbj8uY29uZmlybWVkID09PQogICAgICB0cnVlICYmCiAgICBjb25maXJtYXRpb24udmFsaWQgPT09CiAgICAgIHRydWUKICApIHsKICAgIHJldHVybiAoCiAgICAgIDxzZWN0aW9uIGNsYXNzTmFtZT0ibXQtNyByb3VuZGVkLVsycmVtXSBib3JkZXIgYm9yZGVyLWVtZXJhbGQtNTAwLzI1IGJnLWVtZXJhbGQtNTAwLzEwIHAtNiBzbTpwLTgiPgogICAgICAgIDxkaXYgY2xhc3NOYW1lPSJmbGV4IGl0ZW1zLXN0YXJ0IGdhcC00Ij4KICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSJncmlkIGgtMTIgdy0xMiBzaHJpbmstMCBwbGFjZS1pdGVtcy1jZW50ZXIgcm91bmRlZC0yeGwgYmctZW1lcmFsZC02MDAgdGV4dC13aGl0ZSI+CiAgICAgICAgICAgIDxDaGVja0NpcmNsZTIKICAgICAgICAgICAgICBzaXplPXsyNH0KICAgICAgICAgICAgLz4KICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSJmbGV4LTEiPgogICAgICAgICAgICA8cCBjbGFzc05hbWU9InRleHQteHMgZm9udC1ibGFjayB1cHBlcmNhc2UgdHJhY2tpbmctWzAuMThlbV0gdGV4dC1lbWVyYWxkLTcwMCBkYXJrOnRleHQtZW1lcmFsZC0zMDAiPgogICAgICAgICAgICAgIENvbmZpcm1hdGlvbiBzw6ljdXJpc8OpZQogICAgICAgICAgICA8L3A+CgogICAgICAgICAgICA8aDIgY2xhc3NOYW1lPSJtdC0yIHRleHQteGwgZm9udC1ibGFjayI+CiAgICAgICAgICAgICAgQ2UgcGxhbiBleGFjdCBlc3QgY29uZmlybcOpCiAgICAgICAgICAgIDwvaDI+CgogICAgICAgICAgICA8cCBjbGFzc05hbWU9Im10LTIgdGV4dC1zbSBsZWFkaW5nLTYgdGV4dC1tdXRlZC1mb3JlZ3JvdW5kIj4KICAgICAgICAgICAgICBMYSBwcmV1dmUgZXN0IGxpw6llIGF1eCBjcsOpbmVhdXggZXQgYXV4IHByZXN0YXRhaXJlcyBhY3R1ZWxsZW1lbnQgYWZmaWNow6lzLgogICAgICAgICAgICAgIFRvdXRlIG1vZGlmaWNhdGlvbiBkdSBwbGFuIGludmFsaWRlcmEgY2V0dGUgY29uZmlybWF0aW9uLgogICAgICAgICAgICA8L3A+CgogICAgICAgICAgICB7Y29uZmlybWF0aW9uLmNvbmZpcm1hdGlvbklkICYmICgKICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0ibXQtNSBpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgcm91bmRlZC14bCBib3JkZXIgYm9yZGVyLWVtZXJhbGQtNTAwLzIwIGJnLWJhY2tncm91bmQvNzAgcHgtNCBweS0yIHRleHQteHMgZm9udC1ibGFjayI+CiAgICAgICAgICAgICAgICA8RmluZ2VycHJpbnQKICAgICAgICAgICAgICAgICAgc2l6ZT17MTV9CiAgICAgICAgICAgICAgICAvPgoKICAgICAgICAgICAgICAgIFByZXV2ZXsiICJ9CiAgICAgICAgICAgICAgICB7Y29uZmlybWF0aW9uLmNvbmZpcm1hdGlvbklkLnNsaWNlKAogICAgICAgICAgICAgICAgICAwLAogICAgICAgICAgICAgICAgICA4CiAgICAgICAgICAgICAgICApfQogICAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICApfQoKICAgICAgICAgICAgPGJ1dHRvbgogICAgICAgICAgICAgIHR5cGU9ImJ1dHRvbiIKICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PgogICAgICAgICAgICAgICAgdm9pZCBjaGVjaygpCiAgICAgICAgICAgICAgfQogICAgICAgICAgICAgIGNsYXNzTmFtZT0ibWwtMyBtdC01IGlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiByb3VuZGVkLXhsIGJvcmRlciBib3JkZXItYm9yZGVyIGJnLWJhY2tncm91bmQgcHgtNCBweS0yIHRleHQteHMgZm9udC1ibGFjayIKICAgICAgICAgICAgPgogICAgICAgICAgICAgIDxSZWZyZXNoQ3cKICAgICAgICAgICAgICAgIHNpemU9ezE1fQogICAgICAgICAgICAgIC8+CgogICAgICAgICAgICAgIFJldsOpcmlmaWVyCiAgICAgICAgICAgIDwvYnV0dG9uPgoKICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9Im10LTUgZmxleCBpdGVtcy1zdGFydCBnYXAtMyByb3VuZGVkLTJ4bCBib3JkZXIgYm9yZGVyLWVtZXJhbGQtNTAwLzE1IGJnLWJhY2tncm91bmQvNzAgcC00Ij4KICAgICAgICAgICAgICA8U2hpZWxkQ2hlY2sKICAgICAgICAgICAgICAgIGNsYXNzTmFtZT0ibXQtMC41IHNocmluay0wIHRleHQtZW1lcmFsZC02MDAiCiAgICAgICAgICAgICAgICBzaXplPXsxOH0KICAgICAgICAgICAgICAvPgoKICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9InRleHQteHMgbGVhZGluZy01IHRleHQtbXV0ZWQtZm9yZWdyb3VuZCI+CiAgICAgICAgICAgICAgICBDZXR0ZSBjb25maXJtYXRpb24gbmUgY3LDqWUgYXVjdW5lIHLDqXNlcnZhdGlvbiBldCBuZSBkw6ljbGVuY2hlIGF1Y3VuIHBhaWVtZW50LgogICAgICAgICAgICAgIDwvcD4KICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICA8L2Rpdj4KICAgICAgICA8L2Rpdj4KICAgICAgPC9zZWN0aW9uPgogICAgKTsKICB9CgogIGNvbnN0IGNoYW5nZWQgPQogICAgY29uZmlybWF0aW9uPy5yZWNvbmZpcm1hdGlvblJlcXVpcmVkID09PQogICAgdHJ1ZTsKCiAgcmV0dXJuICgKICAgIDxzZWN0aW9uCiAgICAgIGNsYXNzTmFtZT17CiAgICAgICAgY2hhbmdlZAogICAgICAgICAgPyAibXQtNyByb3VuZGVkLVsycmVtXSBib3JkZXIgYm9yZGVyLWFtYmVyLTUwMC8yNSBiZy1hbWJlci01MDAvMTAgcC02IHNtOnAtOCIKICAgICAgICAgIDogIm10LTcgcm91bmRlZC1bMnJlbV0gYm9yZGVyIGJvcmRlci12aW9sZXQtNTAwLzI1IGJnLXZpb2xldC01MDAvMTAgcC02IHNtOnAtOCIKICAgICAgfQogICAgPgogICAgICA8ZGl2IGNsYXNzTmFtZT0iZmxleCBpdGVtcy1zdGFydCBnYXAtNCI+CiAgICAgICAge2NoYW5nZWQgPyAoCiAgICAgICAgICA8QWxlcnRUcmlhbmdsZQogICAgICAgICAgICBjbGFzc05hbWU9Im10LTAuNSBzaHJpbmstMCB0ZXh0LWFtYmVyLTYwMCIKICAgICAgICAgICAgc2l6ZT17MjR9CiAgICAgICAgICAvPgogICAgICAgICkgOiAoCiAgICAgICAgICA8RmluZ2VycHJpbnQKICAgICAgICAgICAgY2xhc3NOYW1lPSJtdC0wLjUgc2hyaW5rLTAgdGV4dC12aW9sZXQtNjAwIgogICAgICAgICAgICBzaXplPXsyNH0KICAgICAgICAgIC8+CiAgICAgICAgKX0KCiAgICAgICAgPGRpdiBjbGFzc05hbWU9ImZsZXgtMSI+CiAgICAgICAgICA8cCBjbGFzc05hbWU9InRleHQteHMgZm9udC1ibGFjayB1cHBlcmNhc2UgdHJhY2tpbmctWzAuMThlbV0gdGV4dC1tdXRlZC1mb3JlZ3JvdW5kIj4KICAgICAgICAgICAgQ29uZmlybWF0aW9uIGNsaWVudAogICAgICAgICAgPC9wPgoKICAgICAgICAgIDxoMiBjbGFzc05hbWU9Im10LTIgdGV4dC14bCBmb250LWJsYWNrIj4KICAgICAgICAgICAge2NoYW5nZWQKICAgICAgICAgICAgICA/ICJMZSBwbGFuIGEgY2hhbmfDqSIKICAgICAgICAgICAgICA6ICJDb25maXJtZXIgY2V0dGUgcsOpcGFydGl0aW9uIGV4YWN0ZSJ9CiAgICAgICAgICA8L2gyPgoKICAgICAgICAgIDxwIGNsYXNzTmFtZT0ibXQtMiB0ZXh0LXNtIGxlYWRpbmctNiB0ZXh0LW11dGVkLWZvcmVncm91bmQiPgogICAgICAgICAgICB7Y2hhbmdlZAogICAgICAgICAgICAgID8gIkwnYW5jaWVubmUgY29uZmlybWF0aW9uIG4nZXN0IHBsdXMgdmFsYWJsZS4gVsOpcmlmaWUgbGEgbm91dmVsbGUgcsOpcGFydGl0aW9uIHB1aXMgY29uZmlybWUtbGEuIgogICAgICAgICAgICAgIDogIktMWVggcmV2w6lyaWZpZSBsZXMgZGlzcG9uaWJpbGl0w6lzIGF1IG1vbWVudCBkdSBjbGljIGF2YW50IGQnZW5yZWdpc3RyZXIgbGEgcHJldXZlIGRlIGNlIHBsYW4uIn0KICAgICAgICAgIDwvcD4KCiAgICAgICAgICB7ZXJyb3JNZXNzYWdlICYmICgKICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9Im10LTQgcm91bmRlZC0yeGwgYm9yZGVyIGJvcmRlci1yb3NlLTUwMC8yMCBiZy1yb3NlLTUwMC8xMCBwLTQgdGV4dC1zbSB0ZXh0LXJvc2UtNzAwIGRhcms6dGV4dC1yb3NlLTMwMCI+CiAgICAgICAgICAgICAge2Vycm9yTWVzc2FnZX0KICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICApfQoKICAgICAgICAgIDxidXR0b24KICAgICAgICAgICAgdHlwZT0iYnV0dG9uIgogICAgICAgICAgICBkaXNhYmxlZD17CiAgICAgICAgICAgICAgY29uZmlybWluZwogICAgICAgICAgICB9CiAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+CiAgICAgICAgICAgICAgdm9pZCBjb25maXJtUGxhbigpCiAgICAgICAgICAgIH0KICAgICAgICAgICAgY2xhc3NOYW1lPSJtdC01IGlubGluZS1mbGV4IGgtMTIgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGdhcC0yIHJvdW5kZWQtMnhsIGJnLXZpb2xldC02MDAgcHgtNiB0ZXh0LXNtIGZvbnQtYmxhY2sgdGV4dC13aGl0ZSB0cmFuc2l0aW9uIGhvdmVyOmJnLXZpb2xldC01MDAgZGlzYWJsZWQ6Y3Vyc29yLXdhaXQgZGlzYWJsZWQ6b3BhY2l0eS01MCIKICAgICAgICAgID4KICAgICAgICAgICAge2NvbmZpcm1pbmcgPyAoCiAgICAgICAgICAgICAgPExvYWRlckNpcmNsZQogICAgICAgICAgICAgICAgY2xhc3NOYW1lPSJhbmltYXRlLXNwaW4iCiAgICAgICAgICAgICAgICBzaXplPXsxOH0KICAgICAgICAgICAgICAvPgogICAgICAgICAgICApIDogKAogICAgICAgICAgICAgIDxDaGVja0NpcmNsZTIKICAgICAgICAgICAgICAgIHNpemU9ezE4fQogICAgICAgICAgICAgIC8+CiAgICAgICAgICAgICl9CgogICAgICAgICAgICB7Y29uZmlybWluZwogICAgICAgICAgICAgID8gIlbDqXJpZmljYXRpb24uLi4iCiAgICAgICAgICAgICAgOiAiSmUgY29uZmlybWUgZXhhY3RlbWVudCBjZSBwbGFuIn0KICAgICAgICAgIDwvYnV0dG9uPgoKICAgICAgICAgIDxwIGNsYXNzTmFtZT0ibXQtNCB0ZXh0LXhzIGxlYWRpbmctNSB0ZXh0LW11dGVkLWZvcmVncm91bmQiPgogICAgICAgICAgICBMYSByw6lzZXJ2YXRpb24gcmVzdGVyYSB1bmUgYWN0aW9uIHPDqXBhcsOpZSBhcHLDqHMgY2V0dGUgY29uZmlybWF0aW9uLgogICAgICAgICAgPC9wPgogICAgICAgIDwvZGl2PgogICAgICA8L2Rpdj4KICAgIDwvc2VjdGlvbj4KICApOwp9"

$reviewPath =
    Join-Path $root "app\assistant\market\[id]\split-plan\page.tsx"

$componentPath =
    Join-Path $root "app\assistant\market\[id]\split-plan\SplitPlanConfirmation.tsx"

$confirmationRoute =
    Join-Path $root "app\api\market\requests\[id]\split-fallback\confirm\route.ts"

foreach (
    $required
    in @(
        $reviewPath,
        $confirmationRoute
    )
) {
    if (
        -not (
            Test-Path -LiteralPath $required
        )
    ) {
        throw "13.19e : prerequisite introuvable : $required"
    }
}

$review =
    [System.IO.File]::ReadAllText(
        $reviewPath
    )

$confirmation =
    [System.IO.File]::ReadAllText(
        $confirmationRoute
    )

if (
    -not $review.Contains(
        "KLYX_MULTI_PROVIDER_REVIEW_PAGE_13_17"
    )
) {
    throw "13.19e : page split-plan 13.17 introuvable."
}

if (
    -not $confirmation.Contains(
        "KLYX_SPLIT_PLAN_CONFIRMATION_API_13_18"
    )
) {
    throw "13.19e : API confirmation 13.18 introuvable."
}

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

Copy-Item `
    -LiteralPath $reviewPath `
    -Destination ($reviewPath + ".bak-13-19e-" + $timestamp) `
    -Force

if (
    Test-Path -LiteralPath $componentPath
) {
    Copy-Item `
        -LiteralPath $componentPath `
        -Destination ($componentPath + ".bak-13-19e-" + $timestamp) `
        -Force
}

# ============================================================
# RESTORE FULL COMPONENT
# ============================================================

[System.IO.File]::WriteAllText(
    $componentPath,
    $component,
    $utf8
)

# ============================================================
# RESTORE IMPORT
# ============================================================

$importLine =
    'import SplitPlanConfirmation from "./SplitPlanConfirmation";'

if (
    -not $review.Contains(
        $importLine
    )
) {
    $importMatch =
        [regex]::Match(
            $review,
            '(?m)^import\s'
        )

    if (
        -not $importMatch.Success
    ) {
        throw "13.19e : imports split-plan introuvables."
    }

    $review =
        $review.Insert(
            $importMatch.Index,
            $importLine +
            "`r`n"
        )
}

# ============================================================
# RESTORE JSX WIRING
# ============================================================

if (
    -not $review.Contains(
        "KLYX_SPLIT_PLAN_CONFIRMATION_WIRING_13_18"
    )
) {
    $textIndex =
        $review.IndexOf(
            "Aucun engagement pour le moment"
        )

    if (
        $textIndex -lt 0
    ) {
        $textIndex =
            $review.IndexOf(
                "Aucun engagement"
            )
    }

    if (
        $textIndex -lt 0
    ) {
        throw "13.19e : section securite 13.17 introuvable."
    }

    $sectionIndex =
        $review.LastIndexOf(
            "<section",
            $textIndex
        )

    if (
        $sectionIndex -lt 0
    ) {
        throw "13.19e : emplacement JSX confirmation introuvable."
    }

    $renderLines = @(
        '            {/* KLYX_SPLIT_PLAN_CONFIRMATION_WIRING_13_18 */}',
        '            <SplitPlanConfirmation',
        '              requestId={requestId}',
        '              plan={{',
        '                slots: data.slots ?? [],',
        '                assignments: data.assignments ?? [],',
        '              }}',
        '            />',
        ''
    )

    $render =
        (
            $renderLines -join
            "`r`n"
        ) +
        "`r`n"

    $review =
        $review.Insert(
            $sectionIndex,
            $render
        )
}

[System.IO.File]::WriteAllText(
    $reviewPath,
    $review,
    $utf8
)

# ============================================================
# FINAL CHECK
# ============================================================

$finalReview =
    [System.IO.File]::ReadAllText(
        $reviewPath
    )

$finalComponent =
    [System.IO.File]::ReadAllText(
        $componentPath
    )

if (
    -not $finalReview.Contains(
        "KLYX_SPLIT_PLAN_CONFIRMATION_WIRING_13_18"
    )
) {
    throw "13.19e : wiring 13.18 toujours absent."
}

if (
    -not $finalReview.Contains(
        "<SplitPlanConfirmation"
    )
) {
    throw "13.19e : composant non rendu."
}

if (
    -not $finalComponent.Contains(
        "KLYX_SPLIT_PLAN_CONFIRMATION_UI_COMPAT_13_19E"
    )
) {
    throw "13.19e : composant compatibility absent."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.19e REPARATION OK"
Write-Host "======================================"
Write-Host "UI confirmation 13.18 : RESTAUREE"
Write-Host "Marker wiring 13.18 : RESTAURE"
Write-Host "Bouton confirmation plan : ACTIF"
Write-Host "API confirmation : CONNECTEE"
Write-Host "Booking au clic confirmation : NON"
Write-Host "Paiement : NON"
Write-Host "Migration supplementaire : AUCUNE"
Write-Host "======================================"
Write-Host ""