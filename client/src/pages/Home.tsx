import { toast } from "sonner";
import { useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarDays,
  Coins,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  PencilLine,
  Plus,
  RotateCcw,
  Scale,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  Trophy,
  Upload,
  Wallet,
  Zap,
} from "lucide-react";
import {
  DEFAULT_STORE,
  PROVIDERS,
  SAMPLE_CSV,
  UsageEntry,
  costOf,
  exportCsv,
  findProvider,
  formatTokens,
  formatUSD,
  isValidDateISO,
  loadStore,
  modelLabel,
  monthKey,
  parseCsv,
  providerName,
  saveStore,
  todayISO,
  uid,
  type PriceOverride,
  type StoreState,
} from "@/lib/costs";
import { cn } from "@/lib/utils";

const CHART_TOOLTIP = {
  backgroundColor: "#0c1118",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  fontSize: 12,
  color: "#e2e8f0",
};

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={CHART_TOOLTIP} className="px-3 py-2">
      {label != null && <div className="mb-1 font-semibold text-slate-200">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-slate-300">
          {p.payload?.fill && <span className="h-2 w-2 rounded-full" style={{ background: p.payload.fill }} />}
          <span>{p.name}: <strong className="text-white">{formatUSD(Number(p.value))}</strong></span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card className="border-white/[0.08] bg-white/[0.025]">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint/10 text-mint">{icon}</div>
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</div>
          <div className="truncate font-display text-2xl font-bold text-white">{value}</div>
          <div className="truncate text-[11px] text-slate-500">{sub}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.015] px-6 py-14 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-slate-500">
        <Sparkles size={20} />
      </div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">{body}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>
    </div>
  );
}

