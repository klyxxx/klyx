"use client";

import { useEffect, useState } from "react";
import Image, { type ImageProps } from "next/image";

export type KlyxImageProps = Omit<ImageProps, "quality" | "src"> & {
  src: ImageProps["src"];
  quality?: 75 | 85 | 92;
  fallbackSrc?: ImageProps["src"];
};

const DEFAULT_FALLBACK_SRC = "/klyx-image-fallback.svg";

function shouldBypassNextOptimization(src: ImageProps["src"]): boolean {
  return (
    typeof src === "string" &&
    (/^(?:https?:\/\/|blob:|data:)/i.test(src) || src.endsWith(".svg"))
  );
}

/**
 * KLYX media primitive.
 *
 * New product imagery should use this component instead of creating local
 * image defaults. It keeps premium quality for local assets and deliberately
 * bypasses the Next.js image optimizer for dynamic external/blob/data URLs so
 * user/provider imagery can render reliably without widening remote hosts.
 *
 * Every image fails soft to the neutral KLYX fallback unless a dedicated
 * fallbackSrc is supplied. External images never receive the KLYX page URL as
 * a referrer. Theme-specific assets belong in KlyxThemeImage.
 */
export default function KlyxImage({
  src,
  fallbackSrc,
  quality = 92,
  sizes = "(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 33vw",
  unoptimized,
  onError,
  referrerPolicy,
  ...props
}: KlyxImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<ImageProps["src"]>(src);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const effectiveFallbackSrc = fallbackSrc ?? DEFAULT_FALLBACK_SRC;

  useEffect(() => {
    setResolvedSrc(src);
    setFallbackUsed(false);
  }, [src]);

  const handleError: NonNullable<ImageProps["onError"]> = (event) => {
    if (!fallbackUsed && resolvedSrc !== effectiveFallbackSrc) {
      setFallbackUsed(true);
      setResolvedSrc(effectiveFallbackSrc);
    }

    onError?.(event);
  };

  return (
    <Image
      {...props}
      data-klyx-managed-image="true"
      src={resolvedSrc}
      quality={quality}
      sizes={sizes}
      referrerPolicy={referrerPolicy ?? "no-referrer"}
      unoptimized={
        unoptimized ?? shouldBypassNextOptimization(resolvedSrc)
      }
      onError={handleError}
    />
  );
}
