import { StrictMode, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bitcoin,
  CheckCircle2,
  CircleGauge,
  Database,
  Layers3,
  LogOut,
  Plus,
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

type AssetType = "stock" | "etf" | "other";
type FoundationConclusion = "不碰" | "只观察" | "等回调" | "低位分批" | "已具备较好安全边际";

type FoundationLevels = {
  no_chase: string;
  observe: string;
  reasonable: string;
  safe: string;
  bargain: string;
  stop_loss: string;
  reduce: string;
  sell: string;
  keep: string;
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
};

type FoundationSettings = { refresh_seconds: number };
type AdminUser = User & { disabled: number; created_at: string };
type Page = "foundation" | "foundation-detail" | "dashboard" | "btc" | "admin";

const levelMeta = [
  ["no_chase", "禁追", "绝对不追价区间，高于该位置不新买"],
  ["observe", "观察", "可以开始跟踪，但不急着买"],
  ["reasonable", "合理", "具备一定性价比的买入区"],
  ["safe", "安全", "安全边际较高，值得认真考虑"],
  ["bargain", "捡漏", "恐慌或错杀时的极限低价区"],
  ["stop_loss", "止损", "买入逻辑失效/抄底失败认错位"],
  ["reduce", "减仓", "偏热时候的减仓观察区"],
  ["sell", "卖出", "明显高估/分批卖出区"],
  ["keep", "底仓", "极端高估/只留底仓区"]
] as const;

const buyKeys = ["no_chase", "observe", "reasonable", "safe", "bargain"] as const;
const sellKeys = ["stop_loss", "reduce", "sell", "keep"] as const;

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
            <span>安全边际工作台</span>
          </div>
        </div>
        <nav>
          <NavButton active={page === "foundation" || page === "foundation-detail"} onClick={() => setPage("foundation")} icon={<Layers3 size={18} />} label="筑基看板" />
          <NavButton active={page === "dashboard"} onClick={() => setPage("dashboard")} icon={<BarChart3 size={18} />} label="见顶仪表盘" />
          <NavButton active={page === "btc"} onClick={() => setPage("btc")} icon={<Bitcoin size={18} />} label="BTC 捡漏策略" />
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
        {page === "foundation" && <FoundationBoard onOpen={openFoundationDetail} />}
        {page === "foundation-detail" && detailId && <FoundationDetailPage id={detailId} onBack={() => setPage("foundation")} />}
        {page === "dashboard" && <DashboardPage />}
        {page === "btc" && <BtcStrategyPage />}
        {page === "admin" && user.role === "admin" && <AdminPage />}
      </main>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return <button className={active ? "active" : ""} onClick={onClick}>{icon} {label}</button>;
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("admin@666.com");
  const [password, setPassword] = useState("666666");
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
      <form className="login-panel" onSubmit={submit}>
        <div className="brand large">
          <CircleGauge size={32} />
          <div>
            <strong>慢富</strong>
            <span>低风险高赔率资产看板</span>
          </div>
        </div>
        <label>
          邮箱
          <input value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          密码
          <input type="password" value={password} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="primary-button" disabled={submitting}>
          {submitting ? "登录中" : "登录"}
        </button>
      </form>
    </div>
  );
}

