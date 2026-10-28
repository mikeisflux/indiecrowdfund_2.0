import { db } from "@/lib/db";
import { getSecret } from "@/lib/vault";
import { getAnthropic } from "@/lib/ai/anthropic-client";

/** The model the support chat and the JSON helpers run on. */
export const CLAUDE_TEST_MODEL = "claude-sonnet-4-6";

export interface ClaudeConnectionResult {
  ok: boolean;
  checkedAt: string;
  model: string;
  /** Where the key came from: the admin setting, or the server environment. */
  keySource: "settings" | "env" | "none";
  /** Last four characters of the key in use, for telling two keys apart. Never the key. */
  keyHint: string | null;
  latencyMs: number | null;
  reply: string | null;
  error: string | null;
  /** What to do about it, in plain words. */
  advice: string | null;
}

/**
 * Prove the Claude connection end to end: resolve the key the way every
 * feature does, send one tiny real message on the support chat's model,
 * and report what came back and how long it took. A key that lists
 * models but cannot be used for messages, or a model that no longer
 * exists, fails here and passed the old "list models" check.
 */
export async function testClaudeConnection(): Promise<ClaudeConnectionResult> {
  const checkedAt = new Date().toISOString();
  const settings = await db.platformSettings.findFirst({ select: { anthropicApiKey: true } });
  const fromSettings = getSecret("anthropic_api_key", settings?.anthropicApiKey);
  const key = fromSettings || process.env.ANTHROPIC_API_KEY || null;
  const keySource: ClaudeConnectionResult["keySource"] = fromSettings ? "settings" : process.env.ANTHROPIC_API_KEY ? "env" : "none";
  const keyHint = key ? `…${key.slice(-4)}` : null;
  const base = { checkedAt, model: CLAUDE_TEST_MODEL, keySource, keyHint };

  if (!key) {
    return { ...base, ok: false, latencyMs: null, reply: null, error: "No Anthropic API key is configured", advice: "Enter the key under Admin → Settings → AI and save." };
  }
  if (!key.startsWith("sk-ant-")) {
    return {
      ...base,
      ok: false,
      latencyMs: null,
      reply: null,
      error: "The stored key does not look like an Anthropic key",
      advice: "The saved value could not be decrypted into a real key. Re-enter it under Admin → Settings → AI and save.",
    };
  }

  const started = Date.now();
  try {
    const anthropic = await getAnthropic();
    const resp = await anthropic.messages.create({
      model: CLAUDE_TEST_MODEL,
      max_tokens: 20,
      messages: [{ role: "user", content: "Reply with the single word PONG and nothing else." }],
    });
    const latencyMs = Date.now() - started;
    const text = resp.content
      .filter((c) => c.type === "text")
      .map((c) => (c.type === "text" ? c.text : ""))
      .join(" ")
      .trim();
    return { ...base, ok: true, latencyMs, reply: text.slice(0, 80) || "(empty reply)", error: null, advice: null };
  } catch (e) {
    const latencyMs = Date.now() - started;
    const status = (e as { status?: number })?.status;
    const msg = e instanceof Error ? e.message : String(e);
    let advice: string;
    if (status === 401) advice = "Anthropic rejected the key. Generate a new one at console.anthropic.com, paste it under Admin → Settings → AI and save.";
    else if (status === 403) advice = "The key is valid but not allowed to use this model or organisation. Check the key's permissions at console.anthropic.com.";
    else if (status === 404) advice = `Model ${CLAUDE_TEST_MODEL} was not found for this key. The model name in the code needs updating.`;
    else if (status === 429) advice = "Rate limited or out of credit. Check usage and billing at console.anthropic.com.";
    else if (status && status >= 500) advice = "Anthropic is having trouble. Try again in a few minutes.";
    else advice = "The server could not reach Anthropic. Check outbound network access from the server.";
    return { ...base, ok: false, latencyMs, reply: null, error: `${status ? `HTTP ${status}: ` : ""}${msg.slice(0, 200)}`, advice };
  }
}
