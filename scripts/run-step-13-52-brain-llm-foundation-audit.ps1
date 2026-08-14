$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$manifestPath =
    Join-Path `
        $root `
        "reports\brain-llm-foundation-audit-13-52.json"

$reportPath =
    Join-Path `
        $root `
        "reports\brain-llm-foundation-audit-13-52.txt"

# ============================================================
# SEARCH SCOPE
# ============================================================

$roots =
    @(
        "app",
        "lib",
        "components"
    )

$extensions =
    @(
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".mts",
        ".cts"
    )

$files =
    @()

foreach (
    $relativeRoot
    in $roots
) {
    $path =
        Join-Path `
            $root `
            $relativeRoot

    if (
        -not (
            Test-Path `
                -LiteralPath `
                $path
        )
    ) {
        continue
    }

    $files +=
        @(
            Get-ChildItem `
                -LiteralPath `
                $path `
                -File `
                -Recurse `
                -Force |
            Where-Object {
                $_.Extension.ToLowerInvariant() -in
                $extensions
            }
        )
}

# ============================================================
# PATTERNS
# ============================================================

$brainPatterns =
    @(
        'brain',
        'assistant',
        'recommend',
        'memory',
        'market',
        'confirm-request',
        'market-publish',
        'respond'
    )

$llmPatterns =
    @(
        'openai',
        'anthropic',
        'gemini',
        'groq',
        'mistral',
        'chat\.completions',
        'responses\.create',
        'generateText',
        'streamText',
        'ai-sdk',
        'llm',
        'model:'
    )

$rulePatterns =
    @(
        '\bif\s*\(',
        '\bswitch\s*\(',
        '\bcase\s+',
        '\bincludes\s*\(',
        '\bstartsWith\s*\(',
        '\bmatch\s*\(',
        '\bRegExp\b',
        '\bregex\b'
    )

$confirmationPatterns =
    @(
        'confirm',
        'confirmed',
        'confirmation',
        'automaticExecutionAllowed',
        'explicit',
        'payment',
        'checkout',
        'publish'
    )

$memoryPatterns =
    @(
        'memory',
        'preferences',
        'memory-context',
        'profile'
    )

# ============================================================
# ANALYZE FILES
# ============================================================

$results =
    @()

foreach (
    $file
    in $files
) {
    $text =
        $null

    try {
        $text =
            [System.IO.File]::ReadAllText(
                $file.FullName
            )
    }
    catch {
        continue
    }

    $relative =
        $file.FullName.Substring(
            $root.Length + 1
        )

    $lower =
        $text.ToLowerInvariant()

    $brainHits =
        @()

    foreach (
        $pattern
        in $brainPatterns
    ) {
        if (
            $lower.Contains(
                $pattern.ToLowerInvariant()
            )
        ) {
            $brainHits +=
                $pattern
        }
    }

    if (
        $brainHits.Count -eq 0
    ) {
        continue
    }

    $llmHits =
        @()

    foreach (
        $pattern
        in $llmPatterns
    ) {
        if (
            [regex]::IsMatch(
                $text,
                $pattern,
                [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
            )
        ) {
            $llmHits +=
                $pattern
        }
    }

    $ruleHits =
        0

    foreach (
        $pattern
        in $rulePatterns
    ) {
        $ruleHits +=
            [regex]::Matches(
                $text,
                $pattern,
                [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
            ).Count
    }

    $confirmationHits =
        @()

    foreach (
        $pattern
        in $confirmationPatterns
    ) {
        if (
            $lower.Contains(
                $pattern.ToLowerInvariant()
            )
        ) {
            $confirmationHits +=
                $pattern
        }
    }

    $memoryHits =
        @()

    foreach (
        $pattern
        in $memoryPatterns
    ) {
        if (
            $lower.Contains(
                $pattern.ToLowerInvariant()
            )
        ) {
            $memoryHits +=
                $pattern
        }
    }

    $results +=
        [pscustomobject]@{
            RelativePath =
                $relative

            BrainSignals =
                @(
                    $brainHits |
                    Sort-Object -Unique
                )

            LlmSignals =
                @(
                    $llmHits |
                    Sort-Object -Unique
                )

            RuleSignalCount =
                $ruleHits

            ConfirmationSignals =
                @(
                    $confirmationHits |
                    Sort-Object -Unique
                )

            MemorySignals =
                @(
                    $memoryHits |
                    Sort-Object -Unique
                )

            Length =
                $file.Length

            Sha256 =
                (
                    Get-FileHash `
                        -LiteralPath `
                        $file.FullName `
                        -Algorithm SHA256
                ).Hash.ToLowerInvariant()
        }
}

# ============================================================
# ROUTES
# ============================================================

$brainRoutes =
    @(
        $results |
        Where-Object {
            $_.RelativePath -match
            '^app\\api\\brain\\'
        }
    )

$assistantRoutes =
    @(
        $results |
        Where-Object {
            $_.RelativePath -match
            '^app\\api\\ai\\|^app\\assistant\\|^app\\brain\\'
        }
    )

$llmFiles =
    @(
        $results |
        Where-Object {
            @(
                $_.LlmSignals
            ).Count -gt 0
        }
    )

$ruleHeavyFiles =
    @(
        $results |
        Where-Object {
            [int]$_.RuleSignalCount -ge 5
        } |
        Sort-Object `
            -Property RuleSignalCount `
            -Descending
    )

$confirmationFiles =
    @(
        $results |
        Where-Object {
            @(
                $_.ConfirmationSignals
            ).Count -gt 0
        }
    )