function FoundationBoard({ onOpen }: { onOpen: (id: string) => void }) {
  const [assets, setAssets] = useState<FoundationAsset[]>([]);
  const [settings, setSettings] = useState<FoundationSettings>({ refresh_seconds: 15 });
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  async function load(refreshPrices = false) {
    setRefreshing(refreshPrices);
    try {
      const data = await api<{ settings: FoundationSettings; assets: FoundationAsset[] }>(refreshPrices ? "/api/foundation/prices" : "/api/foundation", { method: refreshPrices ? "POST" : "GET" });
      setAssets(data.assets);
      setSettings(data.settings);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取失败");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const intervalMs = Math.max(5, settings.refresh_seconds) * 1000;
    const timer = window.setInterval(() => load(true), intervalMs);
    return () => window.clearInterval(timer);
  }, [settings.refresh_seconds]);

  const grouped = useMemo(() => ({
    stock: assets.filter((item) => item.asset_type === "stock"),
    etf: assets.filter((item) => item.asset_type === "etf"),
    other: assets.filter((item) => item.asset_type === "other")
  }), [assets]);

  return (
    <section className="page">
      <PageHeader
        icon={<Layers3 size={22} />}
        title="筑基看板"
        subtitle="只盯低风险、高赔率、安全边际。没有合适点位，就让系统安静地等。"
        action={<button className="secondary-button" onClick={() => load(true)} disabled={refreshing}><RefreshCcw size={16} /> {refreshing ? "刷新中" : "刷新价格"}</button>}
      />
      <div className="hero-grid foundation-summary">
        <Metric label="跟踪标的" value={assets.length} icon={<Database size={18} />} />
        <Metric label="命中买入区" value={assets.filter((item) => item.hit_fields.some((key) => ["reasonable", "safe", "bargain"].includes(key))).length} icon={<CheckCircle2 size={18} />} />
        <Metric label="卖出/风控提醒" value={assets.filter((item) => item.hit_fields.some((key) => ["stop_loss", "reduce", "sell", "keep", "no_chase"].includes(key))).length} icon={<TrendingDown size={18} />} />
        <Metric label="刷新间隔" value={`${settings.refresh_seconds}s`} icon={<Activity size={18} />} />
      </div>
      {error && <p className="error-text" role="alert">{error}</p>}
      <FoundationSection title="股票" assets={grouped.stock} onOpen={onOpen} />
      <FoundationSection title="ETF" assets={grouped.etf} onOpen={onOpen} />
      <FoundationSection title="其他" assets={grouped.other} onOpen={onOpen} />
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
                <th rowSpan={2}>代码</th>
                <th rowSpan={2}>现价</th>
                <th className="buy-group" colSpan={5}>买入参考</th>
                <th className="sell-group" colSpan={4}>卖出 / 风控</th>
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
  return (
    <tr className="click-row" onClick={() => onOpen(asset.id)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && onOpen(asset.id)}>
      <td>{index}</td>
      <td><strong>{asset.name}</strong><span className="muted-inline">{asset.market}</span></td>
      <td className="mono">{asset.code}</td>
      <td className={asset.price_status === "failed" ? "quote-cell failed" : "quote-cell"}>
        <strong>{priceText(asset.current_price)}</strong>
        <span>{asset.price_status === "failed" ? "失败" : asset.price_updated_at ? shortTime(asset.price_updated_at) : "待刷新"}</span>
      </td>
      {buyKeys.map((key) => <LevelCell key={key} asset={asset} itemKey={key} />)}
      {sellKeys.map((key) => <LevelCell className={key === "stop_loss" ? "group-split" : ""} key={key} asset={asset} itemKey={key} />)}
      <td><ConclusionPill value={asset.conclusion} /></td>
    </tr>
  );
}

function LevelCell({ asset, itemKey, className = "" }: { asset: FoundationAsset; itemKey: keyof FoundationLevels; className?: string }) {
  const hit = asset.hit_fields.includes(itemKey);
  return <td className={`${className} level-cell ${hit ? `hit ${itemKey}` : ""}`}><span>{asset.levels[itemKey]}</span>{hit && <em>命中</em>}</td>;
}

function TooltipLabel({ itemKey }: { itemKey: keyof FoundationLevels }) {
  const meta = levelMeta.find(([key]) => key === itemKey)!;
  return <span className="tooltip-label" tabIndex={0} data-tooltip={meta[2]} title={meta[2]}>{meta[1]}</span>;
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
  return (
    <div className="markdown-view">
      {text.split(/\n{2,}/).map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("### ")) return <h3 key={index}>{trimmed.slice(4)}</h3>;
        if (trimmed.startsWith("## ")) return <h2 key={index}>{trimmed.slice(3)}</h2>;
        if (trimmed.startsWith("# ")) return <h1 key={index}>{trimmed.slice(2)}</h1>;
        if (trimmed.includes("\n- ")) {
          return <ul key={index}>{trimmed.split("\n").map((line) => <li key={line}>{line.replace(/^- /, "")}</li>)}</ul>;
        }
        return <p key={index}>{trimmed}</p>;
      })}
    </div>
  );
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
  const [tab, setTab] = useState<"foundation" | "indicators" | "users">("foundation");
  return (
    <section className="page">
      <PageHeader icon={<Shield size={22} />} title="后台管理" subtitle="配置筑基标的、见顶指标、用户权限和刷新节奏。" />
      <div className="tabs">
        <button className={tab === "foundation" ? "active" : ""} onClick={() => setTab("foundation")}><Layers3 size={16} /> 筑基看板</button>
        <button className={tab === "indicators" ? "active" : ""} onClick={() => setTab("indicators")}><SlidersHorizontal size={16} /> 指标</button>
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}><Users size={16} /> 用户</button>
      </div>
      {tab === "foundation" && <FoundationAdmin />}
      {tab === "indicators" && <IndicatorAdmin />}
      {tab === "users" && <UserAdmin />}
    </section>
  );
}

function FoundationAdmin() {
  const [assets, setAssets] = useState<FoundationAsset[]>([]);
  const [settings, setSettings] = useState<FoundationSettings>({ refresh_seconds: 15 });
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
    await api("/api/admin/foundation/settings", { method: "PUT", body: JSON.stringify({ refresh_seconds: Number(settings.refresh_seconds) }) });
    setMessage("刷新秒数已保存");
  }

  return (
    <div className="admin-layout">
      <div className="list-panel">
        <button className={!selected.id ? "active" : ""} onClick={() => setSelected({ ...blankFoundationRaw, sort_order: assets.length + 1 })}>
          <Plus size={15} /> 新增标的
        </button>
        {assets.map((item) => (
          <button key={item.id} className={selected.id === item.id ? "active" : ""} onClick={() => setSelected(item.raw ?? blankFoundationRaw)}>
            <span>{item.name}</span>
            <ConclusionPill value={item.conclusion} />
          </button>
        ))}
      </div>
      <div className="admin-stack">
        <form className="edit-panel compact" onSubmit={saveSettings}>
          <h3>刷新配置</h3>
          <label>前台价格刷新秒数<input type="number" min={5} max={3600} value={settings.refresh_seconds} onChange={(event) => setSettings({ refresh_seconds: Number(event.target.value) })} /></label>
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
  return value >= 1000 ? value.toLocaleString("zh-CN", { maximumFractionDigits: 0 }) : value.toLocaleString("zh-CN", { maximumFractionDigits: 3 });
}

function shortTime(value: string) {
  return value.includes("T") ? value.slice(11, 16) : value.slice(11, 16) || value.slice(0, 10);
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
