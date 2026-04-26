"use client";

import { useEffect, useState } from "react";
import {
  Radio,
  Loader2,
  StopCircle,
  Users,
  Bell,
  Clock,
  Wifi,
  WifiOff,
  AlertTriangle,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LiveStreamPlayer } from "@/components/chat/live-stream-player";
import { useLiveStream } from "@/components/chat/use-live-stream";
import {
  LiveStreamCredentialsCard,
  StreamYardSetupGuide,
} from "@/components/chat/live-stream-shared";
import { cn } from "@/lib/utils";

interface LiveStreamTabProps {
  /** Logged-in creator's user id — used to resolve their chat room. */
  creatorId: string | undefined;
}

interface ResolvedRoom {
  id: string;
  name: string;
  slug: string;
}

function formatElapsed(startedAt: string | null): string {
  if (!startedAt) return "00:00";
  const elapsed = Math.max(
    0,
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  );
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function LiveStreamTab({ creatorId }: LiveStreamTabProps) {
  const [room, setRoom] = useState<ResolvedRoom | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  // Resolve (or lazily create) the creator's chat room.
  useEffect(() => {
    if (!creatorId) return;
    let cancelled = false;
    (async () => {
      try {
        setResolving(true);
        setResolveError(null);
        const res = await fetch(
          `/api/chat/rooms/resolve?creatorId=${encodeURIComponent(creatorId)}`
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Failed (${res.status})`);
        }
        const data = await res.json();
        if (!cancelled) setRoom(data.room);
      } catch (err) {
        if (!cancelled) {
          setResolveError(
            err instanceof Error ? err.message : "Failed to load chat room"
          );
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  const {
    status,
    credentials,
    isStarting,
    isStopping,
    start,
    stop,
    refresh,
  } = useLiveStream({ roomId: room?.id ?? null });

  // Live ticker for elapsed-time display so the panel doesn't look frozen.
  const [elapsed, setElapsed] = useState(formatElapsed(status.startedAt));
  useEffect(() => {
    if (!status.live) {
      setElapsed("00:00");
      return;
    }
    setElapsed(formatElapsed(status.startedAt));
    const id = setInterval(
      () => setElapsed(formatElapsed(status.startedAt)),
      1000
    );
    return () => clearInterval(id);
  }, [status.live, status.startedAt]);

  // Two-step confirm so a stray click doesn't kill a live stream.
  const [stopArmed, setStopArmed] = useState(false);
  useEffect(() => {
    if (!stopArmed) return;
    const id = window.setTimeout(() => setStopArmed(false), 4000);
    return () => window.clearTimeout(id);
  }, [stopArmed]);
  const handleStop = async () => {
    if (!stopArmed) {
      setStopArmed(true);
      return;
    }
    setStopArmed(false);
    await stop();
  };

  if (!creatorId) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Please log in to manage your live stream.
        </CardContent>
      </Card>
    );
  }

  if (resolving && !room) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading your stream room…
        </CardContent>
      </Card>
    );
  }

  if (resolveError || !room) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-12 text-center space-y-2">
          <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto" />
          <p className="text-sm text-muted-foreground">
            {resolveError || "Could not load your chat room."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const goLiveBusy = isStarting || isStopping;

  return (
    <div className="space-y-6">
      {/* Status header card */}
      <Card
        className={cn(
          "overflow-hidden border-border/50 backdrop-blur transition-colors",
          status.live
            ? "bg-gradient-to-br from-red-500/10 via-rose-500/5 to-transparent border-red-500/30"
            : "bg-card/50"
        )}
      >
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {status.live ? (
                  <Badge className="bg-red-600 hover:bg-red-600 gap-1">
                    <Wifi className="h-3 w-3 animate-pulse" />
                    LIVE
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <WifiOff className="h-3 w-3" />
                    Offline
                  </Badge>
                )}
                <span className="text-sm font-medium">{room.name}</span>
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-red-500 to-rose-500 bg-clip-text text-transparent">
                {status.live ? "You're broadcasting" : "Launch Party Studio"}
              </h2>
              <p className="text-sm text-muted-foreground max-w-xl">
                {status.live
                  ? "Your stream is being relayed to viewers in your chat room. Keep StreamYard connected — viewers see playback within ~10 seconds of your broadcast."
                  : "Run a live launch party, AMA, or behind-the-scenes session for your community. Mint a Cloudflare ingest endpoint, paste it into StreamYard, and your viewers watch HLS playback inline above the chat."}
              </p>
            </div>

            <div className="flex flex-col items-stretch md:items-end gap-2">
              {status.live ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  onClick={handleStop}
                  disabled={goLiveBusy}
                  className="min-w-[160px]"
                >
                  {isStopping ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <StopCircle className="h-4 w-4 mr-2" />
                  )}
                  {stopArmed ? "Click again to confirm" : "End stream"}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  onClick={start}
                  disabled={goLiveBusy}
                  className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white min-w-[160px]"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Provisioning…
                    </>
                  ) : (
                    <>
                      <Radio className="h-4 w-4 mr-2" />
                      Go Live
                    </>
                  )}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={refresh}
                className="text-xs text-muted-foreground"
              >
                <RefreshCw className="h-3 w-3 mr-1.5" />
                Refresh status
              </Button>
            </div>
          </div>

          {/* Live stat strip */}
          {status.live && (
            <>
              <Separator className="my-5" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Elapsed</p>
                    <p className="font-mono tabular-nums font-semibold">
                      {elapsed}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Viewers</p>
                    <p className="font-semibold">
                      {status.viewerCount.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Notifications
                    </p>
                    <p className="font-semibold">
                      Members alerted
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Live preview — embedded HLS player so the creator can monitor
          their own broadcast without leaving the dashboard. */}
      {status.live && status.playbackUrl && (
        <Card className="bg-card/50 backdrop-blur border-border/50 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Live preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LiveStreamPlayer
              playbackUrl={status.playbackUrl}
              startedAt={status.startedAt}
              viewerCount={status.viewerCount}
              brandName={room.name}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Same feed your viewers see in the chat room. Audio is muted by
              default — unmute the player above if you need to monitor sound.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Credentials + StreamYard setup. Visible whenever we have credentials
          (right after Start, or after a page refresh while live). */}
      {credentials ? (
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Radio className="h-4 w-4 text-red-500" />
              Broadcast credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <LiveStreamCredentialsCard credentials={credentials} />
            <StreamYardSetupGuide />
            <p className="text-xs text-muted-foreground">
              Treat the stream key like a password. If you suspect it&apos;s
              leaked, end the stream and start a new one — Cloudflare mints
              fresh credentials every time.
            </p>
          </CardContent>
        </Card>
      ) : !status.live ? (
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="text-base">How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-2">
              <li>
                Click <strong>Go Live</strong> above. We mint a fresh
                Cloudflare RTMP endpoint just for this session.
              </li>
              <li>
                Copy the Server URL and Stream key into StreamYard&apos;s{" "}
                <strong>Custom RTMP destination</strong>.
              </li>
              <li>
                Hit <strong>Go Live</strong> in StreamYard. Your viewers watch
                HLS playback inline above your chat — no plugins, no apps.
              </li>
              <li>
                Members of your chat room with notifications enabled get a{" "}
                <strong>Live now</strong> alert.
              </li>
              <li>
                Click <strong>End stream</strong> when you&apos;re done. We
                tear down the Cloudflare input so nothing keeps billing in the
                background.
              </li>
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {/* Footer hint */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4 shrink-0" />
          <span>
            One stream per creator — the live player surfaces inside the
            Community tab on every one of your projects.
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
