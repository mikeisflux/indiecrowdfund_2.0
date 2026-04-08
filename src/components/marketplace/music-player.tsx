"use client";

import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import Image from "next/image";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  Volume2,
  VolumeX,
  Volume1,
  Download,
  Music,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AudioVisualizer } from "./audio-visualizer";

// ─── Types ───────────────────────────────────────────────────────────

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  coverImage: string | null;
  audioUrl: string;
  duration?: number; // seconds
  price?: number;
  slug?: string;
}

interface PlayerState {
  currentTrack: MusicTrack | null;
  queue: MusicTrack[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: "off" | "all" | "one";
}

interface MusicPlayerContextValue extends PlayerState {
  playTrack: (track: MusicTrack, queue?: MusicTrack[]) => void;
  playQueue: (tracks: MusicTrack[], startIndex?: number) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  closePlayer: () => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error("useMusicPlayer must be used within MusicPlayerProvider");
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────

export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    queue: [],
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.7,
    isMuted: false,
    isShuffled: false,
    repeatMode: "off",
  });

  // Create audio element on mount
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.preload = "metadata";
    audioRef.current = audio;

    audio.addEventListener("timeupdate", () => {
      setState((s) => ({ ...s, currentTime: audio.currentTime }));
    });
    audio.addEventListener("loadedmetadata", () => {
      setState((s) => ({ ...s, duration: audio.duration }));
    });
    audio.addEventListener("ended", () => {
      handleTrackEnd();
    });

    return () => {
      audio.pause();
      audio.src = "";
      audioCtxRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (!audioCtxRef.current && audioRef.current) {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
    }
    if (audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume();
    }
  }, []);

  const handleTrackEnd = useCallback(() => {
    setState((prev) => {
      if (prev.repeatMode === "one") {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play();
        }
        return prev;
      }

      const currentIdx = prev.queue.findIndex((t) => t.id === prev.currentTrack?.id);
      let nextIdx = currentIdx + 1;

      if (prev.isShuffled) {
        nextIdx = Math.floor(Math.random() * prev.queue.length);
      }

      if (nextIdx >= prev.queue.length) {
        if (prev.repeatMode === "all") {
          nextIdx = 0;
        } else {
          return { ...prev, isPlaying: false };
        }
      }

      const next = prev.queue[nextIdx];
      if (next && audioRef.current) {
        audioRef.current.src = next.audioUrl;
        audioRef.current.play();
        return { ...prev, currentTrack: next, isPlaying: true, currentTime: 0 };
      }
      return { ...prev, isPlaying: false };
    });
  }, []);

  const playTrack = useCallback(
    (track: MusicTrack, queue?: MusicTrack[]) => {
      ensureAudioContext();
      if (audioRef.current) {
        audioRef.current.src = track.audioUrl;
        audioRef.current.volume = state.isMuted ? 0 : state.volume;
        audioRef.current.play();
        setState((s) => ({
          ...s,
          currentTrack: track,
          queue: queue || (s.queue.length > 0 ? s.queue : [track]),
          isPlaying: true,
          currentTime: 0,
        }));
      }
    },
    [ensureAudioContext, state.isMuted, state.volume]
  );

  const playQueue = useCallback(
    (tracks: MusicTrack[], startIndex = 0) => {
      if (tracks.length === 0) return;
      ensureAudioContext();
      const track = tracks[startIndex];
      if (audioRef.current && track) {
        audioRef.current.src = track.audioUrl;
        audioRef.current.volume = state.isMuted ? 0 : state.volume;
        audioRef.current.play();
        setState((s) => ({
          ...s,
          currentTrack: track,
          queue: tracks,
          isPlaying: true,
          currentTime: 0,
        }));
      }
    },
    [ensureAudioContext, state.isMuted, state.volume]
  );

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !state.currentTrack) return;
    ensureAudioContext();
    if (state.isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setState((s) => ({ ...s, isPlaying: !s.isPlaying }));
  }, [state.isPlaying, state.currentTrack, ensureAudioContext]);

  const nextTrack = useCallback(() => {
    const idx = state.queue.findIndex((t) => t.id === state.currentTrack?.id);
    let next: number;
    if (state.isShuffled) {
      next = Math.floor(Math.random() * state.queue.length);
    } else {
      next = idx + 1 >= state.queue.length ? 0 : idx + 1;
    }
    const track = state.queue[next];
    if (track) playTrack(track);
  }, [state.queue, state.currentTrack, state.isShuffled, playTrack]);

  const prevTrack = useCallback(() => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    const idx = state.queue.findIndex((t) => t.id === state.currentTrack?.id);
    const prev = idx - 1 < 0 ? state.queue.length - 1 : idx - 1;
    const track = state.queue[prev];
    if (track) playTrack(track);
  }, [state.queue, state.currentTrack, playTrack]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setState((s) => ({ ...s, currentTime: time }));
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    if (audioRef.current) {
      audioRef.current.volume = v;
    }
    setState((s) => ({ ...s, volume: v, isMuted: v === 0 }));
  }, []);

  const toggleMute = useCallback(() => {
    setState((s) => {
      const newMuted = !s.isMuted;
      if (audioRef.current) {
        audioRef.current.volume = newMuted ? 0 : s.volume;
      }
      return { ...s, isMuted: newMuted };
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setState((s) => ({ ...s, isShuffled: !s.isShuffled }));
  }, []);

  const cycleRepeat = useCallback(() => {
    setState((s) => ({
      ...s,
      repeatMode: s.repeatMode === "off" ? "all" : s.repeatMode === "all" ? "one" : "off",
    }));
  }, []);

  const closePlayer = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setState((s) => ({
      ...s,
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    }));
  }, []);

  return (
    <MusicPlayerContext.Provider
      value={{
        ...state,
        playTrack,
        playQueue,
        togglePlay,
        nextTrack,
        prevTrack,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        cycleRepeat,
        closePlayer,
      }}
    >
      {children}
      {state.currentTrack && (
        <MusicPlayerBar analyser={analyserRef.current} />
      )}
    </MusicPlayerContext.Provider>
  );
}