export default function Home() {
  const [store, setStore] = useState<StoreState>(() => loadStore());
  const [tab, setTab] = useState("dashboard");
  const { entries, priceOverrides, budget } = store;

  const update = (next: StoreState) => {
    setStore(next);
    saveStore(next);
  };

  // ---- log form ----
  const [date, setDate] = useState(todayISO());
  const [providerId, setProviderId] = useState(PROVIDERS[0].id);
  const [modelId, setModelId] = useState(PROVIDERS[0].models[0].id);
  const [inTok, setInTok] = useState("100000");
  const [outTok, setOutTok] = useState("25000");
  const [note, setNote] = useState("");

  // ---- csv ----
  const [csvText, setCsvText] = useState("");
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [lastImport, setLastImport] = useState(0);

  // ---- compare ----
  const [cmpIn, setCmpIn] = useState("1000000");
  const [cmpOut, setCmpOut] = useState("500000");

  // ---- settings ----
  const [priceDraft, setPriceDraft] = useState<Record<string, { i: string; o: string }> | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<string | null>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);

  const enriched = useMemo(
    () => entries.map((e) => ({ ...e, cost: costOf(e, priceOverrides) })),
    [entries, priceOverrides]
  );

  const stats = useMemo(() => {
    const totalSpend = enriched.reduce((s, e) => s + e.cost, 0);
    const thisMonth = monthKey(todayISO());
    const monthSpend = enriched.filter((e) => monthKey(e.date) === thisMonth).reduce((s, e) => s + e.cost, 0);
    const totalTokens = enriched.reduce((s, e) => s + e.inputTokens + e.outputTokens, 0);
    const byModel = new Map<string, { label: string; spend: number }>();
    enriched.forEach((e) => {
      const key = `${e.providerId}/${e.modelId}`;
      const cur = byModel.get(key) ?? { label: modelLabel(e.providerId, e.modelId), spend: 0 };
      cur.spend += e.cost;
      byModel.set(key, cur);
    });
    const top = [...byModel.values()].sort((a, b) => b.spend - a.spend)[0];
    return { totalSpend, monthSpend, totalTokens, topModel: top, entryCount: entries.length };
  }, [enriched, entries.length]);

  const daily = useMemo(() => {
    const days: { d: string; label: string; spend: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      days.push({
        d: iso,
        label: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        spend: 0,
      });
    }
    const map = new Map(days.map((x) => [x.d, x]));
    enriched.forEach((e) => {
      const slot = map.get(e.date);
      if (slot) slot.spend += e.cost;
    });
    return days;
  }, [enriched]);

  const byProvider = useMemo(() => {
    const map = new Map<string, number>();
    enriched.forEach((e) => map.set(e.providerId, (map.get(e.providerId) ?? 0) + e.cost));
    return [...map.entries()]
      .map(([id, value]) => ({
        name: providerName(id),
        value: Math.round(value * 10000) / 10000,
        fill: findProvider(id)?.color ?? "#8ef0c1",
      }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [enriched]);

  const byModel = useMemo(() => {
    const map = new Map<string, { name: string; spend: number }>();
    enriched.forEach((e) => {
      const key = `${e.providerId}/${e.modelId}`;
      const cur = map.get(key) ?? { name: modelLabel(e.providerId, e.modelId), spend: 0 };
      cur.spend += e.cost;
      map.set(key, cur);
    });
    return [...map.values()].sort((a, b) => b.spend - a.spend).slice(0, 8)
      .map((x) => ({ name: x.name.length > 18 ? x.name.slice(0, 17) + "…" : x.name, spend: Math.round(x.spend * 10000) / 10000 }));
  }, [enriched]);

  const compareRows = useMemo(() => {
    const inN = Math.max(0, Number(String(cmpIn).replace(/[,_\s]/g, "")) || 0);
    const outN = Math.max(0, Number(String(cmpOut).replace(/[,_\s]/g, "")) || 0);
    const rows: { provider: string; model: string; inPrice: number; outPrice: number; cost: number }[] = [];
    PROVIDERS.forEach((p) =>
      p.models.forEach((m) => {
        const o = priceOverrides[m.id];
        const ip = o?.inputPer1M ?? m.inputPer1M;
        const op = o?.outputPer1M ?? m.outputPer1M;
        rows.push({
          provider: p.name,
          model: m.label,
          inPrice: ip,
          outPrice: op,
          cost: (inN / 1_000_000) * ip + (outN / 1_000_000) * op,
        });
      })
    );
    return rows.sort((a, b) => a.cost - b.cost);
  }, [cmpIn, cmpOut, priceOverrides]);

  const budgetPct = budget > 0 ? (stats.monthSpend / budget) * 100 : 0;

  // ---- actions ----
  const addEntry = () => {
    if (!isValidDateISO(date)) { toast.error("Pick a valid date"); return; }
    const provider = findProvider(providerId);
    if (!provider) { toast.error("Pick a provider"); return; }
    const inN = Math.round(Number(inTok.replace(/[,_\s]/g, "")));
    const outN = Math.round(Number(outTok.replace(/[,_\s]/g, "")));
    if (!Number.isFinite(inN) || inN < 0 || !Number.isFinite(outN) || outN < 0) {
      toast.error("Token counts must be non-negative numbers");
      return;
    }
    const entry: UsageEntry = { id: uid(), date, providerId, modelId, inputTokens: inN, outputTokens: outN, note: note.trim() || undefined };
    update({ ...store, entries: [entry, ...store.entries] });
    setNote("");
    toast.success("Usage logged", { description: `${modelLabel(providerId, modelId)} · ${formatUSD(costOf(entry, priceOverrides))}` });
  };

  const deleteEntry = (id: string) => {
    update({ ...store, entries: store.entries.filter((e) => e.id !== id) });
    toast.success("Entry deleted");
  };

  const importCsv = () => {
    if (!csvText.trim()) { toast.error("Paste some CSV first"); return; }
    const { entries: parsed, errors } = parseCsv(csvText);
    setCsvErrors(errors);
    setLastImport(parsed.length);
    if (parsed.length) {
      update({ ...store, entries: [...parsed, ...store.entries] });
      setCsvText("");
      toast.success(`Imported ${parsed.length} ${parsed.length === 1 ? "entry" : "entries"}`,
        { description: errors.length ? `${errors.length} rows skipped` : "Everything stayed in your browser." });
    } else {
      toast.error("Nothing imported", { description: errors[0] ?? "Check the CSV format." });
    }
  };

  const loadSampleData = () => {
    const { entries: parsed } = parseCsv(SAMPLE_CSV);
    update({ ...store, entries: [...parsed, ...store.entries] });
    toast.success(`Loaded ${parsed.length} sample entries`, { description: "Explore the dashboard, then clear them anytime." });
  };

  const downloadEntriesCsv = () => {
    if (!entries.length) { toast.error("Nothing to export yet"); return; }
    const blob = new Blob([exportCsv(entries)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ai-cost-tracker.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ai-cost-tracker-backup.json"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  };

  const importJsonFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? "")) as Partial<StoreState>;
        if (!Array.isArray(parsed.entries)) throw new Error("bad file");
        update({
          entries: parsed.entries,
          priceOverrides: parsed.priceOverrides && typeof parsed.priceOverrides === "object" ? parsed.priceOverrides : {},
          budget: typeof parsed.budget === "number" ? parsed.budget : DEFAULT_STORE.budget,
        });
        toast.success("Backup restored", { description: `${parsed.entries.length} entries loaded.` });
      } catch {
        toast.error("Could not read that backup file");
      }
    };
    reader.onerror = () => toast.error("Could not read that file");
    reader.readAsText(file);
  };

  const clearAll = () => {
    update({ ...DEFAULT_STORE });
    setPriceDraft(null);
    setBudgetDraft(null);
    toast.success("All data cleared");
  };

  const effectivePrices = useMemo(() => {
    const map: Record<string, { i: number; o: number }> = {};
    PROVIDERS.forEach((p) => p.models.forEach((m) => {
      const o = priceOverrides[m.id];
      map[m.id] = { i: o?.inputPer1M ?? m.inputPer1M, o: o?.outputPer1M ?? m.outputPer1M };
    }));
    return map;
  }, [priceOverrides]);

  const draft = priceDraft ?? Object.fromEntries(
    Object.entries(effectivePrices).map(([k, v]) => [k, { i: String(v.i), o: String(v.o) }])
  );

  const savePrices = () => {
    const next: Record<string, PriceOverride> = {};
    PROVIDERS.forEach((p) => p.models.forEach((m) => {
      const d = draft[m.id];
      if (!d) return;
      const i = Number(d.i), o = Number(d.o);
      if (Number.isFinite(i) && i >= 0 && Number.isFinite(o) && o >= 0 && (i !== m.inputPer1M || o !== m.outputPer1M)) {
        next[m.id] = { inputPer1M: i, outputPer1M: o };
      }
    }));
    update({ ...store, priceOverrides: next });
    setPriceDraft(null);
    toast.success("Prices updated", { description: "Your overrides are stored locally." });
  };

  const resetPrices = () => {
    update({ ...store, priceOverrides: {} });
    setPriceDraft(null);
    toast.success("Prices reset to defaults");
  };

  const sortedEntries = useMemo(
    () => [...enriched].sort((a, b) => b.date.localeCompare(a.date) || b.cost - a.cost),
    [enriched]
  );

  const provider = findProvider(providerId) ?? PROVIDERS[0];

  return (
    <div className="min-h-screen bg-[#080b10] text-slate-100 selection:bg-mint/30 selection:text-white">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#080b10]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[70px] max-w-[1440px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-mint text-[#07100d] shadow-[0_0_24px_rgba(142,240,193,0.22)]">
              <Coins size={19} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-[15px] font-bold tracking-tight text-white">AI Cost Tracker</span>
                <span className="rounded-full border border-mint/20 bg-mint/[0.08] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-mint">Open source</span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">Multi-provider LLM spend dashboard</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-[11px] text-slate-500 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_9px_#8ef0c1]" />
            100% local — no API keys needed, nothing leaves your browser
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 py-7 lg:px-8 lg:py-10">
        <div className="mb-7 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-mint">
              <Sparkles size={14} /> FinOps for AI builders
            </div>
            <h1 className="font-display text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl">
              Know exactly what your AI costs.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Log token usage across OpenAI, Anthropic, Google, DeepSeek, xAI and Mistral —
              see spend per day, per provider and per model. No accounts, no keys, no uploads.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="mb-6 grid w-full grid-cols-2 gap-1 bg-white/[0.04] p-1 sm:grid-cols-4">
            <TabsTrigger value="dashboard" className="flex items-center gap-2 data-[state=active]:bg-mint data-[state=active]:text-[#07100d]">
              <LayoutDashboard size={15} /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="log" className="flex items-center gap-2 data-[state=active]:bg-mint data-[state=active]:text-[#07100d]">
              <PencilLine size={15} /> Log usage
            </TabsTrigger>
            <TabsTrigger value="compare" className="flex items-center gap-2 data-[state=active]:bg-mint data-[state=active]:text-[#07100d]">
              <Scale size={15} /> Compare
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2 data-[state=active]:bg-mint data-[state=active]:text-[#07100d]">
              <Settings size={15} /> Settings
            </TabsTrigger>
          </TabsList>

          {/* ------------------------------ DASHBOARD ------------------------------ */}
          <TabsContent value="dashboard" className="space-y-5">
            {entries.length === 0 ? (
              <EmptyState
                title="No usage logged yet"
                body="Add your first entry or load sample data to see the dashboard come alive — charts, provider breakdowns and budget tracking."
                action={
                  <>
                    <Button onClick={() => setTab("log")} className="bg-mint text-[#07100d] hover:bg-mint/90">
                      <Plus size={15} /> Log your first usage
                    </Button>
                    <Button variant="outline" onClick={loadSampleData} className="border-white/15 text-slate-300 hover:text-white">
                      <Sparkles size={15} /> Load sample data
                    </Button>
                  </>
                }
              />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard icon={<Wallet size={20} />} label="Total spend" value={formatUSD(stats.totalSpend)} sub={`${stats.entryCount} logged ${stats.entryCount === 1 ? "entry" : "entries"}`} />
                  <StatCard icon={<CalendarDays size={20} />} label="This month" value={formatUSD(stats.monthSpend)} sub={budget > 0 ? `of ${formatUSD(budget)} budget` : "no budget set"} />
                  <StatCard icon={<Zap size={20} />} label="Total tokens" value={formatTokens(stats.totalTokens)} sub="input + output" />
                  <StatCard icon={<Trophy size={20} />} label="Top model by spend" value={stats.topModel?.label ?? "—"} sub={stats.topModel ? formatUSD(stats.topModel.spend) : "log usage to find out"} />
                </div>

                {budget > 0 && (
                  <Card className="border-white/[0.08] bg-white/[0.025]">
                    <CardContent className="p-5">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-300">Monthly budget</span>
                        <span className={cn("font-mono font-semibold", budgetPct > 100 ? "text-rose-300" : budgetPct > 90 ? "text-amber-300" : "text-slate-400")}>
                          {formatUSD(stats.monthSpend)} / {formatUSD(budget)} · {budgetPct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                        <div
                          className={cn("h-full rounded-full transition-all", budgetPct > 100 ? "bg-rose-400" : budgetPct > 90 ? "bg-amber-300" : "bg-mint")}
                          style={{ width: `${Math.min(100, budgetPct)}%` }}
                        />
                      </div>
                      {budgetPct > 100 ? (
                        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-300"><TriangleAlert size={13} /> Over budget this month — time to switch cheaper models or cut usage.</p>
                      ) : budgetPct > 90 ? (
                        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-300"><TriangleAlert size={13} /> Almost at your monthly budget.</p>
                      ) : (
                        <p className="mt-2 text-[11px] text-slate-600">On track. Adjust the budget in Settings.</p>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Card className="border-white/[0.08] bg-white/[0.025]">
                  <CardHeader>
                    <CardTitle className="text-sm text-white">Spend per day</CardTitle>
                    <CardDescription className="text-xs">Last 30 days, all providers</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={daily} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8ef0c1" stopOpacity={0.45} />
                            <stop offset="100%" stopColor="#8ef0c1" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} interval={4} />
                        <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1 ? `$${v}` : `$${v.toFixed(2)}`)} width={52} />
                        <Tooltip content={<ChartTip />} />
                        <Area type="monotone" dataKey="spend" name="Spend" stroke="#8ef0c1" strokeWidth={2} fill="url(#spendGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <div className="grid gap-5 lg:grid-cols-2">
                  <Card className="border-white/[0.08] bg-white/[0.025]">
                    <CardHeader>
                      <CardTitle className="text-sm text-white">Spend by provider</CardTitle>
                      <CardDescription className="text-xs">Where your money goes</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[260px]">
                      {byProvider.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={byProvider} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2} strokeWidth={0}>
                              {byProvider.map((p) => <Cell key={p.name} fill={p.fill} />)}
                            </Pie>
                            <Tooltip content={<ChartTip />} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : <p className="py-20 text-center text-xs text-slate-600">No spend to chart yet.</p>}
                    </CardContent>
                    {byProvider.length > 0 && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 px-6 pb-5">
                        {byProvider.map((p) => (
                          <span key={p.name} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <span className="h-2 w-2 rounded-full" style={{ background: p.fill }} />{p.name} · {formatUSD(p.value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>

                  <Card className="border-white/[0.08] bg-white/[0.025]">
                    <CardHeader>
                      <CardTitle className="text-sm text-white">Spend by model</CardTitle>
                      <CardDescription className="text-xs">Top 8 models</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[260px]">
                      {byModel.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={byModel} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v}`} />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={110} />
                            <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                            <Bar dataKey="spend" name="Spend" fill="#8ef0c1" radius={[0, 6, 6, 0]} barSize={16} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <p className="py-20 text-center text-xs text-slate-600">No spend to chart yet.</p>}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* ------------------------------ LOG ------------------------------ */}
          <TabsContent value="log" className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="border-white/[0.08] bg-white/[0.025]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm text-white"><Plus size={15} className="text-mint" /> Log usage</CardTitle>
                  <CardDescription className="text-xs">Record one API session. Cost is calculated instantly from current prices.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-400">Date</Label>
                      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-white/10 bg-white/[0.04] text-slate-200" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-400">Provider</Label>
                      <Select value={providerId} onValueChange={(v) => { setProviderId(v); const p = findProvider(v); if (p) setModelId(p.models[0].id); }}>
                        <SelectTrigger className="border-white/10 bg-white/[0.04] text-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent>{PROVIDERS.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-slate-400">Model</Label>
                    <Select value={modelId} onValueChange={setModelId}>
                      <SelectTrigger className="border-white/10 bg-white/[0.04] text-slate-200"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {provider.models.map((m) => <SelectItem key={m.id} value={m.id}>{m.label} · ${m.inputPer1M}/${m.outputPer1M} per 1M</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-400">Input tokens</Label>
                      <Input inputMode="numeric" value={inTok} onChange={(e) => setInTok(e.target.value)} placeholder="100000" className="border-white/10 bg-white/[0.04] font-mono text-slate-200" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-400">Output tokens</Label>
                      <Input inputMode="numeric" value={outTok} onChange={(e) => setOutTok(e.target.value)} placeholder="25000" className="border-white/10 bg-white/[0.04] font-mono text-slate-200" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-slate-400">Note <span className="text-slate-600">(optional)</span></Label>
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. homepage rewrite" className="border-white/10 bg-white/[0.04] text-slate-200" />
                  </div>
                  <Button onClick={addEntry} className="w-full bg-mint font-semibold text-[#07100d] hover:bg-mint/90">
                    <Plus size={15} /> Add entry
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-white/[0.08] bg-white/[0.025]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm text-white"><FileSpreadsheet size={15} className="text-mint" /> Import CSV</CardTitle>
                  <CardDescription className="font-mono text-xs">date,provider,model,input_tokens,output_tokens[,note]</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder={SAMPLE_CSV}
                    spellCheck={false}
                    className="min-h-[148px] border-white/10 bg-white/[0.04] font-mono text-[12px] leading-5 text-slate-300 placeholder:text-slate-700"
                  />
                  <div className="flex gap-2">
                    <Button onClick={importCsv} className="bg-mint font-semibold text-[#07100d] hover:bg-mint/90"><Upload size={15} /> Import</Button>
                    <Button variant="outline" onClick={() => setCsvText(SAMPLE_CSV)} className="border-white/15 text-slate-300 hover:text-white">Load sample CSV</Button>
                  </div>
                  {lastImport > 0 && csvErrors.length === 0 && (
                    <p className="text-[11px] text-mint">Imported {lastImport} {lastImport === 1 ? "entry" : "entries"} cleanly.</p>
                  )}
                  {csvErrors.length > 0 && (
                    <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3">
                      <p className="mb-1 text-[11px] font-semibold text-rose-300">{lastImport} imported · {csvErrors.length} rows skipped:</p>
                      <ul className="max-h-32 space-y-1 overflow-auto text-[11px] text-rose-200/80">
                        {csvErrors.map((e, i) => <li key={i}>• {e}</li>)}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-white/[0.08] bg-white/[0.025]">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm text-white">Logged entries</CardTitle>
                  <CardDescription className="text-xs">{entries.length} {entries.length === 1 ? "entry" : "entries"} · {formatUSD(stats.totalSpend)} total</CardDescription>
                </div>
                {entries.length > 0 && (
                  <Button variant="outline" size="sm" onClick={downloadEntriesCsv} className="border-white/15 text-slate-300 hover:text-white">
                    <Download size={14} /> CSV
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {sortedEntries.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-600">Nothing logged yet — add an entry above or import a CSV.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/[0.07] hover:bg-transparent">
                          <TableHead className="text-slate-500">Date</TableHead>
                          <TableHead className="text-slate-500">Provider</TableHead>
                          <TableHead className="text-slate-500">Model</TableHead>
                          <TableHead className="text-right text-slate-500">In</TableHead>
                          <TableHead className="text-right text-slate-500">Out</TableHead>
                          <TableHead className="text-right text-slate-500">Cost</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedEntries.map((e) => (
                          <TableRow key={e.id} className="border-white/[0.06]">
                            <TableCell className="font-mono text-xs text-slate-400">{e.date}</TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1.5 text-xs text-slate-300">
                                <span className="h-2 w-2 rounded-full" style={{ background: findProvider(e.providerId)?.color }} />
                                {providerName(e.providerId)}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-slate-300">{modelLabel(e.providerId, e.modelId)}{e.note && <span className="block truncate text-[10px] text-slate-600">{e.note}</span>}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-slate-400">{formatTokens(e.inputTokens)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-slate-400">{formatTokens(e.outputTokens)}</TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold text-mint">{formatUSD(e.cost)}</TableCell>
                            <TableCell>
                              <button onClick={() => deleteEntry(e.id)} title="Delete entry" className="grid h-7 w-7 place-items-center rounded-md text-slate-600 transition hover:bg-rose-400/10 hover:text-rose-300">
                                <Trash2 size={14} />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ------------------------------ COMPARE ------------------------------ */}
          <TabsContent value="compare" className="space-y-5">
            <Card className="border-white/[0.08] bg-white/[0.025]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm text-white"><Scale size={15} className="text-mint" /> Same workload, different models</CardTitle>
                <CardDescription className="text-xs">Enter a token workload once — see what every model would charge for it.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid max-w-lg grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-slate-400">Input tokens</Label>
                    <Input inputMode="numeric" value={cmpIn} onChange={(e) => setCmpIn(e.target.value)} className="border-white/10 bg-white/[0.04] font-mono text-slate-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-slate-400">Output tokens</Label>
                    <Input inputMode="numeric" value={cmpOut} onChange={(e) => setCmpOut(e.target.value)} className="border-white/10 bg-white/[0.04] font-mono text-slate-200" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/[0.08] bg-white/[0.025]">
              <CardContent className="pt-5">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/[0.07] hover:bg-transparent">
                        <TableHead className="text-slate-500">Model</TableHead>
                        <TableHead className="text-slate-500">Provider</TableHead>
                        <TableHead className="text-right text-slate-500">Input / 1M</TableHead>
                        <TableHead className="text-right text-slate-500">Output / 1M</TableHead>
                        <TableHead className="text-right text-slate-500">Workload cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {compareRows.map((r, i) => (
                        <TableRow key={`${r.provider}-${r.model}`} className={cn("border-white/[0.06]", i === 0 && "bg-mint/[0.05]")}>
                          <TableCell className="text-xs font-semibold text-slate-200">
                            <span className="flex items-center gap-2">
                              {r.model}
                              {i === 0 && <Badge className="bg-mint text-[10px] font-bold text-[#07100d] hover:bg-mint">Cheapest</Badge>}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-slate-400">{r.provider}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-slate-400">${r.inPrice}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-slate-400">${r.outPrice}</TableCell>
                          <TableCell className={cn("text-right font-mono text-xs font-semibold", i === 0 ? "text-mint" : "text-slate-300")}>{formatUSD(r.cost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-slate-600">
                  Switching from the priciest to the cheapest model for this workload would save{" "}
                  <strong className="text-mint">{formatUSD(compareRows[compareRows.length - 1].cost - compareRows[0].cost)}</strong> per run.
                  Prices are estimates — edit them in Settings.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ------------------------------ SETTINGS ------------------------------ */}
          <TabsContent value="settings" className="space-y-5">
            <Card className="border-white/[0.08] bg-white/[0.025]">
              <CardHeader>
                <CardTitle className="text-sm text-white">Monthly budget</CardTitle>
                <CardDescription className="text-xs">The dashboard warns you when spend passes 90% of this.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex max-w-xs items-center gap-2">
                  <span className="text-sm text-slate-500">$</span>
                  <Input
                    type="number" min={0}
                    value={budgetDraft ?? String(budget)}
                    onChange={(e) => {
                      setBudgetDraft(e.target.value);
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= 0) update({ ...store, budget: v });
                    }}
                    className="border-white/10 bg-white/[0.04] font-mono text-slate-200"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/[0.08] bg-white/[0.025]">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm text-white">Model prices <span className="font-normal text-slate-500">(USD per 1M tokens)</span></CardTitle>
                  <CardDescription className="text-xs">Prices change — override any of them. Overrides are stored locally.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={resetPrices} className="border-white/15 text-slate-300 hover:text-white">
                    <RotateCcw size={14} /> Reset to defaults
                  </Button>
                  <Button size="sm" onClick={savePrices} className="bg-mint font-semibold text-[#07100d] hover:bg-mint/90">Save prices</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {PROVIDERS.map((p) => (
                  <div key={p.id}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                      <span className="text-xs font-semibold text-slate-200">{p.name}</span>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/[0.07] hover:bg-transparent">
                            <TableHead className="text-slate-500">Model</TableHead>
                            <TableHead className="text-right text-slate-500">Input $ / 1M</TableHead>
                            <TableHead className="text-right text-slate-500">Output $ / 1M</TableHead>
                            <TableHead className="w-24 text-right text-slate-500">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {p.models.map((m) => {
                            const d = draft[m.id] ?? { i: String(m.inputPer1M), o: String(m.outputPer1M) };
                            const edited = d.i !== String(m.inputPer1M) || d.o !== String(m.outputPer1M);
                            return (
                              <TableRow key={m.id} className="border-white/[0.06]">
                                <TableCell className="text-xs text-slate-300">{m.label}<span className="block font-mono text-[10px] text-slate-600">{m.id}</span></TableCell>
                                <TableCell className="text-right">
                                  <Input type="number" min={0} step="any" value={d.i}
                                    onChange={(e) => setPriceDraft({ ...draft, [m.id]: { ...d, i: e.target.value } })}
                                    className="ml-auto w-28 border-white/10 bg-white/[0.04] text-right font-mono text-xs text-slate-200" />
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input type="number" min={0} step="any" value={d.o}
                                    onChange={(e) => setPriceDraft({ ...draft, [m.id]: { ...d, o: e.target.value } })}
                                    className="ml-auto w-28 border-white/10 bg-white/[0.04] text-right font-mono text-xs text-slate-200" />
                                </TableCell>
                                <TableCell className="text-right">
                                  {edited
                                    ? <Badge variant="outline" className="border-amber-300/30 text-[10px] text-amber-300">edited</Badge>
                                    : <Badge variant="outline" className="border-white/10 text-[10px] text-slate-600">default</Badge>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-white/[0.08] bg-white/[0.025]">
              <CardHeader>
                <CardTitle className="text-sm text-white">Backup & data</CardTitle>
                <CardDescription className="text-xs">Everything lives in this browser's localStorage.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={exportJson} className="border-white/15 text-slate-300 hover:text-white">
                  <Download size={15} /> Export JSON
                </Button>
                <Button variant="outline" onClick={() => jsonFileRef.current?.click()} className="border-white/15 text-slate-300 hover:text-white">
                  <Upload size={15} /> Import JSON
                </Button>
                <input ref={jsonFileRef} accept=".json,application/json" className="hidden" type="file"
                  onChange={(e) => { importJsonFile(e.target.files?.[0]); e.target.value = ""; }} />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="border-rose-400/30 text-rose-300 hover:bg-rose-400/10 hover:text-rose-200">
                      <Trash2 size={15} /> Clear all data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-white/10 bg-[#0c1118]">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">Delete everything?</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400">
                        This removes all {entries.length} logged {entries.length === 1 ? "entry" : "entries"}, price overrides and your budget from this browser. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-white/15 text-slate-300">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={clearAll} className="bg-rose-500 text-white hover:bg-rose-600">Delete all</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-14 grid gap-4 border-t border-white/[0.07] pt-8 sm:grid-cols-3">
          <div className="feature-note"><div className="feature-icon"><ShieldCheck size={16} /></div><div><h2>Private by design</h2><p>No API keys, no accounts — your usage data never leaves this tab.</p></div></div>
          <div className="feature-note"><div className="feature-icon"><Scale size={16} /></div><div><h2>Compare honestly</h2><p>See what the same workload costs on every major model.</p></div></div>
          <div className="feature-note"><div className="feature-icon"><Wallet size={16} /></div><div><h2>Stay on budget</h2><p>Monthly budget tracking with warnings before you overspend.</p></div></div>
        </div>
      </main>
      <footer className="border-t border-white/[0.07] px-5 py-5 text-center text-[11px] text-slate-600">
        Built for AI builders who want fewer surprises on their API bill.
      </footer>
    </div>
  );
}
