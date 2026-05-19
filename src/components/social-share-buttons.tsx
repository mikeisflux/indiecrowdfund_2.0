"use client";

import { useCallback } from "react";
import { Facebook, Linkedin, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Header social-share row — opens each platform's share-intent URL in
// a new tab, pre-populated with the canonical site URL + a short
// blurb. Each platform handles its own auth: if the user is logged
// in to (e.g.) Facebook in the same browser, the share dialog skips
// the login step and goes straight to the composer. If they're not
// logged in, the platform shows its own login prompt before the share.
//
// We don't try to do platform OAuth here — that would require server
// integrations per platform, app review, scopes, refresh tokens, etc.
// Web-intent share URLs are the standard "let users share your site"
// pattern and require zero backend.

const SHARE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";
const SHARE_TEXT = "Discover indie creators on IndieCrowdfund — comics, books, music, movies, games & more.";

function openShareWindow(url: string) {
  // Centered popup ~600x500 — big enough for the platforms' share
  // composers, small enough not to be obnoxious. Falls back to a
  // plain new tab if the popup is blocked.
  const width = 600;
  const height = 500;
  const left = typeof window !== "undefined" ? window.screenX + (window.outerWidth - width) / 2 : 0;
  const top = typeof window !== "undefined" ? window.screenY + (window.outerHeight - height) / 2 : 0;
  const features = `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`;
  const popup = window.open(url, "ShareWindow", features);
  if (!popup) {
    // Popup blocked — open in a new tab as fallback so the share still
    // happens, just full-screen.
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// Minimal inline SVGs for X (Twitter) and Reddit since lucide-react
// doesn't ship them at the right brand mark. Facebook + LinkedIn use
// lucide.
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
function RedditIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 01-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 01.042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 014.028 12.5c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 01.14-.197.35.35 0 01.238-.042l2.906.617a1.214 1.214 0 011.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 00-.231.094.33.33 0 000 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 00.029-.463.33.33 0 00-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 00-.232-.095z" />
    </svg>
  );
}

interface ShareTarget {
  name: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  label: string; // for aria
  hoverColor: string; // tailwind brand-tint on hover
}

const TARGETS: ShareTarget[] = [
  {
    name: "Facebook",
    href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}`,
    Icon: ({ className }) => <Facebook className={className} fill="currentColor" />,
    label: "Share IndieCrowdfund on Facebook",
    hoverColor: "hover:text-[#1877F2]",
  },
  {
    name: "X",
    href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(SHARE_URL)}&text=${encodeURIComponent(SHARE_TEXT)}`,
    Icon: XIcon,
    label: "Share IndieCrowdfund on X",
    hoverColor: "hover:text-foreground",
  },
  {
    name: "LinkedIn",
    href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SHARE_URL)}`,
    Icon: ({ className }) => <Linkedin className={className} fill="currentColor" />,
    label: "Share IndieCrowdfund on LinkedIn",
    hoverColor: "hover:text-[#0A66C2]",
  },
  {
    name: "Reddit",
    href: `https://www.reddit.com/submit?url=${encodeURIComponent(SHARE_URL)}&title=${encodeURIComponent("IndieCrowdfund — indie creator crowdfunding")}`,
    Icon: RedditIcon,
    label: "Share IndieCrowdfund on Reddit",
    hoverColor: "hover:text-[#FF4500]",
  },
];

export function SocialShareButtons({ className = "" }: { className?: string }) {
  const handleClick = useCallback((href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    openShareWindow(href);
  }, []);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {TARGETS.map(({ name, href, Icon, label, hoverColor }) => (
        <a
          key={name}
          href={href}
          onClick={handleClick(href)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={`Share on ${name}`}
          className={`inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground ${hoverColor} hover:bg-muted transition-colors`}
        >
          <Icon className="h-4 w-4" />
        </a>
      ))}
    </div>
  );
}

// Compact dropdown variant — single trigger button with a Share icon
// that opens a menu containing the four share targets. Used in the
// site header to recover the real estate the four inline icons used
// to consume. Shares the same TARGETS list as SocialShareButtons so
// adding / removing a platform updates both surfaces.
export function SocialShareDropdown({ className = "" }: { className?: string }) {
  const handleSelect = useCallback(
    (href: string) => () => openShareWindow(href),
    []
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          aria-label="Share IndieCrowdfund"
          title="Share IndieCrowdfund"
        >
          <Share2 className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {TARGETS.map(({ name, href, Icon, hoverColor }) => (
          <DropdownMenuItem
            key={name}
            onSelect={handleSelect(href)}
            className="cursor-pointer flex items-center gap-2"
          >
            <Icon className={`h-4 w-4 text-muted-foreground ${hoverColor.replace("hover:", "group-hover:")}`} />
            <span>Share on {name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
