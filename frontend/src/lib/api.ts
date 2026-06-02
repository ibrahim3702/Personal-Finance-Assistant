const TOKEN_KEY = "fa_token";

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t: string) { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (opts.body && !(opts.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`/api${path}`, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  signup: (email: string, password: string) =>
    request<{ access_token: string; user: any }>("/auth/signup", {
      method: "POST", body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ access_token: string; user: any }>("/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: any }>("/auth/me"),

  chat: (message: string) =>
    request<{ reply: string; tool_trace: any[] }>("/chat", {
      method: "POST", body: JSON.stringify({ message }),
    }),
  chatHistory: () => request<{ messages: any[] }>("/chat/history"),

  transactions: (params?: { category?: string; limit?: number; skip?: number }) => {
    const clean: Record<string, string> = {};
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") clean[k] = String(v);
    });
    const q = new URLSearchParams(clean).toString();
    return request<{ items: any[]; total: number }>(`/transactions${q ? `?${q}` : ""}`);
  },
  uploadCsv: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<any>("/transactions/upload", { method: "POST", body: fd });
  },
  createTx: (data: { date: string; amount: number; merchant: string; category?: string }) =>
    request<{ transaction: any }>("/transactions", {
      method: "POST", body: JSON.stringify(data),
    }),
  deleteTx: (id: string) =>
    request<any>(`/transactions/${id}`, { method: "DELETE" }),
  categories: () =>
    request<{ categories: string[] }>("/transactions/categories"),

  extractReceipt: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<{ extracted: any }>("/receipts/extract", { method: "POST", body: fd });
  },
  commitReceipt: (data: any) =>
    request<any>("/receipts/commit", { method: "POST", body: JSON.stringify(data) }),

  budgets: () => request<{ results: any[] }>("/budgets"),
  upsertBudget: (category: string, amount: number) =>
    request<any>("/budgets", { method: "PUT", body: JSON.stringify({ category, amount }) }),
  deleteBudget: (category: string) =>
    request<any>(`/budgets/${category}`, { method: "DELETE" }),

  summary: () => request<any>("/insights/summary"),
  recurring: () => request<{ results: any[] }>("/insights/recurring"),
  anomalies: () => request<{ results: any[] }>("/insights/anomalies"),
};
