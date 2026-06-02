import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../lib/api";

export default function Login() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const r = mode === "login"
        ? await api.login(email, password)
        : await api.signup(email, password);
      setToken(r.access_token);
      nav("/");
    } catch (e: any) {
      setErr(e.message || "failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="bg-blob animate-blob" style={{ background: '#4361ee', width: 600, height: 600, top: -150, left: -150 }} />
        <div className="bg-blob animate-blob" style={{ background: '#a855f7', width: 500, height: 500, bottom: -120, right: -120, animationDelay: '-8s' }} />
        <div className="bg-blob animate-blob" style={{ background: '#ec4899', width: 420, height: 420, top: '40%', left: '40%', animationDelay: '-14s' }} />
      </div>

      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-grad-brand bg-[length:200%_200%] animate-gradient-x shadow-glow-violet mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                 strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-white">
              <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-slate-400 mt-1.5">
            {mode === "login" ? "Sign in to your finance assistant" : "Start tracking smarter, in seconds"}
          </p>
        </div>

        <form onSubmit={submit} className="glass-strong rounded-2xl p-7 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                   placeholder="you@example.com" className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
            <input type="password" required minLength={6} value={password}
                   onChange={e => setPassword(e.target.value)}
                   placeholder="••••••••" className="input" />
          </div>

          {err && (
            <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 animate-slide-down">
              <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{err}</span>
            </div>
          )}

          <button disabled={busy} className="btn-primary w-full py-3">
            {busy ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Please wait…
              </span>
            ) : mode === "login" ? "Sign in" : "Create account"}
          </button>

          <div className="divider" />

          <button type="button"
                  onClick={() => setMode(mode === "login" ? "signup" : "login")}
                  className="w-full text-sm text-slate-400 hover:text-white transition-colors">
            {mode === "login"
              ? <>Don't have an account? <span className="text-brand-400 font-medium">Sign up</span></>
              : <>Already have an account? <span className="text-brand-400 font-medium">Sign in</span></>}
          </button>
        </form>

        <p className="text-center text-xs text-slate-600 mt-6">
          Secured by Finance AI · Your data stays private
        </p>
      </div>
    </div>
  );
}
