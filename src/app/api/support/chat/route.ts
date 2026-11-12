import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { alertAdmins } from "@/lib/admin-alerts";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { getBackerSupportContext, formatBackerSupportContext, type BackerPledgeSummary } from "@/lib/support/backer-context";
import { getVerifiedIdentity, issueVerificationCode, verifyCode, type VerifiedIdentity } from "@/lib/support/verification";
import { notifyNewMessage } from "@/lib/messages/notify";
import { runTool } from "@/lib/agent-api";
import { rateLimiter } from "@/lib/rate-limiter";
import { searchKnowledgeBase, formatKbContext } from "@/lib/support/knowledge-base";
// The shared client decrypts the stored key. This route had its own copy
// that read the column raw, so once Settings started encrypting the key
// the support bot sent ciphertext as the API key and got 401 on every
// message, while every other AI feature kept working.
import { getAnthropic } from "@/lib/ai/anthropic-client";

const log = logger.child({ module: "support-chat" });

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(8000),
});
const bodySchema = z.object({
  // The full conversation so the AI has context. Cap to avoid prompt
  // explosion from a runaway client.
  messages: z.array(messageSchema).min(1).max(40),
  // Optional page URL the user is currently on — useful context when
  // they ask "why is this not working" without saying which page.
  pageUrl: z.string().url().max(2048).optional(),
  // Per-browser-session id from the widget; ties the email-code identity
  // check to this conversation.
  chatToken: z.string().min(16).max(80).optional(),
});

/**
 * Identity in this route has two levels:
 *   - session: who NextAuth says is logged in (may be a shared computer).
 *   - verified: the chat proved ownership of an account's email with a code.
 * Personal data (orders, email history) and order escalations need
 * VERIFIED. The server enforces it in the tool executors; the prompt only
 * tells the model how to get there.
 */

// Claude tools (Anthropic's tool-use API). The model decides when to
// call these; we execute them server-side and feed results back so the
// model can compose a final reply that references "I've sent your
// report to Mike" / "Email sent to support@".
const TOOLS: Anthropic.Tool[] = [
  {
    name: "send_verification_code",
    description:
      "Email a 6-digit verification code to the address on the user's IndieCrowdfund account. Required before any lookup of their orders, downloads or email history and before escalating an order issue. If the user is logged in, call with no arguments (the code goes to the account email). If not logged in, pass the email they say is on their account. Never reveal whether an email has an account; the result tells you what to say.",
    input_schema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Only when the user is NOT logged in: the email on their account." },
      },
    },
  },
  {
    name: "verify_code",
    description: "Check the 6-digit code the user typed. On success, lookups and escalations about their account are unlocked for 30 minutes.",
    input_schema: {
      type: "object",
      properties: { code: { type: "string", description: "The 6 digits the user entered." } },
      required: ["code"],
    },
  },
  {
    name: "lookup_my_orders",
    description:
      "After verification: the user's recent pledges — campaign, slug, pledge id, status, reward and add-ons, survey and fulfillment state, and exactly which digital files this pledge can download, which exist but are NOT included in their tier/add-ons, and whether the creator has uploaded any files at all. Use this before answering any order, reward, shipping or download question.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "lookup_my_email_history",
    description:
      "After verification: what IndieCrowdfund has emailed the user recently and what the mail provider reported (delivered, bounced, reason), plus whether the address is blocklisted or unsubscribed. Use for 'I never got the email'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "lookup_campaign",
    description: "Public details of a campaign by slug or title: status, dates, creator name, reward tiers and add-ons with prices, funding. No verification needed.",
    input_schema: {
      type: "object",
      properties: { campaign: { type: "string", description: "Campaign slug (from the URL) or exact title." } },
      required: ["campaign"],
    },
  },
  {
    name: "submit_bug_report",
    description:
      "File a bug report on behalf of the user. Use this when something on the WEBSITE is broken (a 500 error, a button that doesn't work, a payment that won't go through, a download link that errors, a page that won't load) AND the knowledge base does NOT cover the issue. The report goes to the platform's admin queue at /admin/bug-reports. NOT for questions about a creator's shipping, delivery dates, reward contents or files they haven't uploaded — those go to message_creator.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short one-sentence summary of the bug (max 200 chars). Written from the user's perspective." },
        description: {
          type: "string",
          description: "Full description of the bug as the user described it. Include steps to reproduce, what they expected, and what actually happened, even if you have to infer some pieces. Plain text, no markdown.",
        },
        category: { type: "string", enum: ["UI_VISUAL", "FUNCTIONALITY", "PERFORMANCE", "SECURITY", "PAYMENT", "ACCOUNT", "PROJECT", "REWARDS", "OTHER"], description: "Best-fit category for the bug." },
        severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], description: "LOW for cosmetic, MEDIUM for annoying, HIGH for blocks the user, CRITICAL for payment / data loss / security." },
        contactEmail: { type: "string", description: "The email address the user wants the resolution sent to. Required when the user is not logged in and not verified; ask them for it before calling." },
        contactName: { type: "string", description: "The user's name, if they gave one." },
      },
      required: ["title", "description", "category", "severity"],
    },
  },
  {
    name: "message_creator",
    description:
      "Send the user's question to the CREATOR of a campaign they backed, through the platform's messaging (it lands in the creator's IndieKit inbox and they get an email; replies come back to the user's account inbox). Use for anything only the creator can answer or fix: when their rewards will ship, tracking, a digital file they haven't uploaded yet, what a tier includes, a damaged or wrong item, a survey question. Requires verification and a pledge on that campaign.",
    input_schema: {
      type: "object",
      properties: {
        campaign: { type: "string", description: "The campaign slug from the user's orders." },
        pledgeId: { type: "string", description: "The pledge id from the user's orders." },
        subject: { type: "string", description: "Short subject (max 120 chars)." },
        message: {
          type: "string",
          description: "The message to the creator, written in the user's voice and first person, with the specifics: what they ordered, what they're asking. Plain text.",
        },
      },
      required: ["campaign", "pledgeId", "subject", "message"],
    },
  },
  {
    name: "email_support",
    description:
      "Send a note to the PLATFORM's human support team at support@indiecrowdfund.com. Only for things the platform itself must handle: account access and merges, billing disputes with the platform, refunds the site won't let them request, policy questions, a creator who is unresponsive after the user already messaged them, or a creator-side problem the platform must chase (e.g. a digital-only tier whose creator never uploaded the file). NOT for ordinary creator questions (use message_creator) and NOT for how-to questions the knowledge base answers. For anything about an order, verification is required and you must pass campaign and pledgeId.",
    input_schema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Short subject line summarizing the issue (max 200 chars)." },
        body: {
          type: "string",
          description:
            "Clear hand-off note: who the user is, what they're trying to do, what they're stuck on, what you already checked and ruled out, and any relevant URLs. For order issues quote the campaign, pledge id, reward and add-ons. Plain text.",
        },
        campaign: { type: "string", description: "Campaign slug, required whenever the issue concerns an order, reward, shipment or download." },
        pledgeId: { type: "string", description: "Pledge id, when the issue concerns a specific order." },
        contactEmail: { type: "string", description: "The email address support should reply to. Required when the user is not logged in and not verified; ask them for it before calling." },
        contactName: { type: "string", description: "The user's name, if they gave one." },
      },
      required: ["subject", "body"],
    },
  },
];

