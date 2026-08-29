import Image, {
  type ImageProps,
} from "next/image";

export type KlyxImageProps =
  Omit<ImageProps, "quality"> & {
    quality?: 75 | 85 | 92;
  };

/**
 * KLYX media primitive.
 *
 * New product imagery should use this component instead of creating local
 * image defaults. 92 is intentionally high enough for premium UI while
 * preserving Next.js optimization and responsive delivery.
 */
export default function KlyxImage({
  quality = 92,
  sizes = "(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 33vw",
  ...props
}: KlyxImageProps) {
  return (
    <Image
      {...props}
      quality={quality}
      sizes={sizes}
    />
  );
}
