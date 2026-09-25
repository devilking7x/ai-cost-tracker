// AI Cost Tracker — pricing data, cost math, CSV import/export, localStorage store.
// NOTE: model prices change often. These are plausible defaults only —
// every price is editable in the app's Settings tab and stored locally.

export interface ModelPrice {
  id: string; // e.g. "gpt-4o"
  label: string; // e.g. "GPT-4o"
  inputPer1M: number; // USD per 1M input tokens
  outputPer1M: number; // USD per 1M output tokens
}

export interface Provider {
  id: string; // e.g. "openai"
  name: string; // e.g. "OpenAI"
  color: string; // chart color
  models: ModelPrice[];
}

export const PROVIDERS: Provider[] = [
  {
    id: "openai",
    name: "OpenAI",
    color: "#10a37f",
    models: [
      { id: "gpt-4o", label: "GPT-4o", inputPer1M: 2.5, outputPer1M: 10 },
      { id: "gpt-4o-mini", label: "GPT-4o mini", inputPer1M: 0.15, outputPer1M: 0.6 },
      { id: "o3-mini", label: "o3-mini", inputPer1M: 1.1, outputPer1M: 4.4 },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    color: "#d97757",
    models: [
      { id: "claude-opus-4", label: "Claude Opus 4", inputPer1M: 15, outputPer1M: 75 },
      { id: "claude-sonnet-4", label: "Claude Sonnet 4", inputPer1M: 3, outputPer1M: 15 },
      { id: "claude-haiku-4", label: "Claude Haiku 4", inputPer1M: 0.8, outputPer1M: 4 },
    ],
  },
  {
    id: "google",
    name: "Google",
    color: "#4285f4",
    models: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", inputPer1M: 1.25, outputPer1M: 10 },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", inputPer1M: 0.3, outputPer1M: 2.5 },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    color: "#4d6bfe",
    models: [{ id: "deepseek-chat", label: "DeepSeek Chat", inputPer1M: 0.27, outputPer1M: 1.1 }],
  },
  {
    id: "xai",
    name: "xAI",
    color: "#e5e7eb",
    models: [{ id: "grok-3", label: "Grok 3", inputPer1M: 3, outputPer1M: 15 }],
  },
  {
    id: "mistral",
    name: "Mistral",
    color: "#ff7000",
    models: [{ id: "mistral-large", label: "Mistral Large", inputPer1M: 2, outputPer1M: 6 }],
  },
];

export interface UsageEntry {
  id: string;
  date: string; // YYYY-MM-DD
  providerId: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  note?: string;
}

export interface PriceOverride {
  inputPer1M: number;
  outputPer1M: number;
}

export interface StoreState {
  entries: UsageEntry[];
  priceOverrides: Record<string, PriceOverride>; // key = modelId
  budget: number; // monthly budget in USD
}

const STORAGE_KEY = "ai-cost-tracker:v1";

export const DEFAULT_STORE: StoreState = { entries: [], priceOverrides: {}, budget: 100 };

export function loadStore(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STORE };
    const parsed = JSON.parse(raw) as Partial<StoreState>;
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      priceOverrides:
        parsed.priceOverrides && typeof parsed.priceOverrides === "object" ? parsed.priceOverrides : {},
      budget: typeof parsed.budget === "number" && parsed.budget >= 0 ? parsed.budget : DEFAULT_STORE.budget,
    };
  } catch {
    return { ...DEFAULT_STORE };
  }
}

export function saveStore(state: StoreState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const uid = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export function findProvider(providerId: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === providerId);
}

export function findModel(provider: Provider, modelId: string): ModelPrice | undefined {
  return provider.models.find((m) => m.id === modelId);
}

export function modelLabel(providerId: string, modelId: string): string {
  const p = findProvider(providerId);
  const m = p ? findModel(p, modelId) : undefined;
  return m ? m.label : modelId;
}

export function providerName(providerId: string): string {
  return findProvider(providerId)?.name ?? providerId;
}

/** Effective price for a model, applying the user's overrides when present. */
export function resolvePrice(
  provider: Provider,
  modelId: string,
  overrides: Record<string, PriceOverride>
): ModelPrice | undefined {
  const base = findModel(provider, modelId);
  if (!base) return undefined;
  const o = overrides[modelId];
  if (!o) return base;
  return { ...base, inputPer1M: o.inputPer1M, outputPer1M: o.outputPer1M };
}

