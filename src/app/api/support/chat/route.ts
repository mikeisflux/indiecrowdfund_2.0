import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { rateLimiter } from "@/lib/rate-limiter";
import { searchKnowledgeBase, formatKbContext } from "@/lib/support/knowledge-base";

const log = logger.child({ module: "support-chat" });

// Anthropic SDK is shared across the app — see src/lib/ai/anthropic.ts.
// Reusing its key-resolution logic here so the support bot picks up the
// same admin-managed API key as auto-tag, marketing-copy, etc.
async function getAnthropic(): Promise<Anthropic> {
  const settings = await db.platformSettings.findFirst({
    select: { anthropicApiKey: true },
  });
  const apiKey = settings?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Anthropic API key not configured. Set it in Admin Settings > AI.");
  }
  return new Anthropic({ apiKey });
}

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
});

// Claude tools (Anthropic's tool-use API). The model decides when to
// call these; we execute them server-side and feed results back so the
// model can compose a final reply that references "I've sent your
// report to Mike" / "Email sent to support@".
const TOOLS: Anthropic.Tool[] = [
  {
    name: "submit_bug_report",
    description:
      "File a bug report on behalf of the user. Use this when the user describes something broken on the site (a 500 error, a button that doesn't work, a missing feature, payment problem, etc.) AND the knowledge base does NOT cover the issue. The report goes to the platform's admin queue at /admin/bug-reports.",
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short one-sentence summary of the bug (max 200 chars). Written from the user's perspective.",
        },
        description: {
          type: "string",
          description:
            "Full description of the bug as the user described it. Include steps to reproduce, what they expected, and what actually happened, even if you have to infer some pieces. Plain text, no markdown.",
        },
        category: {
          type: "string",
          enum: ["UI_VISUAL", "FUNCTIONALITY", "PERFORMANCE", "SECURITY", "PAYMENT", "ACCOUNT", "PROJECT", "REWARDS", "OTHER"],
          description: "Best-fit category for the bug.",
        },
        severity: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
          description: "LOW for cosmetic, MEDIUM for annoying, HIGH for blocks the user, CRITICAL for payment / data loss / security.",
        },
      },
      required: ["title", "description", "category", "severity"],
    },
  },
  {
    name: "email_support",
    description:
      "Send a free-form email to the human support team at support@indiecrowdfund.com. Use this when the user has a question or feedback that doesn't fit the bug-report shape (general question, feature request, account issue requiring human review, billing dispute, etc.) AND the knowledge base does NOT cover it. Don't use this for ordinary how-to questions you can answer from the knowledge base.",
    input_schema: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "Short subject line summarizing the issue (max 200 chars).",
        },
        body: {
          type: "string",
          description:
            "Full message to send to support. Write it as a clear hand-off note: who the user is (if known), what they're trying to do, what they're stuck on, and any relevant URLs or context. Plain text.",
        },
      },
      required: ["subject", "body"],
    },
  },
];

