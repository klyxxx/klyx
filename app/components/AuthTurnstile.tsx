"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

const TURNSTILE_SCRIPT_ID = "klyx-turnstile-script";
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const AUTH_TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

export const AUTH_TURNSTILE_ENABLED =
  AUTH_TURNSTILE_SITE_KEY.length > 0;

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "dark";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type AuthTurnstileHandle = {
  reset: () => void;
};

type AuthTurnstileProps = {
  action:
    | "login"
    | "signup"
    | "password-reset";
  onTokenChange: (token: string) => void;
};

const AuthTurnstile = forwardRef<
  AuthTurnstileHandle,
  AuthTurnstileProps
>(function AuthTurnstile(
  {
    action,
    onTokenChange,
  },
  ref
) {
  const containerRef =
    useRef<HTMLDivElement | null>(null);
  const widgetIdRef =
    useRef<string | null>(null);
  const callbackRef =
    useRef(onTokenChange);

  useEffect(() => {
    callbackRef.current = onTokenChange;
  }, [onTokenChange]);

  useImperativeHandle(
    ref,
    () => ({
      reset() {
        callbackRef.current("");

        if (
          widgetIdRef.current &&
          window.turnstile
        ) {
          window.turnstile.reset(
            widgetIdRef.current
          );
        }
      },
    }),
    []
  );

  useEffect(() => {
    if (!AUTH_TURNSTILE_ENABLED) {
      return;
    }

    let cancelled = false;
    let script:
      | HTMLScriptElement
      | null = null;

    const renderWidget = () => {
      if (
        cancelled ||
        widgetIdRef.current ||
        !containerRef.current ||
        !window.turnstile
      ) {
        return;
      }

      widgetIdRef.current =
        window.turnstile.render(
          containerRef.current,
          {
            sitekey:
              AUTH_TURNSTILE_SITE_KEY,
            action,
            theme: "dark",
            callback(token) {
              callbackRef.current(token);
            },
            "expired-callback"() {
              callbackRef.current("");
            },
            "error-callback"() {
              callbackRef.current("");
            },
          }
        );
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      script = document.getElementById(
        TURNSTILE_SCRIPT_ID
      ) as HTMLScriptElement | null;

      if (!script) {
        script = document.createElement(
          "script"
        );
        script.id = TURNSTILE_SCRIPT_ID;
        script.src = TURNSTILE_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      script.addEventListener(
        "load",
        renderWidget
      );
    }

    return () => {
      cancelled = true;

      script?.removeEventListener(
        "load",
        renderWidget
      );

      if (
        widgetIdRef.current &&
        window.turnstile
      ) {
        window.turnstile.remove(
          widgetIdRef.current
        );
        widgetIdRef.current = null;
      }

      callbackRef.current("");
    };
  }, [action]);

  if (!AUTH_TURNSTILE_ENABLED) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3">
      <div
        ref={containerRef}
        className="min-h-[65px]"
        aria-label="Vérification anti-robot"
      />
    </div>
  );
});

export default AuthTurnstile;
