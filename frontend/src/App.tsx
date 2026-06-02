import { Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getToken, clearToken, api } from "./lib/api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Transactions from "./pages/Transactions";
import Receipts from "./pages/Receipts";
import Budgets from "./pages/Budgets";

function Icon({ name, className = "w-4 h-4" }: { name: string; className?: string }) {
  const paths: Record<string, JSX.Element> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
    chat: <path d="M21 12a8 8 0 1 1-3.2-6.4L21 4l-1.2 3.6A8 8 0 0 1 21 12Z" />,
    list: (
      <>
        <path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" />
        <circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" />
      </>
    ),
    receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6M9 16h4" />,
    target: (
      <>
        <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" />
      </>
    ),
    logout: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />,
    sparkle: <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2zM19 14l.9 2.7L22 18l-2.1.9L19 22l-.9-2.7L16 18l2.1-.9L19 14z" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      {paths[name]}
    </svg>
  );
}

function BackgroundBlobs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <div className="bg-blob animate-blob" style={{ background: '#4361ee', width: 480, height: 480, top: -100, left: -120 }} />
      <div className="bg-blob animate-blob" style={{ background: '#a855f7', width: 520, height: 520, top: '40%', right: -150, animationDelay: '-6s' }} />
      <div className="bg-blob animate-blob" style={{ background: '#06b6d4', width: 420, height: 420, bottom: -120, left: '30%', animationDelay: '-12s' }} />
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    api.me().then((r) => setEmail(r.user.email)).catch(() => {
      clearToken(); nav("/login");
    });
  }, []);

  const initials = email ? email.slice(0, 2).toUpperCase() : "··";

  const links = [
    { to: "/", icon: "dashboard", label: "Dashboard" },
    { to: "/chat", icon: "chat", label: "Assistant" },
    { to: "/transactions", icon: "list", label: "Transactions" },
    { to: "/receipts", icon: "receipt", label: "Receipts" },
    { to: "/budgets", icon: "target", label: "Budgets" },
  ];

  return (
    <div className="h-screen flex overflow-hidden">
      <BackgroundBlobs />

      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-white/5 bg-ink-950/40 backdrop-blur-xl h-screen sticky top-0">
        <div className="px-5 py-6 flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-grad-brand bg-[length:200%_200%] animate-gradient-x flex items-center justify-center shadow-glow-brand">
              <Icon name="sparkle" className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -inset-1 bg-grad-brand rounded-xl opacity-40 blur-md -z-10 animate-pulse-glow" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white tracking-tight">Finance AI</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Personal assistant</div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-grad-brand" />
                  )}
                  <Icon name={l.icon} />
                  <span>{l.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl">
            <div className="w-9 h-9 rounded-full bg-grad-brand flex items-center justify-center text-xs font-semibold text-white">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-300 truncate">{email || "—"}</div>
              <div className="text-[10px] text-slate-500">Signed in</div>
            </div>
            <button onClick={() => { clearToken(); nav("/login"); }}
              title="Sign out"
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-20 bg-ink-950/70 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-grad-brand flex items-center justify-center">
              <Icon name="sparkle" className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold">Finance AI</span>
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {links.map(l => (
              <NavLink key={l.to} to={l.to} end={l.to === "/"}
                className={({ isActive }) => `px-2.5 py-1.5 rounded-lg text-xs ${isActive ? 'bg-white/10 text-white' : 'text-slate-400'}`}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto w-full px-5 md:px-8 py-6 md:py-8 animate-fade-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/chat" element={<Protected><Chat /></Protected>} />
      <Route path="/transactions" element={<Protected><Transactions /></Protected>} />
      <Route path="/receipts" element={<Protected><Receipts /></Protected>} />
      <Route path="/budgets" element={<Protected><Budgets /></Protected>} />
    </Routes>
  );
}
