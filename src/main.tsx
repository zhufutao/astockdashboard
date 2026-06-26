import { StrictMode, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Bitcoin,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  CircleGauge,
  Database,
  ExternalLink,
  FileText,
  Layers3,
  LogOut,
  Plus,
  Radio,
  RefreshCcw,
  Shield,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  UserPlus,
  Users
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import "./styles.css";

type User = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "user";
};

type Indicator = {
  id: string;
  name: string;
  category: string;
  description: string;
  weight: number;
  enabled: boolean;
  source_type: "auto" | "manual" | "pending";
  source_name: string;
  source_url: string | null;
  threshold_note: string;
  near_threshold: number | null;
  hit_threshold: number | null;
  current_value: number | null;
  current_text: string | null;
  status: "not_hit" | "near" | "hit" | "pending" | "manual" | "failed";
  contribution: number;
  last_updated: string | null;
};

type Dashboard = {
  score: number;
  rawScore: number;
  totalWeight: number;
  riskLevel: string;
  hitCount: number;
  totalCount: number;
  connectedCount: number;
  pendingCount: number;
  failedCount: number;
  indicators: Indicator[];
};

type Strategy = {
  title: string;
  summary: string;
  source_note: string;
  updated_at: string;
  content: {
    rules: string[];
    conclusion: string;
    backtest: Array<Record<string, string | number>>;
    riskNotes: string[];
  };
  realtime: null | {
    source: string;
    date?: string;
    open?: number;
    close?: number;
    high?: number;
    low?: number;
    changePct?: number;
    triggered?: boolean;
    action?: string;
    error?: string;
    message?: string;
    updatedAt: string;
  };
};

type BtcLighthouseState = "empty" | "build_1" | "build_2" | "full" | "top_watch" | "clear";
type BtcTriggerRecord = {
  signalDate: string;
  executionDate: string;
  action: "BUY" | "SELL_EXTREME" | "SELL_CONFIRM" | "SELL_MATURE_TREND";
  actionLabel: string;
  executionPrice: number;
  signalPrice: number;
  targetPosition: number;
  bottomScore: number;
  topScore: number;
  bottomGroups: number;
  drawdown: number;
  mvrv: number;
  nupl: number | null;
  puell: number | null;
  mayer: number | null;
  reason: string;
};
type BtcMatureSignal = {
  multiple: number;
  label: string;
  role: "defensive" | "default" | "aggressive";
  reached: boolean;
  active: boolean;
  peakMultiple: number | null;
  drawdownFromPeak: number | null;
  triggerPrice: number | null;
  targetPeakPrice: number | null;
  distanceToMultiple: number | null;
  action: string;
  note: string;
};
type BtcLighthouseLatest = {
  id: string;
  strategy_version: string;
  signal_date: string;
  state: BtcLighthouseState;
  state_label: string;
  suggested_action: string;
  recommended_position: number;
  current_position: number;
  price: number;
  bottom_score: number;
  top_score: number;
  bottom_groups: number;
  trigger_summary: string;
  source_status: "ok" | "failed";
  source_message: string | null;
  data_updated_at: string | null;
  updated_at: string;
  metrics: {
    mvrv?: number;
    nupl?: number;
    puell?: number;
    mayer?: number;
    drawdown?: number;
    ma20w?: number;
    ma200d?: number;
    ma200w?: number;
    mvrvZ?: number;
    piCycleRecent?: boolean;
  };
  state_details: {
    avgEntry?: number;
    cyclePeak?: number;
    topWatch?: boolean;
    watchPeak?: number;
    matureReduced?: boolean;
    peakMultiple?: number | null;
    drawdownFromPositionPeak?: number | null;
    matureSignals?: BtcMatureSignal[];
    boughtLevels?: number[];
  };
  triggers?: BtcTriggerRecord[];
};
type BtcRealtimeTicker = {
  source: string;
  symbol: string;
  price: number | null;
  priceChangePercent: number | null;
  updatedAt: string;
  status: "ok" | "failed";
  message?: string;
};
type BtcLighthouseHistory = Pick<BtcLighthouseLatest, "signal_date" | "state" | "state_label" | "suggested_action" | "recommended_position" | "current_position" | "price" | "bottom_score" | "top_score" | "bottom_groups" | "trigger_summary">;

type AssetType = "stock" | "etf" | "other";
type FoundationConclusion = "不碰" | "只观察" | "等回调" | "低位分批" | "已具备较好安全边际";

type FoundationLevels = {
  no_chase: string;
  observe: string;
  reasonable: string;
  safe: string;
  bargain: string;
  deep_value_review: string;
  stop_loss: string;
  reduce: string;
  sell: string;
  keep: string;
};
type FoundationPriceKey = keyof FoundationLevels | "none";
type CombinedActionName = "可建仓" | "小仓试" | "只观察" | "等价格" | "减仓" | "清仓";
type CombinedAction = {
  action: CombinedActionName;
  suggested_position: number;
  reason: string;
};
type FoundationIntegrationContext = {
  matched: boolean;
  id: string | null;
  code: string | null;
  name: string | null;
  current_price: number | null;
  conclusion: FoundationConclusion | null;
  primary_hit_key: FoundationPriceKey | null;
  primary_hit_label: string;
  primary_hit_note: string;
  primary_hit_level: string | null;
  hit_fields: string[];
};
type JindanIntegrationContext = {
  matched: boolean;
  code: string | null;
  name: string | null;
  enhanced_signal: string | null;
  enhanced_label: string | null;
  suggested_position: number | null;
  suggested_action: string | null;
  trend_state: JindanRow["trend_state"] | null;
  source_status: JindanRow["source_status"] | null;
  combined_action?: CombinedAction | null;
};

type FoundationRaw = {
  id: string;
  asset_type: AssetType;
  name: string;
  code: string;
  market: string;
  enabled: number;
  sort_order: number;
  current_price: number | null;
  no_chase_min: number | null;
  observe_min: number | null;
  observe_max: number | null;
  reasonable_min: number | null;
  reasonable_max: number | null;
  safe_min: number | null;
  safe_max: number | null;
  bargain_min: number | null;
  bargain_max: number | null;
  stop_loss: number | null;
  reduce_min: number | null;
  reduce_max: number | null;
  sell_min: number | null;
  sell_max: number | null;
  keep_min: number | null;
  conclusion: FoundationConclusion;
  analysis_markdown: string;
  analysis_json: string;
  analysis_updated_at: string | null;
};

type FoundationAsset = {
  id: string;
  asset_type: AssetType;
  name: string;
  code: string;
  market: string;
  style_tag: string;
  enabled: boolean;
  sort_order: number;
  current_price: number | null;
  price_source: string | null;
  price_status: "pending" | "ok" | "failed" | "manual";
  price_error: string | null;
  price_updated_at: string | null;
  conclusion: FoundationConclusion;
  analysis_updated_at: string | null;
  levels: FoundationLevels;
  hit_fields: string[];
  raw?: FoundationRaw;
  analysis_markdown?: string;
  jindan_gate?: JindanIntegrationContext | null;
};

type FoundationSettings = {
  refresh_seconds: number;
  trading_refresh_seconds: number;
  offhours_refresh_seconds: number;
  active_refresh_seconds?: number;
  is_trading_time?: boolean;
};
type FoundationHitSummaryAsset = Pick<FoundationAsset, "id" | "code" | "name" | "current_price">;
type FoundationHitSummaryGroup = {
  key: keyof FoundationLevels;
  label: string;
  count: number;
  assets: FoundationHitSummaryAsset[];
};
type FoundationHitSummary = {
  buy: FoundationHitSummaryGroup[];
  review?: FoundationHitSummaryGroup[];
  sell: FoundationHitSummaryGroup[];
};
type JindanAssetType = "stock" | "index" | "etf" | "crypto" | "commodity" | "other";
type JindanDataSource = "tushare_daily" | "tushare_index_daily" | "tushare_fund_daily" | "ths_index_daily" | "binance_daily" | "yahoo_chart";
type JindanAsset = {
  id: string;
  asset_type: JindanAssetType;
  name: string;
  code: string;
  market: string;
  data_source: JindanDataSource;
  enabled: number;
  highlighted: number;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};
type JindanSnapshot = {
  id: string;
  report_date: string;
  generated_at: string;
};
type JindanRow = {
  id: string;
  snapshot_id: string;
  asset_id: string;
  rank: number | null;
  previous_rank: number | null;
  rank_change: number | null;
  code: string;
  name: string;
  market: string;
  asset_type: JindanAssetType;
  data_source: JindanDataSource;
  highlighted: number;
  pct_chg: number | null;
  close: number | null;
  ma20: number | null;
  ma60: number | null;
  ma20_slope_pct: number | null;
  atr20: number | null;
  deviation_pct: number | null;
  volume_ratio: number | null;
  trend_state: "strong" | "weak" | "unknown";
  enhanced_signal: string | null;
  enhanced_label: string | null;
  suggested_position: number | null;
  suggested_action: string | null;
  filter_flags_json: string | null;
  filter_summary: string | null;
  state_changed_at: string | null;
  interval_pct: number | null;
  actual_trade_date: string | null;
  source_status: "ok" | "failed" | "insufficient";
  source_error: string | null;
  foundation_match?: FoundationIntegrationContext | null;
  combined_action?: CombinedAction | null;
};
type JindanOverview = {
  snapshot: JindanSnapshot | null;
  rows: JindanRow[];
  assets_count: number;
};
type AdminUser = User & { disabled: number; created_at: string };
type FlowLabCandidate = {
  id: string;
  code: string;
  name: string;
  board: string;
  rank: number | null;
  score: number;
  status: "watch" | "paper_entry" | "blocked" | "closed";
  source_agreement: boolean;
  price: number | null;
  pct_chg: number | null;
  vwap: number | null;
  industry: string | null;
  concept_cluster: string | null;
  score_breakdown: Record<string, number>;
  reason: string;
  appearances: number;
  previous_days: Array<{ label: string; trade_date: string; appearances: number }>;
};
type FlowLabOverview = {
  latest: null | {
    id: string;
    strategy_version: string;
    captured_at: string;
    trade_date: string | null;
    market_state: "green" | "amber" | "red" | "unknown";
    data_status: "ok" | "partial" | "failed" | "pending";
    snapshot_count: number;
    summary: Record<string, unknown>;
  };
  candidates: FlowLabCandidate[];
  snapshots: Array<{
    id: string;
    source: "ths" | "eastmoney" | "tencent";
    dataset: "individual";
    captured_at: string;
    row_count: number;
    status: "ok" | "failed";
    error: string | null;
    rows: Array<{ rank: number; code: string | null; cells: string[] }>;
  }>;
  radar: { successful_snapshots: number; previous_trade_dates: string[] };
  positions: Array<{
    id: string; candidate_id: string; code?: string | null; board: string; entry_at: string; entry_price: number;
    exit_at: string | null; exit_slot: "09:30" | "09:35" | "09:45" | "10:00"; exit_price: number | null;
    position_weight: number; status: "open" | "closed"; return_pct: number | null; notes: string;
  }>;
  paper: {
    total: number; open_count: number; closed_count: number; wins: number; avg_return: number | null;
    by_exit_slot: Array<{ exit_slot: string; closed_count: number; wins: number; avg_return: number | null }>;
    by_board: Array<{ board: string; closed_count: number; wins: number; avg_return: number | null }>;
    by_data_mode: Array<{ data_mode: string; closed_count: number; wins: number; avg_return: number | null }>;
  };
  quotes: Array<{
    code: string; price: number | null; pre_close: number | null; pct_chg: number | null; quote_time: string | null; refreshed_at: string | null;
    trade_date: string | null; source: "ths"; status: "live" | "closed" | "stale" | "failed"; error: string | null;
    score_penalty: number; risk: string | null; blocked: boolean;
  }>;
};
type Page = "foundation" | "foundation-detail" | "jindan" | "flow-lab" | "dashboard" | "btc" | "admin";

const foundationAdminSections: Array<{ key: AssetType; title: string }> = [
  { key: "stock", title: "股票" },
  { key: "etf", title: "ETF" },
  { key: "other", title: "其他" }
];

const levelMeta = [
  ["no_chase", "禁追", "绝对不追价区间，高于该位置不新买"],
  ["observe", "观察", "可以开始跟踪，但不急着买"],
  ["reasonable", "合理", "具备一定性价比的买入区"],
  ["safe", "安全", "安全边际较高，值得认真考虑"],
  ["bargain", "捡漏", "恐慌或错杀时的极限低价区"],
  ["deep_value_review", "超跌", "低于极限捡漏区但未跌破买入逻辑失效位，需要复核下跌原因；不是自动加仓信号"],
  ["stop_loss", "止损", "买入逻辑失效/抄底失败认错位"],
  ["reduce", "减仓", "偏热时候的减仓观察区"],
  ["sell", "卖出", "明显高估/分批卖出区"],
  ["keep", "底仓", "极端高估/只留底仓区"]
] as const;

const buyKeys = ["no_chase", "observe", "reasonable", "safe", "bargain", "deep_value_review"] as const;
const sellKeys = ["stop_loss", "reduce", "sell", "keep"] as const;
const emptyHitSummary: FoundationHitSummary = { buy: [], sell: [] };
const defaultFoundationSettings: FoundationSettings = {
  refresh_seconds: 300,
  trading_refresh_seconds: 30,
  offhours_refresh_seconds: 300,
  active_refresh_seconds: 300,
  is_trading_time: false
};

const blankFoundationRaw: FoundationRaw = {
  id: "",
  asset_type: "stock",
  name: "",
  code: "",
  market: "A股",
  enabled: 1,
  sort_order: 0,
  current_price: null,
  no_chase_min: null,
  observe_min: null,
  observe_max: null,
  reasonable_min: null,
  reasonable_max: null,
  safe_min: null,
  safe_max: null,
  bargain_min: null,
  bargain_max: null,
  stop_loss: null,
  reduce_min: null,
  reduce_max: null,
  sell_min: null,
  sell_max: null,
  keep_min: null,
  conclusion: "只观察",
  analysis_markdown: "",
  analysis_json: "{}",
  analysis_updated_at: null
};

const jindanAssetTypes: Array<{ value: JindanAssetType; label: string }> = [
  { value: "stock", label: "股票" },
  { value: "index", label: "指数" },
  { value: "etf", label: "ETF" },
  { value: "crypto", label: "加密" },
  { value: "commodity", label: "商品" },
  { value: "other", label: "其他" }
];

const jindanDataSources: Array<{ value: JindanDataSource; label: string }> = [
  { value: "tushare_daily", label: "Tushare 股票日线(前复权)" },
  { value: "tushare_index_daily", label: "Tushare 指数日线" },
  { value: "tushare_fund_daily", label: "Tushare 基金日线" },
  { value: "ths_index_daily", label: "同花顺指数日线" },
  { value: "binance_daily", label: "Binance 日线" },
  { value: "yahoo_chart", label: "Yahoo 日线" }
];

