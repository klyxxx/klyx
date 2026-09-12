from pathlib import Path
import re


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one occurrence, got {count}: {old!r}")
    path.write_text(text.replace(old, new, 1))


# Hidden/history presentation is secured by mission ownership, not by the
# historical account_type label.
activity = Path("app/api/bookings/activity-hidden/route.ts")
text = activity.read_text()
text, import_count = re.subn(r"\n  requireAccountType,", "", text, count=1)
if import_count != 1:
    raise SystemExit(f"activity-hidden import patch count={import_count}")
call_count = text.count('    requireAccountType(profile, "client");\n')
if call_count != 2:
    raise SystemExit(f"activity-hidden role call count={call_count}")
text = text.replace('    requireAccountType(profile, "client");\n', "")
activity.write_text(text)

split = Path("app/api/bookings/split-missions/route.ts")
text = split.read_text()
text, import_count = re.subn(r"\n  requireAccountType,", "", text, count=1)
if import_count != 1:
    raise SystemExit(f"split-missions import patch count={import_count}")
text, call_count = re.subn(
    r"\n\s*requireAccountType\(\s*profile,\s*\"client\"\s*\);\n",
    "\n",
    text,
    count=1,
)
if call_count != 1:
    raise SystemExit(f"split-missions role call patch count={call_count}")
split.write_text(text)

# One MissionRail history: always use the relationship-aware overview.
rail = Path("app/ui/MissionRail.tsx")
text = rail.read_text()
replace_guard = "      if (!accountType) {"
if text.count(replace_guard) != 1:
    raise SystemExit("MissionRail active-profile guard not found")
text = text.replace(replace_guard, "      if (!activeProfileId) {", 1)
provider_branch = re.compile(
    r"\n        if \(accountType === \"provider\"\) \{.*?\n          return;\n        \}\n\n(?=        const \[overviewResponse, hiddenResponse, splitResponse\])",
    re.S,
)
text, branch_count = provider_branch.subn("\n", text, count=1)
if branch_count != 1:
    raise SystemExit(f"MissionRail provider history branch count={branch_count}")
rail.write_text(text)

# The same central composer visibly communicates both directions.
thread = Path("app/components/assistant/AssistantThread.tsx")
text = thread.read_text()
suggestions = {
    '{ id: "move", label: "Organize a move", value: "I need to organize a move" },':
        '{ id: "earn", label: "Earn about €100 Saturday", value: "I am free Saturday and want to earn about €100 near me" },',
    '{ id: "move", label: "Een verhuizing organiseren", value: "Ik wil een verhuizing organiseren" },':
        '{ id: "earn", label: "Zaterdag ongeveer €100 verdienen", value: "Ik ben zaterdag vrij en wil ongeveer €100 in mijn buurt verdienen" },',
    '{ id: "move", label: "Einen Umzug organisieren", value: "Ich möchte einen Umzug organisieren" },':
        '{ id: "earn", label: "Samstag etwa 100 € verdienen", value: "Ich bin Samstag frei und möchte ungefähr 100 € in meiner Nähe verdienen" },',
    '{ id: "move", label: "Organiser un déménagement", value: "Je dois organiser un déménagement" },':
        '{ id: "earn", label: "Gagner environ 100 € samedi", value: "Je suis libre samedi, je veux gagner environ 100 € près de chez moi" },',
}
for old, new in suggestions.items():
    if text.count(old) != 1:
        raise SystemExit(f"AssistantThread suggestion missing: {old}")
    text = text.replace(old, new, 1)

payload_old = (
    "  readiness?: {\n"
    "    nextMissing?: string | null;\n"
    "    summary?: BrainSummary | null;\n"
    "  };\n"
    "};"
)
payload_new = (
    "  readiness?: {\n"
    "    nextMissing?: string | null;\n"
    "    summary?: BrainSummary | null;\n"
    "  };\n"
    "  action?: {\n"
    "    href?: string;\n"
    "    label?: string;\n"
    "  } | null;\n"
    "};"
)
if text.count(payload_old) != 1:
    raise SystemExit("AssistantThread BrainPayload shape not found")
