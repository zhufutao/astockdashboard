import { StrictMode, useEffect, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bitcoin,
  CheckCircle2,
  CircleGauge,
  Database,
  LogOut,
  Plus,
  RefreshCcw,
  Shield,
  SlidersHorizontal,
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

type AdminUser = User & { disabled: number; created_at: string };

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("dashboard");

  useEffect(() => {
    api<{ user: User | null }>("/api/auth/me")
      .then((data) => setUser(data.user))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <FullPageNote text="正在载入慢富" />;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <CircleGauge size={28} />
          <div>
            <strong>慢富</strong>
            <span>极简投资看板</span>
          </div>
        </div>
        <nav>
          <button className={page === "dashboard" ? "active" : ""} onClick={() => setPage("dashboard")}>
            <BarChart3 size={18} /> 见顶仪表盘
          </button>
          <button className={page === "btc" ? "active" : ""} onClick={() => setPage("btc")}>
            <Bitcoin size={18} /> BTC 捡漏策略
          </button>
          {user.role === "admin" && (
            <button className={page === "admin" ? "active" : ""} onClick={() => setPage("admin")}>
              <SlidersHorizontal size={18} /> 后台管理
            </button>
          )}
        </nav>
        <div className="account">
          <div>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button className="icon-button" title="退出登录" onClick={() => logout(setUser)}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <main>
        {page === "dashboard" && <DashboardPage />}
        {page === "btc" && <BtcStrategyPage />}
        {page === "admin" && user.role === "admin" && <AdminPage />}
      </main>
    </div>
  );
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
            <span>A 股顶部风险与低频策略看板</span>
          </div>
        </div>
        <label>
          邮箱
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          密码
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="primary-button" disabled={submitting}>
          {submitting ? "登录中" : "登录"}
        </button>
      </form>
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
            <Bar dataKey="weight" fill="#d8dee9" radius={[4, 4, 0, 0]} />
            <Bar dataKey="contribution" fill="#111827" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>
      <div className="indicator-grid">
        {dashboard.indicators.map((indicator) => (
          <IndicatorCard key={indicator.id} indicator={indicator} />
        ))}
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
  const [tab, setTab] = useState<"indicators" | "users">("indicators");
  return (
    <section className="page">
      <PageHeader icon={<Shield size={22} />} title="后台管理" subtitle="第一版支持指标手动配置和管理员创建用户。" />
      <div className="tabs">
        <button className={tab === "indicators" ? "active" : ""} onClick={() => setTab("indicators")}><SlidersHorizontal size={16} /> 指标</button>
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}><Users size={16} /> 用户</button>
      </div>
      {tab === "indicators" ? <IndicatorAdmin /> : <UserAdmin />}
    </section>
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

function PageHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return <header className="page-header"><div>{icon}<h1>{title}</h1></div><p>{subtitle}</p></header>;
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return <div className="metric">{icon}<span>{label}</span><strong>{value}</strong></div>;
}

function StatusPill({ status }: { status: Indicator["status"] }) {
  return <span className={`status-pill ${status}`}>{statusLabel(status)}</span>;
}

const statusOptions: Indicator["status"][] = ["not_hit", "near", "hit", "pending", "manual", "failed"];

function statusLabel(status: Indicator["status"]) {
  return ({ not_hit: "未达标", near: "接近", hit: "已达标", pending: "待接入", manual: "手动", failed: "失败" } as const)[status];
}

function valueText(value: number | null) {
  return value === null ? "--" : String(value);
}

function numericOrNull(value: number | null) {
  return value === null || Number.isNaN(value) ? null : Number(value);
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