const SYSTEM_PROMPT = (kbContext: string, sessionContext: string) => `You are ICF Support — IndieCrowdfund's customer support agent. You answer questions from creators and backers on the platform. The user has already seen a hard-coded greeting from the chat widget ("Thank you for contacting ICF Support! I will be your buffer between our disgruntled and grumpy web developer!"), so do NOT greet them again. Jump straight to answering.

How to answer questions:
1. ALWAYS check the knowledge base below first. If the answer is there, give it directly and cite the relevant /handbook/page URL so the user can read more. Quote prices, fees, and policies verbatim from the KB — don't paraphrase numbers.
2. If the knowledge base partially covers the topic, answer what you know and acknowledge the gap.
3. If the knowledge base doesn't cover the question OR the user is reporting a problem, route it to the right place — this matters, the platform owner does not want creators' fulfillment questions in the platform inbox:
   - Something on the WEBSITE is broken (errors, buttons, payments failing, pages not loading) → submit_bug_report.
   - Anything about a specific campaign's rewards, shipping, delivery dates, tracking, files the creator hasn't uploaded, damaged/wrong items, survey contents → message_creator. The creator is the person who can actually answer.
   - Account access, account merges, platform billing disputes, policy, a creator who hasn't replied after being messaged, or a creator-side failure the platform must chase → email_support.
   After the tool call returns, tell the user it's been sent and what to expect.
4. Don't make up policies, fees, refund timelines, or feature behavior. If you'd be guessing, escalate via email_support.
   - Before submit_bug_report or email_support for a user who is not logged in and not verified, ask for the email address they want the reply at and pass it as contactEmail. Never file a report with no way to reach the person.
5. Don't promise specific resolution times — say "the team usually replies within 1–2 business days" if asked. Creators reply on their own schedule.
6. Don't ask the user for sensitive information (full card numbers, SSN, passwords). If they offer it, refuse and tell them never to send that to chat.

Identity — personal data needs a code:
7. Orders, downloads and email history are personal. Before you look any of it up or escalate an order issue, the user must verify: call send_verification_code (no arguments if they're logged in; otherwise ask for the email on their account and pass it), tell them to check that inbox, then call verify_code with the digits they type. The result of send_verification_code tells you exactly what to say; never confirm or deny that an email has an account. Once verified you'll see "VERIFIED" in the session context and can use lookup_my_orders / lookup_my_email_history.
8. If verification fails or they can't get the code, you can still answer general questions and campaign-level questions via lookup_campaign; you just can't show or send anything personal.

Orders, rewards, shipments and digital downloads — be thorough, the data is a tool call away:
9. Never escalate an order question without knowing WHICH campaign it is about. Call lookup_my_orders first. If the user hasn't named the campaign and more than one pledge could fit, ask which campaign; if only one fits, name it and confirm.
10. Not every pledge includes a digital item. Before treating a digital download as "missing", read the pledge: does the reward tier or an add-on include a digital file? lookup_my_orders says, per campaign, which digital files this pledge can download, which exist but are NOT included in their tier or add-ons, and whether the creator has uploaded any files at all.
   - Tier/add-ons don't include a digital file → tell the user plainly that their pledge didn't include one (name the tier) and that the digital version is a separate add-on or tier on that campaign if files exist. Do NOT escalate; nothing is broken.
   - Pledge qualifies and the file is listed as available → it should be at /dashboard/backer?tab=downloads; walk them through it, and only file submit_bug_report (category REWARDS) if they confirm it isn't there.
   - Pledge includes a digital-only tier but the creator has uploaded nothing → tell the user the creator hasn't released the file yet, then message_creator asking when it will be uploaded. Only if the creator has already been messaged and hasn't replied, email_support so the platform can chase them.
   - Files still uploading → the creator is mid-upload; check back later.
11. Every escalation about an order MUST carry: campaign slug, pledge id, the reward and add-ons, pledge and fulfillment status, and exactly what you checked. The tools require the slug and pledge id; a request without them is bounced back to you.

Style:
- Match the user's tone but stay professional. Light humor matches the greeting line ("buffer between you and the disgruntled web developer") — lean into it ONCE per session if natural, don't beat the joke.
- Short paragraphs, no markdown headings, no bullet-point salads. Conversational.
- Address creators and backers differently when relevant. Most users are backers.

Knowledge base (top matches for this user's question):
${kbContext}

${sessionContext}`;

