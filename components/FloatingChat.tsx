"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

/* ─── Typing dots animation ─── */
function TypingDots() {
  return (
    <>
      <style>{`
        @keyframes dotBounce {
          0%,80%,100% { transform: translateY(0); opacity: 0.3; }
          40%          { transform: translateY(-4px); opacity: 1; }
        }
        .dot1 { animation: dotBounce 1.2s ease infinite 0s;   }
        .dot2 { animation: dotBounce 1.2s ease infinite 0.2s; }
        .dot3 { animation: dotBounce 1.2s ease infinite 0.4s; }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0.55rem 0.75rem" }}>
        {["dot1", "dot2", "dot3"].map(cls => (
          <div key={cls} className={cls} style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.45)" }} />
        ))}
      </div>
    </>
  );
}

/* ─── Send icon ─── */
function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

/* ─── Bot icon ─── */
function BotIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <line x1="12" y1="7" x2="12" y2="11" />
      <line x1="8" y1="15" x2="8" y2="17" />
      <line x1="16" y1="15" x2="16" y2="17" />
    </svg>
  );
}

export default function FloatingChat() {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const FLASK_URL = process.env.NEXT_PUBLIC_FLASK_URL || "http://localhost:5000";
  const MCP_KEY   = process.env.NEXT_PUBLIC_MCP_KEY   || "";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message     = { role: "user", content: text };
    const updatedHistory       = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${FLASK_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-MCP-Key": MCP_KEY },
        body: JSON.stringify({ message: text, history: messages }),
      });
      const data = await res.json();
      setMessages([...updatedHistory, {
        role: "assistant",
        content: data.success ? data.answer : `Error: ${data.error}`,
      }]);
    } catch {
      setMessages([...updatedHistory, {
        role: "assistant",
        content: "Failed to connect to server.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  return (
    <>
      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .fc-scrollbar::-webkit-scrollbar       { width: 3px; }
        .fc-scrollbar::-webkit-scrollbar-track  { background: transparent; }
        .fc-scrollbar::-webkit-scrollbar-thumb  { background: rgba(255,255,255,0.1); border-radius: 10px; }

        .fc-msg-user { animation: chatSlideUp 0.22s ease both; }
        .fc-msg-bot  { animation: chatSlideUp 0.22s ease both; }

        .fc-input::placeholder { color: rgba(255,255,255,0.22); }
        .fc-input:focus        { border-color: rgba(255,255,255,0.28) !important; background: rgba(255,255,255,0.07) !important; }
      `}</style>

      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12, fontFamily: "'Inter',system-ui,sans-serif" }}>

        {/* ── Chat window ── */}
        {open && (
          <div style={{ width: 360, height: 500, display: "flex", flexDirection: "column", borderRadius: 18, overflow: "hidden", background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 24px 64px rgba(0,0,0,0.7), 0 0 40px rgba(255,255,255,0.03)", animation: "chatSlideUp 0.28s cubic-bezier(0.34,1.56,0.64,1) both" }}>

            {/* Header */}
            <div style={{ padding: "0.85rem 1.1rem", background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", backdropFilter: "blur(12px)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                {/* Avatar */}
                <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)" }}>
                  <BotIcon />
                </div>
                <div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff", letterSpacing: "0.01em" }}>MCP Admin AI</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: 1 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(74,222,128,1)", boxShadow: "0 0 6px rgba(74,222,128,0.8)" }} />
                    <span style={{ fontSize: "0.62rem", fontWeight: 600, color: "rgba(74,222,128,0.8)", letterSpacing: "0.06em" }}>ONLINE</span>
                  </div>
                </div>
              </div>
              <CloseBtn onClick={() => setOpen(false)} />
            </div>

            {/* Messages */}
            <div className="fc-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "1rem 0.9rem", display: "flex", flexDirection: "column", gap: "0.65rem", background: "#080808" }}>

              {/* Empty state */}
              {messages.length === 0 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "0.75rem", opacity: 0.5 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)" }}>
                    <BotIcon />
                  </div>
                  <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.35)", textAlign: "center", lineHeight: 1.6, maxWidth: 200 }}>
                   Sorry the free api tier will be exhaused so it has been disabled
                  </p>
                </div>
              )}

              {/* Message bubbles */}
              {messages.map((msg, i) => (
                <div key={i} className={msg.role === "user" ? "fc-msg-user" : "fc-msg-bot"}
                  style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "80%",
                    padding: "0.6rem 0.85rem",
                    borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    fontSize: "0.82rem",
                    lineHeight: 1.65,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    ...(msg.role === "user"
                      ? { background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)" }
                      : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.75)" }
                    ),
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="fc-msg-bot" style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "14px 14px 14px 4px" }}>
                    <TypingDots />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div style={{ padding: "0.75rem 0.9rem", background: "rgba(255,255,255,0.03)", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
              <input
                ref={inputRef}
                type="text"
                className="fc-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask something…"
                disabled={true}
                style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "0.58rem 0.85rem", fontSize: "0.82rem", fontWeight: 500, color: "#fff", fontFamily: "inherit", outline: "none", transition: "border-color 0.2s, background 0.2s", opacity: loading ? 0.5 : 1 }}
              />
              <SendBtn onClick={sendMessage} disabled={loading || !input.trim()} />
            </div>
          </div>
        )}

        {/* ── Toggle button ── */}
        <button
          onClick={() => setOpen(v => !v)}
          onMouseEnter={() => setBtnHover(true)}
          onMouseLeave={() => setBtnHover(false)}
          style={{ width: 50, height: 50, borderRadius: "50%", background: btnHover ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)", border: `1px solid ${btnHover ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", transition: "all 0.2s", transform: btnHover ? "scale(1.07)" : "scale(1)", backdropFilter: "blur(12px)" }}>
          {open
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          }
        </button>

      </div>
    </>
  );
}

/* ─── Close button ─── */
function CloseBtn({ onClick }: { onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick}
      style={{ width: 26, height: 26, borderRadius: 7, background: h ? "rgba(255,255,255,0.1)" : "transparent", border: "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "none", transition: "all 0.15s", borderColor: h ? "rgba(255,255,255,0.14)" : "transparent" }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  );
}

/* ─── Send button ─── */
function SendBtn({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: disabled ? "rgba(255,255,255,0.04)" : h ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)", border: `1px solid ${disabled ? "rgba(255,255,255,0.07)" : h ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.14)"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "not-allowed" : "none", color: disabled ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.75)", transition: "all 0.15s", opacity: disabled ? 0.5 : 1 }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    </button>
  );
}
