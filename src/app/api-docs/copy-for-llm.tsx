"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Copies the API reference as Markdown, for pasting into an assistant.
 *
 * navigator.clipboard needs a secure context and can be refused outright, so
 * there is a textarea + execCommand fallback rather than a button that
 * silently does nothing. A copy button that fails quietly is worse than no
 * button, because the user pastes whatever was in the clipboard before.
 */
export function CopyForLLM({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);

  const fallbackCopy = (text: string): boolean => {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  };

  const handleCopy = async () => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(markdown);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = fallbackCopy(markdown);

    if (ok) {
      setCopied(true);
      toast.success("API reference copied — paste it into your assistant.");
      setTimeout(() => setCopied(false), 2500);
    } else {
      toast.error("Couldn't copy automatically. Use the raw Markdown link instead.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={handleCopy} variant="default">
        {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
        {copied ? "Copied" : "Copy for LLM"}
      </Button>
      <Button variant="outline" asChild>
        {/* Always-available escape hatch when the clipboard is unavailable
            (http origin, locked-down browser, embedded webview). */}
        <a href="/api-docs/llms.txt" target="_blank" rel="noopener noreferrer">
          View raw Markdown
        </a>
      </Button>
      <span className="text-sm text-muted-foreground">
        Copies the full reference as Markdown for ChatGPT, Claude, or Cursor.
      </span>
    </div>
  );
}
