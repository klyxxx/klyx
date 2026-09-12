from pathlib import Path

path = Path("app/components/assistant/AssistantThread.tsx")
text = path.read_text()

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
    raise SystemExit("BrainPayload shape mismatch")
text = text.replace(payload_old, payload_new, 1)

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
        raise SystemExit(f"starter suggestion mismatch: {old}")
    text = text.replace(old, new, 1)

path.write_text(text)
