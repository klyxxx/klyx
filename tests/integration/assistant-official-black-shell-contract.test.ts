import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("KLYX official assistant-first black shell", () => {
  it("keeps /assistant isolated, black and centered", () => {
    const page = read("app/assistant/page.tsx");
    const styles = read("app/assistant/assistant-shell.module.css");

    expect(page).toContain('import styles from "./assistant-shell.module.css"');
    expect(page).toContain("styles.shell");
    expect(styles).toContain("--klyx-assistant-black: #050505");
    expect(styles).toContain("--klyx-assistant-white: #f7f7f8");
    expect(styles).toContain("--klyx-assistant-blue: #2563eb");
    expect(styles).toContain('background: var(--klyx-assistant-black)');
    expect(styles).toContain('max-width: 54rem');
    expect(styles).toContain('[data-testid="assistant-composer"]');
    expect(styles).toContain("box-shadow: none !important");
  });

  it("keeps the validated assistant-first content and at most three suggestions", () => {
    const thread = read("app/components/assistant/AssistantThread.tsx");
    const suggestions = read("app/components/assistant/SuggestionGroup.tsx");

    expect(thread).toContain('translateKlyxAssistantHome(locale, "organizeTitle")');
    expect(suggestions).toContain("suggestions.slice(0, 3)");
    expect(thread).not.toContain("dashboard");
    expect(thread).not.toContain("marketplace");
  });

  it("keeps photo, voice and send as the composer entry points", () => {
    const composer = read("app/components/assistant/AssistantComposer.tsx");

    expect(composer).toContain("Camera");
    expect(composer).toContain("Mic");
    expect(composer).toContain("ArrowUp");
    expect(composer).toContain('aria-label="Photo"');
    expect(composer).toContain('type="submit"');
    expect(composer).toContain('data-testid="assistant-composer"');
  });
});
