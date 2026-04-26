"use client";

import { useEffect, useRef, useState } from "react";
import { Radio, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveStreamPlayerProps {
  playbackUrl: string | null;
  startedAt: string | null;
  viewerCount: number;
  brandName?: string | null;
}

function formatElapsed(startedAt: string | null): string {
  if (!startedAt) return "00:00";
  const start = new Date(startedAt).getTime();
  const elapsed = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function LiveStreamPlayer({
  playbackUrl,
  startedAt,
  viewerCount,
  brandName,
}: LiveStreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState(formatElapsed(startedAt));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tick the elapsed timer every second.
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(formatElapsed(startedAt));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  // Attach HLS source. Native HLS on Safari, hls.js everywhere else.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackUrl) return;
    setError(null);
    setLoading(true);

    let destroy = () => {};

    const native =
      video.canPlayType("application/vnd.apple.mpegurl") !== "";
    if (native) {
      video.src = playbackUrl;
      const onLoaded = () => setLoading(false);
      const onError = () =>
        setError("Stream is starting up — give it a few seconds and refresh.");
      video.addEventListener("loadeddata", onLoaded);
      video.addEventListener("error", onError);
      destroy = () => {
        video.removeEventListener("loadeddata", onLoaded);
        video.removeEventListener("error", onError);
        video.removeAttribute("src");
        video.load();
      };
    } else {
      let cancelled = false;
      import("hls.js")
        .then((mod) => {
          if (cancelled) return;
          const Hls = mod.default;
          if (!Hls.isSupported()) {
            setError("Your browser doesn't support HLS playback.");
            return;
          }
          const hls = new Hls({
            lowLatencyMode: true,
            enableWorker: true,
          });
          hls.loadSource(playbackUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => setLoading(false));
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data?.fatal) {
              setError(
                "Stream is starting up — give it a few seconds and refresh."
              );
            }
          });
          destroy = () => hls.destroy();
        })
        .catch((err) => {
          if (cancelled) return;
          console.error("Failed to load hls.js", err);
          setError("Couldn't load the live player.");
        });
      destroy = () => {
        cancelled = true;
      };
    }

    return () => destroy();
  }, [playbackUrl]);

  if (!playbackUrl) {
    return null;
  }

  return (
    <div className="relative bg-black rounded-lg overflow-hidden shadow-xl border border-border/40 mb-3">
      {/* Live header strip */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between gap-3 px-3 py-2 bg-gradient-to-b from-black/70 to-transparent text-white">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider">
            <Radio className="h-3 w-3 animate-pulse" />
            Live
          </span>
          {brandName && (
            <span className="text-xs font-medium truncate">{brandName}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {viewerCount.toLocaleString()}
          </span>
          <span className="font-mono tabular-nums">{elapsed}</span>
        </div>
      </div>

      {/* Loading / error overlay */}
      {(loading || error) && (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center text-white text-sm",
            error ? "bg-black/80" : "bg-black/40"
          )}
        >
          {error ? (
            error
          ) : (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading stream…
            </span>
          )}
        </div>
      )}

      <video
        ref={videoRef}
        className="w-full aspect-video bg-black"
        controls
        playsInline
        autoPlay
        muted
      />
    </div>
  );
}
