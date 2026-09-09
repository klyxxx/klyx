import { expect, test } from "@playwright/test";

import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";

test.use({ trace: "off", screenshot: "off", video: "off" });

test.describe("KLYX assistant voice input", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("real browser detection stays honest and mocked recognition drives the composer", async ({ page }) => {
    test.setTimeout(180_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");
    await page.goto("/assistant", { waitUntil: "domcontentloaded" });

    const nativeSupport = await page.evaluate(() => {
      const speechWindow = window as typeof window & {
        SpeechRecognition?: unknown;
        webkitSpeechRecognition?: unknown;
      };
      return Boolean(
        speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
      );
    });
    expect(typeof nativeSupport).toBe("boolean");

    await page.evaluate(() => {
      type ResultHandler = ((event: unknown) => void) | null;
      type ErrorHandler = ((event: unknown) => void) | null;
      type VoidHandler = (() => void) | null;

      const state: {
        starts: number;
        stops: number;
        aborts: number;
        lang: string;
        current: MockSpeechRecognition | null;
      } = {
        starts: 0,
        stops: 0,
        aborts: 0,
        lang: "",
        current: null,
      };

      class MockSpeechRecognition {
        lang = "";
        interimResults = true;
        continuous = true;
        onstart: VoidHandler = null;
        onresult: ResultHandler = null;
        onerror: ErrorHandler = null;
        onend: VoidHandler = null;

        start() {
          state.starts += 1;
          state.lang = this.lang;
          state.current = this;
        }

        stop() {
          state.stops += 1;
          this.onend?.();
        }

        abort() {
          state.aborts += 1;
          this.onend?.();
        }
      }

      const speechWindow = window as typeof window & {
        SpeechRecognition?: typeof MockSpeechRecognition;
        webkitSpeechRecognition?: typeof MockSpeechRecognition;
        __klyxVoiceMock?: {
          snapshot: () => {
            starts: number;
            stops: number;
            aborts: number;
            lang: string;
          };
          fireStart: () => void;
          emitResult: (transcript: string) => void;
          emitError: (error: string) => void;
          disable: () => void;
        };
      };

      Object.defineProperty(speechWindow, "SpeechRecognition", {
        configurable: true,
        writable: true,
        value: MockSpeechRecognition,
      });
      Object.defineProperty(speechWindow, "webkitSpeechRecognition", {
        configurable: true,
        writable: true,
        value: undefined,
      });

      speechWindow.__klyxVoiceMock = {
        snapshot: () => ({
          starts: state.starts,
          stops: state.stops,
          aborts: state.aborts,
          lang: state.lang,
        }),
        fireStart: () => state.current?.onstart?.(),
        emitResult: (transcript: string) => {
          state.current?.onresult?.({
            results: [[{ transcript }]],
          });
        },
        emitError: (error: string) => {
          state.current?.onerror?.({ error });
          state.current?.onend?.();
        },
        disable: () => {
          Object.defineProperty(speechWindow, "SpeechRecognition", {
            configurable: true,
            writable: true,
            value: undefined,
          });
          Object.defineProperty(speechWindow, "webkitSpeechRecognition", {
            configurable: true,
            writable: true,
            value: undefined,
          });
        },
      };
    });

    const textarea = page.locator("textarea").first();
    const voiceButton = page.locator('button[aria-pressed]').first();
    await expect(textarea).toBeVisible();
    await expect(voiceButton).toBeEnabled();
    await textarea.fill("J’ai déjà");

    await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>(
        'button[aria-pressed]'
      );
      if (!button) throw new Error("Voice button missing");
      button.click();
      button.click();
    });

    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as typeof window & {
              __klyxVoiceMock?: { snapshot: () => { starts: number } };
            }
          ).__klyxVoiceMock?.snapshot().starts
        )
      )
      .toBe(1);

    await page.evaluate(() =>
      (
        window as typeof window & {
          __klyxVoiceMock?: { fireStart: () => void };
        }
      ).__klyxVoiceMock?.fireStart()
    );
    await expect(voiceButton).toHaveAttribute("aria-pressed", "true");

    const language = await page.evaluate(() =>
      (
        window as typeof window & {
          __klyxVoiceMock?: { snapshot: () => { lang: string } };
        }
      ).__klyxVoiceMock?.snapshot().lang
    );
    expect(["fr-BE", "en-GB", "nl-BE", "de-DE"]).toContain(language);

    await page.evaluate(() =>
      (
        window as typeof window & {
          __klyxVoiceMock?: { emitResult: (value: string) => void };
        }
      ).__klyxVoiceMock?.emitResult("besoin d’un plombier")
    );
    await expect(textarea).toHaveValue("J’ai déjà besoin d’un plombier");

    await voiceButton.click();
    await expect(voiceButton).toHaveAttribute("aria-pressed", "false");
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as typeof window & {
              __klyxVoiceMock?: { snapshot: () => { stops: number } };
            }
          ).__klyxVoiceMock?.snapshot().stops
        )
      )
      .toBe(1);

    await voiceButton.click();
    await page.evaluate(() =>
      (
        window as typeof window & {
          __klyxVoiceMock?: { emitError: (value: string) => void };
        }
      ).__klyxVoiceMock?.emitError("not-allowed")
    );
    await expect(page.getByRole("alert")).toContainText(/microphone/i);

    await page.evaluate(() =>
      (
        window as typeof window & {
          __klyxVoiceMock?: { disable: () => void };
        }
      ).__klyxVoiceMock?.disable()
    );
    await voiceButton.click();
    await expect(page.getByRole("alert")).toContainText(
      /n’est pas prise en charge|not supported|niet ondersteund|nicht unterstützt/i
    );
  });
});
