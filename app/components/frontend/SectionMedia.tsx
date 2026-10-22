"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { storedFrameStyle } from "@/lib/image-position";

function embedSrc(url: string, autoplay: boolean): string | null {
  const flag = autoplay ? 1 : 0;
  const yt = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/i
  );
  if (yt?.[1]) {
    return `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=${flag}&mute=1&loop=1&playlist=${yt[1]}&playsinline=1`;
  }
  const vimeo = url.match(/vimeo\.com\/(\d+)/i);
  if (vimeo?.[1]) {
    return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=${flag}&muted=1&loop=1`;
  }
  return null;
}

/** File video with a play/pause control that appears over the picture. */
export function MediaVideo({
  src,
  poster,
  autoplay = false,
  className,
}: {
  src: string;
  poster?: string;
  autoplay?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [paused, setPaused] = useState(!autoplay);
  return (
    <div className={`fe-media-video${paused ? " is-paused" : ""}`}>
      <video
        ref={ref}
        className={className}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        autoPlay={autoplay}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
      />
      <button
        type="button"
        className="fe-media-video-toggle"
        aria-label={paused ? "Play video" : "Pause video"}
        onClick={(event) => {
          event.preventDefault();
          const video = ref.current;
          if (!video) return;
          if (video.paused) void video.play().catch(() => undefined);
          else video.pause();
        }}
      >
        {paused ? <Play size={20} aria-hidden /> : <Pause size={18} aria-hidden />}
      </button>
    </div>
  );
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
  autoplay = true,
  controls = false,
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
  /** File videos only; embeds follow their own provider. */
  autoplay?: boolean;
  /** Show a play/pause overlay (file videos only). */
  controls?: boolean;
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
    const embed = embedSrc(video, autoplay);
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
    if (controls) {
      return (
        <MediaVideo
          src={video}
          poster={poster || image || undefined}
          autoplay={autoplay}
          className={className}
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
        autoPlay={autoplay}
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
