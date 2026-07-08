"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";

export interface LiveStreamCredentials {
  ingestUrl: string;
  streamKey: string;
}

export interface LiveStreamStatus {
  live: boolean;
  playbackUrl: string | null;
  startedAt: string | null;
  viewerCount: number;
  isOwner: boolean;
  initialized: boolean;
}

export interface UseLiveStreamOptions {
  roomId: string | null | undefined;
  /** Poll interval in ms. Default 10_000. Pass 0 to disable polling. */
  pollIntervalMs?: number;
}

export interface UseLiveStreamReturn {
  status: LiveStreamStatus;
  credentials: LiveStreamCredentials | null;
  isStarting: boolean;
  isStopping: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  refresh: () => Promise<void>;
  clearCredentials: () => void;
}

const INITIAL_STATUS: LiveStreamStatus = {
  live: false,
  playbackUrl: null,
  startedAt: null,
  viewerCount: 0,
  isOwner: false,
  initialized: false,
};

// Centralised state + actions for a chat room's live-stream lifecycle.
// Polls /stream/status, exposes start/stop, and surfaces the
// owner-only ingest credentials (returned by /start at provisioning
// time and again by /status after a page refresh).
export function useLiveStream({
  roomId,
  pollIntervalMs = 10_000,
}: UseLiveStreamOptions): UseLiveStreamReturn {
  const [status, setStatus] = useState<LiveStreamStatus>(INITIAL_STATUS);
  const [credentials, setCredentials] = useState<LiveStreamCredentials | null>(
    null
  );
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  const refresh = useCallback(async () => {
    const id = roomIdRef.current;
    if (!id) {
      setStatus(INITIAL_STATUS);
      return;
    }
    try {
      const res = await fetch(`/api/chat/rooms/${id}/stream/status`);
      if (!res.ok) return;
      const data = await res.json();
      setStatus({
        live: !!data.live,
        playbackUrl: data.playbackUrl ?? null,
        startedAt: data.startedAt ?? null,
        viewerCount: data.viewerCount ?? 0,
        isOwner: !!data.isOwner,
        initialized: true,
      });
      // Owner-only credential rehydration (status only returns these
      // when the caller is the room owner).
      if (data.isOwner && data.ingestUrl && data.streamKey) {
        setCredentials({
          ingestUrl: data.ingestUrl,
          streamKey: data.streamKey,
        });
      } else if (!data.live) {
        setCredentials(null);
      }
    } catch {
      // Silent — status UI just won't update this tick.
    }
  }, []);

  const start = useCallback(async () => {
    const id = roomIdRef.current;
    if (!id) return;
    setIsStarting(true);
    try {
      const res = await apiFetch(`/api/chat/rooms/${id}/stream/start`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to start stream");
      }
      const data = await res.json();
      setCredentials({
        ingestUrl: data.ingestUrl,
        streamKey: data.streamKey,
      });
      setStatus((prev) => ({
        ...prev,
        live: true,
        playbackUrl: data.playbackUrl ?? null,
        startedAt: new Date().toISOString(),
        initialized: true,
      }));
      toast.success("Stream provisioned — paste these into StreamYard");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start stream"
      );
    } finally {
      setIsStarting(false);
    }
  }, []);

  const stop = useCallback(async () => {
    const id = roomIdRef.current;
    if (!id) return;
    setIsStopping(true);
    try {
      const res = await apiFetch(`/api/chat/rooms/${id}/stream/stop`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to stop stream");
      setStatus((prev) => ({
        ...prev,
        live: false,
        playbackUrl: null,
        startedAt: null,
        viewerCount: 0,
        initialized: true,
      }));
      setCredentials(null);
      toast.success("Stream ended");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to stop stream"
      );
    } finally {
      setIsStopping(false);
    }
  }, []);

  const clearCredentials = useCallback(() => {
    setCredentials(null);
  }, []);

  // Initial fetch + polling. Polling is paused when roomId is missing
  // or when pollIntervalMs is 0.
  useEffect(() => {
    if (!roomId) {
      setStatus(INITIAL_STATUS);
      setCredentials(null);
      return;
    }
    refresh();
    if (pollIntervalMs <= 0) return;
    const id = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(id);
  }, [roomId, pollIntervalMs, refresh]);

  return {
    status,
    credentials,
    isStarting,
    isStopping,
    start,
    stop,
    refresh,
    clearCredentials,
  };
}