text = text.replace(payload_old, payload_new, 1)

replace_once(
    thread,
    '  const [value, setValue] = useState("");',
    '  const [value, setValue] = useState(() => initialPromptFromLocation());',
)
# Reload because replace_once writes its own snapshot.
text = thread.read_text()

anchor = (
    "function initialConversationFromLocation() {\n"
    '  if (typeof window === "undefined") return null;\n'
    '  const value = new URLSearchParams(window.location.search).get("conversation")?.trim();\n'
    "  return value && UUID_PATTERN.test(value) ? value : null;\n"
    "}\n"
)
prompt_helper = anchor + (
    "\nfunction initialPromptFromLocation() {\n"
    '  if (typeof window === "undefined") return "";\n'
    '  return (\n'
    '    new URLSearchParams(window.location.search)\n'
    '      .get("prompt")\n'
    '      ?.trim()\n'
    '      .slice(0, KLYX_ASSISTANT_MESSAGE_MAX_LENGTH) ?? ""\n'
    '  );\n'
    "}\n"
)
if text.count(anchor) != 1:
    raise SystemExit("AssistantThread conversation helper not found")
text = text.replace(anchor, prompt_helper, 1)

stale_comment = "        // ClientRouteGuard owns access. This profile lookup only protects async\n"
if text.count(stale_comment) != 1:
    raise SystemExit("AssistantThread access comment not found")
text = text.replace(
    stale_comment,
    "        // The server assistant layout owns access. This lookup only protects async\n",
    1,
)

turn_pattern = re.compile(
    r"        if \(visibleReply\) \{\n          additions\.push\(\{\n            id: nextTurnId\(\"assistant\"\),\n            role: \"assistant\",\n            content: visibleReply,\n          \}\);\n        \}",
)
turn_replacement = '''        if (visibleReply) {
          const groundedAction: AssistantAction | undefined =
            nextPayload?.action?.href && nextPayload.action.label
              ? {
                  href: nextPayload.action.href,
                  label: nextPayload.action.label,
                }
              : undefined;

          additions.push({
            id: nextTurnId("assistant"),
            role: "assistant",
            content: visibleReply,
            variant: groundedAction ? "groundedAction" : undefined,
            action: groundedAction,
          });
        }'''
text, turn_count = turn_pattern.subn(turn_replacement, text, count=1)
if turn_count != 1:
    raise SystemExit(f"AssistantThread reply turn patch count={turn_count}")
thread.write_text(text)

# Product links converge on the canonical shell. Keep the legacy compatibility
# route and provider API paths untouched.
product_files = [
    Path("app/onboarding/OnboardingOverview.tsx"),
    Path("app/provider/jobs/page.tsx"),
    Path("app/components/KlyxRoutePrefetch.tsx"),
    Path("app/provider/page.tsx"),
    Path("app/components/ClientRouteGuard.tsx"),
    Path("lib/klyx-navigation.ts"),
    Path("app/ui/AppSidebar.tsx"),
]
for path in product_files:
    source = path.read_text()
    source = source.replace('"/provider/assistant?prompt="', '"/assistant?prompt="')
    source = source.replace('"/provider/assistant"', '"/assistant"')
    source = source.replace("'/provider/assistant?prompt='", "'/assistant?prompt='")
    source = source.replace("'/provider/assistant'", "'/assistant'")
    path.write_text(source)

# Invariants.
if "requireAccountType" in activity.read_text():
    raise SystemExit("activity-hidden still has role guard")
if "requireAccountType" in split.read_text():
    raise SystemExit("split-missions still has role guard")
if 'fetch("/api/provider/jobs"' in rail.read_text():
    raise SystemExit("MissionRail still branches to provider history")
if "/provider/assistant" in Path("lib/account-home.ts").read_text():
    raise SystemExit("account home still splits assistant routing")
