"use client";

import { useState } from "react";
import { Check, Code2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

/**
 * "Embed on your site" — generates the iframe snippet for a campaign.
 *
 * The snippet ships a small resize listener alongside the iframe. A
 * cross-origin frame cannot size itself and the parent cannot measure it, so
 * without that the card is stuck at a fixed height with dead space or an
 * internal scrollbar. The listener is guarded: it checks the message origin
 * and shape before touching anything, and a host who strips the script still
 * gets a working widget at the fallback height.
 */

const ORIGIN = "https://indiecrowdfund.com";

function buildSnippet(path: string, variant: string, theme: string, height: number) {
  const src = `${ORIGIN}/embed/${path}?variant=${variant}&theme=${theme}`;
  return `<iframe
  src="${src}"
  id="icf-embed"
  style="width:100%;max-width:680px;height:${height}px;border:0;overflow:hidden"
  loading="lazy"
  title="Support this campaign on IndieCrowdfund"
></iframe>
<script>
(function () {
  window.addEventListener("message", function (e) {
    if (e.origin !== "${ORIGIN}") return;
    var d = e.data;
    if (!d || d.type !== "icf-embed-height" || typeof d.height !== "number") return;
    var f = document.getElementById("icf-embed");
    if (f) f.style.height = d.height + "px";
  });
})();
</script>`;
}

export function EmbedDialog({
  vanityName,
  slug,
}: {
  vanityName: string;
  slug: string;
}) {
  const [variant, setVariant] = useState<"full" | "card">("full");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [copied, setCopied] = useState(false);

  const path = `${vanityName}/${slug}`;
  const height = variant === "card" ? 420 : 720;
  const snippet = buildSnippet(path, variant, theme, height);
  const previewSrc = `${ORIGIN}/embed/${path}?variant=${variant}&theme=${theme}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      toast.success("Embed code copied");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Couldn't copy — select the code and copy it manually");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Code2 className="mr-2 h-4 w-4" />
          Embed on your site
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Embed this campaign</DialogTitle>
          <DialogDescription>
            Paste this into any website. It shows live funding totals and reward
            tiers, and updates on its own. Backing opens IndieCrowdfund in a new
            tab so backers sign in and pay securely on our site.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-6">
          <div>
            <Label className="text-xs">Size</Label>
            <div className="mt-1 flex gap-2">
              {(["full", "card"] as const).map((v) => (
                <Button
                  key={v}
                  size="sm"
                  variant={variant === v ? "default" : "outline"}
                  onClick={() => setVariant(v)}
                >
                  {v === "full" ? "Full (with rewards)" : "Compact card"}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Theme</Label>
            <div className="mt-1 flex gap-2">
              {(["light", "dark"] as const).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={theme === t ? "default" : "outline"}
                  onClick={() => setTheme(t)}
                >
                  {t === "light" ? "Light" : "Dark"}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <Label className="text-xs">Preview</Label>
          <div className="mt-1 rounded-lg border bg-muted/30 p-3">
            <iframe
              key={previewSrc}
              src={previewSrc}
              style={{ width: "100%", height, border: 0 }}
              title="Embed preview"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Embed code</Label>
          <textarea
            readOnly
            value={snippet}
            onFocus={(e) => e.currentTarget.select()}
            rows={10}
            className="mt-1 w-full rounded-lg border bg-muted/30 p-3 font-mono text-xs"
          />
          <Button className="mt-2" onClick={copy}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? "Copied" : "Copy embed code"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
