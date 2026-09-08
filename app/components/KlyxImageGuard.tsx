"use client";

import { useEffect } from "react";

const KLYX_FALLBACK_SRC = "/klyx-image-fallback.svg";

function isManagedImage(image: HTMLImageElement): boolean {
  return image.dataset.klyxManagedImage === "true";
}

function applyFallback(image: HTMLImageElement): void {
  if (
    isManagedImage(image) ||
    image.dataset.klyxFallbackApplied === "true" ||
    image.getAttribute("src") === KLYX_FALLBACK_SRC
  ) {
    return;
  }

  image.dataset.klyxFallbackApplied = "true";
  image.removeAttribute("srcset");
  image.removeAttribute("sizes");
  image.src = KLYX_FALLBACK_SRC;
}

function protectImage(image: HTMLImageElement): void {
  if (isManagedImage(image)) return;

  // Raw product/user <img> elements should not leak the current KLYX URL to
  // third-party image hosts. KlyxImage applies the same policy itself.
  if (!image.referrerPolicy) {
    image.referrerPolicy = "no-referrer";
  }

  // An image can fail before React hydrates. Detect that state immediately so
  // the browser's broken-image glyph never remains as the product UI.
  if (image.complete && image.naturalWidth === 0 && image.currentSrc) {
    applyFallback(image);
  }
}

export default function KlyxImageGuard() {
  useEffect(() => {
    const handleError = (event: Event) => {
      const target = event.target;

      if (target instanceof HTMLImageElement) {
        applyFallback(target);
      }
    };

    document.querySelectorAll("img").forEach(protectImage);

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;

          if (node instanceof HTMLImageElement) {
            protectImage(node);
          }

          node.querySelectorAll("img").forEach(protectImage);
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("error", handleError, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("error", handleError, true);
    };
  }, []);

  return null;
}
