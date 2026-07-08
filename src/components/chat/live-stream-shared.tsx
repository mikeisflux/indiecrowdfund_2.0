"use client";

import { useState } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LiveStreamCredentials } from "./use-live-stream";

function copy(label: string, value: string) {
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error("Couldn't copy"));
}

export function LiveStreamCredentialsCard({
  credentials,
}: {
  credentials: LiveStreamCredentials;
}) {
  const [keyVisible, setKeyVisible] = useState(false);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Server / Ingest URL
        </label>
        <div className="flex gap-2">
          <Input
            readOnly
            value={credentials.ingestUrl}
            className="font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => copy("Ingest URL", credentials.ingestUrl)}
            aria-label="Copy ingest URL"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Stream key (keep this secret)
        </label>
        <div className="flex gap-2">
          <Input
            readOnly
            type={keyVisible ? "text" : "password"}
            value={credentials.streamKey}
            className="font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setKeyVisible((v) => !v)}
            aria-label={keyVisible ? "Hide stream key" : "Show stream key"}
          >
            {keyVisible ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => copy("Stream key", credentials.streamKey)}
            aria-label="Copy stream key"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function StreamYardSetupGuide() {
  return (
    <div className="rounded-md bg-muted/50 border p-3 text-xs space-y-1.5">
      <p className="font-medium">StreamYard setup</p>
      <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
        <li>
          Open your broadcast and click{" "}
          <strong>Destinations → Custom RTMP</strong>.
        </li>
        <li>Paste the Server URL and Stream key above.</li>
        <li>
          Hit <strong>Go Live</strong> in StreamYard — viewers see the stream
          here within ~10 seconds.
        </li>
      </ol>
    </div>
  );
}