export function costOf(
  entry: UsageEntry,
  overrides: Record<string, PriceOverride> = {}
): number {
  const provider = findProvider(entry.providerId);
  if (!provider) return 0;
  const price = resolvePrice(provider, entry.modelId, overrides);
  if (!price) return 0;
  return (entry.inputTokens / 1_000_000) * price.inputPer1M +
    (entry.outputTokens / 1_000_000) * price.outputPer1M;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatUSD(n: number): string {
  if (!isFinite(n)) return "$0.00";
  if (n >= 1000) return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  if (n >= 1) return "$" + n.toFixed(2);
  if (n > 0) return "$" + n.toFixed(4);
  return "$0.00";
}

export function formatTokens(n: number): string {
  if (!isFinite(n) || n < 0) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function monthKey(dateISO: string): string {
  return dateISO.slice(0, 7); // YYYY-MM
}

export function isValidDateISO(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

const CSV_HEADER = "date,provider,model,input_tokens,output_tokens,note";

function splitCsvLine(line: string): string[] {
  // Handles quoted fields with commas and escaped quotes.
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function matchProvider(raw: string): Provider | undefined {
  const q = raw.trim().toLowerCase();
  return PROVIDERS.find((p) => p.id.toLowerCase() === q || p.name.toLowerCase() === q);
}

function matchModel(provider: Provider, raw: string): ModelPrice | undefined {
  const q = raw.trim().toLowerCase();
  return provider.models.find((m) => m.id.toLowerCase() === q || m.label.toLowerCase() === q);
}

export function parseCsv(text: string): { entries: UsageEntry[]; errors: string[] } {
  const entries: UsageEntry[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { entries, errors: ["CSV is empty."] };

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const hasHeader = header.includes("date") && header.includes("provider");
  const dataLines = hasHeader ? lines.slice(1) : lines;
  if (!dataLines.length) return { entries, errors: ["No data rows found."] };

  dataLines.forEach((line, idx) => {
    const rowNum = idx + (hasHeader ? 2 : 1);
    const cols = splitCsvLine(line);
    if (cols.length < 5) {
      errors.push(`Row ${rowNum}: expected at least 5 columns (date,provider,model,input_tokens,output_tokens).`);
      return;
    }
    const [dateRaw, providerRaw, modelRaw, inRaw, outRaw, ...rest] = cols;
    if (!isValidDateISO(dateRaw)) { errors.push(`Row ${rowNum}: bad date "${dateRaw}" (use YYYY-MM-DD).`); return; }
    const provider = matchProvider(providerRaw);
    if (!provider) { errors.push(`Row ${rowNum}: unknown provider "${providerRaw}".`); return; }
    const model = matchModel(provider, modelRaw);
    if (!model) { errors.push(`Row ${rowNum}: unknown model "${modelRaw}" for ${provider.name}.`); return; }
    const inputTokens = Number(inRaw.replace(/[,_\s]/g, ""));
    const outputTokens = Number(outRaw.replace(/[,_\s]/g, ""));
    if (!Number.isFinite(inputTokens) || inputTokens < 0 || !Number.isFinite(outputTokens) || outputTokens < 0) {
      errors.push(`Row ${rowNum}: token counts must be non-negative numbers.`);
      return;
    }
    entries.push({
      id: uid(),
      date: dateRaw,
      providerId: provider.id,
      modelId: model.id,
      inputTokens: Math.round(inputTokens),
      outputTokens: Math.round(outputTokens),
      note: rest.join(", ").trim() || undefined,
    });
  });
  return { entries, errors };
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function exportCsv(entries: UsageEntry[]): string {
  const rows = entries.map((e) =>
    [e.date, e.providerId, e.modelId, String(e.inputTokens), String(e.outputTokens), csvEscape(e.note ?? "")].join(",")
  );
  return [CSV_HEADER, ...rows].join("\n");
}

export const SAMPLE_CSV = `${CSV_HEADER}
2026-09-20,openai,gpt-4o,1200000,340000,homepage rewrite
2026-09-21,anthropic,claude-sonnet-4,860000,210000,code review
2026-09-22,google,gemini-2.5-flash,2400000,900000,doc summaries`;