const blankJindanAsset: JindanAsset = {
  id: "",
  asset_type: "stock",
  name: "",
  code: "",
  market: "A股",
  data_source: "tushare_daily",
  enabled: 1,
  highlighted: 0,
  sort_order: 0
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>("foundation");
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    api<{ user: User | null }>("/api/auth/me")
      .then((data) => setUser(data.user))
      .finally(() => setLoading(false));
  }, []);

  function openFoundationDetail(id: string) {
    setDetailId(id);
    setPage("foundation-detail");
  }

  if (loading) return <FullPageNote text="正在载入慢富" />;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <CircleGauge size={28} />
          <div>
            <strong>慢富</strong>
            <span>在K线里修个念头通达</span>
          </div>
        </div>
        <nav>
          <NavButton active={page === "foundation" || page === "foundation-detail"} onClick={() => setPage("foundation")} icon={<Layers3 size={18} />} label="筑基看板" />
          <NavButton active={page === "jindan"} onClick={() => setPage("jindan")} icon={<Activity size={18} />} label="结丹看板" />
          <NavButton active={page === "flow-lab"} onClick={() => setPage("flow-lab")} icon={<Radio size={18} />} label="早盘资金榜雷达" />
          <NavButton active={page === "btc"} onClick={() => setPage("btc")} icon={<Bitcoin size={18} />} label="BTC 捡漏策略" />
          <NavButton active={page === "dashboard"} onClick={() => setPage("dashboard")} icon={<BarChart3 size={18} />} label="见顶仪表盘" />
          {user.role === "admin" && <NavButton active={page === "admin"} onClick={() => setPage("admin")} icon={<SlidersHorizontal size={18} />} label="后台管理" />}
        </nav>
        <div className="account">
          <div>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button className="icon-button" aria-label="退出登录" title="退出登录" onClick={() => logout(setUser)}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <main>
        <div hidden={page !== "foundation"}>
          <FoundationBoard active={page === "foundation"} onOpen={openFoundationDetail} />
        </div>
        {page === "foundation-detail" && detailId && <FoundationDetailPage id={detailId} onBack={() => setPage("foundation")} />}
        {page === "jindan" && <JindanBoard />}
        {page === "flow-lab" && <FlowLabPage isAdmin={user.role === "admin"} />}
        {page === "dashboard" && <DashboardPage />}
        {page === "btc" && <BtcStrategyPage />}
        {page === "admin" && user.role === "admin" && <AdminPage />}
      </main>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  const displayLabel = label.startsWith("BTC ") ? "BTC 周期灯塔" : label;
  return <button className={active ? "active" : ""} onClick={onClick}>{icon} {displayLabel}</button>;
}

function FlowLabPage({ isAdmin }: { isAdmin: boolean }) {
  const [overview, setOverview] = useState<FlowLabOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(0);
  const [retentionDays, setRetentionDays] = useState(10);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState("");

  async function load(forceQuoteRefresh = false) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (forceQuoteRefresh) params.set("refresh_quotes", "force");
      params.set("_ts", String(Date.now()));
      setOverview(await api<FlowLabOverview>(`/api/flow-lab/overview?${params.toString()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "资金榜雷达数据读取失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!autoRefreshSeconds) return;
    const timer = window.setInterval(() => void load(true), autoRefreshSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [autoRefreshSeconds]);

  async function cleanupHistory() {
    if (!window.confirm(`将清理早盘资金榜雷达中早于最近 ${retentionDays} 个交易日的快照、候选记录和旧纸面记录。此操作无法恢复，是否继续？`)) return;
    setCleaning(true);
    setCleanupMessage("");
    try {
      const result = await api<{ skipped: boolean; available_trade_days: number; deleted: { candidates: number; snapshots: number; runs: number; paper_positions: number } }>("/api/flow-lab/cleanup", {
        method: "POST",
        body: JSON.stringify({ keep_trade_days: retentionDays })
      });
      setCleanupMessage(result.skipped
        ? `当前仅有 ${result.available_trade_days} 个交易日的数据，暂不需要清理。`
        : `已清理 ${result.deleted.runs} 轮快照、${result.deleted.candidates} 条候选记录。`);
      await load();
    } catch (err) {
      setCleanupMessage(err instanceof Error ? err.message : "历史数据清理失败");
    } finally {
      setCleaning(false);
    }
  }

  const latest = overview?.latest;
  const candidates = overview?.candidates ?? [];
  const snapshot = overview?.snapshots[0];
  const bestAppearance = candidates[0]?.appearances ?? 0;
  const successfulSnapshots = overview?.radar.successful_snapshots ?? 0;
  const quoteByCode = new Map((overview?.quotes ?? []).map((item) => [item.code, item]));

  return (
    <section className="page flow-lab-page radar-page">
      <header className="page-header flow-lab-header radar-header">
        <div>
          <div className="eyebrow"><Radio size={14} /> THS · 1 MINUTE RADAR</div>
          <h1>早盘资金榜雷达</h1>
          <p>只记录同花顺主力净流入额前 50 的重复出现。上榜次数用于识别持续性，不等于买入信号，更不是涨停预测。</p>
        </div>
        <div className="flow-lab-refresh-controls">
          <label className="flow-lab-auto-refresh">
            <span>实时刷新</span>
            <select value={autoRefreshSeconds} onChange={(event) => setAutoRefreshSeconds(Number(event.target.value))} aria-label="实时刷新频率">
              <option value={0}>关闭</option><option value={5}>5 秒</option><option value={10}>10 秒</option>
              <option value={15}>15 秒</option><option value={30}>30 秒</option><option value={60}>60 秒</option>
            </select>
          </label>
          <button className="button secondary header-action" onClick={() => void load(true)} disabled={loading}>
            <RefreshCcw size={16} className={loading ? "spin" : ""} /> 刷新快照
          </button>
          {isAdmin && <div className="radar-cleanup-controls">
            <label><span>保留</span><select value={retentionDays} onChange={(event) => setRetentionDays(Number(event.target.value))} aria-label="保留交易日数量"><option value={5}>5 日</option><option value={10}>10 日</option><option value={20}>20 日</option></select></label>
            <button className="button danger header-action" onClick={() => void cleanupHistory()} disabled={cleaning}>{cleaning ? "清理中…" : "清理历史"}</button>
          </div>}
        </div>
      </header>

      {error && <div className="error-text">{error}</div>}
      {cleanupMessage && <div className="radar-cleanup-message">{cleanupMessage}</div>}

      <section className="radar-summary">
        <article><span>最近快照</span><strong>{latest ? formatFlowLabTime(latest.captured_at) : "等待本地采集"}</strong><small>电脑每分钟上传一次</small></article>
        <article><span>交易日</span><strong>{latest?.trade_date ?? "—"}</strong><small>同一交易日累计上榜次数</small></article>
        <article><span>成功快照</span><strong>{successfulSnapshots} 次</strong><small>当天统计的分母</small></article>
        <article><span>最高重复上榜</span><strong>{bestAppearance} 次</strong><small>仅反映榜单持续性</small></article>
      </section>

      <div className="radar-method-note"><AlertTriangle size={17} /><span>涨幅风险按分板提示：主板 ≥5% 提醒、≥8% 高风险；创业板 / 科创板 ≥9% 提醒、≥14% 高风险。它是追高风险提示，不会自动下单或替你判断买卖。</span></div>

      <article className="panel flow-lab-candidates radar-candidates">
        <div className="panel-heading"><div><span className="eyebrow">TODAY'S REPEATED LIST</span><h2>候选池</h2></div><span className="muted">按上榜次数降序；同次数按最近榜单名次</span></div>
        {!loading && !candidates.length && <div className="empty-lab">还没有可用快照。启动本地采集器后，这里会显示当日出现过的个股及上榜次数。</div>}
        {!!candidates.length && <div className="table-scroll"><table className="flow-lab-table radar-table"><thead><tr><th>#</th><th>标的</th><th>分板</th><th>价格 / 涨跌幅</th><th>行业</th><th>概念</th><th>上榜频率</th><th>风险</th></tr></thead><tbody>
          {candidates.map((item, index) => {
            const quote = quoteByCode.get(item.code);
            const displayPrice = quote?.price ?? item.price;
            const displayPct = quote?.pct_chg ?? item.pct_chg;
            const quoteLabel = quote?.status === "live"
              ? `实时行情 · 更新 ${quoteRefreshTime(quote.quote_time ?? quote.refreshed_at ?? "")}`
              : "榜单快照";
            const risk = radarPriceRisk(item.board, displayPct);
            return <tr key={item.code}>
              <td className="radar-index">{index + 1}</td>
              <td><a className="radar-stock-link" href={`https://data.eastmoney.com/stockdata/${item.code}.html`} target="_blank" rel="noreferrer" title={`打开 ${item.name} 的东方财富个股数据页`}><strong>{item.name}</strong><small>{item.code}{item.rank ? ` · 最近榜单排名第 ${item.rank}` : ""}</small></a></td>
              <td><span className="board-tag">{item.board}</span></td>
              <td>{displayPrice === null ? "—" : <><b>{displayPrice.toFixed(2)}</b><small className={displayPct !== null && displayPct > 0 ? "quote-up" : displayPct !== null && displayPct < 0 ? "quote-down" : ""}>{displayPct === null ? "涨跌幅 —" : formatPct(displayPct)}</small><small className="quote-source">{quoteLabel}</small></>}</td>
              <td>{item.industry ?? <span className="muted">待补全</span>}</td>
              <td className="radar-concepts">{item.concept_cluster ?? <span className="muted">待补全</span>}</td>
              <td><b className="appearance-count">{item.appearances} / {successfulSnapshots || "—"}</b><small>{successfulSnapshots ? `${((item.appearances / successfulSnapshots) * 100).toFixed(1)}%` : "等待成功快照"}</small>{item.previous_days.length ? <small className="previous-appearances">{item.previous_days.filter((day) => day.appearances > 0).map((day) => `${day.label} ${day.appearances} 次`).join(" · ") || "前 3 个采集交易日未上榜"}</small> : <small className="previous-appearances">历史采集不足</small>}</td>
              <td>{risk ? <span className={`radar-risk ${risk.level}`}>{risk.text}</span> : <span className="muted">—</span>}</td>
            </tr>;
          })}
        </tbody></table></div>}
      </article>

      <article className="panel radar-snapshot">
        <div className="panel-heading"><div><span className="eyebrow">LATEST SNAPSHOT</span><h2>最近一次榜单快照</h2></div><span className="muted">{snapshot ? `${formatFlowLabTime(snapshot.captured_at)} · ${snapshot.row_count} 条` : "等待采集"}</span></div>
        {!snapshot && <div className="empty-lab compact">暂无快照数据。</div>}
        {snapshot?.status === "failed" && <div className="error-text">本轮采集失败：{snapshot.error ?? "未返回原因"}</div>}
        {snapshot?.status === "ok" && <div className="table-scroll snapshot-table-wrap"><table className="flow-lab-table snapshot-table"><thead><tr><th>名次</th><th>标的</th><th>价格</th><th>涨跌幅</th><th>主力净流入</th></tr></thead><tbody>
          {snapshot.rows.map((row) => <tr key={`${snapshot.id}:${row.rank}`}><td>{row.rank}</td><td><strong>{row.cells[2] ?? row.code ?? "—"}</strong><small>{row.code ?? "—"}</small></td><td>{row.cells[3] ?? "—"}</td><td className={String(row.cells[4] ?? "").startsWith("-") ? "quote-down" : "quote-up"}>{row.cells[4] ?? "—"}</td><td><b>{row.cells[8] ?? "—"}</b></td></tr>)}
        </tbody></table></div>}
      </article>
    </section>
  );
}

function radarPriceRisk(board: string, pct: number | null) {
  if (pct === null || pct <= 0) return null;
  const mainBoard = board === "主板";
  const warning = mainBoard ? 5 : 9;
  const highRisk = mainBoard ? 8 : 14;
  if (pct >= highRisk) return { level: "high", text: `涨幅 ${pct.toFixed(2)}% · 高风险追高` };
  if (pct >= warning) return { level: "warning", text: `涨幅 ${pct.toFixed(2)}% · 注意追高` };
  return null;
}

