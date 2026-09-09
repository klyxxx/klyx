import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const commandBar = read("app/components/AssistantCommandBar.tsx");
const securityHeaders = read("lib/security-headers.ts");
const voiceBlock = commandBar.slice(
  commandBar.indexOf("function toggleVoice()"),
  commandBar.indexOf("\n  return (", commandBar.indexOf("function toggleVoice()"))
);

describe("KLYX assistant browser voice input", () => {
  it("keeps Web Speech progressive and never invents browser support", () => {
    expect(commandBar).toContain("SpeechRecognition");
    expect(commandBar).toContain("webkitSpeechRecognition");
    expect(commandBar).toContain("getSpeechRecognitionConstructor()");
    expect(commandBar).toContain("voiceSettings.unavailable");
    expect(commandBar).not.toContain("(!voiceSupported && !listening)");
  });

  it("uses a real recognition lifecycle and guards concurrent starts", () => {
    expect(commandBar).toContain('useRef<VoicePhase>("idle")');
    expect(voiceBlock).toContain('voicePhaseRef.current === "starting"');
    expect(voiceBlock).toContain('voicePhaseRef.current === "stopping"');
    expect(voiceBlock).toContain("recognition.onstart");
    expect(voiceBlock).toContain("recognition.onresult");
    expect(voiceBlock).toContain("recognition.onerror");
    expect(voiceBlock).toContain("recognition.onend");
    expect(voiceBlock).toContain("recognition.start()");
    expect(voiceBlock).toContain("recognition.stop()");
    expect(voiceBlock).not.toContain("setListening(true);\n      recognition.start()");
  });

  it("certifies secure context, microphone errors and real composer insertion", () => {
    expect(voiceBlock).toContain("window.isSecureContext");
    expect(voiceBlock).toContain('case "not-allowed"');
    expect(voiceBlock).toContain('case "service-not-allowed"');
    expect(voiceBlock).toContain('case "audio-capture"');
    expect(voiceBlock).toContain('case "no-speech"');
    expect(voiceBlock).toContain("setValue((current) =>");
    expect(voiceBlock).toContain("transcript");
    expect(voiceBlock).toContain("KLYX_ASSISTANT_MESSAGE_MAX_LENGTH");
    expect(voiceBlock).not.toContain("fetch(");
  });

  it("keeps the four published speech locales exact", () => {
    expect(commandBar).toContain('speechLocale: "fr-BE"');
    expect(commandBar).toContain('speechLocale: "en-GB"');
    expect(commandBar).toContain('speechLocale: "nl-BE"');
    expect(commandBar).toContain('speechLocale: "de-DE"');
  });

  it("keeps microphone permission delegated to KLYX itself without a transcription vendor", () => {
    expect(securityHeaders).toContain("microphone=(self");
    expect(securityHeaders).toContain("KLYX_SUMSUB_ORIGIN");
    expect(voiceBlock).not.toMatch(/openai|deepgram|assemblyai|googleapis|azure|whisper/i);
  });
});
