import { useEffect, useState } from "react";
import { api } from "../lib/api";

const CAT_COLORS: Record<string, string> = {
  food: "from-orange-500 to-red-500",
  groceries: "from-emerald-500 to-teal-500",
  transport: "from-blue-500 to-cyan-500",
  entertainment: "from-fuchsia-500 to-pink-500",
  bills: "from-amber-500 to-orange-500",
  shopping: "from-violet-500 to-purple-500",
  health: "from-rose-500 to-pink-500",
  income: "from-emerald-500 to-green-500",
  other: "from-slate-500 to-slate-600",
};

function catGradient(cat: string) {
  return CAT_COLORS[cat?.toLowerCase()] || "from-brand-500 to-violet-500";
}

const DEFAULT_CATEGORIES = [
  "groceries", "food", "transport", "entertainment", "bills",
  "shopping", "health", "income", "other",
];

export default function Transactions() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [category, setCategory] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [existingCats, setExistingCats] = useState<string[]>([]);

  async function load() {
    const [r, c] = await Promise.all([
      api.transactions({ category: category || undefined, limit: 200 }),
      api.categories().catch(() => ({ categories: [] })),
    ]);
    setItems(r.items); setTotal(r.total);
    setExistingCats(c.categories);
  }
  useEffect(() => { load().catch(e => setMsg(e.message)); }, [category]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true); setMsg("");
    try {
      const r = await api.uploadCsv(f);
      setMsg(`✓ Inserted ${r.inserted} · ${r.duplicates} duplicates · ${r.rejected} rejected`);
      await load();
    } catch (e: any) { setMsg(e.message); }
    finally { setUploading(false); e.target.value = ""; }
  }

  async function remove(id: string) {
    await api.deleteTx(id); load();
  }

  // Merge defaults + existing for the add form dropdown
  const allCats = Array.from(new Set([...DEFAULT_CATEGORIES, ...existingCats])).sort();

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Transactions</h1>
          <p className="text-sm text-slate-400 mt-1">
            <span className="font-mono text-white">{total}</span> total · review & manage your activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdd(true)} className="btn-ghost">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add transaction
          </button>
          <label className="btn-primary cursor-pointer">
            {uploading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload CSV
              </>
            )}
            <input type="file" accept=".csv" className="hidden" onChange={onUpload} disabled={uploading}/>
          </label>
        </div>
      </div>

      <div className="card flex items-center gap-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-slate-500 shrink-0">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input value={category} onChange={e => setCategory(e.target.value)}
               placeholder="Filter by category…"
               className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none" />
        {category && (
          <button onClick={() => setCategory("")} className="text-xs text-slate-400 hover:text-white">
            Clear
          </button>
        )}
      </div>

      {msg && (
        <div className="card border-emerald-500/20 bg-emerald-500/5 text-sm text-emerald-300 animate-slide-down">
          {msg}
        </div>
      )}

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-slate-400 text-left text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Merchant</th>
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium text-right">Amount</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map((t, i) => (
              <tr key={t.id} className="group hover:bg-white/[0.03] transition-colors animate-fade-up"
                  style={{ animationDelay: `${Math.min(i * 12, 400)}ms` }}>
                <td className="px-5 py-3 text-slate-500 font-mono text-xs">{t.date.slice(0, 10)}</td>
                <td className="px-5 py-3 text-slate-100 font-medium">{t.merchant}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs capitalize
                                    bg-gradient-to-r ${catGradient(t.category)} bg-opacity-20 text-white/90
                                    border border-white/10`}>
                    {t.category}
                  </span>
                </td>
                <td className={`px-5 py-3 text-right font-mono tabular-nums
                                ${t.amount < 0 ? "text-slate-200" : "text-emerald-400"}`}>
                  {t.amount < 0 ? "−" : "+"}${Math.abs(t.amount).toFixed(2)}
                </td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => remove(t.id)}
                          className="opacity-0 group-hover:opacity-100 text-xs text-slate-500 hover:text-red-400 transition-all">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-16 text-center">
                <div className="flex flex-col items-center text-slate-500">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/5 flex items-center justify-center mb-3">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                      <rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <p className="text-sm">No transactions yet.</p>
                  <p className="text-xs text-slate-600 mt-1">Add one or upload a CSV to get started.</p>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddTransactionModal
          categories={allCats}
          onClose={() => setShowAdd(false)}
          onSaved={async () => { setShowAdd(false); await load(); setMsg("✓ Transaction added"); }}
        />
      )}
    </div>
  );
}

function AddTransactionModal({
  categories, onClose, onSaved,
}: { categories: string[]; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const raw = parseFloat(amount);
      if (isNaN(raw) || raw <= 0) throw new Error("Enter a positive amount");
      if (!merchant.trim()) throw new Error("Merchant is required");
      const signed = kind === "expense" ? -Math.abs(raw) : Math.abs(raw);
      await api.createTx({
        date: new Date(date).toISOString(),
        amount: signed,
        merchant: merchant.trim(),
        category: category || undefined,
      });
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
         onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <form onSubmit={submit} onClick={e => e.stopPropagation()}
            className="relative glass-strong rounded-2xl w-full max-w-md p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white tracking-tight">Add transaction</h2>
          <button type="button" onClick={onClose}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 p-1 bg-white/[0.03] rounded-xl border border-white/5 mb-4">
          <button type="button" onClick={() => setKind("expense")}
            className={`py-2 rounded-lg text-sm font-medium transition-all
              ${kind === "expense"
                ? "bg-gradient-to-r from-red-500/30 to-pink-500/30 text-white border border-red-500/30"
                : "text-slate-400 hover:text-white"}`}>
            − Expense
          </button>
          <button type="button" onClick={() => setKind("income")}
            className={`py-2 rounded-lg text-sm font-medium transition-all
              ${kind === "income"
                ? "bg-gradient-to-r from-emerald-500/30 to-green-500/30 text-white border border-emerald-500/30"
                : "text-slate-400 hover:text-white"}`}>
            + Income
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1.5">Merchant</label>
            <input value={merchant} onChange={e => setMerchant(e.target.value)} autoFocus
                   className="input" placeholder="Whole Foods" required/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1.5">Amount (USD)</label>
              <input value={amount} onChange={e => setAmount(e.target.value)} type="number" step="0.01" min="0"
                     className="input" placeholder="42.50" required/>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1.5">Date</label>
              <input value={date} onChange={e => setDate(e.target.value)} type="date"
                     className="input" required/>
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1.5">Category</label>
            <div className="relative">
              <select value={category} onChange={e => setCategory(e.target.value)}
                      className="input appearance-none pr-9 capitalize cursor-pointer">
                <option value="" className="bg-ink-900">Auto-detect from merchant</option>
                {categories.map(c => (
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

          {err && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 animate-slide-down">
              {err}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button disabled={busy} className="btn-primary flex-1">
              {busy ? "Saving…" : "Save transaction"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