const SYSTEM_PROMPT = (kbContext: string, sessionContext: string) => `You are ICF Support — IndieCrowdfund's customer support agent. You answer questions from creators and backers on the platform. The user has already seen a hard-coded greeting from the chat widget ("Thank you for contacting ICF Support! I will be your buffer between our disgruntled and grumpy web developer!"), so do NOT greet them again. Jump straight to answering.

How to answer questions:
1. ALWAYS check the knowledge base below first. If the answer is there, give it directly and cite the relevant /handbook/page URL so the user can read more. Quote prices, fees, and policies verbatim from the KB — don't paraphrase numbers.
2. If the knowledge base partially covers the topic, answer what you know and acknowledge the gap.
3. If the knowledge base doesn't cover the question OR the user is reporting something broken, decide:
   - Bug / something on the site is broken → call submit_bug_report.
   - General question, feedback, billing dispute, or anything that needs a human → call email_support.
   After the tool call returns, tell the user it's been sent and what to expect.
4. Don't make up policies, fees, refund timelines, or feature behavior. If you'd be guessing, escalate via email_support.
5. Don't promise specific resolution times — say "the team usually replies within 1–2 business days" if asked.
6. Don't ask the user for sensitive information (full card numbers, SSN, passwords). If they offer it, refuse and tell them never to send that to chat.

Style:
- Match the user's tone but stay professional. Light humor matches the greeting line ("buffer between you and the disgruntled web developer") — lean into it ONCE per session if natural, don't beat the joke.
- Short paragraphs, no markdown headings, no bullet-point salads. Conversational.
- Address creators and backers differently when relevant. Most users are backers.

Knowledge base (top-${"matches"} matches for this user's question):
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
    const { messages, pageUrl } = parsed.data;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      return NextResponse.json({ error: "No user message in payload" }, { status: 400 });
    }

    // Search KB on the latest user message + a snippet of the prior
    // message for some conversational context. Returns top 8 entries.
    const searchQuery = `${lastUser.content} ${messages[messages.length - 2]?.content || ""}`;
    const kbHits = searchKnowledgeBase(searchQuery, 8);
    const kbContext = formatKbContext(kbHits);

    // Pull the user's email + name if logged in so the bot can use it
    // when escalating without re-asking.
    let userInfo: { email: string | null; name: string | null } = { email: null, name: null };
    if (userId) {
      const u = await db.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { email: true, name: true },
      });
      if (u) userInfo = { email: u.email, name: u.name };
    }

    const sessionContext = [
      pageUrl ? `User is currently on: ${pageUrl}` : null,
      userInfo.email ? `Logged-in user: ${userInfo.name || "(no name)"} <${userInfo.email}>` : "User is not logged in.",
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
    // result, and ask Claude again until it returns a plain text reply.
    let finalText = "";
    for (let turn = 0; turn < 4; turn++) {
      const resp = await anthropic.messages.create({
        // claude-sonnet-4-6 is the right tier for customer support:
        // strong enough to handle nuanced bug categorization +
        // escalation decisions, fast enough to feel responsive in a
        // chat UI. Switch to claude-haiku-4-5-20251001 if cost
        // becomes an issue at higher chat volumes.
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: SYSTEM_PROMPT(kbContext, sessionContext),
        tools: TOOLS,
        messages: apiMessages,
      });

      // Collect any text the model emitted alongside the tool calls.
      const textBlocks = resp.content.filter((c) => c.type === "text");
      const toolUses = resp.content.filter((c) => c.type === "tool_use");

      if (toolUses.length === 0) {
        finalText = textBlocks.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
        break;
      }

      // Append assistant turn (text + tool_use) verbatim so Claude sees
      // its own decision when we feed back the tool_result. The SDK's
      // response ContentBlock[] is structurally compatible with the
      // input ContentBlockParam[] union (text + tool_use shapes), so
      // we cast through unknown rather than rebuilding each block.
      apiMessages.push({
        role: "assistant",
        content: resp.content as unknown as AssistantContent,
      });

      // Execute each tool call. Build typed tool_result blocks rather
      // than the loosely-typed scratch shape we used initially —
      // Anthropic's union requires `tool_use_id` to be a non-undefined
      // string, which doesn't match the optional fields we'd otherwise
      // need for assistant blocks.
      const toolResults: UserContent = [];
      for (const tu of toolUses) {
        if (tu.type !== "tool_use") continue;
        const input = tu.input as Record<string, unknown>;
        try {
          if (tu.name === "submit_bug_report") {
            const summary = await executeSubmitBugReport(input, {
              userId,
              userEmail: userInfo.email,
              userName: userInfo.name,
              pageUrl,
            });
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: summary,
            });
            toolExecutions.push({ name: tu.name, input, result: { ok: true, summary } });
          } else if (tu.name === "email_support") {
            const summary = await executeEmailSupport(input, {
              userEmail: userInfo.email,
              userName: userInfo.name,
              pageUrl,
              recentTranscript: messages,
            });
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: summary,
            });
            toolExecutions.push({ name: tu.name, input, result: { ok: true, summary } });
          } else {
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: `Unknown tool: ${tu.name}`,
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log.error({ err: msg, tool: tu.name }, "support tool execution failed");
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: `Tool execution failed: ${msg}`,
          });
          toolExecutions.push({
            name: tu.name,
            input,
            result: { ok: false, error: msg },
          });
        }
      }

      apiMessages.push({ role: "user", content: toolResults });
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
    log.error(
      { err: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined },
      "support chat error"
    );
    return NextResponse.json(
      { error: "Support chat is having trouble. Please try again or email support@indiecrowdfund.com." },
      { status: 500 }
    );
  }
}

// ============== Tool implementations ==============

async function executeSubmitBugReport(
  input: Record<string, unknown>,
  ctx: { userId: string | null; userEmail: string | null; userName: string | null; pageUrl?: string }
): Promise<string> {
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

  // Use the same model the /api/bug-reports endpoint persists to so
  // these reports show up alongside form-submitted ones in /admin.
  const created = await db.bugReport.create({
    data: {
      email: ctx.userEmail || "support-bot@indiecrowdfund.com",
      name: ctx.userName || "(via support chatbot)",
      title,
      description: ctx.pageUrl
        ? `${description}\n\n---\nSubmitted via ICF Support chatbot from page: ${ctx.pageUrl}`
        : `${description}\n\n---\nSubmitted via ICF Support chatbot`,
      category: safeCategory as never,
      severity: safeSeverity as never,
      pageUrl: ctx.pageUrl,
      ...(ctx.userId ? { userId: ctx.userId } : {}),
    },
    select: { id: true },
  });

  log.info(
    { bugReportId: created.id, userId: ctx.userId, category: safeCategory, severity: safeSeverity },
    "Support bot filed bug report"
  );

  return `Bug report filed successfully (id: ${created.id}). The team typically reviews bug reports within 1–2 business days.`;
}

async function executeEmailSupport(
  input: Record<string, unknown>,
  ctx: {
    userEmail: string | null;
    userName: string | null;
    pageUrl?: string;
    recentTranscript: { role: "user" | "assistant"; content: string }[];
  }
): Promise<string> {
  const subject = String(input.subject || "Support chatbot escalation").slice(0, 200);
  const body = String(input.body || "").slice(0, 20000);

  if (!body) {
    return "Email not sent: missing body.";
  }

  // Last 10 turns of the chat so support has context. Trimmed per turn
  // to avoid an unbounded email body if a user pastes huge amounts of
  // text.
  const recent = ctx.recentTranscript.slice(-10).map((m) => {
    const who = m.role === "user" ? "User" : "Bot";
    const text = m.content.length > 1500 ? `${m.content.slice(0, 1500)}…` : m.content;
    return `[${who}] ${text}`;
  });

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 720px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #16a34a; margin: 0 0 12px;">ICF Support — chatbot escalation</h2>
        <p style="margin: 0 0 8px;"><strong>From:</strong> ${escapeHtml(ctx.userName || "(unknown)")} ${ctx.userEmail ? `&lt;${escapeHtml(ctx.userEmail)}&gt;` : ""}</p>
        ${ctx.pageUrl ? `<p style="margin: 0 0 8px;"><strong>Page:</strong> ${escapeHtml(ctx.pageUrl)}</p>` : ""}
        <p style="margin: 16px 0 8px;"><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <div style="white-space: pre-wrap; padding: 12px; border-left: 3px solid #16a34a; background: #f0fdf4;">${escapeHtml(body)}</div>
        <h3 style="margin: 20px 0 8px;">Recent chat transcript</h3>
        <pre style="white-space: pre-wrap; padding: 12px; background: #f9fafb; border-radius: 6px; font-size: 12px; color: #374151;">${escapeHtml(recent.join("\n\n"))}</pre>
      </body>
    </html>
  `;

  await sendEmail({
    to: "support@indiecrowdfund.com",
    subject: `[ICF Support bot] ${subject}`,
    html,
    replyTo: ctx.userEmail || undefined,
    skipUnsubscribeCheck: true,
  });

  log.info({ subject, userEmail: ctx.userEmail }, "Support bot emailed support team");

  return `Email sent to support@indiecrowdfund.com. The team typically replies within 1–2 business days${ctx.userEmail ? ` to ${ctx.userEmail}` : ""}.`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