// Anthropic SDK input/output type aliases — used to keep
// apiMessages typed without leaking the SDK's deeply-nested
// ContentBlockParam union all over the file.
type AssistantContent = Anthropic.Messages.ContentBlock[];
type UserContent = Anthropic.Messages.ToolResultBlockParam[];

interface ToolExecutionRecord {
  name: string;
  input: Record<string, unknown>;
  result: { ok: true; summary: string } | { ok: false; error: string };
}

interface ChatIdentity {
  sessionUserId: string | null;
  sessionEmail: string | null;
  sessionName: string | null;
  verified: VerifiedIdentity | null;
  chatToken?: string;
  ip: string;
  pageUrl?: string;
}

/** The Agent API registry, called as the support bot. Read scope only. */
function agentCtx(identity: ChatIdentity) {
  return { key: { id: "internal:support-chat", name: `support-chat${identity.verified ? `:${identity.verified.email}` : ""}`, scopes: ["agent:read"], ip: identity.ip } };
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit per IP — chat is unauthenticated for visitors and we
    // don't want a runaway client hammering Claude.
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const rl = await rateLimiter.check("support-chat", ip, { limit: 30, windowSec: 60 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "You're sending messages too fast. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    const session = await auth();
    const userId = session?.user?.id || null;

    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid chat payload" }, { status: 400 });
    }
    const { messages, pageUrl, chatToken } = parsed.data;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      return NextResponse.json({ error: "No user message in payload" }, { status: 400 });
    }

    // Search KB on the latest user message + a snippet of the prior
    // message for some conversational context. Returns top 8 entries.
    const searchQuery = `${lastUser.content} ${messages[messages.length - 2]?.content || ""}`;
    const kbHits = searchKnowledgeBase(searchQuery, 8);
    const kbContext = formatKbContext(kbHits);

    const [sessionUser, verified] = await Promise.all([
      userId ? db.user.findFirst({ where: { id: userId, deletedAt: null }, select: { email: true, name: true } }) : Promise.resolve(null),
      getVerifiedIdentity(chatToken),
    ]);
    const identity: ChatIdentity = {
      sessionUserId: userId,
      sessionEmail: sessionUser?.email ?? null,
      sessionName: sessionUser?.name ?? null,
      verified,
      chatToken,
      ip,
      pageUrl,
    };

    const sessionContext = [
      pageUrl ? `User is currently on: ${pageUrl}` : null,
      identity.sessionEmail ? `Logged-in user: ${identity.sessionName || "(no name)"} <${identity.sessionEmail}>` : "User is not logged in.",
      identity.verified
        ? `VERIFIED: this chat has proven ownership of ${identity.verified.email}${identity.verified.name ? ` (${identity.verified.name})` : ""}. lookup_my_orders and lookup_my_email_history are available.`
        : "NOT VERIFIED: no personal data may be shown or escalated until send_verification_code + verify_code succeed.",
      chatToken ? null : "The chat widget sent no session token; verification is unavailable in this session — tell the user to reload the page if they need account help.",
    ]
      .filter(Boolean)
      .join("\n");

    const anthropic = await getAnthropic();
    const toolExecutions: ToolExecutionRecord[] = [];

    // Convert client messages to Anthropic shape.
    const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Tool-use loop. Claude may call a tool, we execute, append the
    // result, and call again. Cap iterations so a confused model can't
    // spin.
    let finalText = "";
    for (let i = 0; i < 6; i++) {
      const resp = await anthropic.messages.create({
        // Sonnet: strong enough for KB grounding + sensible
        // escalation decisions, fast enough to feel responsive in a
        // chat widget.
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: SYSTEM_PROMPT(kbContext, sessionContext),
        tools: TOOLS,
        messages: apiMessages,
      });

      const textParts = resp.content.filter((c) => c.type === "text");
      finalText = textParts.map((c) => (c.type === "text" ? c.text : "")).join("\n").trim();
      const toolUses = resp.content.filter((c) => c.type === "tool_use");

      if (resp.stop_reason !== "tool_use" || toolUses.length === 0) {
        break;
      }

      // Append assistant turn (text + tool_use) verbatim so Claude sees
      // its own tool call in history. The SDK's output ContentBlock[]
      // (text + tool_use shapes) is structurally compatible with the
      // input ContentBlockParam[] union (text + tool_use shapes), so
      // we can pass it through with a minimal cast rather than
      // reconstructing every block.
      apiMessages.push({ role: "assistant", content: resp.content as AssistantContent });

      // Execute each tool call and collect results.
      // Anthropic's union requires `tool_use_id` to be a non-undefined
      // string per block.
      const toolResults: UserContent = [];
      for (const tu of toolUses) {
        if (tu.type !== "tool_use") continue;
        const input = tu.input as Record<string, unknown>;
        try {
          const summary = await executeTool(tu.name, input, identity, messages);
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: summary });
          toolExecutions.push({ name: tu.name, input, result: { ok: true, summary } });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log.error({ err: msg, tool: tu.name }, "support tool execution failed");
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: `Tool execution failed: ${msg}` });
          toolExecutions.push({ name: tu.name, input, result: { ok: false, error: msg } });
        }
      }

      apiMessages.push({ role: "user", content: toolResults });

      // verify_code can flip the identity mid-turn; refresh it so later
      // tool calls in the same loop see it.
      if (toolUses.some((t) => t.type === "tool_use" && t.name === "verify_code") && !identity.verified) {
        identity.verified = await getVerifiedIdentity(chatToken);
      }
    }

    if (!finalText) {
      finalText =
        "I'm having trouble responding right now. Please email support@indiecrowdfund.com and a human will follow up.";
    }

    return NextResponse.json({
      reply: finalText,
      toolsExecuted: toolExecutions.map((t) => ({ name: t.name, ok: t.result.ok })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, stack: err instanceof Error ? err.stack : undefined }, "support chat error");
    // The bot failed every request for weeks on a revoked API key and the
    // only trace was a line in pm2's error log. Once an hour, tell a human.
    await alertAdmins({
      title: "Support chat bot is failing",
      message: `The support chat returned an error to a visitor:\n\n${message.slice(0, 400)}\n\nIf this mentions an API key, update it under Admin → Settings → AI. Visitors are being told to email support@indiecrowdfund.com in the meantime.`,
      actionUrl: "/admin/settings",
      email: true,
      throttleKey: "support-chat-failing",
      throttleMinutes: 60,
    });
    return NextResponse.json(
      {
        error:
          "Our support assistant is unavailable right now. Email support@indiecrowdfund.com and a person will reply — include your account email and the campaign name.",
      },
      { status: 500 }
    );
  }
}