$memoryFiles =
    @(
        $results |
        Where-Object {
            @(
                $_.MemorySignals
            ).Count -gt 0
        }
    )

$trueLlmAlreadyPresent =
    (
        $llmFiles.Count -gt 0
    )

# ============================================================
# MANIFEST
# ============================================================

$result =
    [pscustomobject]@{
        Step =
            "13.52"

        GeneratedAt =
            (
                Get-Date
            ).ToString(
                "o"
            )

        BrainRelatedFileCount =
            $results.Count

        BrainApiRouteCount =
            $brainRoutes.Count

        AssistantRelatedRouteCount =
            $assistantRoutes.Count

        LlmSignalFileCount =
            $llmFiles.Count

        TrueLlmAlreadyPresent =
            $trueLlmAlreadyPresent

        RuleHeavyFileCount =
            $ruleHeavyFiles.Count

        ConfirmationGuardFileCount =
            $confirmationFiles.Count

        MemoryRelatedFileCount =
            $memoryFiles.Count

        BrainFiles =
            $results

        BrainApiRoutes =
            @(
                $brainRoutes |
                ForEach-Object {
                    $_.RelativePath
                }
            )

        AssistantRoutes =
            @(
                $assistantRoutes |
                ForEach-Object {
                    $_.RelativePath
                }
            )

        LlmSignalFiles =
            @(
                $llmFiles |
                ForEach-Object {
                    $_.RelativePath
                }
            )

        RuleHeavyFiles =
            @(
                $ruleHeavyFiles |
                Select-Object `
                    RelativePath,
                    RuleSignalCount
            )

        ConfirmationGuardFiles =
            @(
                $confirmationFiles |
                ForEach-Object {
                    $_.RelativePath
                }
            )

        MemoryRelatedFiles =
            @(
                $memoryFiles |
                ForEach-Object {
                    $_.RelativePath
                }
            )

        SourceFilesModified =
            0

        RoutesModified =
            0

        DatabaseModified =
            $false

        ProductionModified =
            $false

        AuditOnly =
            $true

        AuditComplete =
            $true
    }

[System.IO.File]::WriteAllText(
    $manifestPath,
    (
        $result |
        ConvertTo-Json -Depth 100
    ),
    $utf8
)

# ============================================================
# TEXT REPORT
# ============================================================

$report =
    New-Object System.Collections.Generic.List[string]

$report.Add(
    "======================================"
)

$report.Add(
    "KLYX 13.52 - BRAIN LLM FOUNDATION AUDIT"
)

$report.Add(
    "======================================"
)

$report.Add(
    ""
)

$report.Add(
    "Brain-related files : " +
    $results.Count
)

$report.Add(
    "Brain API routes : " +
    $brainRoutes.Count
)

$report.Add(
    "Assistant-related routes : " +
    $assistantRoutes.Count
)

$report.Add(
    "Files with LLM signals : " +
    $llmFiles.Count
)

$report.Add(
    "True LLM already present : " +
    $trueLlmAlreadyPresent
)

$report.Add(
    "Rule-heavy files : " +
    $ruleHeavyFiles.Count
)

$report.Add(
    "Confirmation guard files : " +
    $confirmationFiles.Count
)

$report.Add(
    "Memory-related files : " +
    $memoryFiles.Count
)

$report.Add(
    ""
)

if (
    $brainRoutes.Count -gt 0
) {
    $report.Add(
        "BRAIN API ROUTES:"
    )

    foreach (
        $item
        in $brainRoutes
    ) {
        $report.Add(
            "  " +
            $item.RelativePath
        )
    }

    $report.Add(
        ""
    )
}

if (
    $llmFiles.Count -gt 0
) {
    $report.Add(
        "LLM SIGNAL FILES:"
    )

    foreach (
        $item
        in $llmFiles
    ) {
        $report.Add(
            "  " +
            $item.RelativePath
        )
    }

    $report.Add(
        ""
    )
}

if (
    $ruleHeavyFiles.Count -gt 0
) {
    $report.Add(
        "RULE-HEAVY FILES:"
    )

    foreach (
        $item
        in $ruleHeavyFiles
    ) {
        $report.Add(
            (
                "  " +
                $item.RelativePath +
                " | signals=" +
                $item.RuleSignalCount
            )
        )
    }

    $report.Add(
        ""
    )
}

$report.Add(
    "Source files modified : 0"
)

$report.Add(
    "Routes modified : 0"
)

$report.Add(
    "Database modified : NON"
)

$report.Add(
    "Production modified : NON"
)

$report.Add(
    "Audit only : OUI"
)

$report.Add(
    ""
)

$report.Add(
    "======================================"
)

[System.IO.File]::WriteAllLines(
    $reportPath,
    $report,
    $utf8
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.52 BRAIN AUDIT OK"
Write-Host "======================================"
Write-Host (
    "Brain-related files : " +
    $results.Count
)
Write-Host (
    "Brain API routes : " +
    $brainRoutes.Count
)
Write-Host (
    "LLM signal files : " +
    $llmFiles.Count
)
Write-Host (
    "Rule-heavy files : " +
    $ruleHeavyFiles.Count
)
Write-Host (
    "Confirmation guard files : " +
    $confirmationFiles.Count
)
Write-Host (
    "Memory-related files : " +
    $memoryFiles.Count
)
Write-Host "Source files modified : 0"
Write-Host "Production modified : NON"
Write-Host "======================================"