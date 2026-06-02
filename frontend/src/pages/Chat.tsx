import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

type Msg = { role: "user" | "assistant"; content: string; trace?: any[] };

const SUGGESTIONS = [
  { text: "How much did I spend on groceries last month?", icon: "🛒" },
  { text: "What was my biggest purchase in the last 90 days?", icon: "💸" },
  { text: "Am I spending more than usual this month?", icon: "📈" },
  { text: "Find my recurring subscriptions", icon: "🔁" },
];

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.chatHistory().then(r =>
      setMessages(r.messages.map(m => ({ role: m.role, content: m.content })))
    ).catch(() => {});
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput("");
    setMessages(m => [...m, { role: "user", content: msg }]);
    setBusy(true);
    try {
      const r = await api.chat(msg);
      setMessages(m => [...m, { role: "assistant", content: r.reply, trace: r.tool_trace }]);
    } catch (e: any) {
      setMessages(m => [...m, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally { setBusy(false); }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] md:h-[calc(100vh-80px)] -mx-1">
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
          Assistant
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">Ask anything about your finances — I'll do the math.</p>
      </div>

      <div className="flex-1 glass-strong rounded-2xl flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center animate-fade-up">
              <div className="relative mb-5">
                <div className="w-16 h-16 rounded-2xl bg-grad-brand bg-[length:200%_200%] animate-gradient-x flex items-center justify-center shadow-glow-violet">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-8 h-8 text-white">
                    <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z" />
                  </svg>
                </div>
                <div className="absolute -inset-2 bg-grad-brand rounded-3xl opacity-30 blur-xl -z-10 animate-pulse-glow" />
              </div>
              <div className="text-lg font-semibold text-white">How can I help today?</div>
              <p className="text-sm text-slate-400 mt-1 mb-6">Try one of these to get started</p>
              <div className="grid sm:grid-cols-2 gap-2.5 w-full max-w-xl">
                {SUGGESTIONS.map((s, i) => (
                  <button key={s.text} onClick={() => send(s.text)}
                    className="group text-left p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07]
                               border border-white/10 hover:border-brand-500/40
                               transition-all duration-200 hover:-translate-y-0.5 animate-fade-up"
                    style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="text-xl mb-1">{s.icon}</div>
                    <div className="text-sm text-slate-200 group-hover:text-white">{s.text}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 animate-fade-up ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-grad-brand flex items-center justify-center shrink-0 shadow-glow-brand">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-white">
                    <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z" />
                  </svg>
                </div>
              )}
              <div className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed
                  ${m.role === "user"
                    ? "bg-grad-brand text-white rounded-br-md shadow-glow-brand"
                    : "bg-white/[0.05] text-slate-100 border border-white/10 rounded-bl-md"}`}>
                {m.content}
                {m.trace && m.trace.length > 0 && (
                  <details className="mt-3 group">
                    <summary className="cursor-pointer text-xs text-slate-400 hover:text-white inline-flex items-center gap-1.5 list-none">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                           className="w-3 h-3 transition-transform group-open:rotate-90">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                      Tool calls ({m.trace.length})
                    </summary>
                    <ul className="mt-2 space-y-1 pl-1">
                      {m.trace.map((t: any, j: number) => (
                        <li key={j} className="font-mono text-[10px] text-slate-400 bg-black/30 rounded-md px-2 py-1 border border-white/5">
                          <span className="text-brand-400">{t.tool}</span>
                          <span className="text-slate-500"> {JSON.stringify(t.args)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex gap-3 animate-fade-up">
              <div className="w-8 h-8 rounded-full bg-grad-brand flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-white">
                  <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z" />
                </svg>
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white/[0.05] border border-white/10 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-typing" />
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-typing" style={{ animationDelay: '0.15s' }} />
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-typing" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form className="border-t border-white/5 p-3 bg-black/20"
              onSubmit={(e) => { e.preventDefault(); send(); }}>
          <div className="flex items-end gap-2 bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-2
                          focus-within:border-brand-500/50 focus-within:bg-white/[0.06] focus-within:ring-4 focus-within:ring-brand-500/10 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ask about your money…"
              rows={1}
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none resize-none max-h-32 py-1.5"
            />
            <button disabled={busy || !input.trim()}
                    className="shrink-0 w-9 h-9 rounded-xl bg-grad-brand bg-[length:200%_200%]
                               flex items-center justify-center text-white shadow-glow-brand
                               hover:shadow-glow-violet hover:bg-[position:100%_50%]
                               transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <div className="text-[10px] text-slate-600 mt-1.5 px-1">Press Enter to send · Shift+Enter for newline</div>
        </form>
      </div>
    </div>
  );
}
