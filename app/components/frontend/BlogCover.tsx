import Image from "next/image";
import { isOptimizableBlogCover } from "@/lib/blog-post-input";

/**
 * Blog cover: next/image for configured hosts, a plain <img> for any other
 * https URL an editor or the MCP agent supplied.
 *
 * `fill` positioning is written inline for the fallback so both branches sit
 * in the same absolutely positioned frame.
 */
export function BlogCover({
  src,
  alt = "",
  sizes,
  priority = false,
  className,
}: {
  src: string;
  alt?: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (isOptimizableBlogCover(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={className}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />
  );
}