// ============== Tool dispatch ==============

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  identity: ChatIdentity,
  transcript: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  switch (name) {
    case "send_verification_code":
      return executeSendCode(input, identity);
    case "verify_code":
      return executeVerifyCode(input, identity);
    case "lookup_my_orders":
      return executeLookupOrders(identity);
    case "lookup_my_email_history":
      return executeLookupEmailHistory(identity);
    case "lookup_campaign":
      return executeLookupCampaign(input, identity);
    case "submit_bug_report":
      return executeSubmitBugReport(input, identity);
    case "message_creator":
      return executeMessageCreator(input, identity);
    case "email_support":
      return executeEmailSupport(input, identity, transcript);
    default:
      return `Unknown tool: ${name}`;
  }
}

const NEEDS_VERIFICATION = "Not allowed: the user has not verified their identity in this chat. Call send_verification_code, have them enter the code, then verify_code.";

async function executeSendCode(input: Record<string, unknown>, identity: ChatIdentity): Promise<string> {
  if (!identity.chatToken) return "Cannot send a code: this chat session has no token. Ask the user to reload the page and try again.";
  const rl = await rateLimiter.check("support-verify-send", identity.ip, { limit: 6, windowSec: 3600 });
  if (!rl.allowed) return "Too many codes requested from this connection. Tell the user to try again in an hour or email support@indiecrowdfund.com.";
  const email = typeof input.email === "string" ? input.email : undefined;
  const res = await issueVerificationCode({ chatToken: identity.chatToken, email, sessionEmail: identity.sessionEmail, ip: identity.ip });
  if (res.ok) {
    return `Code sent to ${res.masked}. Tell the user to check that inbox (and spam) and type the 6-digit code here. It expires in 10 minutes.`;
  }
  switch (res.reason) {
    case "no_account":
      // Same wording whether or not the address exists: never confirm accounts.
      return "If that email has an IndieCrowdfund account, a code has been sent to it. Tell the user exactly that, ask them to check the inbox, and if nothing arrives ask whether they might have signed up with a different email.";
    case "rate_limited":
      return "That address has already received 3 codes in the last hour. Tell the user to use the most recent one or wait an hour.";
    case "invalid_email":
      return "No usable email. If the user is not logged in, ask for the email on their account and call again with it.";
    default:
      return "The code email could not be sent right now. Apologise and suggest emailing support@indiecrowdfund.com from the account address.";
  }
}