// ─── Player Bar UI ───────────────────────────────────────────────────

function formatTime(s: number) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function MusicPlayerBar({ analyser }: { analyser: AnalyserNode | null }) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffled,
    repeatMode,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    closePlayer,
  } = useMusicPlayer();

  const progressRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(pct * duration);
  };

  const handleProgressDrag = useCallback(
    (e: MouseEvent) => {
      if (!progressRef.current || !duration || !isDragging) return;
      const rect = progressRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seek(pct * duration);
    },
    [isDragging, duration, seek]
  );

  useEffect(() => {
    if (isDragging) {
      const up = () => setIsDragging(false);
      window.addEventListener("mousemove", handleProgressDrag);
      window.addEventListener("mouseup", up);
      return () => {
        window.removeEventListener("mousemove", handleProgressDrag);
        window.removeEventListener("mouseup", up);
      };
    }
  }, [isDragging, handleProgressDrag]);

  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl">
      {/* Progress bar — thin line at the very top */}
      <div
        ref={progressRef}
        className="absolute top-0 left-0 right-0 h-1 bg-muted cursor-pointer group"
        onClick={handleProgressClick}
        onMouseDown={() => setIsDragging(true)}
      >
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-[width] duration-100 relative"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="flex items-center h-[72px] px-4 gap-4">
        {/* Left — Track Info */}
        <div className="flex items-center gap-3 min-w-0 w-[280px] shrink-0">
          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
            {currentTrack.coverImage ? (
              <Image
                src={currentTrack.coverImage}
                alt={currentTrack.title}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/30 to-pink-500/30">
                <Music className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{currentTrack.title}</p>
            <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
          </div>
        </div>

        {/* Center — Controls */}
        <div className="flex-1 flex flex-col items-center justify-center gap-1 max-w-[600px] mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleShuffle}
              className={cn(
                "p-1.5 rounded-full transition-colors hover:bg-muted",
                isShuffled ? "text-purple-500" : "text-muted-foreground"
              )}
              title="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <button
              onClick={prevTrack}
              className="p-1.5 rounded-full text-foreground hover:bg-muted transition-colors"
              title="Previous"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button
              onClick={togglePlay}
              className="p-2.5 rounded-full bg-foreground text-background hover:scale-105 transition-transform"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>
            <button
              onClick={nextTrack}
              className="p-1.5 rounded-full text-foreground hover:bg-muted transition-colors"
              title="Next"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
            <button
              onClick={cycleRepeat}
              className={cn(
                "p-1.5 rounded-full transition-colors hover:bg-muted relative",
                repeatMode !== "off" ? "text-purple-500" : "text-muted-foreground"
              )}
              title={`Repeat: ${repeatMode}`}
            >
              <Repeat className="w-4 h-4" />
              {repeatMode === "one" && (
                <span className="absolute -top-0.5 -right-0.5 text-[8px] font-bold text-purple-500">1</span>
              )}
            </button>
          </div>
          <div className="flex items-center gap-2 w-full text-xs text-muted-foreground">
            <span className="w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
            <div
              ref={progressRef}
              className="flex-1 h-1 bg-muted rounded-full cursor-pointer group hidden sm:block"
              onClick={handleProgressClick}
              onMouseDown={() => setIsDragging(true)}
            >
              <div
                className="h-full bg-foreground/60 rounded-full relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <span className="w-10 tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right — Volume + Visualizer + Download */}
        <div className="flex items-center gap-3 w-[280px] shrink-0 justify-end">
          <AudioVisualizer
            analyser={analyser}
            isPlaying={isPlaying}
            width={100}
            height={32}
            barCount={24}
            className="hidden md:block"
          />

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleMute}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <VolumeIcon className="w-4 h-4" />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 h-1 accent-purple-500 cursor-pointer hidden sm:block"
            />
          </div>

          {currentTrack.price !== undefined && currentTrack.price > 0 && (
            <button
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 transition-opacity"
              title={`Buy for $${currentTrack.price.toFixed(2)}`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>${currentTrack.price.toFixed(2)}</span>
            </button>
          )}

          <button
            onClick={closePlayer}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Close player"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
