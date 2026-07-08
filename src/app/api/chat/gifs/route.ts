import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSecret } from "@/lib/vault";
import { logger } from "@/lib/logger";

const gifsLogger = logger.child({ module: "chat-gifs" });

export const dynamic = "force-dynamic";

interface KlipyGif {
  slug?: string;
  id?: string | number;
  title?: string;
  file?: {
    md?: { gif?: { url?: string }; mp4?: { url?: string } };
    sm?: { gif?: { url?: string }; mp4?: { url?: string } };
  };
  preview?: { url?: string };
  // Klipy returns variations of these, so we accept anything string-typed below.
  [key: string]: unknown;
}

interface KlipyResponse {
  result?: boolean;
  data?: {
    data?: KlipyGif[];
    current_page?: number;
    has_next?: boolean;
  };
}

function pickUrl(gif: KlipyGif): { url: string | null; preview: string | null } {
  const url =
    gif.file?.md?.gif?.url ||
    gif.file?.sm?.gif?.url ||
    gif.file?.md?.mp4?.url ||
    null;
  const preview = gif.preview?.url || gif.file?.sm?.gif?.url || url;
  return { url, preview };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await db.platformSettings.findUnique({
    where: { id: "default" },
    select: { klipyEnabled: true, klipyApiKey: true },
  });

  if (!settings?.klipyEnabled) {
    return NextResponse.json({ enabled: false, gifs: [] });
  }

  const apiKey = getSecret("klipy_api_key", settings.klipyApiKey);
  if (!apiKey) {
    return NextResponse.json({ enabled: false, gifs: [] });
  }

  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const perPage = Math.min(
    24,
    Math.max(6, parseInt(searchParams.get("per_page") || "18") || 18)
  );

  // Klipy requires a stable customer_id per user for personalised results.
  const customerId = session.user.id;
  const endpoint = query
    ? `https://api.klipy.com/api/v1/${encodeURIComponent(apiKey)}/gifs/search`
    : `https://api.klipy.com/api/v1/${encodeURIComponent(apiKey)}/gifs/trending`;

  const url = new URL(endpoint);
  if (query) url.searchParams.set("q", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("customer_id", customerId);

  try {
    const klipyRes = await fetch(url.toString(), { cache: "no-store" });
    if (!klipyRes.ok) {
      gifsLogger.warn(
        { status: klipyRes.status },
        "Klipy upstream returned non-OK"
      );
      return NextResponse.json(
        { enabled: true, gifs: [], error: "Klipy upstream error" },
        { status: 502 }
      );
    }
    const json = (await klipyRes.json()) as KlipyResponse;
    const items = json.data?.data || [];
    const gifs = items
      .map((gif) => {
        const { url: gifUrl, preview } = pickUrl(gif);
        if (!gifUrl) return null;
        return {
          id: String(gif.slug || gif.id || gifUrl),
          url: gifUrl,
          previewUrl: preview || gifUrl,
          title: typeof gif.title === "string" ? gif.title : "",
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      enabled: true,
      gifs,
      page: json.data?.current_page ?? page,
      hasMore: json.data?.has_next ?? false,
    });
  } catch (error) {
    gifsLogger.error({ err: formatError(error) }, "Klipy fetch failed");
    return NextResponse.json(
      { enabled: true, gifs: [], error: "Klipy request failed" },
      { status: 502 }
    );
  }
}