async function executeVerifyCode(input: Record<string, unknown>, identity: ChatIdentity): Promise<string> {
  if (!identity.chatToken) return "Cannot verify: this chat session has no token. Ask the user to reload the page.";
  const code = String(input.code ?? "");
  const res = await verifyCode({ chatToken: identity.chatToken, code });
  if (res.ok) {
    identity.verified = res.identity;
    return `Verified as ${res.identity.email}. You may now call lookup_my_orders and lookup_my_email_history, and escalate order issues.`;
  }
  switch (res.reason) {
    case "no_code":
      return "No code has been sent in this chat yet. Call send_verification_code first.";
    case "expired":
      return "That code expired. Call send_verification_code to send a fresh one.";
    case "too_many_attempts":
      return "Too many wrong attempts for this code. Call send_verification_code for a new one.";
    default:
      return "Wrong code. Ask the user to check the digits and try again.";
  }
}

async function loadOrders(identity: ChatIdentity): Promise<BackerPledgeSummary[]> {
  if (!identity.verified?.userId) return [];
  return getBackerSupportContext(identity.verified.userId, 10);
}

async function executeLookupOrders(identity: ChatIdentity): Promise<string> {
  if (!identity.verified) return NEEDS_VERIFICATION;
  if (!identity.verified.userId) return "This verified email has no account on record, so there are no orders to show.";
  const rows = await loadOrders(identity);
  log.info({ userId: identity.verified.userId, pledges: rows.length }, "Support bot looked up verified user's orders");
  return `Orders for ${identity.verified.email} (newest first):\n${formatBackerSupportContext(rows)}`;
}