function LegacyFlowLabPage() {
  const [overview, setOverview] = useState<FlowLabOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(0);
  const [guidanceCollapsed, setGuidanceCollapsed] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setOverview(await api<FlowLabOverview>("/api/flow-lab/overview"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "实验室数据读取失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!autoRefreshSeconds) return;
    void load();
    const timer = window.setInterval(() => void load(), autoRefreshSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [autoRefreshSeconds]);

  const latest = overview?.latest;
  const closed = overview?.paper.closed_count ?? 0;
  const winRate = closed ? ((overview?.paper.wins ?? 0) / closed) * 100 : null;
  const signals = overview?.candidates.filter((item) => item.status === "paper_entry") ?? [];
  const quoteByCode = new Map((overview?.quotes ?? []).map((item) => [item.code, item]));

  return (
    <section className="page flow-lab-page">
      <header className="page-header flow-lab-header">
        <div>
          <div className="eyebrow"><Radio size={14} /> PAPER ONLY · V1</div>
          <h1>早盘资金共振实验室</h1>
          <p>把“资金榜靠前”拆成可复核的条件：同花顺主力净流入、板块共振、价格位置、VWAP 与市场闸门。这里先记录证据和模拟结果，不生成实盘指令。</p>
        </div>
        <div className="flow-lab-refresh-controls">
          <label className="flow-lab-auto-refresh">
            <span>实时刷新</span>
            <select
              value={autoRefreshSeconds}
              onChange={(event) => setAutoRefreshSeconds(Number(event.target.value))}
              aria-label="实时刷新频率"
            >
              <option value={0}>关闭</option>
              <option value={5}>5 秒</option>
              <option value={10}>10 秒</option>
              <option value={15}>15 秒</option>
              <option value={30}>30 秒</option>
              <option value={60}>60 秒</option>
            </select>
          </label>
          <button className="button secondary header-action" onClick={() => void load()} disabled={loading}>
            <RefreshCcw size={16} className={loading ? "spin" : ""} /> 刷新快照
          </button>
        </div>
      </header>

      {error && <div className="error-text">{error}</div>}

      {latest?.summary?.source_mode === "ths_only" && <div className="flow-lab-source-alert">
        <CheckCircle2 size={20} /><div><strong>同花顺单源规则</strong><span>榜单、涨跌家数、大盘评级、分钟 VWAP 与纸面结算均取自同花顺；研究分不再使用双源交叉条件。</span></div>
      </div>}

      <div className="flow-lab-status-strip">
        <div>
          <span>最近采样</span>
          <strong>{latest ? formatFlowLabTime(latest.captured_at) : "等待本地采集器"}</strong>
        </div>
        <div>
          <span>市场闸门</span>
          <strong className={`market-state ${latest?.market_state ?? "unknown"}`}>{marketStateLabel(latest?.market_state)}</strong>
        </div>
        <div>
          <span>数据完整度</span>
          <strong>{latest ? `${latest.snapshot_count} 份快照 · ${dataStatusLabel(latest.data_status)}` : "未接入"}</strong>
        </div>
        <div>
          <span>策略版本</span>
          <strong>{latest?.strategy_version ?? "v1-paper"}</strong>
        </div>
      </div>

      <div className="flow-lab-metrics">
        <article>
          <span>本轮重点观察</span>
          <strong>{overview?.candidates.length ?? 0}</strong>
          <small>不是买入清单</small>
        </article>
        <article className={signals.length ? "signal-metric" : ""}>
          <span>模拟买入信号</span>
          <strong>{signals.length}</strong>
          <small>{signals.length ? "仅生成纸面仓位" : "本轮没有触发"}</small>
        </article>
        <article>
          <span>开放模拟仓</span>
          <strong>{overview?.paper.open_count ?? 0}</strong>
          <small>T+1 四个早盘结算窗口</small>
        </article>
        <article>
          <span>已结算样本</span>
          <strong>{closed}</strong>
          <small>样本不足不评估胜率</small>
        </article>
        <article>
          <span>模拟胜率</span>
          <strong>{winRate === null ? "—" : `${winRate.toFixed(1)}%`}</strong>
          <small>{overview?.paper.avg_return == null ? "等待样本" : `平均 ${overview.paper.avg_return.toFixed(2)}%`}</small>
        </article>
      </div>

      {!!signals.length && <div className="flow-lab-signal-alert">
        <Activity size={20} /><div><strong>发现 {signals.length} 个模拟买入信号</strong><span>{signals.map((item) => `${item.name}（${item.code}）`).join("、")}；已进入下方“纸面交易流水”，不连接任何券商。</span></div>
      </div>}

      <section className="flow-lab-guidance">
        <button className="flow-lab-guidance-toggle" type="button" onClick={() => setGuidanceCollapsed((value) => !value)} aria-expanded={!guidanceCollapsed}>
          <span><Shield size={16} /> 研究约束与采样面板</span>
          <em>{guidanceCollapsed ? "展开" : "收起"} {guidanceCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</em>
        </button>
        {!guidanceCollapsed && <div className="flow-lab-layout">
        <article className="panel flow-lab-rules">
          <div className="panel-heading"><div><span className="eyebrow">V1 研究约束</span><h2>先把“诱多”关在门外</h2></div><Shield size={20} /></div>
          <ol>
            <li><b>09:35</b> 只建档；<b>09:40</b> 复核；<b>09:45–09:50</b> 才允许形成模拟候选。</li>
            <li>个股、行业、概念统一取同花顺主力净流入额前 50；榜单排序与原始快照必须可复核。</li>
            <li>行业与概念均须共振；重叠概念聚类后只记一次，防止热门词反复加分。</li>
            <li>价格高于 VWAP、涨幅过热、分钟数据过期或市场闸门转红，直接阻断模拟入场。</li>
            <li>主板单票模拟上限 8%，创业板/科创板 5%；次日四个早盘窗口分别结算，分板统计。</li>
          </ol>
        </article>
        <article className="panel flow-lab-sources">
          <div className="panel-heading"><div><span className="eyebrow">采样面板</span><h2>每 5 分钟一组证据</h2></div><Database size={20} /></div>
          <div className="source-check"><CheckCircle2 size={16} /><span>同花顺：个股 / 行业 / 概念主力净流入各前 50</span></div>
          <div className="source-check"><Activity size={16} /><span>同花顺分时：候选股累计 VWAP 与 T+1 结算价</span></div>
          <div className="source-check"><AlertTriangle size={16} /><span>同花顺市场页：涨跌家数、大盘评级与涨跌停，红灯禁止纸面入场</span></div>
        </article>
        </div>}
      </section>

      <article className="panel flow-lab-candidates">
        <div className="panel-heading"><div><span className="eyebrow">LATEST RUN</span><h2>候选观察池</h2></div><span className="muted">模拟入场优先；行情每 25 秒缓存刷新</span></div>
        {!loading && !overview?.candidates.length && <div className="empty-lab">还没有本地采集快照。采集器运行后，这里会显示原始证据筛出的“观察”候选；第一阶段不会自动下单。</div>}
        {!!overview?.candidates.length && <div className="table-scroll"><table className="flow-lab-table"><thead><tr><th>标的</th><th>分板</th><th>研究分</th><th>同花顺</th><th>价格 / VWAP</th><th>行业 · 概念簇</th><th>处理</th></tr></thead><tbody>
          {overview.candidates.map((item) => {
            const quote = quoteByCode.get(item.code);
            const liveScore = Math.max(0, Number(item.score) - (quote?.score_penalty ?? 0));
            const displayPrice = quote?.price ?? item.price;
            const liveRisk = quote?.risk;
            return <tr key={item.id}><td><strong>{item.name}</strong><small>{item.code}</small></td><td>{item.board}</td><td><b>{liveScore.toFixed(0)}</b>{quote?.score_penalty ? <small>原研究分 {Number(item.score).toFixed(0)}</small> : null}</td><td>{item.source_agreement ? <span className="source-agree">完整</span> : <span className="muted">缺失</span>}</td><td>{displayPrice ? <><b>{displayPrice.toFixed(2)}</b><small className={quote?.pct_chg && quote.pct_chg > 0 ? "quote-up" : quote?.pct_chg && quote.pct_chg < 0 ? "quote-down" : ""}>涨跌 {quote?.pct_chg === null || quote?.pct_chg === undefined ? "—" : formatPct(quote.pct_chg)} · VWAP {item.vwap?.toFixed(2) ?? "—"}</small></> : "—"}</td><td><span>{item.industry ?? "—"}</span><small>{item.concept_cluster ?? "未聚类"}</small></td><td className="candidate-action-cell"><span className={`lab-status ${quote?.blocked ? "blocked" : item.status}`}>{quote?.blocked ? "实时阻断" : flowLabStatusLabel(item.status)}</span><small>{liveRisk ? `${liveRisk}；${item.reason}` : item.reason}</small></td></tr>;
          })}
        </tbody></table></div>}
      </article>

      <section className="flow-lab-bottom-grid">
        <article className="panel flow-lab-positions">
          <div className="panel-heading"><div><span className="eyebrow">PAPER LEDGER</span><h2>纸面交易流水</h2></div><span className="muted">T+1：09:30 / 09:35 / 09:45 / 10:00</span></div>
          {!overview?.positions.length && <div className="empty-lab compact">每个模拟入场会生成 4 条平行记录：次日 09:30、09:35、09:45、10:00；四个时点分别结算并独立统计胜率。</div>}
          {!!overview?.positions.length && <div className="table-scroll"><table className="flow-lab-table paper-table"><thead><tr><th>模拟仓位</th><th>入场</th><th>结算窗口</th><th>仓位</th><th>结算</th><th>收益</th><th>备注</th></tr></thead><tbody>
            {overview.positions.map((item) => <tr key={item.id}><td><strong>{item.code ?? item.candidate_id.split(":").at(-1)}</strong><small>{item.board}</small></td><td><b>{item.entry_price.toFixed(2)}</b><small>{formatFlowLabTime(item.entry_at)}</small></td><td><b>{item.exit_slot}</b></td><td>{(item.position_weight * 100).toFixed(1)}%</td><td>{item.exit_price ? <><b>{item.exit_price.toFixed(2)}</b><small>{item.exit_at ? formatFlowLabTime(item.exit_at) : ""}</small></> : <span className="lab-status watch">持有中</span>}</td><td>{item.return_pct === null ? "—" : <b className={item.return_pct >= 0 ? "return-up" : "return-down"}>{item.return_pct >= 0 ? "+" : ""}{item.return_pct.toFixed(2)}%</b>}</td><td><small>{item.notes || "—"}</small></td></tr>)}
          </tbody></table></div>}
          {!!overview?.paper.total && <div className="paper-breakdowns">
            <PaperBreakdown title="结算窗口" rows={overview.paper.by_exit_slot} labelKey="exit_slot" />
            <PaperBreakdown title="分板" rows={overview.paper.by_board} labelKey="board" />
            <PaperBreakdown title="数据模式" rows={overview.paper.by_data_mode} labelKey="data_mode" />
          </div>}
        </article>

        <article className="panel flow-lab-snapshots">
          <div className="panel-heading"><div><span className="eyebrow">RAW EVIDENCE</span><h2>本轮榜单快照</h2></div><span className="muted">最多 6 × 50 行</span></div>
          {!overview?.snapshots.length && <div className="empty-lab compact">快照上传后显示。个股、行业、概念和市场闸门均来自同花顺；任一必需快照缺失时，不会生成纸面入场。</div>}
          {!!overview?.snapshots.length && <div className="snapshot-list">{overview.snapshots.map((snapshot) => <details key={snapshot.id} className={`snapshot-item ${snapshot.status}`}>
            <summary><span><b>{snapshotSourceLabel(snapshot.source)}</b> · {snapshotDatasetLabel(snapshot.dataset)}</span><span>{snapshot.status === "ok" ? `${snapshot.row_count} 行` : "采集失败"}</span></summary>
            {snapshot.status === "failed" && <p className="snapshot-error">{snapshot.error ?? "未提供失败原因"}</p>}
            {snapshot.status === "ok" && <div className="snapshot-rows">{snapshot.rows.map((row) => <div key={`${snapshot.id}:${row.rank}`}><span>{row.rank}</span><b>{row.code ?? "—"}</b><p>{row.cells.join(" · ")}</p></div>)}</div>}
          </details>)}</div>}
        </article>
      </section>
    </section>
  );
}

function formatFlowLabTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" });
}

function formatPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function marketStateLabel(value?: string) {
  return ({ green: "绿灯：允许研究", amber: "黄灯：降权观察", red: "红灯：禁止模拟入场", unknown: "待市场快照" } as Record<string, string>)[value ?? "unknown"];
}

function dataStatusLabel(value: string) {
  return ({ ok: "完整", partial: "部分缺失", failed: "失败", pending: "等待采集" } as Record<string, string>)[value] ?? "未知";
}

function flowLabStatusLabel(value: FlowLabCandidate["status"]) {
  return ({ watch: "观察", paper_entry: "模拟入场", blocked: "已阻断", closed: "已结算" } as Record<FlowLabCandidate["status"], string>)[value];
}

function snapshotDatasetLabel(value: FlowLabOverview["snapshots"][number]["dataset"]) {
  return ({ individual: "个股资金", industry: "行业资金", concept: "概念资金", market: "市场资金" } as Record<string, string>)[value];
}

function snapshotSourceLabel(value: FlowLabOverview["snapshots"][number]["source"]) {
  return ({ ths: "同花顺", eastmoney: "东方财富", tencent: "腾讯指数" } as Record<string, string>)[value] ?? value;
}

function PaperBreakdown({ title, rows, labelKey }: { title: string; rows: Array<Record<string, string | number | null>>; labelKey: string }) {
  return <section className="paper-breakdown"><h3>{title}</h3>{rows.length ? rows.map((row) => {
    const closed = Number(row.closed_count ?? 0);
    const wins = Number(row.wins ?? 0);
    const average = row.avg_return === null ? null : Number(row.avg_return);
    const label = row[labelKey] === "ths_only" ? "同花顺" : row[labelKey] === "dual_source" ? "历史双源" : row[labelKey] === "ths_primary_degraded" ? "历史降级" : String(row[labelKey]);
    return <div key={`${title}:${label}`}><b>{label}</b><span>{closed ? `${wins}/${closed} 胜 · ${average === null ? "—" : `${average >= 0 ? "+" : ""}${average.toFixed(2)}%`}` : "等待结算样本"}</span></div>;
  }) : <p>等待结算样本</p>}</section>;
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const data = await api<{ user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      onLogin(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-panel" onSubmit={submit} autoComplete="off">
        <div className="brand large">
          <CircleGauge size={32} />
          <div>
            <strong>慢富</strong>
            <span>低风险高赔率资产看板</span>
          </div>
        </div>
        <label>
          邮箱
          <input value={email} autoComplete="off" onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          密码
          <input type="password" value={password} autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="primary-button" disabled={submitting}>
          {submitting ? "登录中" : "登录"}
        </button>
      </form>
    </div>
  );
}

function JindanBoard() {
  const [overview, setOverview] = useState<JindanOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [activeJindanTab, setActiveJindanTab] = useState<JindanAssetType>("index");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setOverview(await api<JindanOverview>("/api/jindan"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取结丹看板失败");
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const data = await api<JindanOverview & { ok: boolean }>("/api/jindan/generate", {
        method: "POST",
        body: JSON.stringify({})
      });
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成结丹快照失败");
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const rows = overview?.rows ?? [];
  const validRows = rows.filter((row) => row.source_status === "ok");
  const strongRows = validRows.filter((row) => row.trend_state === "strong");
  const weakRows = validRows.filter((row) => row.trend_state === "weak");
  const groupedRows = useMemo(() => Object.fromEntries(jindanBoardSections.map((section) => [
    section.key,
    rows
      .filter((row) => row.asset_type === section.key)
      .sort((left, right) => {
        if (left.rank !== null && right.rank !== null) return left.rank - right.rank;
        if (left.rank !== null) return -1;
        if (right.rank !== null) return 1;
        return left.name.localeCompare(right.name, "zh-CN") || left.code.localeCompare(right.code);
      })
  ])) as Record<string, JindanRow[]>, [rows]);
  const activeJindanInfo = jindanBoardSections.find((item) => item.key === activeJindanTab) ?? jindanBoardSections[0];
  const activeJindanRows = groupedRows[activeJindanInfo.key] ?? [];
  const leader = rows.find((row) => row.source_status === "ok");

  return (
    <section className="page foundation-page jindan-page">
      <PageHeader
        icon={<Activity size={22} />}
        title="结丹看板"
        subtitle="按 20 日均线偏离率观察跨资产趋势强弱，记录状态切换、区间涨幅和量能变化。"
        action={<button className="secondary-button" onClick={generate} disabled={generating}><RefreshCcw size={16} /> {generating ? "生成中" : "生成今日快照"}</button>}
      />
      <div className="hero-grid foundation-summary">
        <Metric label="跟踪标的" value={overview?.assets_count ?? 0} icon={<Database size={18} />} />
        <Metric label="有效排序" value={validRows.length} icon={<CheckCircle2 size={18} />} />
        <Metric label="强趋势" value={strongRows.length} icon={<ArrowUp size={18} />} />
        <Metric label="弱趋势" value={weakRows.length} icon={<ArrowDown size={18} />} />
      </div>
      <section className="opportunity-summary jindan-note">
        <div className="section-head">
          <h2>{overview?.snapshot ? `鱼盆趋势模型历史回测数据 日期：${overview.snapshot.report_date.replace(/-/g, ".")}` : "等待生成趋势快照"}</h2>
          <span>{leader ? `当前领先：${leader.name} ${ratioText(leader.deviation_pct)}` : "暂无有效排序"}</span>
        </div>
        <p>数据仅供市场历史风格趋势观察，不构成投资建议。跨市场按报表日前最近有效交易日对齐，股票/ETF 建议使用前复权日线口径。</p>
        <p>增强信号在原始 20 日线趋势上叠加五项过滤：波动缓冲优先使用 0.5 × ATR20，ATR 缺失时才退回 1%；再结合连续 2 日确认、MA20 斜率、MA60 背景和量能确认。量比 ≥ 1 才算量能配合，转强但量比 &lt; 0.8 会降级为观察。仓位含义：观望 0%，轻仓 30%，标准趋势仓 60%，确认转弱退出 0%；观察转弱只允许已有趋势仓降到 30%，空仓不新开。</p>
      </section>
      {error && <p className="error-text" role="alert">{error}</p>}
      {loading ? (
        <FullPageNote text="正在读取结丹看板" />
      ) : rows.length === 0 ? (
        <div className="empty-state">暂无结丹快照。先在后台添加标的，再生成今日快照。</div>
      ) : (
        <>
          <div className="foundation-tabs jindan-tabs" role="tablist" aria-label="结丹看板分类">
            {jindanBoardSections.map((section) => (
              <button
                key={section.key}
                type="button"
                role="tab"
                aria-selected={activeJindanTab === section.key}
                className={activeJindanTab === section.key ? "active" : ""}
                onClick={() => setActiveJindanTab(section.key)}
              >
                <span>{section.title}</span>
                <em>{(groupedRows[section.key] ?? []).length}</em>
              </button>
            ))}
          </div>
          <JindanTableSection title={activeJindanInfo.title} rows={activeJindanRows} />
        </>
      )}
    </section>
  );
}

const jindanBoardSections: Array<{ key: JindanAssetType; title: string }> = [
  { key: "index", title: "指数" },
  { key: "stock", title: "股票" },
  { key: "etf", title: "ETF" }
];

function JindanTableSection({ title, rows }: { title: string; rows: JindanRow[] }) {
  return (
    <section className="table-panel jindan-section">
      <div className="section-head">
        <h2>{title}</h2>
        <span>{rows.length} 个标的</span>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state compact">暂无{title}标的</div>
      ) : (
        <div className="table-wrap jindan-table-wrap">
          <table className="jindan-table">
            <thead>
              <tr>
                <th>排序</th>
                <th>标的</th>
                <th>涨幅%</th>
                <th>现价</th>
                <th>20日均线</th>
                <th>偏离率</th>
                <th><span className="tooltip-label" tabIndex={0} title={volumeRatioTip} data-tooltip={volumeRatioTip}>量比</span></th>
                <th>增强信号</th>
                <th>过滤规则</th>
                <th>仓位含义</th>
                <th>状态转变时间</th>
                <th>区间涨幅%</th>
                <th>排名变化</th>
                <th>实际交易日</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => <JindanRowView key={row.id} row={row} />)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function JindanRowView({ row }: { row: JindanRow }) {
  const [expanded, setExpanded] = useState(false);
  const invalid = row.source_status !== "ok";
  const deviationClass = row.deviation_pct === null ? "" : row.deviation_pct >= 0 ? "positive" : "negative";
  const changedToday = row.state_changed_at !== null && row.state_changed_at === row.actual_trade_date;
  const eastmoneyUrl = (row.asset_type === "stock" || row.asset_type === "etf") ? eastmoneyStockUrl(row.code) : null;
  const filters = parseJindanFilters(row.filter_flags_json);
  const signalClass = row.enhanced_signal ?? "unknown";
  const openEastmoney = () => {
    if (eastmoneyUrl) window.open(eastmoneyUrl, "_blank", "noopener,noreferrer");
  };
  return (
    <tr
      className={`${eastmoneyUrl ? "click-row" : ""} ${row.highlighted ? "highlight-row" : ""} ${invalid ? "muted-row" : ""} ${changedToday ? "trend-changed-row" : ""}`}
      onClick={openEastmoney}
      tabIndex={eastmoneyUrl ? 0 : undefined}
      onKeyDown={(event) => event.key === "Enter" && openEastmoney()}
      aria-label={eastmoneyUrl ? `打开${row.name}的东方财富页面` : undefined}
    >
      <td>{row.rank ?? "--"}</td>
      <td>
        <strong className="asset-name-link">{row.name}-{row.code}{eastmoneyUrl && <ExternalLink size={12} aria-hidden="true" />}</strong>
        <span className="asset-tags">
          <span>{row.market}</span>
          <em>{jindanAssetTypeLabel(row.asset_type)}</em>
          <button
            type="button"
            className="asset-detail-button jindan-link-toggle"
            title="查看筑基位置和综合动作"
            aria-label={`查看${row.name}的筑基联动信息`}
            aria-expanded={expanded}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((value) => !value);
            }}
          >
            <SlidersHorizontal size={12} />
          </button>
        </span>
        {expanded && (
          <div className="jindan-inline-detail" onClick={(event) => event.stopPropagation()}>
            <div>
              <span>筑基位置</span>
              <FoundationMatchCell foundation={row.foundation_match} />
            </div>
            <div>
              <span>综合动作</span>
              <CombinedActionCell action={row.combined_action} />
            </div>
          </div>
        )}
      </td>
      <td className={ratioClass(row.pct_chg)}>{ratioText(row.pct_chg)}</td>
      <td>{priceText(row.close)}</td>
      <td>{priceText(row.ma20)}</td>
      <td className={`jindan-deviation ${deviationClass}`}>{ratioText(row.deviation_pct)}</td>
      <td>{row.volume_ratio === null ? "-" : numberText(row.volume_ratio, 2)}</td>
      <td>
        <span className={`enhanced-signal ${signalClass}`}>{row.enhanced_label ?? "--"}</span>
        {row.filter_summary && <small className="enhanced-summary">{row.filter_summary}</small>}
      </td>
      <td>
        {filters.length ? (
          <div className="filter-chip-list">
            {filters.map((filter) => <span key={filter.key} className={filter.passed ? "filter-chip passed" : "filter-chip blocked"} title={filter.note}>{filter.passed ? "✓" : "×"} {filter.label}</span>)}
          </div>
        ) : "--"}
      </td>
      <td>
        <strong>{positionText(row.suggested_position)}</strong>
        <small className="enhanced-action">{row.suggested_action ?? "等待有效数据"}</small>
      </td>
      <td>
        <span className={changedToday ? `trend-change-badge ${row.trend_state}` : ""}>
          {row.state_changed_at ?? "--"}
          {changedToday && <em>{row.trend_state === "strong" ? "今日转强" : "今日转弱"}</em>}
        </span>
      </td>
      <td className={ratioClass(row.interval_pct)}>{ratioText(row.interval_pct)}</td>
      <td>{rankChangeText(row.rank_change)}</td>
      <td>{invalid ? row.source_error : row.actual_trade_date}</td>
    </tr>
  );
}

function FoundationMatchCell({ foundation }: { foundation?: FoundationIntegrationContext | null }) {
  if (!foundation || !foundation.matched) {
    return (
      <div className="integration-cell muted">
        <span className="foundation-hit-chip none">未纳入筑基</span>
        <small>缺少价格赔率判断</small>
      </div>
    );
  }
  return (
    <div className="integration-cell">
      <span
        className={`foundation-hit-chip ${foundation.primary_hit_key ?? "none"}`}
        title={foundation.primary_hit_note}
      >
        {foundation.primary_hit_label}
      </span>
      <small title={foundation.primary_hit_note}>
        {foundation.primary_hit_level ?? foundation.primary_hit_note}
      </small>
      {foundation.conclusion && <ConclusionPill value={foundation.conclusion} />}
    </div>
  );
}

function TrendGateCell({ gate }: { gate?: JindanIntegrationContext | null }) {
  if (!gate || !gate.matched) {
    return (
      <div className="integration-cell muted">
        <span className="trend-gate-chip none">未纳入结丹</span>
        <small>缺少趋势闸门</small>
      </div>
    );
  }
  return (
    <div className="integration-cell">
      <span className={`trend-gate-chip ${gate.enhanced_signal ?? "unknown"}`}>{gate.enhanced_label ?? "--"}</span>
      <small>{gate.suggested_action ?? "等待有效趋势数据"}</small>
    </div>
  );
}

function CombinedActionCell({ action }: { action?: CombinedAction | null }) {
  if (!action) {
    return (
      <div className="integration-cell muted">
        <span className="combined-action none">未匹配</span>
        <small>暂不生成综合动作</small>
      </div>
    );
  }
  return (
    <div className="integration-cell">
      <span className={`combined-action ${combinedActionClass(action.action)}`}>{action.action}</span>
      <strong>{positionText(action.suggested_position)}</strong>
      <small>{action.reason}</small>
    </div>
  );
}

function combinedActionClass(action: CombinedActionName) {
  if (action === "可建仓") return "build";
  if (action === "小仓试") return "trial";
  if (action === "等价格") return "wait";
  if (action === "减仓") return "reduce";
  if (action === "清仓") return "clear";
  return "watch";
}

function jindanAssetTypeLabel(value: JindanAssetType) {
  return jindanAssetTypes.find((item) => item.value === value)?.label ?? value;
}

function jindanDataSourceLabel(value: JindanDataSource) {
  return jindanDataSources.find((item) => item.value === value)?.label ?? value;
}

function parseJindanFilters(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => ({
        key: String(item?.key ?? `${item?.label ?? "filter"}-${index}`),
        label: String(item?.label ?? ""),
        passed: Boolean(item?.passed),
        note: String(item?.note ?? "")
      }))
      .filter((item) => item.label);
  } catch {
    return [];
  }
}

function positionText(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${Math.round(value * 100)}%`;
}

function ratioClass(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return value >= 0 ? "positive-text" : "negative-text";
}

function rankChangeText(value: number | null) {
  if (value === null) return "--";
  if (value > 0) return `+${value}`;
  return String(value);
}

const volumeRatioTip = "量比 = 当日成交量 / 前5个有效交易日平均成交量。大于1表示今天放量；1.5以上说明量能明显增强；2以上通常是显著放量，需要结合价格位置判断是否加速。0.8以下表示缩量，趋势延续力可能不足。";

function FoundationBoard({ active, onOpen }: { active: boolean; onOpen: (id: string) => void }) {
  const [assets, setAssets] = useState<FoundationAsset[]>([]);
  const [settings, setSettings] = useState<FoundationSettings>(defaultFoundationSettings);
  const [hitSummary, setHitSummary] = useState<FoundationHitSummary>(emptyHitSummary);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [activeAssetTab, setActiveAssetTab] = useState<AssetType>("stock");
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);

  async function load(refreshPrices = false) {
    setRefreshing(refreshPrices);
    try {
      const data = await api<{ settings: FoundationSettings; assets: FoundationAsset[]; hit_summary?: FoundationHitSummary }>(refreshPrices ? "/api/foundation/prices" : "/api/foundation", { method: refreshPrices ? "POST" : "GET" });
      setAssets(data.assets);
      setSettings(data.settings);
      setHitSummary(data.hit_summary ?? buildClientHitSummary(data.assets));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取失败");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!active) return;
    const activeSeconds = settings.active_refresh_seconds ?? settings.refresh_seconds;
    const intervalMs = Math.max(5, activeSeconds) * 1000;
    const timer = window.setInterval(() => load(true), intervalMs);
    return () => window.clearInterval(timer);
  }, [active, settings.active_refresh_seconds, settings.refresh_seconds]);

  const grouped = useMemo(() => ({
    stock: assets.filter((item) => item.asset_type === "stock"),
    etf: assets.filter((item) => item.asset_type === "etf"),
    other: assets.filter((item) => item.asset_type === "other")
  }), [assets]);
  const buyHitCount = hitSummary.buy.reduce((sum, item) => sum + item.count, 0);
  const sellHitCount = hitSummary.sell.reduce((sum, item) => sum + item.count, 0);
  const activeRefresh = settings.active_refresh_seconds ?? settings.refresh_seconds;
  const refreshLabel = settings.is_trading_time ? "交易时段刷新" : "非交易刷新";
  const activeTabInfo = foundationAdminSections.find((item) => item.key === activeAssetTab)!;
  const activeAssets = grouped[activeAssetTab];

  return (
    <section className="page foundation-page">
      <PageHeader
        icon={<Layers3 size={22} />}
        title="筑基看板"
        subtitle="只盯低风险、高赔率、安全边际。没有合适点位，就让系统安静地等。"
        action={<button className="secondary-button" onClick={() => load(true)} disabled={refreshing}><RefreshCcw size={16} /> {refreshing ? "刷新中" : "刷新价格"}</button>}
      />
      <div className="hero-grid foundation-summary">
        <Metric label="跟踪标的" value={assets.length} icon={<Database size={18} />} />
        <Metric label="命中买入区" value={buyHitCount} icon={<CheckCircle2 size={18} />} />
        <Metric label="卖出/风控提醒" value={sellHitCount} icon={<TrendingDown size={18} />} />
        <Metric label={refreshLabel} value={`${activeRefresh}s`} icon={<Activity size={18} />} />
      </div>
      <OpportunitySummary summary={hitSummary} collapsed={summaryCollapsed} onToggle={() => setSummaryCollapsed((value) => !value)} />
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="foundation-tabs" role="tablist" aria-label="筑基看板分类">
        {foundationAdminSections.map((section) => (
          <button
            key={section.key}
            type="button"
            role="tab"
            aria-selected={activeAssetTab === section.key}
            className={activeAssetTab === section.key ? "active" : ""}
            onClick={() => setActiveAssetTab(section.key)}
          >
            <span>{section.title}</span>
            <em>{grouped[section.key].length}</em>
          </button>
        ))}
      </div>
      <FoundationSection title={activeTabInfo.title} assets={activeAssets} onOpen={onOpen} />
    </section>
  );
}

function buildClientHitSummary(assets: FoundationAsset[]): FoundationHitSummary {
  const labels: Record<"reasonable" | "safe" | "bargain" | "deep_value_review" | "stop_loss" | "reduce" | "sell" | "keep", string> = {
    reasonable: "合理区",
    safe: "安全区",
    bargain: "捡漏区",
    deep_value_review: "超跌复核",
    stop_loss: "止损位",
    reduce: "减仓区",
    sell: "卖出区",
    keep: "底仓区"
  };
  const serialize = (key: keyof typeof labels): FoundationHitSummaryGroup => {
    const matched = assets
      .filter((asset) => asset.hit_fields.includes(key))
      .map(({ id, code, name, current_price }) => ({ id, code, name, current_price }));
    return { key, label: labels[key], count: matched.length, assets: matched };
  };
  return {
    buy: (["reasonable", "safe", "bargain"] as const).map(serialize),
    review: (["deep_value_review"] as const).map(serialize),
    sell: (["stop_loss", "reduce", "sell", "keep"] as const).map(serialize)
  };
}

function OpportunitySummary({ summary, collapsed, onToggle }: { summary: FoundationHitSummary; collapsed: boolean; onToggle: () => void }) {
  const groups = [
    ...summary.buy.map((item) => ({ ...item, side: "buy" as const })),
    ...(summary.review ?? []).map((item) => ({ ...item, side: "review" as const })),
    ...summary.sell.map((item) => ({ ...item, side: "sell" as const }))
  ];
  const activeGroups = groups.filter((item) => item.count > 0);
  const totalCount = activeGroups.reduce((sum, item) => sum + item.count, 0);
  return (
    <section className="opportunity-summary">
      <div className="section-head">
        <h2>关键区间命中</h2>
        <button className="summary-toggle" type="button" onClick={onToggle} aria-expanded={!collapsed}>
          <span>{activeGroups.length ? `${totalCount} 条提醒` : "等待更好的价位"}</span>
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {collapsed ? null : activeGroups.length === 0 ? (
        <p className="opportunity-empty">当前没有标的命中买入或卖出关键区间。</p>
      ) : (
        <div className="opportunity-list">
          {activeGroups.map((group) => (
            <div className={`opportunity-item ${group.side}`} key={group.key}>
              <strong>当前有 {group.count} 个标的命中{group.label}：</strong>
              <span>{group.assets.map((asset) => `${asset.code}-${asset.name}`).join("，")}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FoundationSection({ title, assets, onOpen }: { title: string; assets: FoundationAsset[]; onOpen: (id: string) => void }) {
  return (
    <section className="table-panel asset-section">
      <div className="section-head">
        <h2>{title}</h2>
        <span>{assets.length} 个标的</span>
      </div>
      {assets.length === 0 ? (
        <div className="empty-state">暂无标的。可以在后台管理里新增，或用批量分析 skill 写入。</div>
      ) : (
        <div className="table-wrap asset-table-wrap">
          <table className="asset-table">
            <thead>
              <tr>
                <th rowSpan={2}>#</th>
                <th rowSpan={2}>名称</th>
                <th rowSpan={2}>现价</th>
                <th className="buy-group" colSpan={6}>买入参考</th>
                <th className="sell-group" colSpan={4}>卖出 / 风控</th>
                <th rowSpan={2}>趋势闸门</th>
                <th rowSpan={2}>综合动作</th>
                <th rowSpan={2}>结论</th>
              </tr>
              <tr>
                {buyKeys.map((key) => <th key={key}><TooltipLabel itemKey={key} /></th>)}
                {sellKeys.map((key) => <th className={key === "stop_loss" ? "group-split" : ""} key={key}><TooltipLabel itemKey={key} /></th>)}
              </tr>
            </thead>
            <tbody>
              {assets.map((asset, index) => <FoundationRow key={asset.id} asset={asset} index={index + 1} onOpen={onOpen} />)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FoundationRow({ asset, index, onOpen }: { asset: FoundationAsset; index: number; onOpen: (id: string) => void }) {
  const eastmoneyUrl = eastmoneyStockUrl(asset.code);
  const openPrimaryDestination = () => {
    if (eastmoneyUrl) {
      window.open(eastmoneyUrl, "_blank", "noopener,noreferrer");
      return;
    }
    onOpen(asset.id);
  };

  return (
    <tr
      className="click-row"
      onClick={openPrimaryDestination}
      tabIndex={0}
      onKeyDown={(event) => event.key === "Enter" && openPrimaryDestination()}
      aria-label={eastmoneyUrl ? `打开${asset.name}的东方财富页面` : `打开${asset.name}的慢富详情`}
    >
      <td>{index}</td>
      <td>
        <strong className="asset-name-link">{asset.name}-{asset.code}{eastmoneyUrl && <ExternalLink size={12} aria-hidden="true" />}</strong>
        <span className="asset-tags">
          <span>{asset.market}</span>
          <em>{asset.style_tag}</em>
          <button
            type="button"
            className="asset-detail-button"
            title="查看慢富完整分析"
            aria-label={`查看${asset.name}的慢富完整分析`}
            onClick={(event) => {
              event.stopPropagation();
              onOpen(asset.id);
            }}
          >
            <FileText size={12} />
          </button>
        </span>
      </td>
      <td className={asset.price_status === "failed" ? "quote-cell failed" : "quote-cell"}>
        <strong>{priceText(asset.current_price)}</strong>
        <span>{asset.price_status === "failed" ? "失败" : asset.price_updated_at ? shortTime(asset.price_updated_at) : "待刷新"}</span>
      </td>
      {buyKeys.map((key) => <LevelCell key={key} asset={asset} itemKey={key} />)}
      {sellKeys.map((key) => <LevelCell className={key === "stop_loss" ? "group-split" : ""} key={key} asset={asset} itemKey={key} />)}
      <td><TrendGateCell gate={asset.jindan_gate} /></td>
      <td><CombinedActionCell action={asset.jindan_gate?.combined_action} /></td>
      <td><ConclusionPill value={asset.conclusion} /></td>
    </tr>
  );
}

function eastmoneyStockUrl(code: string) {
  return /^\d{6}$/.test(code) ? `https://data.eastmoney.com/stockdata/${code}.html` : null;
}

function LevelCell({ asset, itemKey, className = "" }: { asset: FoundationAsset; itemKey: keyof FoundationLevels; className?: string }) {
  const hit = asset.hit_fields.includes(itemKey);
  const hitText = itemKey === "deep_value_review" ? "复核" : "命中";
  return <td className={`${className} level-cell ${hit ? `hit ${itemKey}` : ""}`}><span>{asset.levels[itemKey]}</span>{hit && <em>{hitText}</em>}</td>;
}

function TooltipLabel({ itemKey }: { itemKey: keyof FoundationLevels }) {
  const meta = levelMeta.find(([key]) => key === itemKey)!;
  return <span className="tooltip-label" tabIndex={0} data-tooltip={meta[2]} aria-label={meta[2]}>{meta[1]}</span>;
}

function FoundationDetailPage({ id, onBack }: { id: string; onBack: () => void }) {
  const [asset, setAsset] = useState<FoundationAsset | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ asset: FoundationAsset }>(`/api/foundation/assets/${id}`).then((data) => setAsset(data.asset)).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <FullPageNote text={error} />;
  if (!asset) return <FullPageNote text="正在读取标的详情" />;

  return (
    <section className="page">
      <PageHeader
        icon={<Layers3 size={22} />}
        title={`${asset.name} ${asset.code}`}
        subtitle="完整分析来自低风险安全边际模板，列表价位以结构化字段为准。"
        action={<button className="secondary-button" onClick={onBack}><ArrowLeft size={16} /> 返回看板</button>}
      />
      <div className="detail-hero">
        <Metric label="现价" value={priceText(asset.current_price)} icon={<Activity size={18} />} />
        <Metric label="结论" value={asset.conclusion} icon={<Shield size={18} />} />
        <Metric label="安全区" value={asset.levels.safe} icon={<CheckCircle2 size={18} />} />
        <Metric label="捡漏区" value={asset.levels.bargain} icon={<Database size={18} />} />
        <Metric label="超跌复核" value={asset.levels.deep_value_review} icon={<AlertTriangle size={18} />} />
      </div>
      <section className="table-panel">
        <h2>买入与卖出参考价位（以此为准）</h2>
        <div className="level-summary">
          {levelMeta.map(([key, label, tip]) => (
            <div key={key} className={asset.hit_fields.includes(key) ? `active ${key}` : ""}>
              <span>{label}</span>
              <strong>{asset.levels[key]}</strong>
              <small>{tip}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="plain-panel report-panel">
        <h2>完整分析</h2>
        <MarkdownView text={asset.analysis_markdown || "暂无完整分析。可以使用 manfu-foundation-updater skill 批量生成并写入。"} />
      </section>
    </section>
  );
}

function MarkdownView({ text }: { text: string }) {
  const blocks = parseMarkdownBlocks(text);
  return (
    <div className="markdown-view">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Tag = (`h${block.level}` as "h1" | "h2" | "h3");
          return <Tag key={index}>{block.text}</Tag>;
        }
        if (block.type === "list") {
          return <ul key={index}>{block.items.map((item, itemIndex) => <li key={`${itemIndex}-${item}`}>{item}</li>)}</ul>;
        }
        if (block.type === "table") {
          return (
            <div className="markdown-table-wrap" key={index}>
              <table className="markdown-table">
                <thead>
                  <tr>{block.headers.map((cell, cellIndex) => <th key={`${cellIndex}-${cell}`}>{cell}</th>)}</tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <p key={index}>{block.text}</p>;
      })}
    </div>
  );
}

type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "paragraph"; text: string };

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const content = paragraph.join("\n").trim();
    if (content) blocks.push({ type: "paragraph", text: content });
    paragraph = [];
  };

  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) {
      flushParagraph();
      index += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      flushParagraph();
      blocks.push({ type: "heading", level: 3, text: line.slice(4).trim() });
      index += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      blocks.push({ type: "heading", level: 2, text: line.slice(3).trim() });
      index += 1;
      continue;
    }
    if (line.startsWith("# ")) {
      flushParagraph();
      blocks.push({ type: "heading", level: 1, text: line.slice(2).trim() });
      index += 1;
      continue;
    }
    if (isTableStart(lines, index)) {
      flushParagraph();
      const tableLines: string[] = [];
      while (index < lines.length && isPipeRow(lines[index])) {
        tableLines.push(lines[index].trim());
        index += 1;
      }
      const [headerLine, , ...bodyLines] = tableLines;
      blocks.push({
        type: "table",
        headers: splitTableRow(headerLine),
        rows: bodyLines.filter((row) => !isSeparatorRow(row)).map(splitTableRow)
      });
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        items.push(lines[index].trim().slice(2).trim());
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }
    paragraph.push(line);
    index += 1;
  }
  flushParagraph();
  return blocks;
}

