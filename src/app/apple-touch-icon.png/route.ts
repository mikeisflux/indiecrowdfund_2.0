import { NextResponse } from "next/server";
import path from "path";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import sharp from "sharp";
import { getBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";

// iOS Safari, Android Chrome and most "add to home screen" flows request
// /apple-touch-icon.png on their own, whatever <head> declares. It 404'd
// (and the client error reporter dutifully filed it). Serve a 180×180 PNG
// built from the admin-uploaded favicon or logo, white-padded so a
// transparent logo doesn't become a black square on a home screen.
const UPLOADS_BASE = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
const SIZE = 180;

let cache: { key: string; png: Buffer; at: number } | null = null;

async function sourceBuffer(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  const m = url.match(/^\/api\/uploads\/(.+?)(\?.*)?$/);
  if (!m) return null;
  const rel = decodeURIComponent(m[1]);
  const file = path.resolve(UPLOADS_BASE, rel);
  if (!file.startsWith(path.resolve(UPLOADS_BASE) + path.sep) || !existsSync(file)) return null;
  if (/\.ico$/i.test(file)) return null; // sharp can't read .ico
  return readFile(file);
}

export async function GET() {
  try {
    const branding = await getBranding();
    const key = `${branding.faviconUrl || ""}|${branding.logoUrl || ""}`;
    if (cache && cache.key === key && Date.now() - cache.at < 6 * 60 * 60 * 1000) {
      return png(cache.png);
    }
    const src = (await sourceBuffer(branding.faviconUrl)) || (await sourceBuffer(branding.logoUrl));
    let out: Buffer;
    if (src) {
      out = await sharp(src)
        .resize(SIZE, SIZE, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .flatten({ background: "#ffffff" })
        .png()
        .toBuffer();
    } else {
      // No usable upload: brand green tile so the home-screen icon is at
      // least recognisably ours rather than Safari's grey placeholder.
      out = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: "#028858" } }).png().toBuffer();
    }
    cache = { key, png: out, at: Date.now() };
    return png(out);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

function png(buf: Buffer) {
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": "image/png", "Content-Length": String(buf.length), "Cache-Control": "public, max-age=86400" },
  });
}