async function executeLookupEmailHistory(identity: ChatIdentity): Promise<string> {
  if (!identity.verified) return NEEDS_VERIFICATION;
  const res = await runTool("user_email_history", { email: identity.verified.email, limit: 15 }, agentCtx(identity));
  if (!res.ok) return `Lookup failed: ${res.error}`;
  const r = res.result as {
    account: { emailVerified: boolean; unsubscribed: boolean } | null;
    blocklisted: unknown[];
    newsletter: { isActive: boolean } | null;
    emailLog: { type: string; subject: string | null; sentAt: Date; openedAt: Date | null }[];
    sentFolder: { subject: string; sentAt: Date | null; providerStatus: string; deliveredAt: string | null; bounceReason: string | null }[];
  };
  const lines = [
    `Account: ${r.account ? `${r.account.emailVerified ? "email verified" : "email NOT verified"}, ${r.account.unsubscribed ? "unsubscribed from all email" : "subscribed"}` : "no account"}`,
    `Blocklisted: ${r.blocklisted.length ? "YES" : "no"}; newsletter: ${r.newsletter ? (r.newsletter.isActive ? "active" : "inactive") : "not subscribed"}`,
    "Recent sends and the mail provider's verdict:",
    ...r.sentFolder.slice(0, 10).map((s) => `- ${s.sentAt ? new Date(s.sentAt).toISOString().slice(0, 16) : "?"} "${s.subject}" → ${s.providerStatus}${s.deliveredAt ? " (delivered)" : ""}${s.bounceReason ? ` reason: ${s.bounceReason}` : ""}`),
  ];
  return lines.join("\n");
}

async function executeLookupCampaign(input: Record<string, unknown>, identity: ChatIdentity): Promise<string> {
  const ref = String(input.campaign ?? "").trim();
  if (!ref) return "campaign is required.";
  let res = await runTool("get_project", { project: ref, timelineDays: 0 }, agentCtx(identity));
  if (!res.ok) {
    // Try as a title.
    const search = await runTool("list_projects", { search: ref, status: ["LIVE", "FUNDED", "FAILED", "CANCELLED", "PAUSED"], limit: 3 }, agentCtx(identity));
    const hits = search.ok ? (search.result as { projects: { slug: string; title: string }[] }).projects : [];
    if (hits.length === 1) res = await runTool("get_project", { project: hits[0].slug, timelineDays: 0 }, agentCtx(identity));
    else if (hits.length > 1) return `Several campaigns match "${ref}": ${hits.map((h) => `${h.title} (${h.slug})`).join("; ")}. Ask which one.`;
    else return `No campaign matches "${ref}".`;
  }
  if (!res.ok) return `Lookup failed: ${res.error}`;
  const p = res.result as {
    title: string; slug: string; status: string; url: string; goal: number; raised: number; backers: number; launchDate: Date | null; endDate: Date | null;
    creator: { name: string | null }; rewards: { title: string; price: number; shipping: string; estimatedDelivery: Date | null }[]; addons: { title: string; price: number; shipping: string }[];
  };
  return [
    `${p.title} (${p.slug}) — ${p.status}; ${p.url}`,
    `Creator: ${p.creator.name ?? "unknown"}; raised $${p.raised} of $${p.goal} from ${p.backers} backers; ends ${p.endDate ? new Date(p.endDate).toISOString().slice(0, 10) : "n/a"}`,
    `Tiers: ${p.rewards.map((r) => `${r.title} ($${r.price}, ${r.shipping === "NO_SHIPPING" ? "digital/no shipping" : "ships"}${r.estimatedDelivery ? `, est. ${new Date(r.estimatedDelivery).toISOString().slice(0, 7)}` : ""})`).join("; ") || "none"}`,
    `Add-ons: ${p.addons.map((a) => `${a.title} ($${a.price}, ${a.shipping === "NO_SHIPPING" ? "digital" : "ships"})`).join("; ") || "none"}`,
  ].join("\n");
}

// ============== Escalations ==============

async function executeSubmitBugReport(input: Record<string, unknown>, identity: ChatIdentity): Promise<string> {
  const title = String(input.title || "").slice(0, 200);
  const description = String(input.description || "").slice(0, 20000);
  const category = String(input.category || "OTHER");
  const severity = String(input.severity || "MEDIUM");

  if (!title || !description) {
    return "Bug report not submitted: missing title or description.";
  }

  const validCategories = ["UI_VISUAL", "FUNCTIONALITY", "PERFORMANCE", "SECURITY", "PAYMENT", "ACCOUNT", "PROJECT", "REWARDS", "OTHER"];
  const validSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const safeCategory = validCategories.includes(category) ? category : "OTHER";
  const safeSeverity = validSeverities.includes(severity) ? severity : "MEDIUM";

  // The report must carry a real address for the person who filed it: the
  // resolution email goes there. A report filed under a placeholder
  // (support-bot@…) sent the "your bug has been fixed" email to our own
  // inbox and the backer who reported it heard nothing.
  const contactEmail = typeof input.contactEmail === "string" ? input.contactEmail.trim().toLowerCase() : "";
  const email = identity.verified?.email || identity.sessionEmail || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) ? contactEmail : null);
  if (!email) {
    return "Bug report NOT submitted: no email address to send the resolution to. Ask the user for the email address they'd like updates at, then call submit_bug_report again with contactEmail.";
  }
  const name = identity.verified?.name || identity.sessionName || (typeof input.contactName === "string" ? input.contactName.trim().slice(0, 100) : "") || null;
  const reporterUserId = identity.verified?.userId || identity.sessionUserId;

  // Use the same model the /api/bug-reports endpoint persists to so
  // these reports show up alongside form-submitted ones in /admin.
  const created = await db.bugReport.create({
    data: {
      email,
      name: name || "(via support chatbot)",
      title,
      description: identity.pageUrl
        ? `${description}\n\n---\nSubmitted via ICF Support chatbot from page: ${identity.pageUrl}${identity.verified ? "\nIdentity verified by email code." : ""}`
        : `${description}\n\n---\nSubmitted via ICF Support chatbot${identity.verified ? "\nIdentity verified by email code." : ""}`,
      category: safeCategory as never,
      severity: safeSeverity as never,
      pageUrl: identity.pageUrl,
      ...(reporterUserId ? { userId: reporterUserId } : {}),
    },
    select: { id: true },
  });

  log.info({ bugReportId: created.id, userId: reporterUserId, category: safeCategory, severity: safeSeverity }, "Support bot filed bug report");
  return `Bug report filed successfully (id: ${created.id}). The team typically reviews bug reports within 1–2 business days.`;
}