function isTableStart(lines: string[], index: number) {
  return isPipeRow(lines[index]) && isSeparatorRow(lines[index + 1] ?? "");
}

function isPipeRow(line: string) {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|");
}

function isSeparatorRow(line: string) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function splitTableRow(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function DashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dashboard>("/api/dashboard").then(setDashboard).catch((err) => setError(err.message));
  }, []);

  if (error) return <FullPageNote text={error} />;
  if (!dashboard) return <FullPageNote text="正在读取见顶指标" />;

  const chartData = dashboard.indicators.map((item) => ({
    name: item.name.length > 8 ? `${item.name.slice(0, 8)}...` : item.name,
    contribution: item.contribution,
    weight: item.weight
  }));

  return (
    <section className="page">
      <PageHeader
        icon={<BarChart3 size={22} />}
        title="A 股见顶仪表盘"
        subtitle="评分只基于已接入或手动配置的指标，待接入和获取失败不参与总分。"
      />
      <div className="hero-grid">
        <div className="score-panel">
          <div className="score-ring" style={{ "--score": `${dashboard.score}%` } as CSSProperties}>
            <strong>{dashboard.score}</strong>
            <span>/ 100</span>
          </div>
          <div>
            <p className="eyebrow">整体风险</p>
            <h2>{dashboard.riskLevel}</h2>
            <p>已达标 {dashboard.hitCount} / {dashboard.totalCount}，已接入 {dashboard.connectedCount} 个指标。</p>
          </div>
        </div>
        <Metric label="总权重" value={dashboard.totalWeight.toFixed(1)} icon={<Activity size={18} />} />
        <Metric label="待接入" value={dashboard.pendingCount} icon={<Database size={18} />} />
        <Metric label="获取失败" value={dashboard.failedCount} icon={<AlertTriangle size={18} />} />
      </div>
      <section className="chart-band">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} />
            <Tooltip />
            <Bar dataKey="weight" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="contribution" fill="#0F766E" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>
      <div className="indicator-grid">
        {dashboard.indicators.map((indicator) => <IndicatorCard key={indicator.id} indicator={indicator} />)}
      </div>
    </section>
  );
}

