"use client";

import { useState } from "react";
import { Play } from "lucide-react";

type Playable = { kind: "file" | "embed"; src: string };

/** Đổi link người dùng dán thành nguồn phát được trong trang. */
export function playableVideo(raw: string): Playable | null {
  const text = raw.trim();
  if (!text || text.includes("/media/videos/")) return null;
  if (text.startsWith("blob:") || text.startsWith("data:video") || text.startsWith("data:application")) {
    return { kind: "file", src: text };
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id ? { kind: "embed", src: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` } : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const fromQuery = url.searchParams.get("v");
    const parts = url.pathname.split("/").filter(Boolean);
    const id = fromQuery || (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live" ? parts[1] : "");
    return id ? { kind: "embed", src: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).pop();
    return id ? { kind: "embed", src: `https://player.vimeo.com/video/${id}?autoplay=1` } : null;
  }
  if (host === "fb.watch" || host.endsWith("facebook.com")) {
    return {
      kind: "embed",
      src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(text)}&show_text=false&autoplay=true`,
    };
  }
  const tiktok = text.match(/video\/(\d+)/);
  if (host.endsWith("tiktok.com") && tiktok?.[1]) {
    return { kind: "embed", src: `https://www.tiktok.com/embed/v2/${tiktok[1]}` };
  }
  return { kind: "file", src: text };
}

export function LinkedVideo({
  src,
  className,
  label,
}: {
  src: string;
  className: string;
  label?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const media = playableVideo(src);

  if (!media) {
    return (
      <div className={`grid place-items-center bg-slate-900 px-2 text-center text-[11px] text-slate-300 ${className}`}>
        Chưa có link video để phát
      </div>
    );
  }

  if (!playing) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className={`relative grid place-items-center bg-slate-900 text-white ${className}`}
        aria-label="Phát video"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 shadow">
          <Play className="ml-0.5 h-4 w-4 fill-current" />
        </span>
        {label && (
          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium">
            {label}
          </span>
        )}
      </button>
    );
  }

  if (media.kind === "file") {
    return (
      <video
        src={media.src}
        className={`bg-black object-contain ${className}`}
        controls
        autoPlay
        playsInline
      />
    );
  }

  return (
    <iframe
      src={media.src}
      title={label || "Video nơi làm việc"}
      className={`bg-black ${className}`}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
    />
  );
}
