"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Send, Loader2, Bot, User as UserIcon } from "lucide-react";
import { apiFetch } from "@/lib/fetch-utils";
import { cn } from "@/lib/utils";

// Floating support chat widget — bottom-right corner of every page.
//
// Closed state: a small circular button. Open state: a chat panel.
// Greeting is rendered client-side (instant, no API call) so users see
// the welcome line the moment they click. After their first real
// message we POST the conversation to /api/support/chat which loops
// through Claude with the knowledge base + tool-use for escalation
// (submit_bug_report / email_support).

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const GREETING =
  "Thank you for contacting ICF Support! I will be your buffer between our disgruntled and grumpy web developer!\n\nWhat can I help you with?";

export function SupportChatWidget() {
  // Hide on admin routes — admins have other tools and don't need a
  // customer-facing chatbot popping up over their dashboards.
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return <SupportChatWidgetInner />;
}

function SupportChatWidgetInner() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // Focus the input when the panel opens.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    setError(null);

    try {
      // Strip the synthetic GREETING off before sending so the AI
      // doesn't see it in history. The greeting is a UI affordance,
      // not a real assistant turn.
      const apiMessages = next.filter(
        (m, i) => !(i === 0 && m.role === "assistant" && m.content === GREETING)
      );

      const res = await apiFetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || `Chat error (HTTP ${res.status})`);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "" }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach support chat");
    } finally {
      setSending(false);
    }
  }, [input, messages, sending]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <>
      {/* Closed state — circular button */}
      {!open && (
        <button
          type="button"
          aria-label="Open ICF Support chat"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 transition-all hover:scale-105 flex items-center justify-center"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="sr-only">Open support chat</span>
        </button>
      )}

      {/* Open state — chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="ICF Support chat"
          className="fixed bottom-5 right-5 z-50 w-[min(380px,calc(100vw-2.5rem))] h-[min(560px,calc(100vh-2.5rem))] bg-background border rounded-lg shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-emerald-600 text-white">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <div>
                <p className="text-sm font-semibold leading-none">ICF Support</p>
                <p className="text-[10px] opacity-90 mt-0.5">AI assistant · escalates to a human if needed</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close support chat"
              onClick={() => setOpen(false)}
              className="rounded-md hover:bg-white/15 p-1.5 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-muted/30">
            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} />
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Thinking…</span>
              </div>
            )}
            {error && (
              <div className="text-xs text-red-600 dark:text-red-400 p-2 rounded border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
                {error}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t p-3 bg-background">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask a question or describe a problem…"
                rows={1}
                disabled={sending}
                className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 max-h-32"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={!input.trim() || sending}
                aria-label="Send message"
                className={cn(
                  "h-9 w-9 rounded-md flex items-center justify-center shrink-0",
                  "bg-emerald-600 text-white hover:bg-emerald-700",
                  "disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                )}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Replies are AI-generated. The bot can file bug reports and email
              <span className="font-mono"> support@indiecrowdfund.com</span> on your behalf.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-7 w-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words",
          isUser
            ? "bg-emerald-600 text-white rounded-br-none"
            : "bg-background border rounded-bl-none"
        )}
      >
        {content}
      </div>
      {isUser && (
        <div className="h-7 w-7 rounded-full bg-zinc-300 dark:bg-zinc-700 flex items-center justify-center shrink-0">
          <UserIcon className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
