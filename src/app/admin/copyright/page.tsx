"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Copyright,
  Play,
  Loader2,
  Download,
  RefreshCw,
  CheckCircle2,
  Camera,
  ShieldCheck,
} from "lucide-react";

interface PdfInfo {
  exists: boolean;
  size: number;
  modified: string | null;
  filename: string;
}

interface StatusResponse {
  running: boolean;
  pid: number | null;
  pageCount: number | null;
  log: string;
  pdf: PdfInfo;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function CopyrightPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [includeAuth, setIncludeAuth] = useState(true);
  const [fresh, setFresh] = useState(false);
  const [starting, setStarting] = useState(false);
  const wasRunning = useRef(false);
  const logRef = useRef<HTMLPreElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/copyright/status", { cache: "no-store" });
      if (res.ok) {
        const data: StatusResponse = await res.json();
        setStatus(data);
        // Announce completion once, when a live run flips to finished.
        if (wasRunning.current && !data.running) {
          if (data.pdf.exists) {
            toast.success(`Capture complete — ${data.pageCount ?? "?"} page(s) in the PDF.`);
          } else {
            toast.error("Capture finished but no PDF was produced. Check the log.");
          }
        }
        wasRunning.current = data.running;
      }
    } catch {
      // transient — next poll will retry
    }
  }, []);

  // Initial load.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while a capture is running.
  useEffect(() => {
    if (!status?.running) return;
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [status?.running, refresh]);

  // Keep the log scrolled to the newest line.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [status?.log]);

  const runCapture = useCallback(async () => {
    setStarting(true);
    try {
      const res = await apiFetch("/api/admin/copyright/run", {
        method: "POST",
        json: { includeAuth, fresh },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toast.info("A capture is already running.");
      } else if (!res.ok) {
        toast.error(data?.error || "Failed to start capture.");
      } else {
        toast.success("Capture started. Screenshotting every page…");
        wasRunning.current = true;
        // Optimistically flip to running so polling starts immediately.
        setStatus((prev) =>
          prev
            ? { ...prev, running: true }
            : { running: true, pid: data.pid ?? null, pageCount: null, log: "", pdf: { exists: false, size: 0, modified: null, filename: "" } }
        );
      }
    } catch {
      toast.error("Failed to start capture.");
    } finally {
      setStarting(false);
    }
  }, [includeAuth, fresh]);

  const downloadPdf = useCallback(() => {
    // Server responds with Content-Disposition: attachment, so this downloads
    // the file without navigating away from the page.
    window.location.href = "/api/admin/copyright/download";
  }, []);

  const running = !!status?.running;
  const pdf = status?.pdf;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Copyright className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Copyright Capture</h1>
          <p className="text-sm text-muted-foreground">
            Screenshot every page of the site into a single PDF — a dated record of the platform&apos;s
            work for copyright and archival purposes.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Controls */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Run a capture</CardTitle>
            <CardDescription>
              Captures all public pages, then — with the toggle on — logs in as you to capture the
              dashboard and admin pages too.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="includeAuth" className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Include logged-in pages
                </Label>
                <p className="text-xs text-muted-foreground">Dashboard, IndieKit, settings &amp; admin.</p>
              </div>
              <Switch
                id="includeAuth"
                checked={includeAuth}
                onCheckedChange={setIncludeAuth}
                disabled={running || starting}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="fresh" className="flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Re-capture everything
                </Label>
                <p className="text-xs text-muted-foreground">
                  Ignore the cache and re-shoot every page from scratch.
                </p>
              </div>
              <Switch
                id="fresh"
                checked={fresh}
                onCheckedChange={setFresh}
                disabled={running || starting}
              />
            </div>

            <Separator />

            <Button onClick={runCapture} disabled={running || starting} className="w-full">
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Capture running…
                </>
              ) : starting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting…
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run capture
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground">
              Capturing the whole site can take a few minutes. You can leave this page — the run
              continues on the server and this panel picks it back up.
            </p>
          </CardContent>
        </Card>

        {/* PDF + status */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Latest PDF</CardTitle>
                <CardDescription>The most recently assembled capture.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={refresh} disabled={starting}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Refresh
                </Button>
                <Button size="sm" onClick={downloadPdf} disabled={!pdf?.exists}>
                  <Download className="mr-1.5 h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {running ? (
                <Badge variant="secondary" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Running
                </Badge>
              ) : pdf?.exists ? (
                <Badge variant="secondary" className="gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Ready
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <Camera className="h-3 w-3" />
                  Not captured yet
                </Badge>
              )}
              {typeof status?.pageCount === "number" && (
                <span className="text-muted-foreground">{status.pageCount} page(s)</span>
              )}
              {pdf?.exists && (
                <>
                  <span className="text-muted-foreground">· {formatBytes(pdf.size)}</span>
                  {pdf.modified && (
                    <span className="text-muted-foreground">
                      · updated {new Date(pdf.modified).toLocaleString()}
                    </span>
                  )}
                </>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Camera className="h-3.5 w-3.5" />
                Capture log
              </div>
              <pre
                ref={logRef}
                className="h-72 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed"
              >
                {status?.log?.trim()
                  ? status.log
                  : "No capture has been run yet. Click “Run capture” to begin."}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
