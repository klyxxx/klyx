"use client";

import { useEffect, useState } from "react";
import Image, { type ImageProps } from "next/image";

export type KlyxImageProps = Omit<ImageProps, "quality" | "src"> & {
  src: ImageProps["src"];
  quality?: 75 | 85 | 92;
  fallbackSrc?: ImageProps["src"];
};

function shouldBypassNextOptimization(src: ImageProps["src"]): boolean {
  return (
    typeof src === "string" &&
    /^(?:https?:\/\/|blob:|data:)/i.test(src)
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
 * `fallbackSrc` provides a fail-soft visual replacement when the requested
 * image cannot load. Theme-specific assets belong in KlyxThemeImage.
 */
export default function KlyxImage({
  src,
  fallbackSrc,
  quality = 92,
  sizes = "(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 33vw",
  unoptimized,
  onError,
  ...props
}: KlyxImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<ImageProps["src"]>(src);
  const [fallbackUsed, setFallbackUsed] = useState(false);

  useEffect(() => {
    setResolvedSrc(src);
    setFallbackUsed(false);
  }, [src]);

  const handleError: NonNullable<ImageProps["onError"]> = (event) => {
    if (fallbackSrc && !fallbackUsed) {
      setFallbackUsed(true);
      setResolvedSrc(fallbackSrc);
    }

    onError?.(event);
  };

  return (
    <Image
      {...props}
      src={resolvedSrc}
      quality={quality}
      sizes={sizes}
      unoptimized={
        unoptimized ?? shouldBypassNextOptimization(resolvedSrc)
      }
      onError={handleError}
    />
  );
}
