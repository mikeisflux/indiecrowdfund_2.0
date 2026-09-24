import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getProjectAccess } from "@/lib/auth/collaborator";
import { resolvePledgeShippingAddress } from "@/lib/fulfillment/shipping-address";

const packingSlipsLogger = logger.child({ module: "creator-indiekit-packing-slips" });

/**
 * Printable packing slips — one page per order.
 *
 * GET returns a self-contained HTML document the creator prints (or
 * saves as PDF from the print dialog). Selection:
 *   ?pledgeIds=a,b,c        specific orders (the per-backer dialog)
 *   ?groupId=<custom group> a creator-defined package group
 *   ?groupName=<title>      an auto-generated reward-tier group
 *   (none)                  every completed order on the campaign
 * Options: includePrice=1, thankYou=0, paper=letter|a4|half.
 *
 * This backs the Packages tab's "Export Packing Slips" and the packing
 * slip dialog's Print/Download buttons, which previously toasted success
 * and produced nothing (Print ran window.print() on the whole app page).
 */

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const PAPER_SIZES: Record<string, string> = {
  letter: "8.5in 11in",
  a4: "A4",
  half: "8.5in 5.5in",
};

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = req.nextUrl.searchParams;
    const projectId = params.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    const access = await getProjectAccess(projectId, session.user.id, "canCoordinateFulfillment");
    if (!access) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { title: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const includePrice = params.get("includePrice") === "1";
    const thankYou = params.get("thankYou") !== "0";
    const paper = PAPER_SIZES[params.get("paper") || "letter"] || PAPER_SIZES.letter;

    const pledgeIdsParam = (params.get("pledgeIds") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const groupId = params.get("groupId");
    const groupName = params.get("groupName");

    let idFilter: string[] | null = null;
    if (pledgeIdsParam.length > 0) {
      idFilter = pledgeIdsParam.slice(0, 500);
    } else if (groupId) {
      const group = await db.customPackageGroup.findFirst({
        where: { id: groupId, projectId },
        select: { pledgeIds: true },
      });
      if (group) idFilter = group.pledgeIds;
    }

    const pledges = await db.pledge.findMany({
      where: {
        projectId,
        deletedAt: null,
        status: "COMPLETED",
        ...(idFilter
          ? { id: { in: idFilter } }
          : groupName
            ? groupName === "No Reward"
              ? { rewardId: null }
              : { reward: { title: groupName } }
            : {}),
      },
      orderBy: { backerNumber: "asc" },
      take: 500,
      select: {
        id: true,
        backerNumber: true,
        shippingAddress: true,
        user: { select: { name: true, email: true } },
        reward: { select: { title: true, amount: true } },
        surveyResponse: { select: { shippingAddress: true } },
        addons: {
          select: { quantity: true, addon: { select: { title: true, amount: true } } },
        },
      },
    });

    if (pledges.length === 0) {
      return new NextResponse(
        "<!doctype html><html><body style='font-family:sans-serif;padding:40px'><h2>No orders matched this selection.</h2></body></html>",
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const slips = pledges
      .map((p) => {
        const address = resolvePledgeShippingAddress(
          p.surveyResponse?.shippingAddress,
          p.shippingAddress
        );
        const items: { name: string; qty: number; price: number }[] = [];
        if (p.reward) items.push({ name: p.reward.title, qty: 1, price: Number(p.reward.amount) });
        for (const a of p.addons) {
          items.push({ name: a.addon.title, qty: a.quantity, price: Number(a.addon.amount) });
        }
        const totalQty = items.reduce((s, i) => s + i.qty, 0);

        const rows = items
          .map(
            (i) => `<tr>
              <td>${esc(i.name)}</td>
              <td class="c">${i.qty}</td>
              ${includePrice ? `<td class="r">$${(i.price * i.qty).toFixed(2)}</td>` : ""}
              <td class="c"><span class="box"></span></td>
            </tr>`
          )
          .join("");

        return `<section class="slip">
          <header>
            <div>
              <h1>PACKING SLIP</h1>
              <p class="muted">Order #${esc(p.id.substring(0, 8).toUpperCase())}${p.backerNumber ? ` · Backer #${p.backerNumber}` : ""}</p>
            </div>
            <div class="right">
              <p class="strong">${esc(project.title)}</p>
              <p class="muted">${new Date().toLocaleDateString()}</p>
            </div>
          </header>
          <div class="cols">
            <div>
              <p class="label">SHIP TO</p>
              ${
                address
                  ? `<p class="strong">${esc(address.name || p.user.name || "")}</p>
                     <p>${esc(address.line1)}</p>
                     ${address.line2 ? `<p>${esc(address.line2)}</p>` : ""}
                     <p>${esc([address.city, address.state, address.postalCode].filter(Boolean).join(", "))}</p>
                     <p>${esc(address.country)}</p>`
                  : `<p class="muted">No shipping address on file</p>`
              }
            </div>
            <div>
              <p class="label">BACKER</p>
              <p>${esc(p.user.name || "")}</p>
              <p class="muted">${esc(p.user.email || "")}</p>
              <p class="muted">${esc(p.reward?.title || "No Reward")}</p>
            </div>
          </div>
          <p class="label">ITEMS (${totalQty})</p>
          <table>
            <thead><tr><th>Item</th><th class="c">Qty</th>${includePrice ? '<th class="r">Price</th>' : ""}<th class="c">✓</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          ${thankYou ? `<footer><p class="strong">Thank you for backing ${esc(project.title)}!</p><p class="muted">Your support makes this possible.</p></footer>` : ""}
        </section>`;
      })
      .join("\n");

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Packing Slips — ${esc(project.title)}</title>
<style>
  @page { size: ${paper}; margin: 0.5in; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; margin: 0; }
  .toolbar { padding: 12px 16px; background: #f5f5f5; border-bottom: 1px solid #ddd;
             display: flex; gap: 12px; align-items: center; position: sticky; top: 0; }
  .toolbar button { padding: 8px 20px; font-size: 14px; cursor: pointer; }
  .slip { padding: 32px; page-break-after: always; max-width: 8in; margin: 0 auto; }
  .slip:last-child { page-break-after: auto; }
  header { display: flex; justify-content: space-between; margin-bottom: 24px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  p { margin: 2px 0; font-size: 13px; }
  .muted { color: #666; }
  .strong { font-weight: 600; }
  .right { text-align: right; }
  .label { font-size: 11px; font-weight: 600; color: #666; letter-spacing: 0.05em; margin: 16px 0 6px; }
  .cols { display: flex; gap: 48px; }
  .cols > div { flex: 1; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; border-bottom: 2px solid #111; padding: 6px 4px; font-size: 11px; }
  td { border-bottom: 1px solid #ddd; padding: 8px 4px; }
  .c { text-align: center; } .r { text-align: right; }
  .box { display: inline-block; width: 16px; height: 16px; border: 2px solid #111; border-radius: 3px; }
  footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; text-align: center; }
  @media print { .toolbar { display: none; } }
</style>
</head>
<body>
<div class="toolbar">
  <button onclick="window.print()">Print / Save as PDF</button>
  <span style="font-size:13px;color:#666">${pledges.length} packing slip(s) — ${esc(project.title)}</span>
</div>
${slips}
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    packingSlipsLogger.error({ err: formatError(error) }, "Packing slips render failed");
    return NextResponse.json({ error: "Failed to generate packing slips" }, { status: 500 });
  }
}
