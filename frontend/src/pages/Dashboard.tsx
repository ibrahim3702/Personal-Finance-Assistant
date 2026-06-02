import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend,
} from "recharts";
import { api } from "../lib/api";

const COLORS = ["#5d7cff", "#a855f7", "#ec4899", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#7c9cff"];

function StatCard({
  label, value, sub, gradient, delay,
}: { label: string; value: string; sub?: string; gradient: string; delay: number }) {
  return (
    <div className="card card-hover relative overflow-hidden animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full ${gradient} opacity-30 blur-2xl`} />
      <div className="relative">
        <div className="text-xs uppercase tracking-widest text-slate-500 font-medium">{label}</div>
        <div className="text-2xl font-bold text-white mt-2 tracking-tight">{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function SectionCard({
  title, subtitle, children, delay = 0, className = "",
}: { title: string; subtitle?: string; children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div className={`card card-hover animate-fade-up ${className}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0,1,2,3].map(i => <div key={i} className="card h-24 skeleton" />)}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card h-72 skeleton" />
        <div className="card h-72 skeleton" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [recurring, setRecurring] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all([api.summary(), api.recurring(), api.anomalies()])
      .then(([s, r, a]) => {
        setSummary(s); setRecurring(r.results); setAnomalies(a.results);
      })
      .catch(e => setErr(e.message));
  }, []);

  if (err) return (
    <div className="card border-red-500/30 bg-red-500/5 text-red-300">{err}</div>
  );
  if (!summary) return <Loading />;

  const monthData = (summary.by_month || []).slice().reverse().map((m: any) => ({
    label: `${m.year}-${String(m.month).padStart(2, "0")}`,
    spent: Math.abs(m.total),
  }));
  const catData = (summary.by_category || []).slice(0, 8);

  const totalSpent = monthData.reduce((s: number, m: any) => s + m.spent, 0);
  const currentMonth = monthData[monthData.length - 1]?.spent ?? 0;
  const prevMonth = monthData[monthData.length - 2]?.spent ?? 0;
  const monthDelta = prevMonth > 0 ? ((currentMonth - prevMonth) / prevMonth) * 100 : 0;
  const topCategory = catData[0];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Overview</h1>
          <p className="text-sm text-slate-400 mt-1">Your financial snapshot at a glance</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="This month" value={`$${currentMonth.toFixed(2)}`}
          sub={monthDelta !== 0 ? `${monthDelta > 0 ? '↑' : '↓'} ${Math.abs(monthDelta).toFixed(1)}% vs last` : "—"}
          gradient="bg-grad-brand" delay={0} />
        <StatCard label="Total tracked" value={`$${totalSpent.toFixed(0)}`}
          sub={`${monthData.length} months`} gradient="bg-grad-emerald" delay={60} />
        <StatCard label="Top category" value={topCategory?.category ?? "—"}
          sub={topCategory ? `$${Number(topCategory.spent).toFixed(2)}` : ""}
          gradient="bg-grad-amber" delay={120} />
        <StatCard label="Recurring" value={`${recurring.length}`}
          sub="subscriptions detected"
          gradient="bg-gradient-to-br from-fuchsia-500 to-pink-500" delay={180} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <SectionCard title="Spending by month" subtitle="Total outflow per month" delay={240}>
          {monthData.length === 0
            ? <EmptyState text="No data yet — upload a CSV." />
            : <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c9cff" stopOpacity={1} />
                      <stop offset="100%" stopColor="#4361ee" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(124,156,255,0.06)' }} />
                  <Bar dataKey="spent" fill="url(#barFill)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>}
        </SectionCard>

        <SectionCard title="Spending by category" subtitle="Where your money goes" delay={300}>
          {catData.length === 0
            ? <EmptyState text="No data." />
            : <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={catData} dataKey="spent" nameKey="category"
                       cx="50%" cy="50%" innerRadius={50} outerRadius={88}
                       paddingAngle={3} stroke="rgba(11,15,28,1)" strokeWidth={2}>
                    {catData.map((_: any, i: number) =>
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>}
        </SectionCard>

        <SectionCard title="Recurring charges" subtitle="Subscriptions & repeat bills" delay={360}>
          {recurring.length === 0
            ? <EmptyState text="No recurring patterns detected." />
            : <ul className="space-y-1.5">
                {recurring.slice(0, 8).map((r: any, i: number) => (
                  <li key={i} className="flex items-center justify-between px-3 py-2.5 rounded-xl
                                         bg-white/[0.02] hover:bg-white/[0.05] border border-white/5
                                         hover:border-white/10 transition-all group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-grad-brand/30 flex items-center justify-center
                                      text-xs font-semibold text-brand-400 shrink-0">
                        {r.merchant?.slice(0,2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-slate-200 truncate">{r.merchant}</div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">{r.cadence}</div>
                      </div>
                    </div>
                    <span className="font-mono text-sm text-white">${r.avg_amount.toFixed(2)}</span>
                  </li>
                ))}
              </ul>}
        </SectionCard>

        <SectionCard title="Unusual activity" subtitle="Recent outliers worth a look" delay={420}>
          {anomalies.length === 0
            ? <EmptyState text="No anomalies detected." />
            : <ul className="space-y-1.5">
                {anomalies.slice(0, 8).map((a: any, i: number) => (
                  <li key={i} className="flex items-center justify-between px-3 py-2.5 rounded-xl
                                         bg-red-500/[0.04] hover:bg-red-500/[0.08] border border-red-500/10
                                         hover:border-red-500/20 transition-all">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-200 truncate">{a.merchant}</div>
                      <div className="text-[10px] text-slate-500">{a.date} · {a.category}</div>
                    </div>
                    <span className="font-mono text-sm text-red-400">${a.amount.toFixed(2)}</span>
                  </li>
                ))}
              </ul>}
        </SectionCard>
      </div>

      {summary.budgets?.length > 0 && (
        <SectionCard title="Budgets" subtitle="Where you stand this month" delay={480}>
          <div className="grid sm:grid-cols-2 gap-3">
            {summary.budgets.map((b: any) => {
              const color = b.status === "over" ? "from-red-500 to-pink-500"
                          : b.status === "warning" ? "from-amber-400 to-orange-500"
                          : "from-emerald-400 to-cyan-500";
              return (
                <div key={b.category} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm capitalize font-medium text-slate-200">{b.category}</span>
                    <span className="font-mono text-xs text-slate-400">
                      <span className="text-white">${b.spent.toFixed(2)}</span> / ${b.limit.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-2 bg-white/[0.04] rounded-full mt-3 overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700`}
                      style={{ width: `${Math.min(b.pct_used, 100)}%` }}
                    />
                  </div>
                  <div className="mt-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                    {b.pct_used.toFixed(0)}% used · {b.status}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/5 flex items-center justify-center mb-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-slate-500">
          <circle cx="12" cy="12" r="9" /><path d="M8 12h8M12 8v8" />
        </svg>
      </div>
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}