async function executeMessageCreator(input: Record<string, unknown>, identity: ChatIdentity): Promise<string> {
  if (!identity.verified?.userId) return NEEDS_VERIFICATION;
  const slug = String(input.campaign ?? "").trim();
  const pledgeId = String(input.pledgeId ?? "").trim();
  const subject = String(input.subject ?? "").trim().slice(0, 120);
  const message = String(input.message ?? "").trim().slice(0, 8000);
  if (!slug || !pledgeId || !subject || !message) return "Not sent: campaign, pledgeId, subject and message are all required. Get the slug and pledge id from lookup_my_orders.";

  // The pledge must belong to the verified user and to that campaign; the
  // model cannot message a creator about someone else's order.
  const pledge = await db.pledge.findFirst({
    where: { id: pledgeId, userId: identity.verified.userId, deletedAt: null, project: { slug } },
    select: {
      id: true,
      amount: true,
      status: true,
      fulfillmentStatus: true,
      reward: { select: { title: true } },
      addons: { select: { quantity: true, addon: { select: { title: true } } } },
      project: { select: { id: true, title: true, slug: true, creatorId: true, creator: { select: { id: true, name: true, email: true, deletedAt: true } } } },
    },
  });
  if (!pledge) return `Not sent: no pledge ${pledgeId} by this user on campaign "${slug}". Re-check lookup_my_orders.`;
  if (!pledge.project.creator || pledge.project.creator.deletedAt) return "Not sent: this campaign's creator account is closed. Use email_support instead.";

  const rl = await rateLimiter.check("support-message-creator", identity.verified.userId, { limit: 5, windowSec: 3600 });
  if (!rl.allowed) return "Not sent: this user has already messaged creators 5 times in the last hour. Ask them to wait for replies.";

  const orderLine = `Order: ${pledge.reward?.title ?? "no reward tier"}${pledge.addons.length ? ` + ${pledge.addons.map((a: { quantity: number; addon: { title: string } }) => (a.quantity > 1 ? `${a.quantity}x ${a.addon.title}` : a.addon.title)).join(", ")}` : ""} — $${Number(pledge.amount).toFixed(2)}, pledge ${pledge.id}, ${pledge.status}, fulfillment ${pledge.fulfillmentStatus}.`;
  const content = `${message}\n\n—\n${orderLine}\nSent via ICF Support chat on behalf of ${identity.verified.name || identity.verified.email}; replies go to their IndieCrowdfund inbox.`;

  const created = await db.message.create({
    data: { projectId: pledge.project.id, senderId: identity.verified.userId, recipientId: pledge.project.creatorId, subject: `[${pledge.project.title}] ${subject}`, content },
    select: { id: true },
  });
  await notifyNewMessage({
    messageId: created.id,
    recipientId: pledge.project.creatorId,
    senderId: identity.verified.userId,
    senderName: identity.verified.name || identity.verified.email,
    projectId: pledge.project.id,
    subject: `[${pledge.project.title}] ${subject}`,
    content,
    sendEmailCopy: true,
    source: "direct",
  }).catch((err: unknown) => log.warn({ err: err instanceof Error ? err.message : String(err), messageId: created.id }, "creator notify failed"));

  log.info({ messageId: created.id, projectId: pledge.project.id, userId: identity.verified.userId }, "Support bot messaged creator");
  return `Message sent to ${pledge.project.creator.name || "the creator"} of "${pledge.project.title}" through their IndieCrowdfund inbox (they also get an email). Replies arrive in the user's own inbox at /dashboard/messages. Creators reply on their own schedule.`;
}

