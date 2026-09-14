import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, ArrowLeft, ChevronDown, LifeBuoy, Sparkles } from "lucide-react";
import { apiRequest } from "../../lib/api/http";
import { LogoMark } from "../brand/Logo";

/**
 * Ported from the real web app's components/chat/chat-widget.tsx — a floating
 * self-serve support chat, backed by an anonymous per-device conversation
 * token (not the logged-in user's session), so it works identically for a
 * logged-out visitor and a signed-in company user. Talks to the real backend's
 * /api/chat/* and /api/support/* routes via the same apiRequest bridge used
 * everywhere else; realtime push (Supabase broadcast) is not wired here, so
 * this relies purely on the same polling cadence the real widget uses as its
 * own fallback (4s while open, 25s in the background).
 */

type ChatMessage = { id: string; sender_type: "visitor" | "super_admin"; body: string; created_at: string };
type KbEntry = { id: string; category: string; q: string; a: string };
type AskResult = { type: "answer"; kbId: string; question: string; answer: string } | { type: "escalated"; message: string };

const TOKEN_KEY = "nerz_chat_token";
const NAME_KEY = "nerz_chat_name";
const SEEN_KEY = "nerz_chat_last_seen";

const readLS = (k: string) => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const writeLS = (k: string, v: string) => {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"help" | "chat">("help");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);
  const convoIdRef = useRef<string | null>(null);
  const lastAtRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    setName(readLS(NAME_KEY) || "");
  }, []);

  const applyMessages = useCallback((incoming: ChatMessage[], replace = false) => {
    if (!incoming.length && !replace) return;
    setMessages((prev) => {
      const base = replace ? [] : prev;
      const seen = new Set(base.map((m) => m.id));
      const merged = [...base, ...incoming.filter((m) => m.id && !seen.has(m.id))];
      merged.sort((a, b) => a.created_at.localeCompare(b.created_at));
      if (merged.length) lastAtRef.current = merged[merged.length - 1].created_at;
      return merged;
    });
  }, []);

  const init = useCallback(async () => {
    if (convoIdRef.current) return true;
    try {
      const data = await apiRequest<{ conversation: { id: string; token: string }; messages: ChatMessage[] }>(
        "POST",
        "/api/chat/session",
        { token: readLS(TOKEN_KEY) || undefined, name: readLS(NAME_KEY) || undefined },
      );
      tokenRef.current = data.conversation.token;
      convoIdRef.current = data.conversation.id;
      writeLS(TOKEN_KEY, data.conversation.token);
      applyMessages(data.messages || [], true);
      setError(null);
      return true;
    } catch {
      setError("Chat is unavailable right now. Please try again shortly.");
      return false;
    }
  }, [applyMessages]);

  const poll = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    try {
      const qs = new URLSearchParams({ token, ...(lastAtRef.current ? { after: lastAtRef.current } : {}) });
      const data = await apiRequest<{ messages: ChatMessage[] }>("GET", `/api/chat/messages?${qs.toString()}`);
      const fresh = data.messages || [];
      if (fresh.length) {
        applyMessages(fresh);
        if (!openRef.current) {
          const adminNew = fresh.filter((m) => m.sender_type === "super_admin").length;
          if (adminNew) setUnread((n) => n + adminNew);
        }
      }
    } catch {
      /* ignore */
    }
  }, [applyMessages]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (open && view === "chat") {
        const okInit = await init();
        if (okInit && !cancelled) {
          setUnread(0);
          if (lastAtRef.current) writeLS(SEEN_KEY, lastAtRef.current);
        }
      }
    };
    run();
    const base = open ? 4000 : 25000;
    const id = setInterval(() => {
      if (cancelled || !(open || tokenRef.current)) return;
      poll();
    }, base);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [open, view, init, poll]);

  useEffect(() => {
    const existing = readLS(TOKEN_KEY);
    if (!existing) return;
    tokenRef.current = existing;
    lastAtRef.current = readLS(SEEN_KEY);
    init().then((okInit) => {
      if (!okInit) return;
      const seen = readLS(SEEN_KEY);
      setMessages((prev) => {
        const real = prev.filter((m) => m.id && !m.id.startsWith("tmp-"));
        if (real.length) setView("chat");
        const adminUnseen = real.filter((m) => m.sender_type === "super_admin" && (!seen || m.created_at > seen)).length;
        if (adminUnseen) setUnread(adminUnseen);
        return prev;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (open && view === "chat" && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, view]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    const okInit = await init();
    const token = tokenRef.current;
    if (!okInit || !token) return;
    setSending(true);
    setDraft("");
    if (name && name !== readLS(NAME_KEY)) writeLS(NAME_KEY, name);
    const optimistic: ChatMessage = { id: `tmp-${Date.now()}`, sender_type: "visitor", body: text, created_at: new Date().toISOString() };
    applyMessages([optimistic]);
    try {
      const data = await apiRequest<{ message: ChatMessage }>("POST", "/api/chat/messages", { token, body: text });
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      applyMessages([data.message]);
      setError(null);
    } catch {
      setError("Message failed to send. It will retry when you're back online.");
    } finally {
      setSending(false);
    }
  };

  const goToChat = async () => {
    setView("chat");
    await init();
    setUnread(0);
  };

  const needsName = !readLS(NAME_KEY) && !messages.some((m) => m.sender_type === "visitor");

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[540px] max-h-[calc(100vh-2rem)] w-[92vw] max-w-[380px] flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-2xl">
          <header className="flex items-center justify-between bg-ink px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              {view === "chat" && messages.length > 0 && (
                <button onClick={() => setView("help")} aria-label="Back to help" className="rounded-md p-1 text-white/80 transition hover:bg-white/10 hover:text-white">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div className="h-7 w-7 overflow-hidden rounded-lg">
                <LogoMark size={28} />
              </div>
              <div>
                <p className="text-sm font-semibold">{view === "help" ? "9nerz Help" : "Chat with the 9nerz team"}</p>
                <p className="text-[11px] text-white/70">{view === "help" ? "Answers to common questions" : "Goes straight to our team"}</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="rounded-md p-1 text-white/80 transition hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </header>

          {view === "help" ? (
            <HelpView onTalkToTeam={goToChat} />
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-background px-3 py-3">
                {messages.length === 0 && (
                  <p className="mx-auto mt-6 max-w-[240px] text-center text-xs text-muted-foreground">Send us a message and we&apos;ll get back to you here.</p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender_type === "visitor" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                        m.sender_type === "visitor" ? "rounded-br-sm bg-ink text-white" : "rounded-bl-sm border border-hairline bg-white text-ink"
                      }`}
                    >
                      {m.body}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-hairline bg-white p-2">
                {error && <p className="mb-2 px-1 text-[11px] text-red-500">{error}</p>}
                {needsName && (
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name (optional)"
                    className="mb-2 w-full rounded-lg border border-hairline px-3 py-2 text-sm outline-none focus:border-ink"
                  />
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={1}
                    placeholder="Type a message…"
                    className="max-h-28 flex-1 resize-none rounded-lg border border-hairline px-3 py-2 text-sm outline-none focus:border-ink"
                  />
                  <button
                    onClick={send}
                    disabled={sending || !draft.trim()}
                    aria-label="Send message"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber text-ink transition hover:brightness-95 disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : "Open chat"}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-xl transition hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber px-1 text-[11px] font-bold text-ink">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </div>
  );
}

function HelpView({ onTalkToTeam }: { onTalkToTeam: () => void }) {
  const [kb, setKb] = useState<KbEntry[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);

  useEffect(() => {
    apiRequest<{ entries: KbEntry[] }>("GET", "/api/support/kb")
      .then((data) => setKb(data.entries || []))
      .catch(() => {});
  }, []);

  const ask = async () => {
    const text = q.trim();
    if (!text || asking) return;
    setAsking(true);
    setResult(null);
    try {
      const data = await apiRequest<AskResult>("POST", "/api/support/ask", { question: text, token: readLS(TOKEN_KEY) || undefined });
      setResult(data);
      setQ("");
    } catch {
      setResult({ type: "escalated", message: "Network error. Please talk to the team below." });
    } finally {
      setAsking(false);
    }
  };

  const categories = Array.from(new Set(kb.map((e) => e.category)));

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <div className="rounded-xl border border-hairline bg-white p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink">
            <Sparkles className="h-3.5 w-3.5 text-amber" /> Ask a question
          </p>
          <div className="flex items-end gap-2">
            <textarea
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask();
                }
              }}
              rows={1}
              placeholder="e.g. How do routing rules work?"
              className="max-h-24 flex-1 resize-none rounded-lg border border-hairline px-3 py-2 text-sm outline-none focus:border-ink"
            />
            <button
              onClick={ask}
              disabled={asking || !q.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink text-white transition hover:brightness-110 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          {result && (
            <div className="mt-2 rounded-lg border border-hairline bg-[#f9fafb] p-2.5 text-sm text-ink">
              {result.type === "answer" ? (
                <>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">{result.question}</p>
                  <p className="whitespace-pre-wrap">{result.answer}</p>
                  <button onClick={onTalkToTeam} className="mt-2 text-xs font-medium text-teal hover:underline">
                    Still need help? Talk to the team →
                  </button>
                </>
              ) : (
                <>
                  <p className="whitespace-pre-wrap">{result.message}</p>
                  <button onClick={onTalkToTeam} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110">
                    <LifeBuoy className="h-3.5 w-3.5" /> Continue with the team
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {categories.map((cat) => (
          <div key={cat}>
            <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{cat}</p>
            <div className="overflow-hidden rounded-xl border border-hairline bg-white">
              {kb
                .filter((e) => e.category === cat)
                .map((e) => (
                  <div key={e.id} className="border-b border-hairline last:border-0">
                    <button
                      onClick={() => setOpenId(openId === e.id ? null : e.id)}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink hover:bg-background"
                    >
                      <span className="min-w-0 flex-1">{e.q}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${openId === e.id ? "rotate-180" : ""}`} />
                    </button>
                    {openId === e.id && <p className="whitespace-pre-wrap px-3 pb-3 text-sm text-muted-foreground">{e.a}</p>}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-hairline bg-white p-2.5">
        <button
          onClick={onTalkToTeam}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-ink px-3 py-2 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white"
        >
          <MessageCircle className="h-4 w-4" /> Talk to the 9nerz team
        </button>
      </div>
    </div>
  );
}
