import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Budgets() {
  const [items, setItems] = useState<any[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [b, c] = await Promise.all([api.budgets(), api.categories()]);
    setItems(b.results);
    setAllCategories(c.categories);
  }
  useEffect(() => { load(); }, []);

  const budgetedSet = new Set(items.map((b: any) => b.category));
  const available = allCategories.filter(c => !budgetedSet.has(c));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !amount) return;
    setBusy(true);
    try {
      await api.upsertBudget(category.toLowerCase(), parseFloat(amount));
      setCategory(""); setAmount(""); await load();
    } finally { setBusy(false); }
  }
  async function remove(c: string) { await api.deleteBudget(c); load(); }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Budgets</h1>
        <p className="text-sm text-slate-400 mt-1">Set monthly limits per category — we'll keep watch.</p>
      </div>

      <form onSubmit={submit} className="card flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1 min-w-0">
          <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1.5">Category</label>
          <div className="relative">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="input appearance-none pr-9 capitalize cursor-pointer"
              disabled={allCategories.length === 0}
            >
              <option value="" className="bg-ink-900">
                {allCategories.length === 0
                  ? "No categories yet — upload transactions first"
                  : available.length === 0
                    ? "All categories already budgeted"
                    : "Select a category…"}
              </option>
              {available.map(c => (
                <option key={c} value={c} className="bg-ink-900 capitalize">{c}</option>
              ))}
            </select>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round"
                 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1.5">Limit (USD)</label>
          <input value={amount} onChange={e => setAmount(e.target.value)}
                 type="number" step="0.01" className="input" placeholder="400"/>
        </div>
        <button disabled={busy || !category || !amount} className="btn-primary sm:w-auto">
          {busy ? "Saving…" : "Save budget"}
        </button>
      </form>

      <div className="space-y-3">
        {items.length === 0 && (
          <div className="card flex flex-col items-center text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-grad-brand/20 border border-brand-500/20 flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-brand-400">
                <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" />
              </svg>
            </div>
            <p className="text-sm text-slate-300">No budgets yet</p>
            <p className="text-xs text-slate-500 mt-1">Add your first one above to start tracking goals.</p>
          </div>
        )}
        {items.map((b: any, i: number) => {
          const color = b.status === "over" ? "from-red-500 to-pink-500"
                      : b.status === "warning" ? "from-amber-400 to-orange-500"
                      : "from-emerald-400 to-cyan-500";
          const badge = b.status === "over" ? "bg-red-500/15 text-red-300 border-red-500/30"
                      : b.status === "warning" ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                      : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
          return (
            <div key={b.category} className="card card-hover animate-fade-up group"
                 style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-base font-semibold text-white capitalize">{b.category}</div>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${badge}`}>
                      {b.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 font-mono">
                    <span className="text-white">${b.spent.toFixed(2)}</span> of ${b.limit.toFixed(2)}
                    <span className="text-slate-500"> · {b.pct_used.toFixed(0)}% used</span>
                  </div>
                </div>
                <button onClick={() => remove(b.category)}
                        className="text-xs text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                  Remove
                </button>
              </div>
              <div className="h-2.5 bg-white/[0.04] rounded-full mt-4 overflow-hidden relative">
                <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700 relative`}
                     style={{ width: `${Math.min(b.pct_used, 100)}%` }}>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent
                                  bg-[length:200%_100%] animate-shimmer" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