async function executeEmailSupport(
  input: Record<string, unknown>,
  identity: ChatIdentity,
  transcript: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const subject = String(input.subject || "Support chatbot escalation").slice(0, 200);
  const body = String(input.body || "").slice(0, 20000);
  const campaign = typeof input.campaign === "string" ? input.campaign.trim().slice(0, 200) : "";
  const pledgeId = typeof input.pledgeId === "string" ? input.pledgeId.trim().slice(0, 64) : "";

  if (!body) return "Email not sent: missing body.";

  // Order issues need a verified identity and a named campaign. An
  // escalation nobody can act on is worse than none.
  const looksLikeOrderIssue = /\b(pledge|reward|add-?on|digital|download|ship|deliver|order|tier|survey|refund|tracking)\b/i.test(`${subject} ${body}`);
  if (looksLikeOrderIssue) {
    if (!identity.verified) return `Email NOT sent: order issues require verification first. ${NEEDS_VERIFICATION}`;
    if (!campaign) return "Email NOT sent: this is about an order but no campaign was given. Identify which campaign from lookup_my_orders (ask the user if more than one fits), then call email_support again with the campaign slug in `campaign` and the pledge id in `pledgeId`, stating in the body what the pledge included and what you checked. If the question is really for the creator (shipping, files, reward contents), use message_creator instead.";
  }

  const contactEmail = typeof input.contactEmail === "string" ? input.contactEmail.trim().toLowerCase() : "";
  const email = identity.verified?.email || identity.sessionEmail || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) ? contactEmail : null);
  if (!email) {
    return "Email NOT sent: support would have no way to reply. Ask the user for the email address they want the reply at, then call email_support again with contactEmail.";
  }
  const name = identity.verified?.name || identity.sessionName || (typeof input.contactName === "string" ? input.contactName.trim().slice(0, 100) : "") || null;
  const orders = identity.verified?.userId ? formatBackerSupportContext(await loadOrders(identity)) : "";

  // Last 10 turns of the chat so support has context. Trimmed per turn
  // to avoid an unbounded email body if a user pastes huge amounts of
  // text.
  const recent = transcript.slice(-10).map((m) => {
    const who = m.role === "user" ? "User" : "Bot";
    const text = m.content.length > 1500 ? `${m.content.slice(0, 1500)}…` : m.content;
    return `[${who}] ${text}`;
  });

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 720px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #16a34a; margin: 0 0 12px;">ICF Support — chatbot escalation</h2>
        <p style="margin: 0 0 8px;"><strong>From:</strong> ${escapeHtml(name || "(unknown)")} ${email ? `&lt;${escapeHtml(email)}&gt;` : ""} ${identity.verified ? '<span style="color:#16a34a;">· identity verified by email code</span>' : '<span style="color:#b45309;">· NOT verified</span>'}</p>
        ${identity.pageUrl ? `<p style="margin: 0 0 8px;"><strong>Page:</strong> ${escapeHtml(identity.pageUrl)}</p>` : ""}
        ${campaign ? `<p style="margin: 0 0 8px;"><strong>Campaign:</strong> ${escapeHtml(campaign)}${pledgeId ? ` &nbsp;·&nbsp; <strong>Pledge:</strong> ${escapeHtml(pledgeId)}` : ""}</p>` : ""}
        <p style="margin: 16px 0 8px;"><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <div style="white-space: pre-wrap; padding: 12px; border-left: 3px solid #16a34a; background: #f0fdf4;">${escapeHtml(body)}</div>
        ${orders ? `<h3 style="margin: 20px 0 8px;">This backer's recent pledges</h3>
        <pre style="white-space: pre-wrap; padding: 12px; background: #f9fafb; border-radius: 6px; font-size: 12px; color: #374151;">${escapeHtml(orders)}</pre>` : ""}
        <h3 style="margin: 20px 0 8px;">Recent chat transcript</h3>
        <pre style="white-space: pre-wrap; padding: 12px; background: #f9fafb; border-radius: 6px; font-size: 12px; color: #374151;">${escapeHtml(recent.join("\n\n"))}</pre>
      </body>
    </html>
  `;

  await sendEmail({
    to: "support@indiecrowdfund.com",
    subject: `[ICF Support bot] ${subject}`,
    html,
    replyTo: email || undefined,
    skipUnsubscribeCheck: true,
  });

  log.info({ subject, userEmail: email, verified: !!identity.verified }, "Support bot emailed support team");
  return `Email sent to support@indiecrowdfund.com. The team typically replies within 1–2 business days${email ? ` to ${email}` : ""}.`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
