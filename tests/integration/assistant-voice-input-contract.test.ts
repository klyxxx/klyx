import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const commandBar = read("app/components/AssistantCommandBar.tsx");
const composer = read("app/components/assistant/AssistantComposer.tsx");
const securityHeaders = read("lib/security-headers.ts");
const voiceBlock = composer.slice(
  composer.indexOf("function toggleVoice()"),
  composer.indexOf("\n  return (", composer.indexOf("function toggleVoice()"))
);

describe("KLYX assistant browser voice input", () => {
  it("keeps the Phase B wrapper intact and owns voice in AssistantComposer", () => {
    expect(commandBar).toContain(
      'import AssistantThread from "@/app/components/assistant/AssistantThread"'
    );
    expect(commandBar).toContain("return <AssistantThread />");
    expect(commandBar).not.toContain("SpeechRecognition");
    expect(composer).toContain("SpeechRecognition");
    expect(composer).toContain("webkitSpeechRecognition");
    expect(composer).toContain("speechRecognitionConstructor()");
    expect(composer).toContain("voice.unavailable");
  });

  it("uses a real recognition lifecycle and guards concurrent starts", () => {
    expect(composer).toContain('useRef<VoicePhase>("idle")');
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
    expect(voiceBlock).toContain("onChange(nextValue.slice");
    expect(voiceBlock).toContain("transcript");
    expect(voiceBlock).toContain("KLYX_ASSISTANT_MESSAGE_MAX_LENGTH");
    expect(voiceBlock).not.toContain("fetch(");
  });

  it("routes voice UI copy through the static Tolgee bridge", () => {
    expect(composer).toContain("translateKlyxTolgeeRuntimeUi");
    for (const key of [
      "assistant.voice.label",
      "assistant.voice.stop",
      "assistant.voice.unavailable",
      "assistant.voice.failed",
      "assistant.voice.permissionDenied",
      "assistant.voice.noMicrophone",
      "assistant.voice.noSpeech",
      "assistant.voice.secureContextRequired",
    ]) {
      expect(composer).toContain(`\"${key}\"`);
    }

    expect(composer).not.toContain(
      'unavailable: "Voice input is not supported by this browser."'
    );
    expect(composer).not.toContain(
      'unavailable: "La saisie vocale n’est pas prise en charge par ce navigateur."'
    );
  });

  it("keeps the four published speech locales exact and future-proofs registered locales", () => {
    expect(composer).toContain('fr: "fr-BE"');
    expect(composer).toContain('en: "en-GB"');
    expect(composer).toContain('nl: "nl-BE"');
    expect(composer).toContain('de: "de-DE"');
    expect(composer).toContain("getKlyxLocaleMetadata(locale).htmlLang");
    expect(composer).toContain("speechLocaleForKlyxLocale(locale)");
  });

  it("keeps unsupported browsers explicit instead of simulating voice support", () => {
    expect(voiceBlock).toContain("if (!Recognition)");
    expect(voiceBlock).toContain("setVoiceSupported(false)");
    expect(voiceBlock).toContain("onError(voice.unavailable)");
    expect(composer).not.toContain("SpeechRecognition =");
    expect(composer).not.toContain("webkitSpeechRecognition =");
  });

  it("keeps microphone permission delegated to KLYX itself without a transcription vendor", () => {
    expect(securityHeaders).toContain("microphone=(self");
    expect(securityHeaders).toContain("KLYX_SUMSUB_ORIGIN");
    expect(voiceBlock).not.toMatch(/openai|deepgram|assemblyai|googleapis|azure|whisper/i);
  });
});
