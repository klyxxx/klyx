"use client";

import { useEffect, useState } from "react";

import KlyxImage, { type KlyxImageProps } from "./KlyxImage";

type KlyxThemeImageProps = Omit<KlyxImageProps, "src"> & {
  srcLight: KlyxImageProps["src"];
  srcDark?: KlyxImageProps["src"];
  fallbackLight?: KlyxImageProps["src"];
  fallbackDark?: KlyxImageProps["src"];
};

function resolveDocumentTheme(): "light" | "dark" {
  if (typeof document === "undefined") {
    return "light";
  }

  return document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
}

/**
 * Theme-aware KLYX image primitive.
 *
 * Aura uses the light asset and Noir uses the dark asset. The component watches
 * the same root `dark` class managed by ThemeProvider, so switching themes does
 * not require a reload and only one visual source is rendered at a time.
 */
export default function KlyxThemeImage({
  srcLight,
  srcDark,
  fallbackLight,
  fallbackDark,
  ...props
}: KlyxThemeImageProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setTheme(resolveDocumentTheme());

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const dark = theme === "dark";

  return (
    <KlyxImage
      {...props}
      src={dark ? srcDark ?? srcLight : srcLight}
      fallbackSrc={
        dark
          ? fallbackDark ?? fallbackLight
          : fallbackLight ?? fallbackDark
      }
      data-klyx-image-theme={dark ? "noir" : "aura"}
    />
  );
}
