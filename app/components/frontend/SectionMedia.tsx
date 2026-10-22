"use client";

import { useEffect, useState } from "react";
import { storedFrameStyle } from "@/lib/image-position";

function embedSrc(url: string): string | null {
  const yt = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/i
  );
  if (yt?.[1]) {
    return `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&mute=1&loop=1&playlist=${yt[1]}&playsinline=1`;
  }
  const vimeo = url.match(/vimeo\.com\/(\d+)/i);
  if (vimeo?.[1]) {
    return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&muted=1&loop=1&background=1`;
  }
  return null;
}

export function SectionMedia({
  kind,
  image,
  video,
  poster,
  alt,
  className,
  frameKey,
  framePos,
}: {
  /** Shared with the editor's Edit button (drag to move, scroll to zoom). */
  frameKey?: string;
  /** Stored position/zoom ("x y zoom"); empty = as designed. */
  framePos?: string;
  kind: string;
  image: string;
  video: string;
  poster: string;
  alt: string;
  className?: string;
}) {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const showVideo = kind === "video" && Boolean(video) && !reduce;
  if (showVideo) {
    const embed = embedSrc(video);
    if (embed) {
      return (
        <iframe
          className={className}
          src={embed}
          title={alt || "Video"}
          allow="autoplay; fullscreen; picture-in-picture"
          tabIndex={-1}
        />
      );
    }
    return (
      <video
        className={className}
        src={video}
        poster={poster || image || undefined}
        muted
        loop
        playsInline
        autoPlay
      />
    );
  }
  const still = (reduce && (poster || image)) || image || poster;
  if (!still) return null;
  return (
    // Uploaded files and https stills are not in the image optimizer allowlist.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} src={still} alt={alt} data-frame-key={frameKey} style={storedFrameStyle(framePos)} />
  );
}
