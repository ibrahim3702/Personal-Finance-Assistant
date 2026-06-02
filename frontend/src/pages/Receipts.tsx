import { useState } from "react";
import { api } from "../lib/api";

export default function Receipts() {
  const [extracted, setExtracted] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFile(f: File) {
    setBusy(true); setMsg(null); setExtracted(null);
    setPreview(URL.createObjectURL(f));
    try {
      const r = await api.extractReceipt(f);
      setExtracted(r.extracted);
    } catch (e: any) { setMsg({ kind: "err", text: e.message }); }
    finally { setBusy(false); }
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    await handleFile(f);
    e.target.value = "";
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) await handleFile(f);
  }

  async function commit() {
    if (!extracted) return;
    setBusy(true); setMsg(null);
    try {
      await api.commitReceipt(extracted);
      setMsg({ kind: "ok", text: "Saved as transaction." });
      setExtracted(null); setPreview(null);
    } catch (e: any) { setMsg({ kind: "err", text: e.message }); }
    finally { setBusy(false); }
  }

  const conf = extracted?.confidence;
  const confColor = conf === "high" ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/30"
                  : conf === "medium" ? "text-amber-300 bg-amber-500/15 border-amber-500/30"
                  : "text-red-300 bg-red-500/15 border-red-500/30";

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Scan a receipt</h1>
        <p className="text-sm text-slate-400 mt-1">
          Drop a photo — the AI extracts merchant, date, and total. Review before saving.
        </p>
      </div>

      <label
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`block cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300
                    ${dragOver
                      ? 'border-brand-400 bg-brand-500/10 scale-[1.01]'
                      : 'border-white/15 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/25'}`}>
        <div className="px-8 py-10 flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-2xl bg-grad-brand bg-[length:200%_200%] animate-gradient-x
                           flex items-center justify-center shadow-glow-brand mb-4
                           ${busy ? 'animate-pulse' : 'animate-float'}`}>
            {busy ? (
              <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                   strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-white">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            )}
          </div>
          <div className="text-sm font-medium text-white">
            {busy ? "Extracting receipt details…" : "Drop your receipt here or click to upload"}
          </div>
          <div className="text-xs text-slate-500 mt-1">PNG, JPG · max ~10MB</div>
          <input type="file" accept="image/*" className="hidden" onChange={upload} disabled={busy}/>
        </div>
      </label>

      {msg && (
        <div className={`card animate-slide-down text-sm
          ${msg.kind === "ok" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" : "border-red-500/30 bg-red-500/5 text-red-300"}`}>
          {msg.text}
        </div>
      )}

      {extracted && (
        <div className="card animate-scale-in space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Review extracted data</h2>
            <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border ${confColor}`}>
              {conf} confidence
            </span>
          </div>

          {preview && (
            <div className="rounded-xl overflow-hidden border border-white/10 max-h-48 flex justify-center bg-black/30">
              <img src={preview} alt="receipt" className="object-contain max-h-48" />
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Merchant" value={extracted.merchant || ""}
                   onChange={v => setExtracted({ ...extracted, merchant: v })} />
            <Field label="Date" value={extracted.date || ""}
                   onChange={v => setExtracted({ ...extracted, date: v })} />
            <Field label="Total (USD)" type="number" value={extracted.total ?? 0}
                   onChange={v => setExtracted({ ...extracted, total: parseFloat(v) || 0 })} />
            <Field label="Category" value={extracted.category || ""}
                   onChange={v => setExtracted({ ...extracted, category: v })} placeholder="optional"/>
          </div>

          <button onClick={commit} disabled={busy || !extracted.merchant || !extracted.total}
                  className="btn-primary w-full">
            {busy ? "Saving…" : "Save as transaction"}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder,
}: { label: string; value: any; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
             placeholder={placeholder} className="input" step={type === "number" ? "0.01" : undefined} />
    </div>
  );
}
