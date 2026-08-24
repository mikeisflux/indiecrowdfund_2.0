import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getBatchProjectStats } from "@/lib/stats";
import { PUBLIC_PROJECT_STATUSES } from "@/lib/api/serializers";
import { EmbedAutoHeight } from "./auto-height";

/**
 * Campaign embed widget — the page third-party sites put in an iframe.
 *
 * Chrome-less by design: no site header, footer, nav or cookie banner, because
 * it is rendered inside someone else's layout.
 *
 * It reads no session and takes no payment. Backing opens the real campaign
 * page in a new tab, and that is not a shortcut — a pledge requires the backer
 * to be signed in, and a third-party iframe cannot see our session cookie on
 * any browser that blocks third-party cookies (Safari and Firefox by default,
 * Chrome increasingly). 3DS challenges also have to break out of nested
 * frames. Card capture on a domain the backer does not recognise is the
 * phishing shape and drives chargebacks besides. So the widget sells the
 * campaign and hands off; the money always happens on our origin.
 *
 * Only PUBLIC_PROJECT_STATUSES are embeddable — the same rule the API uses, so
 * an unlaunched campaign cannot be surfaced by guessing its URL.
 */

export const dynamic = "force-dynamic";

// Nothing here should ever be indexed as a page in its own right; the real
// campaign page is the canonical one.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Params = { vanityname: string; slug: string };
type Search = { variant?: string; theme?: string };

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { vanityname, slug } = await params;
  const { variant = "full", theme = "light" } = await searchParams;

  const project = await db.project.findFirst({
    where: {
      slug,
      deletedAt: null,
      status: { in: [...PUBLIC_PROJECT_STATUSES] as ("LIVE")[] },
      creator: { vanityUrl: vanityname },
    },
    select: {
      id: true,
      title: true,
      subtitle: true,
      slug: true,
      imageUrl: true,
      currency: true,
      goalAmount: true,
      currentAmount: true,
      backerCount: true,
      status: true,
      endDate: true,
      campaignType: true,
      creator: { select: { name: true, vanityUrl: true } },
      rewards: {
        // Reward has no deletedAt. Public tiers only: SECRET rewards are
          // reachable solely via their secretToken and must not be listed.
          where: { type: "TIER", visibility: "PUBLIC", isEnded: false },
        select: {
          id: true,
          title: true,
          amount: true,
          quantityAvailable: true,
          quantityClaimed: true,
        },
        orderBy: { amount: "asc" },
        take: 4,
      },
    },
  });

  if (!project) notFound();

  type RewardTier = {
    id: string;
    title: string;
    amount: unknown;
    quantityAvailable: number | null;
    quantityClaimed: number;
  };

  const statsMap = await getBatchProjectStats([
    {
      id: project.id,
      status: project.status,
      goalAmount: project.goalAmount as unknown as number,
    },
  ]);
  const stats = statsMap.get(project.id);

  const goal = Number(String(project.goalAmount));
  const pledged = stats ? stats.currentAmount : Number(String(project.currentAmount));
  const backers = stats ? stats.backerCount : project.backerCount;
  const percent = goal > 0 ? Math.min(999, Math.round((pledged / goal) * 100)) : 0;

  const daysLeft = project.endDate
    ? Math.max(0, Math.ceil((new Date(project.endDate).getTime() - Date.now()) / 86_400_000))
    : null;

  const campaignUrl = `https://indiecrowdfund.com/projects/${vanityname}/${project.slug}`;
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: project.currency || "USD",
      maximumFractionDigits: 0,
    }).format(n);

  const dark = theme === "dark";
  const compact = variant === "card";

  // Inline tokens rather than Tailwind's dark: variant — the widget renders
  // inside a stranger's page and must not depend on a `dark` class it cannot
  // see on their <html>.
  const bg = dark ? "#18181b" : "#ffffff";
  const fg = dark ? "#fafafa" : "#18181b";
  const muted = dark ? "#a1a1aa" : "#71717a";
  const border = dark ? "#3f3f46" : "#e4e4e7";

  return (
    <div
      style={{
        background: bg,
        color: fg,
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        border: `1px solid ${border}`,
        borderRadius: 12,
        overflow: "hidden",
        maxWidth: "100%",
      }}
    >
      <EmbedAutoHeight />

      {project.imageUrl && (
        <a href={campaignUrl} target="_blank" rel="noopener noreferrer">
          {/* unoptimized: the optimizer's cache keys off our own origin and
              these are hotlinked from arbitrary sites; a plain img via
              next/image keeps the CDN out of the loop. */}
          <Image
            src={project.imageUrl}
            alt={project.title}
            width={800}
            height={450}
            unoptimized
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        </a>
      )}

      <div style={{ padding: compact ? 14 : 18 }}>
        <a
          href={campaignUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: fg, textDecoration: "none" }}
        >
          <h2 style={{ margin: 0, fontSize: compact ? 16 : 20, fontWeight: 700, lineHeight: 1.25 }}>
            {project.title}
          </h2>
        </a>
        {project.creator?.name && (
          <p style={{ margin: "4px 0 0", fontSize: 13, color: muted }}>
            by {project.creator.name}
          </p>
        )}
        {!compact && project.subtitle && (
          <p style={{ margin: "8px 0 0", fontSize: 14, color: muted, lineHeight: 1.5 }}>
            {project.subtitle}
          </p>
        )}

        <div
          style={{
            marginTop: 14,
            height: 8,
            borderRadius: 999,
            background: border,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.min(100, percent)}%`,
              height: "100%",
              background: "#22c55e",
              borderRadius: 999,
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: compact ? 18 : 22, fontWeight: 700, color: "#22c55e" }}>
              {money(pledged)}
            </div>
            <div style={{ fontSize: 12, color: muted }}>of {money(goal)} goal</div>
          </div>
          <div>
            <div style={{ fontSize: compact ? 18 : 22, fontWeight: 700 }}>{backers}</div>
            <div style={{ fontSize: 12, color: muted }}>backers</div>
          </div>
          {daysLeft !== null && project.status === "LIVE" && (
            <div>
              <div style={{ fontSize: compact ? 18 : 22, fontWeight: 700 }}>{daysLeft}</div>
              <div style={{ fontSize: 12, color: muted }}>days to go</div>
            </div>
          )}
          {project.status !== "LIVE" && (
            <div>
              <div style={{ fontSize: compact ? 18 : 22, fontWeight: 700 }}>{percent}%</div>
              <div style={{ fontSize: 12, color: muted }}>{project.status.toLowerCase()}</div>
            </div>
          )}
        </div>

        {!compact && project.rewards.length > 0 && (
          <div style={{ marginTop: 16, borderTop: `1px solid ${border}`, paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 8 }}>
              REWARDS
            </div>
            {(project.rewards as RewardTier[]).map((r: RewardTier) => {
              const remaining =
                r.quantityAvailable == null
                  ? null
                  : Math.max(0, r.quantityAvailable - r.quantityClaimed);
              return (
                // Deep-links the tier so the backer lands on the pledge page
                // with it already selected, rather than hunting for it again.
                <a
                  key={r.id}
                  href={`${campaignUrl}/pledge?reward=${r.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "8px 0",
                    color: fg,
                    textDecoration: "none",
                    fontSize: 14,
                    borderBottom: `1px solid ${border}`,
                  }}
                >
                  <span>{r.title}</span>
                  <span style={{ whiteSpace: "nowrap", color: muted }}>
                    {money(Number(String(r.amount)))}
                    {remaining !== null && remaining === 0 ? " · gone" : ""}
                  </span>
                </a>
              );
            })}
          </div>
        )}

        <a
          href={`${campaignUrl}/pledge`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            marginTop: 16,
            padding: "12px 16px",
            background: "#22c55e",
            color: "#052e16",
            fontWeight: 700,
            fontSize: 15,
            textAlign: "center",
            borderRadius: 8,
            textDecoration: "none",
          }}
        >
          Back this project →
        </a>

        <a
          href={campaignUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            marginTop: 10,
            fontSize: 11,
            color: muted,
            textAlign: "center",
            textDecoration: "none",
          }}
        >
          Powered by IndieCrowdfund
        </a>
      </div>
    </div>
  );
}