function IndicatorCard({ indicator }: { indicator: Indicator }) {
  return (
    <article className="indicator-card">
      <div className="card-top">
        <div>
          <span className="category">{indicator.category}</span>
          <h3>{indicator.name}</h3>
        </div>
        <StatusPill status={indicator.status} />
      </div>
      <p>{indicator.description}</p>
      <dl className="mini-grid">
        <div><dt>当前值</dt><dd>{indicator.current_text ?? valueText(indicator.current_value)}</dd></div>
        <div><dt>权重</dt><dd>{indicator.weight}</dd></div>
        <div><dt>贡献</dt><dd>{indicator.contribution}</dd></div>
      </dl>
      <div className="source-line">
        <span>{indicator.source_name}</span>
        {indicator.source_url && <a href={indicator.source_url} target="_blank" rel="noreferrer">来源</a>}
      </div>
      <small>{indicator.threshold_note}</small>
    </article>
  );
}

function BtcStrategyPage() {
  const [latest, setLatest] = useState<BtcLighthouseLatest | null>(null);
  const [history, setHistory] = useState<BtcLighthouseHistory[]>([]);
  const [realtime, setRealtime] = useState<BtcRealtimeTicker | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [realtimeRefreshSeconds, setRealtimeRefreshSeconds] = useState(() => {
    const stored = Number(window.localStorage.getItem("manfu-btc-realtime-refresh-seconds"));
    return [0, 5, 10, 15, 30, 60].includes(stored) ? stored : 15;
  });

  async function load() {
    setError("");
    try {
      const data = await api<{ latest: BtcLighthouseLatest; realtime: BtcRealtimeTicker; history: BtcLighthouseHistory[] }>("/api/btc-lighthouse");
      setLatest(data.latest);
      setRealtime(data.realtime);
      setHistory(data.history);
    } catch (err) {
      setError(err instanceof Error ? err.message : "BTC 周期灯塔读取失败");
    }
  }

  async function refresh() {
    setRefreshing(true);
    setError("");
    try {
      const data = await api<{ latest: BtcLighthouseLatest; realtime: BtcRealtimeTicker; history: BtcLighthouseHistory[] }>("/api/btc-lighthouse/refresh", { method: "POST" });
      setLatest(data.latest);
      setRealtime(data.realtime);
      setHistory(data.history);
    } catch (err) {
      setError(err instanceof Error ? err.message : "BTC 周期灯塔刷新失败");
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshRealtime() {
    try {
      const data = await api<{ realtime: BtcRealtimeTicker }>("/api/btc-lighthouse/realtime");
      setRealtime(data.realtime);
    } catch {
      // Keep the last good quote visible when a temporary ticker request fails.
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    window.localStorage.setItem("manfu-btc-realtime-refresh-seconds", String(realtimeRefreshSeconds));
    if (realtimeRefreshSeconds === 0) return;
    const timer = window.setInterval(() => { void refreshRealtime(); }, realtimeRefreshSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [realtimeRefreshSeconds]);

  if (!latest && !error) return <FullPageNote text="正在读取 BTC 周期灯塔" />;
  const metrics = latest?.metrics ?? {};
  const stateDetails = latest?.state_details ?? {};
  const refreshedAt = latest?.updated_at ? dateTimeText(latest.updated_at) : "--";
  const boughtLevels = stateDetails.boughtLevels?.length ? [...stateDetails.boughtLevels].sort((a, b) => a - b).join(" / ") : "无";
  const triggers = latest?.triggers ?? [];
  const matureSignals = stateDetails.matureSignals ?? [];
  const entryReturn = latest && stateDetails.avgEntry ? latest.price / stateDetails.avgEntry - 1 : null;
  const realtimeUpdatedAt = realtime?.updatedAt ? dateTimeText(realtime.updatedAt) : "--";
  const realtimePrice = realtime?.status === "ok" ? realtime.price : null;
  const realtimeSource = realtime?.status === "ok" ? realtime.source : "实时行情源暂不可用";
  const intradayMove = latest && realtimePrice ? realtimePrice / latest.price - 1 : null;
  const projectedBottomScore = latest && intradayMove !== null ? Math.max(0, Math.round(latest.bottom_score - intradayMove * 100)) : null;
  const projectedTopScore = latest && intradayMove !== null ? Math.max(0, Math.round(latest.top_score + Math.max(0, intradayMove) * 100)) : null;
  const intradayPeak = realtimePrice == null ? null : Math.max(stateDetails.cyclePeak ?? 0, realtimePrice);
  const intradayPeakMultiple = stateDetails.avgEntry && intradayPeak ? intradayPeak / stateDetails.avgEntry : null;
  const intradayDrawdownFromPeak = realtimePrice != null && intradayPeak ? realtimePrice / intradayPeak - 1 : null;
  const intradayMatureDefaultActive = (intradayPeakMultiple ?? 0) >= 4;
  const intradayMatureDefaultTrigger = intradayMatureDefaultActive && (intradayDrawdownFromPeak ?? 0) <= -0.3;
  const intradayMa20wBreak = realtimePrice != null && (latest?.top_score ?? 0) >= 110 && metrics.ma20w != null && realtimePrice < metrics.ma20w;
  const intradayExtremeTop = (projectedTopScore ?? 0) >= 210;
  const intradayBottomStage = (latest?.bottom_groups ?? 0) >= 4 && projectedBottomScore != null
    ? projectedBottomScore >= 120 ? "满仓底部预警" : projectedBottomScore >= 105 ? "二档底部预警" : projectedBottomScore >= 90 ? "一档底部预警" : "未触发"
    : "未触发";
  const intradayWarning = realtimePrice == null
    ? { level: "muted", title: "实时价暂不可用", action: "保持日频正式信号，不做盘中判断。" }
    : intradayExtremeTop
      ? { level: "danger", title: "盘中极端顶部预警", action: "顶部热度实时投影已进入极端区，优先检查分批减仓或清仓计划。" }
      : intradayMatureDefaultTrigger
        ? { level: "danger", title: "盘中 4x 利润保护预警", action: "默认成熟牛市标准已触发破位，优先执行利润保护复核。" }
        : intradayMa20wBreak
          ? { level: "danger", title: "盘中趋势破位预警", action: "顶部观察后跌破 20 周线，优先检查清仓规则是否成立。" }
          : intradayBottomStage !== "未触发"
            ? { level: "watch", title: intradayBottomStage, action: "只作为盘中观察，不直接改变正式仓位；等待日频信号确认。" }
            : { level: "quiet", title: "盘中无新增预警", action: "正式仓位仍以日频 BTC 周期灯塔为准。" };

  return (
    <section className="page btc-lighthouse-page">
      <PageHeader
        icon={<Bitcoin size={22} />}
        title="BTC 周期灯塔"
        subtitle="现货复利 · 多指标周期仓位信号 · 后台确定性规则每日刷新"
        action={
          <div className="btc-refresh-controls">
            <label>
              <span>实时刷新</span>
              <select value={realtimeRefreshSeconds} onChange={(event) => setRealtimeRefreshSeconds(Number(event.target.value))} aria-label="BTC 实时价格刷新频率">
                <option value={0}>关闭</option>
                <option value={5}>5 秒</option>
                <option value={10}>10 秒</option>
                <option value={15}>15 秒</option>
                <option value={30}>30 秒</option>
                <option value={60}>60 秒</option>
              </select>
            </label>
            <button className="secondary-button" onClick={refresh} disabled={refreshing}><RefreshCcw size={16} /> {refreshing ? "刷新中" : "刷新信号与价格"}</button>
          </div>
        }
      />
      {error && <p className="error-text" role="alert">{error}</p>}
      {latest && (
        <>
          <section className={`btc-hero ${latest.state}`}>
            <div className="btc-signal-summary">
              <p className="eyebrow">当前信号</p>
              <h2>{latest.state_label}</h2>
              <p>{latest.trigger_summary}</p>
            </div>
            <div className="btc-position-dial">
              <strong>{percentText(latest.recommended_position)}</strong>
              <span>建议仓位</span>
            </div>
            <div className="btc-action-panel">
              <span>信号刷新 {refreshedAt}</span>
              <strong>{latest.suggested_action}</strong>
              <em>策略日频价 {usdText(latest.price)}</em>
              <em>当前仓位 {percentText(latest.current_position)}</em>
              <em>已触发底部档位 {boughtLevels}</em>
            </div>
          </section>

          <div className="hero-grid btc-summary-grid">
            <Metric label="BTC 实时价" value={realtimePrice == null ? usdText(latest.price) : usdText(realtimePrice)} icon={<Bitcoin size={18} />} />
          <Metric label="24h 涨跌" value={realtime?.priceChangePercent == null ? "--" : `${realtime.priceChangePercent.toFixed(2)}%`} icon={<TrendingDown size={18} />} />
            <Metric label="底部分数" value={latest.bottom_score} icon={<Database size={18} />} />
            <Metric label="底部共振" value={`${latest.bottom_groups}/4`} icon={<CheckCircle2 size={18} />} />
          </div>
          <p className="btc-price-note">实时价来自 {realtimeSource}，更新 {realtimeUpdatedAt}；策略评分使用 Coin Metrics 日频价，通常按日更新，不随实时成交价跳动。</p>
          <section className={`btc-intraday-warning ${intradayWarning.level}`}>
            <div className="btc-intraday-lead">
              <span>盘中预警</span>
              <strong>{intradayWarning.title}</strong>
              <p>{intradayWarning.action}</p>
            </div>
            <div className="btc-intraday-grid">
              <div>
                <span>实时价较策略价</span>
                <strong>{ratioText(intradayMove)}</strong>
                <small>{realtimePrice == null ? "等待实时行情源恢复" : `${usdText(realtimePrice)} vs ${usdText(latest.price)}`}</small>
              </div>
              <div>
                <span>底部分数投影</span>
                <strong>{projectedBottomScore ?? "--"}</strong>
                <small>价格下跌会抬高底部预警，正式分数仍等日频确认</small>
              </div>
              <div>
                <span>顶部热度投影</span>
                <strong>{projectedTopScore ?? "--"}</strong>
                <small>实时急涨会提高顶部预警，极端区优先风控</small>
              </div>
              <div>
                <span>4x 利润保护</span>
                <strong>{intradayMatureDefaultTrigger ? "触发" : intradayMatureDefaultActive ? "观察" : "未到"}</strong>
                <small>峰值倍数 {intradayPeakMultiple == null ? "--" : `${numberText(intradayPeakMultiple)}x`}，峰值回撤 {ratioText(intradayDrawdownFromPeak)}</small>
              </div>
            </div>
          </section>
          <section className="btc-guide-grid">
            <div className="btc-guide-card">
              <h3>底部分数怎么读</h3>
              <p>分数用于触发加仓，不是每天重新计算目标仓位。已经买入的档位会一直持有，直到出现清仓规则。</p>
              <ul>
                <li><strong>90+</strong><span>底部四组共振满足时，允许建仓一档，目标约 30%。</span></li>
                <li><strong>105+</strong><span>低估更充分，允许加到二档，目标约 65%。</span></li>
                <li><strong>120+</strong><span>极端底部区，允许满仓；没有达到不强行抄底。</span></li>
              </ul>
            </div>
            <div className="btc-guide-card">
              <h3>顶部热度怎么读</h3>
              <p>顶部不按分数机械分批卖，避免过早丢掉主升浪；它采用“观察或清仓”的利润保护规则。</p>
              <ul>
                <li><strong>&lt;110</strong><span>不因顶部热度卖出，继续按持仓状态执行。</span></li>
                <li><strong>110+</strong><span>卖出 0%，进入顶部观察；之后若回撤 30% 或跌破 20 周线，卖出 100%。</span></li>
                <li><strong>210+</strong><span>极端顶部，不等趋势确认，卖出 100%。</span></li>
                <li><strong>成熟破位</strong><span>4x 是系统默认执行标准；3x 只做防守预警，5x 只做强牛参考。默认触发后先卖出 35%，继续破位再清剩余仓位。</span></li>
              </ul>
            </div>
          </section>

          <section className="btc-mature-panel">
            <div className="section-head">
              <h2>成熟牛市压力表</h2>
              <span>默认按 4x 执行，3x/5x 用来校准强弱</span>
            </div>
            <div className="btc-mature-summary">
              <div>
                <span>持仓峰值倍数</span>
                <strong>{stateDetails.peakMultiple == null ? "--" : `${numberText(stateDetails.peakMultiple)}x`}</strong>
              </div>
              <div>
                <span>较平均成本盈亏</span>
                <strong>{ratioText(entryReturn)}</strong>
                <small>现价 ÷ 策略平均买入成本 - 1，表示这轮持仓总体盈亏。</small>
              </div>
              <div>
                <span>较持仓后最高价回撤</span>
                <strong>{ratioText(stateDetails.drawdownFromPositionPeak)}</strong>
                <small>现价 ÷ 本轮买入后的最高价 - 1，表示从阶段高点回落多少。</small>
              </div>
              <div>
                <span>系统推荐标准</span>
                <strong>4x 均衡</strong>
              </div>
            </div>
            <div className="btc-mature-grid">
              {matureSignals.map((signal) => <BtcMatureCard key={signal.multiple} signal={signal} />)}
            </div>
          </section>

          <section className="btc-grid">
            <div className="plain-panel">
              <h3>底部四组</h3>
              <div className="btc-check-grid">
                <BtcCheck label="深度回撤" active={(metrics.drawdown ?? 0) <= -0.4} value={ratioText(metrics.drawdown)} note="BTC 从历史最高价回撤超过 40%，说明价格已经进入大周期压力释放区。" />
                <BtcCheck label="链上估值低" active={(metrics.mvrv ?? 99) < 1.3 || (metrics.nupl ?? 99) < 0.25} value={`MVRV ${numberText(metrics.mvrv)}`} note="MVRV/NUPL 衡量价格相对链上成本和浮盈压力，越低越接近熊市低估。" />
                <BtcCheck label="矿工收入低" active={(metrics.puell ?? 99) < 0.8} value={`Puell ${numberText(metrics.puell)}`} note="Puell 反映矿工收入相对一年均值，低于 0.8 通常意味着矿工周期承压。" />
                <BtcCheck label="长期趋势便宜" active={(metrics.mayer ?? 99) < 1 || (latest.price <= (metrics.ma200w ?? 0) * 1.1)} value={`Mayer ${numberText(metrics.mayer)}`} note="Mayer 低于 1 或价格接近 200 周线，说明价格低于长期趋势中枢。" />
              </div>
            </div>
            <div className="plain-panel">
              <h3>顶部与风控</h3>
              <dl className="btc-metrics-list">
                <BtcMetric label="20周线" value={usdText(metrics.ma20w)} note="中期牛熊趋势线；顶部观察后跌破它，视为趋势破坏。" />
                <BtcMetric label="200周线" value={usdText(metrics.ma200w)} note="BTC 长周期成本中枢；接近它通常代表大周期便宜区。" />
                <BtcMetric label="NUPL" value={numberText(metrics.nupl)} note="链上未实现净盈亏；越高说明全网浮盈越重，顶部风险越高。" />
                <BtcMetric label="MVRV Z" value={numberText(metrics.mvrvZ)} note="市值相对实现市值的偏离程度；极高时代表历史性过热。" />
                <BtcMetric label="持仓峰值" value={usdText(stateDetails.cyclePeak)} note="本轮建仓后经历过的最高价格，用于判断利润保护触发。" />
                <BtcMetric label="平均成本" value={usdText(stateDetails.avgEntry)} note="策略模拟持仓的平均买入成本，用于判断是否进入成熟牛市阶段。" />
              </dl>
            </div>
          </section>

          <section className="table-panel">
            <div className="section-head"><h2>触发信号记录</h2><span>策略版本 {latest.strategy_version}</span></div>
            <div className="table-wrap">
              <table className="btc-history-table">
                <thead>
                  <tr>
                    <th>信号日</th>
                    <th>执行日</th>
                    <th>操作建议</th>
                    <th>执行价</th>
                    <th>信号价</th>
                    <th>目标仓位</th>
                    <th>底部分</th>
                    <th>顶部热度</th>
                    <th>底部共振</th>
                    <th>回撤</th>
                    <th>MVRV</th>
                    <th>NUPL</th>
                    <th>Puell</th>
                    <th>Mayer</th>
                    <th>触发原因</th>
                  </tr>
                </thead>
                <tbody>
                  {triggers.map((item) => (
                    <tr key={`${item.executionDate}-${item.action}-${item.targetPosition}`}>
                      <td>{item.signalDate}</td>
                      <td>{item.executionDate}</td>
                      <td>{item.actionLabel}</td>
                      <td>{usdText(item.executionPrice)}</td>
                      <td>{usdText(item.signalPrice)}</td>
                      <td>{percentText(item.targetPosition)}</td>
                      <td>{item.bottomScore}</td>
                      <td>{item.topScore}</td>
                      <td>{item.bottomGroups}/4</td>
                      <td>{ratioText(item.drawdown)}</td>
                      <td>{numberText(item.mvrv)}</td>
                      <td>{numberText(item.nupl)}</td>
                      <td>{numberText(item.puell)}</td>
                      <td>{numberText(item.mayer)}</td>
                      <td>{item.reason}</td>
                    </tr>
                  ))}
                  {triggers.length === 0 && (
                    <tr>
                      <td colSpan={15}>暂无已触发的买卖信号</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="risk-band">
            <p><AlertTriangle size={16} /> 这是周期仓位信号，不是短线预测；只使用现货复利口径，不使用合约杠杆。</p>
            <p><AlertTriangle size={16} /> 数据来自 Coin Metrics Community API；如果数据延迟或缺失，看板会保留最近一次可用信号。</p>
          </section>
        </>
      )}
    </section>
  );
}

function BtcCheck({ label, active, value, note }: { label: string; active: boolean; value: string; note: string }) {
  return <div className={active ? "active" : ""}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function BtcMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd><small>{note}</small></div>;
}

function BtcMatureCard({ signal }: { signal: BtcMatureSignal }) {
  const roleText = signal.role === "default" ? "系统默认" : signal.role === "defensive" ? "防守参考" : "进攻参考";
  const statusText = signal.active ? "已触发" : signal.reached ? "成熟区" : "未达到";
  return (
    <article className={`btc-mature-card ${signal.role} ${signal.active ? "active" : signal.reached ? "reached" : ""}`}>
      <div className="btc-mature-card-head">
        <div>
          <span>{roleText}</span>
          <strong>{signal.label}</strong>
        </div>
        <em>{statusText}</em>
      </div>
      <dl>
        <div><dt>当前倍数</dt><dd>{signal.peakMultiple == null ? "--" : `${numberText(signal.peakMultiple)}x`}</dd></div>
        <div><dt>成熟峰值</dt><dd>{usdText(signal.targetPeakPrice)}</dd></div>
        <div><dt>峰值回撤</dt><dd>{ratioText(signal.drawdownFromPeak)}</dd></div>
        <div><dt>破位触发价</dt><dd>{signal.reached ? usdText(signal.triggerPrice) : "不适用"}</dd></div>
      </dl>
      <p>{signal.action}</p>
      <small>{signal.note}</small>
    </article>
  );
}

function LegacyBtcStrategyPage() {
  const [strategy, setStrategy] = useState<Strategy | null>(null);

  useEffect(() => {
    api<Strategy>("/api/strategy/btc").then(setStrategy);
  }, []);

  if (!strategy) return <FullPageNote text="正在读取 BTC 策略" />;

  return (
    <section className="page">
      <PageHeader icon={<Bitcoin size={22} />} title={strategy.title} subtitle={strategy.source_note} />
      <div className="strategy-layout">
        <section className="score-panel">
          <div className={`trigger-box ${strategy.realtime?.triggered ? "hot" : ""}`}>
            <strong>{strategy.realtime?.changePct === undefined ? "--" : `${strategy.realtime.changePct.toFixed(2)}%`}</strong>
            <span>{strategy.realtime?.date ?? "实时数据不可用"}</span>
          </div>
          <div>
            <p className="eyebrow">实时 BTCUSDT 日线</p>
            <h2>{strategy.realtime?.triggered ? "策略已触发" : "等待触发"}</h2>
            <p>{strategy.realtime?.action ?? strategy.realtime?.error ?? "正在等待 Binance 数据。"}</p>
          </div>
        </section>
        <section className="plain-panel">
          <h3>最佳简单策略</h3>
          <ul className="clean-list">
            {strategy.content.rules.map((rule) => <li key={rule}><CheckCircle2 size={16} /> {rule}</li>)}
          </ul>
          <p className="conclusion">{strategy.content.conclusion}</p>
        </section>
      </div>
      <section className="table-panel">
        <h3>回测结果</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>单日跌幅</th><th>持有</th><th>杠杆</th><th>交易数</th><th>爆仓数</th><th>胜率</th><th>平均收益</th><th>持有期最深浮亏</th>
              </tr>
            </thead>
            <tbody>
              {strategy.content.backtest.map((row) => (
                <tr key={`${row.drop}-${row.hold}-${row.leverage}`}>
                  <td>{row.drop}</td><td>{row.hold}</td><td>{row.leverage}</td><td>{row.trades}</td><td>{row.liquidations}</td><td>{row.winRate}</td><td>{row.avgReturn}</td><td>{row.maxDrawdown}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="risk-band">
        {strategy.content.riskNotes.map((note) => <p key={note}><AlertTriangle size={16} /> {note}</p>)}
      </section>
    </section>
  );
}

function AdminPage() {
  const [tab, setTab] = useState<"foundation" | "jindan" | "indicators" | "users">("foundation");
  return (
    <section className="page">
      <PageHeader icon={<Shield size={22} />} title="后台管理" subtitle="配置筑基标的、见顶指标、用户权限和刷新节奏。" />
      <div className="tabs">
        <button className={tab === "foundation" ? "active" : ""} onClick={() => setTab("foundation")}><Layers3 size={16} /> 筑基看板</button>
        <button className={tab === "jindan" ? "active" : ""} onClick={() => setTab("jindan")}><Activity size={16} /> 结丹看板</button>
        <button className={tab === "indicators" ? "active" : ""} onClick={() => setTab("indicators")}><SlidersHorizontal size={16} /> 指标</button>
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}><Users size={16} /> 用户</button>
      </div>
      {tab === "foundation" && <FoundationAdmin />}
      {tab === "jindan" && <JindanAdmin />}
      {tab === "indicators" && <IndicatorAdmin />}
      {tab === "users" && <UserAdmin />}
    </section>
  );
}

function JindanAdmin() {
  const [assets, setAssets] = useState<JindanAsset[]>([]);
  const [selected, setSelected] = useState<JindanAsset>(blankJindanAsset);
  const [latest, setLatest] = useState<JindanSnapshot | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api<{ assets: JindanAsset[]; latest: JindanSnapshot | null }>("/api/admin/jindan");
    setAssets(data.assets);
    setLatest(data.latest);
    setSelected((current) => {
      if (!current.id) return data.assets[0] ?? blankJindanAsset;
      return data.assets.find((item) => item.id === current.id) ?? data.assets[0] ?? blankJindanAsset;
    });
  }

  useEffect(() => { void load(); }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const path = selected.id ? `/api/admin/jindan/assets/${selected.id}` : "/api/admin/jindan/assets";
      await api(path, { method: selected.id ? "PUT" : "POST", body: JSON.stringify(jindanAssetPayload(selected)) });
      setMessage("结丹标的已保存");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selected.id || !window.confirm(`删除 ${selected.name}？`)) return;
    setBusy(true);
    setMessage("");
    try {
      await api(`/api/admin/jindan/assets/${selected.id}`, { method: "DELETE" });
      setSelected(blankJindanAsset);
      setMessage("结丹标的已删除");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    setMessage("");
    try {
      const data = await api<{ snapshot: JindanSnapshot | null; rows: JindanRow[] }>("/api/jindan/generate", { method: "POST", body: JSON.stringify({}) });
      setLatest(data.snapshot);
      setMessage(`已生成结丹快照，${data.rows.length} 个标的`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "生成失败");
    } finally {
      setBusy(false);
    }
  }

  const sortedAssets = [...assets].sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name, "zh-CN"));

  return (
    <div className="admin-layout">
      <section className="list-panel">
        <button className={!selected.id ? "active" : ""} type="button" onClick={() => setSelected({ ...blankJindanAsset, sort_order: assets.length + 1 })}>
          <Plus size={16} /> 新增结丹标的
        </button>
        {sortedAssets.length === 0 && <div className="admin-asset-empty">暂无标的</div>}
        {sortedAssets.map((asset) => (
          <button key={asset.id} className={selected.id === asset.id ? "active" : ""} type="button" onClick={() => setSelected(asset)}>
            <span>{asset.name}</span>
            <em>{asset.code} · {jindanDataSourceLabel(asset.data_source)}</em>
          </button>
        ))}
      </section>
      <div className="admin-stack">
        <section className="edit-panel">
          <div className="section-head">
            <h3>{selected.id ? `编辑 ${selected.name}` : "新增结丹标的"}</h3>
            <span>{latest ? `最新快照 ${latest.report_date}` : "尚未生成快照"}</span>
          </div>
          <form onSubmit={save}>
            <div className="form-grid">
              <label>名称<input value={selected.name} onChange={(event) => setSelected({ ...selected, name: event.target.value })} required /></label>
              <label>代码<input value={selected.code} onChange={(event) => setSelected({ ...selected, code: event.target.value.toUpperCase() })} required placeholder="600000 或 BTCUSDT" /></label>
              <label>市场<input value={selected.market} onChange={(event) => setSelected({ ...selected, market: event.target.value })} required /></label>
              <label>类型<select value={selected.asset_type} onChange={(event) => setSelected({ ...selected, asset_type: event.target.value as JindanAssetType })}>{jindanAssetTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label>数据源<select value={selected.data_source} onChange={(event) => setSelected({ ...selected, data_source: event.target.value as JindanDataSource })}>{jindanDataSources.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label>排序<input type="number" value={selected.sort_order} onChange={(event) => setSelected({ ...selected, sort_order: Number(event.target.value) })} /></label>
              <label>启用<select value={selected.enabled ? "1" : "0"} onChange={(event) => setSelected({ ...selected, enabled: event.target.value === "1" ? 1 : 0 })}><option value="1">启用</option><option value="0">停用</option></select></label>
              <label>高亮<select value={selected.highlighted ? "1" : "0"} onChange={(event) => setSelected({ ...selected, highlighted: event.target.value === "1" ? 1 : 0 })}><option value="0">普通</option><option value="1">高亮</option></select></label>
            </div>
            <div className="form-actions">
              <button className="primary-button" disabled={busy}><Plus size={16} /> 保存结丹标的</button>
              <button className="secondary-button" type="button" disabled={busy || assets.length === 0} onClick={generate}><RefreshCcw size={16} /> 生成快照</button>
              {selected.id && <button className="danger-button" type="button" disabled={busy} onClick={remove}><Trash2 size={16} /> 删除</button>}
            </div>
            {message && <p className={message.includes("失败") || message.includes("未配置") ? "error-text" : "success-text"}>{message}</p>}
          </form>
        </section>
        <section className="plain-panel jindan-admin-note">
          <h3>计算口径</h3>
          <p>偏离率按当前收盘价相对 20 日均线计算；量比按当日成交量除以前 5 个有效交易日平均成交量。状态转变时间取最近一次穿越 20 日均线的日期，区间涨幅以转变前一交易日收盘价为基准。</p>
        </section>
        <section className="plain-panel jindan-admin-note">
          <h3>数据源选择规则</h3>
          <div className="jindan-rule-list">
            <p><strong>A股标准指数</strong><span>选 Tushare 指数日线。例：399300 沪深300、399006 创业板、399905 中证500、000510 中证A500、000016 上证50、000688 科创50。</span></p>
            <p><strong>同花顺特色指数</strong><span>选 同花顺指数日线。例：883418 微盘股，以及类似 88xxxx 的同花顺指数。</span></p>
            <p><strong>股票</strong><span>选 Tushare 股票日线(前复权)。股票和 ETF 在结丹列表里点击会打开东方财富页面。</span></p>
            <p><strong>ETF</strong><span>选 Tushare 基金日线。即使误选股票日线，后端也会按 ETF 自动走基金日线。</span></p>
            <p><strong>港美指数、海外 ETF、黄金白银</strong><span>优先选 Yahoo 日线；常见代码如 QQQ、SPX、HSI、HKTECH、AUUSDO 系统也会自动映射。</span></p>
          </div>
        </section>
      </div>
    </div>
  );
}

function FoundationAdmin() {
  const [assets, setAssets] = useState<FoundationAsset[]>([]);
  const [settings, setSettings] = useState<FoundationSettings>(defaultFoundationSettings);
  const [selected, setSelected] = useState<FoundationRaw>(blankFoundationRaw);
  const [message, setMessage] = useState("");

  async function load() {
    const data = await api<{ settings: FoundationSettings; assets: FoundationAsset[] }>("/api/admin/foundation");
    setSettings(data.settings);
    setAssets(data.assets);
    setSelected((current) => {
      if (!current.id) return data.assets[0]?.raw ?? blankFoundationRaw;
      return data.assets.find((item) => item.id === current.id)?.raw ?? data.assets[0]?.raw ?? blankFoundationRaw;
    });
  }

  useEffect(() => { load(); }, []);

  const groupedAssets = useMemo(() => {
    return foundationAdminSections.map((section) => ({
      ...section,
      items: assets
        .filter((asset) => asset.asset_type === section.key)
        .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name, "zh-CN") || left.code.localeCompare(right.code))
    }));
  }, [assets]);

  async function moveAsset(asset: FoundationAsset, direction: "up" | "down") {
    const section = groupedAssets.find((group) => group.key === asset.asset_type);
    if (!section) return;
    const currentIndex = section.items.findIndex((item) => item.id === asset.id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    await moveAssetToIndex(asset, targetIndex);
  }

  async function moveAssetToIndex(asset: FoundationAsset, targetIndex: number) {
    const section = groupedAssets.find((group) => group.key === asset.asset_type);
    if (!section) return;
    const currentIndex = section.items.findIndex((item) => item.id === asset.id);
    const boundedIndex = Math.min(Math.max(Math.trunc(targetIndex), 0), section.items.length - 1);
    if (currentIndex < 0 || currentIndex === boundedIndex) return;

    const reordered = [...section.items];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(boundedIndex, 0, moved);
    await Promise.all(reordered.map((item, index) => {
      const raw = item.raw;
      if (!raw) return Promise.resolve();
      return api(`/api/admin/foundation/assets/${item.id}`, {
        method: "PUT",
        body: JSON.stringify(foundationPayload({ ...raw, sort_order: (index + 1) * 10 }))
      });
    }));
    setMessage(`${asset.name} 已移动到第 ${boundedIndex + 1} 位`);
    await load();
  }

  function submitSortIndex(asset: FoundationAsset, rawValue: string, currentIndex: number) {
    const targetPosition = Number(rawValue);
    if (!Number.isFinite(targetPosition)) return;
    if (targetPosition === currentIndex + 1) return;
    void moveAssetToIndex(asset, targetPosition - 1);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const payload = foundationPayload(selected);
    const path = selected.id ? `/api/admin/foundation/assets/${selected.id}` : "/api/admin/foundation/assets";
    await api(path, { method: selected.id ? "PUT" : "POST", body: JSON.stringify(payload) });
    setMessage("筑基标的已保存");
    await load();
  }

  async function remove() {
    if (!selected.id || !window.confirm(`删除 ${selected.name}？`)) return;
    await api(`/api/admin/foundation/assets/${selected.id}`, { method: "DELETE" });
    setMessage("已删除");
    setSelected(blankFoundationRaw);
    await load();
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    await api("/api/admin/foundation/settings", {
      method: "PUT",
      body: JSON.stringify({
        trading_refresh_seconds: Number(settings.trading_refresh_seconds),
        offhours_refresh_seconds: Number(settings.offhours_refresh_seconds)
      })
    });
    setMessage("刷新配置已保存");
    await load();
  }

  return (
    <div className="admin-layout">
      <div className="list-panel">
        <button className={!selected.id ? "active" : ""} onClick={() => setSelected({ ...blankFoundationRaw, sort_order: assets.length + 1 })}>
          <Plus size={15} /> 新增标的
        </button>
        {groupedAssets.map((section) => (
          <div className="admin-asset-group" key={section.key}>
            <div className="admin-asset-group-title">
              <span>{section.title}</span>
              <small>{section.items.length}</small>
            </div>
            {section.items.length === 0 && <div className="admin-asset-empty">暂无标的</div>}
            {section.items.map((item, index) => (
              <div className={`admin-asset-row ${selected.id === item.id ? "active" : ""}`} key={item.id}>
                <button type="button" className="admin-asset-main" onClick={() => setSelected(item.raw ?? blankFoundationRaw)}>
                  <span>
                    <strong>{item.name}</strong>
                    <em>{item.code}</em>
                  </span>
                  <ConclusionPill value={item.conclusion} />
                </button>
                <div className="sort-actions" aria-label={`${item.name} 排序`}>
                  <button type="button" className="sort-button" title="置顶" disabled={index === 0} onClick={() => moveAssetToIndex(item, 0)}><ChevronsUp size={14} /></button>
                  <button type="button" className="sort-button" title="上移" disabled={index === 0} onClick={() => moveAsset(item, "up")}><ArrowUp size={14} /></button>
                  <label className="sort-index" title="输入目标序号后按回车或移开焦点">
                    <span>序</span>
                    <input
                      key={`${item.id}-${index}`}
                      type="number"
                      min={1}
                      max={section.items.length}
                      defaultValue={index + 1}
                      onFocus={(event) => event.currentTarget.select()}
                      onBlur={(event) => submitSortIndex(item, event.currentTarget.value, index)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
                      }}
                    />
                  </label>
                  <button type="button" className="sort-button" title="下移" disabled={index === section.items.length - 1} onClick={() => moveAsset(item, "down")}><ArrowDown size={14} /></button>
                  <button type="button" className="sort-button" title="置底" disabled={index === section.items.length - 1} onClick={() => moveAssetToIndex(item, section.items.length - 1)}><ChevronsDown size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="admin-stack">
        <form className="edit-panel compact refresh-settings-form" onSubmit={saveSettings}>
          <h3>刷新配置</h3>
          <label>交易时段刷新秒数<input type="number" min={5} max={3600} value={settings.trading_refresh_seconds} onChange={(event) => setSettings({ ...settings, trading_refresh_seconds: Number(event.target.value) })} /></label>
          <label>非交易时段刷新秒数<input type="number" min={30} max={86400} value={settings.offhours_refresh_seconds} onChange={(event) => setSettings({ ...settings, offhours_refresh_seconds: Number(event.target.value) })} /></label>
          <button className="secondary-button"><RefreshCcw size={16} /> 保存配置</button>
        </form>
        <form className="edit-panel" onSubmit={save}>
          <div className="panel-title-row">
            <h3>{selected.id ? `编辑 ${selected.name}` : "新增筑基标的"}</h3>
            {selected.id && <button type="button" className="danger-button" onClick={remove}><Trash2 size={15} /> 删除</button>}
          </div>
          <div className="form-grid">
            <label>类型<select value={selected.asset_type} onChange={(event) => setSelected({ ...selected, asset_type: event.target.value as AssetType })}><option value="stock">股票</option><option value="etf">ETF</option><option value="other">其他</option></select></label>
            <label>市场<input value={selected.market} onChange={(event) => setSelected({ ...selected, market: event.target.value })} /></label>
            <label>名称<input value={selected.name} onChange={(event) => setSelected({ ...selected, name: event.target.value })} /></label>
            <label>代码<input value={selected.code} onChange={(event) => setSelected({ ...selected, code: event.target.value })} /></label>
            <label>排序<input type="number" value={selected.sort_order} onChange={(event) => setSelected({ ...selected, sort_order: Number(event.target.value) })} /></label>
            <label>启用<select value={selected.enabled ? "1" : "0"} onChange={(event) => setSelected({ ...selected, enabled: event.target.value === "1" ? 1 : 0 })}><option value="1">启用</option><option value="0">停用</option></select></label>
            <label>现价<input type="number" step="0.001" value={selected.current_price ?? ""} onChange={(event) => setSelected({ ...selected, current_price: numericInput(event.target.value) })} /></label>
            <label>结论<select value={selected.conclusion} onChange={(event) => setSelected({ ...selected, conclusion: event.target.value as FoundationConclusion })}>{conclusionOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          </div>
          <h4>买入参考</h4>
          <div className="form-grid">
            <label>禁追 ≥<input type="number" step="0.001" value={selected.no_chase_min ?? ""} onChange={(event) => setSelected({ ...selected, no_chase_min: numericInput(event.target.value) })} /></label>
            <RangeInputs label="观察" min={selected.observe_min} max={selected.observe_max} onChange={(min, max) => setSelected({ ...selected, observe_min: min, observe_max: max })} />
            <RangeInputs label="合理" min={selected.reasonable_min} max={selected.reasonable_max} onChange={(min, max) => setSelected({ ...selected, reasonable_min: min, reasonable_max: max })} />
            <RangeInputs label="安全" min={selected.safe_min} max={selected.safe_max} onChange={(min, max) => setSelected({ ...selected, safe_min: min, safe_max: max })} />
            <RangeInputs label="捡漏" min={selected.bargain_min} max={selected.bargain_max} onChange={(min, max) => setSelected({ ...selected, bargain_min: min, bargain_max: max })} />
          </div>
          <h4>卖出 / 风控</h4>
          <div className="form-grid">
            <label>止损 ≤<input type="number" step="0.001" value={selected.stop_loss ?? ""} onChange={(event) => setSelected({ ...selected, stop_loss: numericInput(event.target.value) })} /></label>
            <RangeInputs label="减仓" min={selected.reduce_min} max={selected.reduce_max} onChange={(min, max) => setSelected({ ...selected, reduce_min: min, reduce_max: max })} />
            <RangeInputs label="卖出" min={selected.sell_min} max={selected.sell_max} onChange={(min, max) => setSelected({ ...selected, sell_min: min, sell_max: max })} />
            <label>底仓 ≥<input type="number" step="0.001" value={selected.keep_min ?? ""} onChange={(event) => setSelected({ ...selected, keep_min: numericInput(event.target.value) })} /></label>
          </div>
          <label>完整分析 Markdown<textarea className="report-input" value={selected.analysis_markdown} onChange={(event) => setSelected({ ...selected, analysis_markdown: event.target.value })} /></label>
          <button className="primary-button"><RefreshCcw size={16} /> 保存筑基标的</button>
          {message && <p className="success-text">{message}</p>}
        </form>
      </div>
    </div>
  );
}

function RangeInputs({ label, min, max, onChange }: { label: string; min: number | null; max: number | null; onChange: (min: number | null, max: number | null) => void }) {
  return (
    <div className="range-inputs">
      <span>{label}</span>
      <input type="number" step="0.001" placeholder="下限" value={min ?? ""} onChange={(event) => onChange(numericInput(event.target.value), max)} />
      <input type="number" step="0.001" placeholder="上限" value={max ?? ""} onChange={(event) => onChange(min, numericInput(event.target.value))} />
    </div>
  );
}

function IndicatorAdmin() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [selected, setSelected] = useState<Indicator | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const data = await api<{ indicators: Indicator[] }>("/api/admin/indicators");
    setIndicators(data.indicators);
    setSelected((current) => current ? data.indicators.find((item) => item.id === current.id) ?? data.indicators[0] : data.indicators[0]);
  }

  useEffect(() => { load(); }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    await api(`/api/admin/indicators/${selected.id}`, {
      method: "PUT",
      body: JSON.stringify({
        weight: Number(selected.weight),
        enabled: Boolean(selected.enabled),
        source_type: selected.source_type,
        source_name: selected.source_name,
        source_url: selected.source_url || null,
        threshold_note: selected.threshold_note,
        near_threshold: numericOrNull(selected.near_threshold),
        hit_threshold: numericOrNull(selected.hit_threshold),
        current_value: numericOrNull(selected.current_value),
        current_text: selected.current_text || null,
        status: selected.status
      })
    });
    setMessage("已保存");
    await load();
  }

  return (
    <div className="admin-layout">
      <div className="list-panel">
        {indicators.map((item) => (
          <button key={item.id} className={selected?.id === item.id ? "active" : ""} onClick={() => setSelected(item)}>
            <span>{item.name}</span>
            <StatusPill status={item.status} />
          </button>
        ))}
      </div>
      {selected && (
        <form className="edit-panel" onSubmit={save}>
          <h3>{selected.name}</h3>
          <div className="form-grid">
            <label>权重<input type="number" step="0.1" value={selected.weight} onChange={(event) => setSelected({ ...selected, weight: Number(event.target.value) })} /></label>
            <label>状态<select value={selected.status} onChange={(event) => setSelected({ ...selected, status: event.target.value as Indicator["status"] })}>{statusOptions.map((option) => <option key={option} value={option}>{statusLabel(option)}</option>)}</select></label>
            <label>数据类型<select value={selected.source_type} onChange={(event) => setSelected({ ...selected, source_type: event.target.value as Indicator["source_type"] })}><option value="auto">自动获取</option><option value="manual">手动配置</option><option value="pending">待接入</option></select></label>
            <label>启用<select value={selected.enabled ? "1" : "0"} onChange={(event) => setSelected({ ...selected, enabled: event.target.value === "1" })}><option value="1">启用</option><option value="0">停用</option></select></label>
            <label>当前数值<input type="number" step="0.01" value={selected.current_value ?? ""} onChange={(event) => setSelected({ ...selected, current_value: event.target.value ? Number(event.target.value) : null })} /></label>
            <label>当前文本<input value={selected.current_text ?? ""} onChange={(event) => setSelected({ ...selected, current_text: event.target.value })} /></label>
            <label>接近阈值<input type="number" step="0.01" value={selected.near_threshold ?? ""} onChange={(event) => setSelected({ ...selected, near_threshold: event.target.value ? Number(event.target.value) : null })} /></label>
            <label>达标阈值<input type="number" step="0.01" value={selected.hit_threshold ?? ""} onChange={(event) => setSelected({ ...selected, hit_threshold: event.target.value ? Number(event.target.value) : null })} /></label>
          </div>
          <label>数据源名称<input value={selected.source_name} onChange={(event) => setSelected({ ...selected, source_name: event.target.value })} /></label>
          <label>数据源链接<input value={selected.source_url ?? ""} onChange={(event) => setSelected({ ...selected, source_url: event.target.value })} /></label>
          <label>阈值说明<textarea value={selected.threshold_note} onChange={(event) => setSelected({ ...selected, threshold_note: event.target.value })} /></label>
          <button className="primary-button"><RefreshCcw size={16} /> 保存指标</button>
          {message && <p className="success-text">{message}</p>}
        </form>
      )}
    </div>
  );
}

function UserAdmin() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "user" as "admin" | "user" });
  const [message, setMessage] = useState("");

  async function load() {
    const data = await api<{ users: AdminUser[] }>("/api/admin/users");
    setUsers(data.users);
  }

  useEffect(() => { load(); }, []);

  async function createUser(event: FormEvent) {
    event.preventDefault();
    await api("/api/admin/users", { method: "POST", body: JSON.stringify(form) });
    setForm({ email: "", name: "", password: "", role: "user" });
    setMessage("用户已创建");
    await load();
  }

  return (
    <div className="users-layout">
      <form className="edit-panel" onSubmit={createUser}>
        <h3><UserPlus size={18} /> 创建用户</h3>
        <label>邮箱<input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>名称<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>密码<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        <label>角色<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as "admin" | "user" })}><option value="user">普通用户</option><option value="admin">管理员</option></select></label>
        <button className="primary-button"><Plus size={16} /> 创建</button>
        {message && <p className="success-text">{message}</p>}
      </form>
      <section className="table-panel">
        <h3>用户列表</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>邮箱</th><th>名称</th><th>角色</th><th>状态</th></tr></thead>
            <tbody>{users.map((item) => <tr key={item.id}><td>{item.email}</td><td>{item.name}</td><td>{item.role}</td><td>{item.disabled ? "已禁用" : "正常"}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PageHeader({ icon, title, subtitle, action }: { icon: ReactNode; title: string; subtitle: string; action?: ReactNode }) {
  return <header className="page-header"><div>{icon}<h1>{title}</h1></div><p>{subtitle}</p>{action && <div className="header-action">{action}</div>}</header>;
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return <div className="metric">{icon}<span>{label}</span><strong>{value}</strong></div>;
}

function StatusPill({ status }: { status: Indicator["status"] }) {
  return <span className={`status-pill ${status}`}>{statusLabel(status)}</span>;
}

function ConclusionPill({ value }: { value: FoundationConclusion }) {
  return <span className={`conclusion-pill ${valueClass(value)}`}>{value}</span>;
}

const statusOptions: Indicator["status"][] = ["not_hit", "near", "hit", "pending", "manual", "failed"];
const conclusionOptions: FoundationConclusion[] = ["不碰", "只观察", "等回调", "低位分批", "已具备较好安全边际"];

function statusLabel(status: Indicator["status"]) {
  return ({ not_hit: "未达标", near: "接近", hit: "已达标", pending: "待接入", manual: "手动", failed: "失败" } as const)[status];
}

function valueClass(value: FoundationConclusion) {
  return ({ 不碰: "avoid", 只观察: "watch", 等回调: "wait", 低位分批: "buy", 已具备较好安全边际: "safe" } as const)[value];
}

function valueText(value: number | null) {
  return value === null ? "--" : String(value);
}

function numericOrNull(value: number | null) {
  return value === null || Number.isNaN(value) ? null : Number(value);
}

function numericInput(value: string) {
  return value === "" ? null : Number(value);
}

function priceText(value: number | null) {
  if (value === null) return "--";
  return value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numberText(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toLocaleString("zh-CN", { maximumFractionDigits: digits });
}

function percentText(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${Math.round(value * 100)}%`;
}

function ratioText(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${(value * 100).toFixed(2)}%`;
}

function usdText(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `$${value.toLocaleString("zh-CN", { maximumFractionDigits: value >= 1000 ? 0 : 2 })}`;
}

function dateTimeText(value: string | null | undefined) {
  if (!value) return "--";
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function shortTime(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value.slice(11, 16) || value.slice(0, 10);
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function quoteRefreshTime(value: string) {
  if (!value) return "—";
  if (!value.includes("T")) {
    return value.slice(11, 19) || value;
  }
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value.slice(11, 19) || value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function foundationPayload(raw: FoundationRaw) {
  return {
    asset_type: raw.asset_type,
    name: raw.name,
    code: raw.code,
    market: raw.market,
    enabled: Boolean(raw.enabled),
    sort_order: Number(raw.sort_order),
    current_price: raw.current_price,
    no_chase_min: raw.no_chase_min,
    observe_min: raw.observe_min,
    observe_max: raw.observe_max,
    reasonable_min: raw.reasonable_min,
    reasonable_max: raw.reasonable_max,
    safe_min: raw.safe_min,
    safe_max: raw.safe_max,
    bargain_min: raw.bargain_min,
    bargain_max: raw.bargain_max,
    stop_loss: raw.stop_loss,
    reduce_min: raw.reduce_min,
    reduce_max: raw.reduce_max,
    sell_min: raw.sell_min,
    sell_max: raw.sell_max,
    keep_min: raw.keep_min,
    conclusion: raw.conclusion,
    analysis_markdown: raw.analysis_markdown,
    analysis_json: raw.analysis_json || "{}",
    analysis_updated_at: raw.analysis_updated_at
  };
}

function jindanAssetPayload(raw: JindanAsset) {
  return {
    asset_type: raw.asset_type,
    name: raw.name,
    code: raw.code,
    market: raw.market,
    data_source: raw.data_source,
    enabled: Boolean(raw.enabled),
    highlighted: Boolean(raw.highlighted),
    sort_order: raw.sort_order
  };
}

function FullPageNote({ text }: { text: string }) {
  return <div className="full-note">{text}</div>;
}

async function logout(setUser: (user: User | null) => void) {
  await api("/api/auth/logout", { method: "POST" });
  setUser(null);
}

async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: init?.cache ?? "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "请求失败");
  return data as T;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
