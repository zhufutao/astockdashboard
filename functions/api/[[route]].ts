import { Context, Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

type Env = {
  DB: D1Database;
  APP_NAME?: string;
  TUSHARE_TOKEN?: string;
  BTC_LIGHTHOUSE_REFRESH_TOKEN?: string;
  FLOW_LAB_INGEST_TOKEN?: string;
};

type User = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "user";
  disabled: number;
};

type Indicator = {
  id: string;
  name: string;
  category: string;
  description: string;
  weight: number;
  enabled: number;
  source_type: "auto" | "manual" | "pending";
  source_name: string;
  source_url: string | null;
  threshold_note: string;
  near_threshold: number | null;
  hit_threshold: number | null;
  direction: "gte" | "lte" | "boolean_count";
  current_value: number | null;
  current_text: string | null;
  status: "not_hit" | "near" | "hit" | "pending" | "manual" | "failed";
  contribution: number;
  last_updated: string | null;
  history_json: string;
  sort_order: number;
};

type FoundationAssetType = "stock" | "etf" | "other";
type FoundationConclusion = "不碰" | "只观察" | "等回调" | "低位分批" | "已具备较好安全边际";

type FoundationAsset = {
  id: string;
  asset_type: FoundationAssetType;
  name: string;
  code: string;
  market: string;
  enabled: number;
  sort_order: number;
  current_price: number | null;
  price_source: string | null;
  price_status: "pending" | "ok" | "failed" | "manual";
  price_error: string | null;
  price_updated_at: string | null;
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
  created_at: string;
  updated_at: string;
};

type FlowLabLiveQuote = {
  code: string;
  price: number | null;
  pre_close: number | null;
  pct_chg: number | null;
  quote_time: string | null;
  trade_date: string | null;
  source: "ths" | "tencent";
  status: "live" | "closed" | "stale" | "failed";
  error: string | null;
  updated_at: string;
};

type FormattedFoundationAsset = ReturnType<typeof formatFoundationAsset>;
type FoundationHitKey = "reasonable" | "safe" | "bargain" | "deep_value_review" | "stop_loss" | "reduce" | "sell" | "keep";
type FoundationPriceKey = FoundationHitKey | "no_chase" | "observe";
type CombinedActionName = "可建仓" | "小仓试" | "只观察" | "等价格" | "减仓" | "清仓";
type FoundationQuoteResult = { ok: true; price: number; source: string } | { ok: false; error: string };
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
  created_at: string;
  updated_at: string;
};
type JindanDailyBar = {
  asset_id: string;
  trade_date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  pre_close: number | null;
  pct_chg: number | null;
  volume: number | null;
  amount: number | null;
  source: string;
  raw_json: string;
};
type JindanSnapshot = {
  id: string;
  report_date: string;
  generated_at: string;
};
type JindanSnapshotRow = {
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
};
type FoundationIntegrationContext = {
  matched: boolean;
  id: string | null;
  code: string | null;
  name: string | null;
  current_price: number | null;
  conclusion: FoundationConclusion | null;
  primary_hit_key: FoundationPriceKey | "none" | null;
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
  trend_state: JindanSnapshotRow["trend_state"] | null;
  source_status: JindanSnapshotRow["source_status"] | null;
};
type CombinedAction = {
  action: CombinedActionName;
  suggested_position: number;
  reason: string;
};
type BtcSignalState = "empty" | "build_1" | "build_2" | "full" | "top_watch" | "clear";
type BtcRawMetric = {
  time: string;
  PriceUSD: string;
  CapMVRVCur: string;
  CapMrktCurUSD: string;
  IssTotUSD: string;
};
type BtcMetricRow = {
  date: string;
  price: number;
  mvrv: number;
  marketCap: number;
  issuedUsd: number;
  ath: number;
  drawdown: number;
  ma200d: number | null;
  ma200w: number | null;
  ma20w: number | null;
  ma111d: number | null;
  ma350dX2: number | null;
  ma2yX5: number | null;
  realizedCap: number | null;
  mvrvZ: number | null;
  nupl: number | null;
  puell: number | null;
  mayer: number | null;
  piCycleRecent: boolean;
  bottomScore: number;
  topScore: number;
  bottomGroups: number;
};
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
  state: BtcSignalState;
  state_label: string;
  suggested_action: string;
  recommended_position: number;
  current_position: number;
  price: number;
  bottom_score: number;
  top_score: number;
  bottom_groups: number;
  trigger_summary: string;
  metrics_json: string;
  state_json: string;
  source_status: "ok" | "failed";
  source_message: string | null;
  data_updated_at: string | null;
  updated_at: string;
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

const app = new Hono<{ Bindings: Env; Variables: { user: User | null } }>().basePath("/api");
type AppContext = Context<{ Bindings: Env; Variables: { user: User | null } }>;

const BTC_LIGHTHOUSE_ID = "btc-cycle-lighthouse";
const BTC_LIGHTHOUSE_VERSION = "btc_cycle_lighthouse_v2";
const BTC_LIGHTHOUSE_SOURCE = "Coin Metrics Community API";
const BTC_BUY_LEVELS: Array<[number, number]> = [[90, 0.30], [105, 0.35], [120, 0.35]];
const BTC_MATURE_MULTIPLES = [
  { multiple: 3, label: "3x 防守", role: "defensive" as const },
  { multiple: 4, label: "4x 默认", role: "default" as const },
  { multiple: 5, label: "5x 进攻", role: "aggressive" as const }
];

const foundationAssetSchema = z.object({
  asset_type: z.enum(["stock", "etf", "other"]),
  name: z.string().min(1),
  code: z.string().min(1),
  market: z.string().min(1).default("A股"),
  enabled: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  current_price: z.number().nullable().optional(),
  no_chase_min: z.number().nullable().optional(),
  observe_min: z.number().nullable().optional(),
  observe_max: z.number().nullable().optional(),
  reasonable_min: z.number().nullable().optional(),
  reasonable_max: z.number().nullable().optional(),
  safe_min: z.number().nullable().optional(),
  safe_max: z.number().nullable().optional(),
  bargain_min: z.number().nullable().optional(),
  bargain_max: z.number().nullable().optional(),
  stop_loss: z.number().nullable().optional(),
  reduce_min: z.number().nullable().optional(),
  reduce_max: z.number().nullable().optional(),
  sell_min: z.number().nullable().optional(),
  sell_max: z.number().nullable().optional(),
  keep_min: z.number().nullable().optional(),
  conclusion: z.string().min(1).default("只观察"),
  analysis_markdown: z.string().default(""),
  analysis_json: z.string().default("{}"),
  analysis_updated_at: z.string().nullable().optional()
});

const jindanAssetSchema = z.object({
  asset_type: z.enum(["stock", "index", "etf", "crypto", "commodity", "other"]),
  name: z.string().min(1),
  code: z.string().min(1),
  market: z.string().min(1).default("A股"),
  data_source: z.enum(["tushare_daily", "tushare_index_daily", "tushare_fund_daily", "ths_index_daily", "binance_daily", "yahoo_chart"]),
  enabled: z.boolean().default(true),
  highlighted: z.boolean().default(false),
  sort_order: z.number().int().default(0)
});

const jindanGenerateSchema = z.object({
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: "服务暂时不可用", detail: error instanceof Error ? error.message : String(error) }, 500);
});

const defaultIndicators = [
  ["jisilu-temp", "集思录 A 股温度计", "估值温度", "用集思录市场温度观察全市场估值所处位置。", 12, "pending", "集思录", "https://www.jisilu.cn/data/indicator/12", "接近/达标阈值建议以后用历史温度分位校准。", 80, 90, "gte", null, "待接入：公开页面可看，自动抓取稳定性待验证。", "pending", 0, 10],
  ["all-a-pe-pb", "全 A PE / PB 分位", "估值温度", "观察全市场估值是否处于历史高分位。", 8, "manual", "手动配置/后续接入可靠行情源", null, "建议以过去 5-10 年历史分位，80% 接近、90% 达标。", 80, 90, "gte", null, "待手动录入或接入可靠数据源。", "manual", 0, 20],
  ["erp", "股债风险溢价 / 股债收益差", "估值温度", "衡量股票相对债券的性价比，风险溢价过低代表股票吸引力下降。", 5, "manual", "手动配置/后续接入国债收益率与指数盈利收益率", null, "方向为越低越危险，阈值需按历史分位校准。", 20, 10, "lte", null, "待手动录入或接入可靠数据源。", "manual", 0, 30],
  ["turnover-amount", "全 A 成交额", "交易热度", "全市场成交额连续放大、天量滞涨是顶部常见信号。", 8, "manual", "手动配置/后续接入行情源", null, "建议用成交额/历史分位，不用绝对金额硬编码。", 80, 90, "gte", null, "待手动录入或接入可靠数据源。", "manual", 0, 40],
  ["amount-float-mcap", "成交额 / 流通市值", "交易热度", "相对成交热度，能过滤市场市值扩张带来的绝对成交额变化。", 6, "manual", "手动配置/后续接入行情源", null, "建议用历史分位，80% 接近、90% 达标。", 80, 90, "gte", null, "待手动录入或接入可靠数据源。", "manual", 0, 50],
  ["all-a-turnover", "全 A 换手率", "交易热度", "市场交易拥挤度指标，顶部附近常先于指数转弱。", 6, "manual", "手动配置/后续接入行情源", null, "建议用历史分位，80% 接近、90% 达标。", 80, 90, "gte", null, "待手动录入或接入可靠数据源。", "manual", 0, 60],
  ["margin-balance", "融资余额", "杠杆资金", "观察杠杆资金是否快速扩张。", 8, "manual", "手动配置/后续接入交易所公开数据", null, "建议看融资余额分位和 20 日增速。", 80, 90, "gte", null, "待手动录入或接入可靠数据源。", "manual", 0, 70],
  ["margin-buy-share", "融资买入额占成交额", "杠杆资金", "杠杆资金参与度越高，顶部脆弱性越强。", 7, "manual", "手动配置/后续接入交易所公开数据", null, "建议用历史分位，80% 接近、90% 达标。", 80, 90, "gte", null, "待手动录入或接入可靠数据源。", "manual", 0, 80],
  ["new-high-share", "创新高个股占比", "市场宽度", "指数上涨但创新高个股占比下降，可能出现宽度背离。", 8, "manual", "手动配置/后续接入行情源", null, "该指标需结合背离规则，第一版先手动配置。", null, null, "boolean_count", null, "待手动录入或接入可靠数据源。", "manual", 0, 90],
  ["advance-share", "上涨家数占比", "市场宽度", "判断行情是否由少数权重股支撑。", 7, "manual", "手动配置/后续接入行情源", null, "建议观察指数上涨日的上涨家数占比和趋势背离。", null, null, "boolean_count", null, "待手动录入或接入可靠数据源。", "manual", 0, 100],
  ["ma-breaks", "主要指数跌破 MA20 / MA60", "技术趋势", "上证、沪深300、中证500、创业板等主要指数共振跌破均线时给出右侧确认。", 10, "manual", "手动配置/后续接入行情源", null, "建议以跌破 MA20 的指数数量接近、跌破 MA60 或多指数共振为达标。", null, null, "boolean_count", null, "待手动录入或接入可靠数据源。", "manual", 0, 110],
  ["search-index", "百度 / 微信搜索指数", "搜索情绪", "跟踪“牛市、炒股、开户、券商”等关键词热度。", 5, "pending", "百度指数/微信指数", null, "能稳定抓到哪个平台就用哪个；抓不到则手动配置。", 80, 90, "gte", null, "待接入：关键词为牛市、炒股、开户、券商。", "pending", 0, 120],
  ["fund-issuance", "新发基金规模 / 爆款基金数量", "基金发行 / 散户入场", "爆款基金频出通常代表散户入场热度较高。", 5, "manual", "手动配置/后续接入公募发行数据", null, "建议用偏股基金发行规模历史分位。", 80, 90, "gte", null, "待手动录入或接入可靠数据源。", "manual", 0, 130],
  ["broker-index", "券商板块走势", "券商 / 短线情绪", "券商是 A 股牛市情绪代理，滞涨或破位常提示风险。", 2.5, "manual", "手动配置/后续接入行情源", null, "建议结合券商板块涨幅分位、是否破 MA20。", null, null, "boolean_count", null, "待手动录入或接入可靠数据源。", "manual", 0, 140],
  ["limit-up-sentiment", "涨停家数、炸板率、连板高度", "券商 / 短线情绪", "短线情绪极端过热后退潮，是市场风险升高的辅助信号。", 2.5, "manual", "手动配置/后续接入行情源", null, "建议综合涨停家数分位、炸板率上升和连板高度退潮。", null, null, "boolean_count", null, "待手动录入或接入可靠数据源。", "manual", 0, 150]
] as const;

const btcStrategyContent = {
  rules: [
    "触发：Binance BTCUSDT 日线收盘跌幅 <= -12%",
    "入场：次日开盘买入做多",
    "杠杆：首选 3x，激进最多 4x",
    "持有：2 天",
    "出场：第 2 天收盘出"
  ],
  conclusion: "BTC 日跌 12% 以上，次日开盘 3x 抄底，拿 2 天走人；别贪高杠杆。",
  backtest: [
    { drop: "-13%", hold: "2天", leverage: "4x", trades: 13, liquidations: 0, winRate: "92.31%", avgReturn: "20.71%", maxDrawdown: "-21.21%" },
    { drop: "-13%", hold: "2天", leverage: "3x", trades: 13, liquidations: 0, winRate: "92.31%", avgReturn: "15.53%", maxDrawdown: "-21.21%" },
    { drop: "-12%", hold: "2天", leverage: "4x", trades: 16, liquidations: 0, winRate: "87.50%", avgReturn: "18.88%", maxDrawdown: "-21.21%" },
    { drop: "-12%", hold: "2天", leverage: "3x", trades: 16, liquidations: 0, winRate: "87.50%", avgReturn: "14.16%", maxDrawdown: "-21.21%" },
    { drop: "-10%", hold: "1天", leverage: "3x", trades: 30, liquidations: 0, winRate: "70.00%", avgReturn: "9.60%", maxDrawdown: "-21.21%" },
    { drop: "-8%", hold: "1天", leverage: "3x", trades: 58, liquidations: 0, winRate: "62.07%", avgReturn: "4.14%", maxDrawdown: "-21.21%" }
  ],
  riskNotes: [
    "回测不代表未来收益。",
    "该策略是极端下跌后的低频策略，不是日常交易策略。",
    "3x 仍然有高风险；4x 回测未爆仓但安全垫较薄。",
    "不要碰 10x、20x 这种高杠杆抄底。",
    "爆仓线是简化保守估算，不等于交易所真实强平价。",
    "实盘会受到手续费、滑点、资金费率和盘口流动性影响。"
  ]
};

app.use("*", async (c, next) => {
  await ensureSeed(c.env.DB);
  c.set("user", await getCurrentUser(c.env.DB, c.req.header("Cookie") ?? ""));
  await next();
});

app.get("/health", (c) => c.json({ ok: true, app: c.env.APP_NAME ?? "慢富" }));

app.post(
  "/auth/login",
  zValidator("json", z.object({ email: z.string().email(), password: z.string().min(1) })),
  async (c) => {
    const { email, password } = c.req.valid("json");
    const userRow = await c.env.DB.prepare("SELECT * FROM users WHERE email = ? AND disabled = 0").bind(email).first<User & { password_hash: string }>();
    if (!userRow || !(await verifyPassword(password, userRow.password_hash))) {
      return c.json({ error: "邮箱或密码错误" }, 401);
    }
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
    await c.env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").bind(sessionId, userRow.id, expiresAt).run();
    setCookie(c, "mf_session", sessionId, expiresAt);
    return c.json({ user: publicUser(userRow) });
  }
);

app.post("/auth/logout", async (c) => {
  const sessionId = parseCookie(c.req.header("Cookie") ?? "").mf_session;
  if (sessionId) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
  }
  c.header("Set-Cookie", "mf_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  return c.json({ ok: true });
});

app.get("/auth/me", (c) => {
  const user = c.get("user");
  return c.json({ user: user ? publicUser(user) : null });
});

app.get("/dashboard", async (c) => {
  const user = requireUser(c);
  if (user instanceof Response) return user;
  await refreshAutoIndicators(c.env.DB);
  const indicators = await listIndicators(c.env.DB);
  return c.json(buildDashboard(indicators));
});

app.get("/strategy/btc", async (c) => {
  const user = requireUser(c);
  if (user instanceof Response) return user;
  const strategy = await c.env.DB.prepare("SELECT * FROM strategies WHERE id = ?").bind("btc-dip").first<{ title: string; summary: string; source_note: string; content_json: string; realtime_enabled: number; updated_at: string }>();
  if (!strategy) return c.json({ error: "策略不存在" }, 404);
  const realtime = strategy?.realtime_enabled ? await getBtcRealtime(c.env.DB) : null;
  return c.json({ ...strategy, content: JSON.parse(strategy.content_json), realtime });
});

app.get("/btc-lighthouse", async (c) => {
  const user = requireUser(c);
  if (user instanceof Response) return user;
  let latest = await getBtcLighthouseLatest(c.env.DB);
  if (!latest || shouldRefreshBtcLighthouse(latest)) {
    latest = await refreshBtcLighthouse(c.env.DB);
  }
  const [history, realtime] = await Promise.all([listBtcLighthouseHistory(c.env.DB), fetchBtcSpotTicker()]);
  return c.json({ latest: formatBtcLighthouse(latest), realtime, history: history.map(formatBtcHistoryRow) });
});

app.get("/btc-lighthouse/realtime", async (c) => {
  const user = requireUser(c);
  if (user instanceof Response) return user;
  return c.json({ realtime: await fetchBtcSpotTicker() });
});

app.post("/btc-lighthouse/refresh", async (c) => {
  const allowed = await canRefreshBtcLighthouse(c);
  if (allowed instanceof Response) return allowed;
  const latest = await refreshBtcLighthouse(c.env.DB);
  const [history, realtime] = await Promise.all([listBtcLighthouseHistory(c.env.DB), fetchBtcSpotTicker()]);
  return c.json({ ok: true, latest: formatBtcLighthouse(latest), realtime, history: history.map(formatBtcHistoryRow) });
});

app.get("/foundation", async (c) => {
  const user = requireUser(c);
  if (user instanceof Response) return user;
  const settings = await getFoundationSettings(c.env.DB);
  const assets = await listFoundationAssets(c.env.DB, true);
  const formatted = assets.map((asset) => formatFoundationAsset(asset));
  const enriched = await enrichFoundationAssetsWithJindan(c.env.DB, formatted);
  return c.json({ settings, assets: enriched, hit_summary: buildFoundationHitSummary(formatted) });
});

const flowLabCandidateSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  name: z.string().min(1),
  board: z.string().min(1).default("主板"),
  rank: z.number().int().positive().max(50).optional(),
  score: z.number().min(0).max(100).default(0),
  status: z.enum(["watch", "paper_entry", "blocked", "closed"]).default("watch"),
  source_agreement: z.boolean().default(false),
  price: z.number().positive().nullable().optional(),
  pct_chg: z.number().finite().nullable().optional(),
  vwap: z.number().positive().nullable().optional(),
  industry: z.string().nullable().optional(),
  concept_cluster: z.string().nullable().optional(),
  score_breakdown: z.record(z.string(), z.number()).default({}),
  reason: z.string().default(""),
  paper_entry: z.object({
    at: z.string().datetime(),
    price: z.number().positive(),
    position_weight: z.number().positive().max(0.08),
    exit_slots: z.array(z.enum(["09:30", "09:35", "09:45", "10:00"])).min(1).max(4).default(["09:30", "09:35", "09:45", "10:00"])
  }).optional()
});

const flowLabSnapshotSchema = z.object({
  id: z.string().min(8).max(160),
  source: z.literal("ths"),
  dataset: z.literal("individual"),
  captured_at: z.string().datetime(),
  status: z.enum(["ok", "failed"]),
  rows: z.array(z.object({ rank: z.number().int().positive(), code: z.string().nullable(), cells: z.array(z.string()) })).max(50),
  error: z.string().nullable().optional()
});

const flowLabRunSchema = z.object({
  id: z.string().min(8).max(120),
  captured_at: z.string().datetime(),
  trade_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  strategy_version: z.string().min(1).max(40).default("v1-paper"),
  market_state: z.enum(["green", "amber", "red", "unknown"]).default("unknown"),
  data_status: z.enum(["ok", "partial", "failed", "pending"]).default("pending"),
  snapshot_count: z.number().int().min(0).max(10000).default(0),
  summary: z.record(z.string(), z.unknown()).default({}),
  candidates: z.array(flowLabCandidateSchema).max(50).default([]),
  snapshots: z.array(flowLabSnapshotSchema).max(12).default([])
});

app.get("/flow-lab/overview", async (c) => {
  const user = requireUser(c);
  if (user instanceof Response) return user;
  const forceQuoteRefresh = c.req.query("refresh_quotes") === "force";
  const latest = await c.env.DB.prepare("SELECT * FROM flow_lab_runs ORDER BY captured_at DESC LIMIT 1").first<{
    id: string; strategy_version: string; captured_at: string; trade_date: string | null; market_state: string; data_status: string; snapshot_count: number; summary_json: string;
  }>();
  const tradeDate = latest?.trade_date ?? (latest ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date(latest.captured_at)) : null);
  const candidates = latest && tradeDate
    ? await c.env.DB.prepare(`
      WITH daily AS (
        SELECT c.*, r.captured_at AS candidate_captured_at,
          COUNT(*) OVER (PARTITION BY c.code) AS appearances,
          ROW_NUMBER() OVER (PARTITION BY c.code ORDER BY r.captured_at DESC) AS recency
        FROM flow_lab_candidates c
        JOIN flow_lab_runs r ON r.id = c.run_id
        WHERE COALESCE(r.trade_date, date(r.captured_at, '+8 hours')) = ?
          AND r.data_status = 'ok'
      )
      SELECT * FROM daily WHERE recency = 1
      ORDER BY appearances DESC, rank ASC, code ASC
      LIMIT 50
    `).bind(tradeDate).all()
    : { results: [] };
  const previousTradeDates = latest && tradeDate
    ? (await c.env.DB.prepare(`
      SELECT DISTINCT COALESCE(trade_date, date(captured_at, '+8 hours')) AS trade_date
      FROM flow_lab_runs
      WHERE strategy_version = ?
        AND COALESCE(trade_date, date(captured_at, '+8 hours')) < ?
        AND data_status = 'ok'
      ORDER BY trade_date DESC LIMIT 3
    `).bind(latest.strategy_version, tradeDate).all<{ trade_date: string }>()).results.map((item) => item.trade_date)
    : [];
  const candidateCodes = candidates.results.map((item) => String(item.code)).filter((code) => /^\d{6}$/.test(code));
  const historicalRows = candidateCodes.length && previousTradeDates.length && latest
    ? (await c.env.DB.prepare(`
      SELECT c.code, COALESCE(r.trade_date, date(r.captured_at, '+8 hours')) AS trade_date, COUNT(*) AS appearances
      FROM flow_lab_candidates c
      JOIN flow_lab_runs r ON r.id = c.run_id
      WHERE r.strategy_version = ?
        AND r.data_status = 'ok'
        AND c.code IN (${candidateCodes.map(() => "?").join(",")})
        AND COALESCE(r.trade_date, date(r.captured_at, '+8 hours')) IN (${previousTradeDates.map(() => "?").join(",")})
      GROUP BY c.code, trade_date
    `).bind(latest.strategy_version, ...candidateCodes, ...previousTradeDates).all<{ code: string; trade_date: string; appearances: number }>()).results
    : [];
  const historicalByKey = new Map(historicalRows.map((item) => [`${item.code}:${item.trade_date}`, Number(item.appearances)]));
  const snapshots = latest
    ? await c.env.DB.prepare("SELECT id, source, dataset, captured_at, row_count, status, payload_json, error FROM flow_lab_snapshots WHERE run_id = ? AND dataset = 'individual'").bind(latest.id).all()
    : { results: [] };
  const successfulSnapshots = latest && tradeDate
    ? await c.env.DB.prepare(`
      SELECT COUNT(*) AS count FROM flow_lab_runs
      WHERE strategy_version = ?
        AND COALESCE(trade_date, date(captured_at, '+8 hours')) = ?
        AND data_status = 'ok'
    `).bind(latest.strategy_version, tradeDate).first<{ count: number }>()
    : null;
  const formattedCandidates = candidates.results.map((item) => ({
    ...formatFlowLabCandidate(item),
    previous_days: previousTradeDates.map((date, index) => ({
      label: `前${index + 1}个采集交易日`,
      trade_date: date,
      appearances: historicalByKey.get(`${item.code}:${date}`) ?? 0
    }))
  }));
  const quotes = latest ? await refreshFlowLabQuotes(c.env.DB, formattedCandidates, forceQuoteRefresh).catch(() => []) : [];
  c.header("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
  c.header("Pragma", "no-cache");
  c.header("Expires", "0");
  return c.json({
    latest: latest ? { ...latest, summary: safeJson(latest.summary_json, {}) } : null,
    candidates: formattedCandidates,
    quotes,
    snapshots: snapshots.results.map(formatFlowLabSnapshot),
    radar: { successful_snapshots: Number(successfulSnapshots?.count ?? 0), previous_trade_dates: previousTradeDates }
  });
});

app.post("/flow-lab/runs", zValidator("json", flowLabRunSchema), async (c) => {
  if (!canIngestFlowLab(c)) return c.json({ error: "需要实验室采集密钥或管理员身份" }, 401);
  const data = c.req.valid("json");
  await c.env.DB.prepare(`
    INSERT INTO flow_lab_runs (id, strategy_version, captured_at, trade_date, market_state, data_status, snapshot_count, summary_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET strategy_version = excluded.strategy_version, captured_at = excluded.captured_at,
      trade_date = excluded.trade_date, market_state = excluded.market_state, data_status = excluded.data_status, snapshot_count = excluded.snapshot_count,
      summary_json = excluded.summary_json, updated_at = CURRENT_TIMESTAMP
  `).bind(data.id, data.strategy_version, data.captured_at, data.trade_date ?? null, data.market_state, data.data_status, data.snapshot_count, JSON.stringify(data.summary)).run();
  await c.env.DB.prepare("DELETE FROM flow_lab_candidates WHERE run_id = ?").bind(data.id).run();
  await c.env.DB.prepare("DELETE FROM flow_lab_snapshots WHERE run_id = ?").bind(data.id).run();
  if (data.candidates.length) {
    await c.env.DB.batch(data.candidates.map((item) => c.env.DB.prepare(`
      INSERT INTO flow_lab_candidates (id, run_id, code, name, board, rank, score, status, source_agreement, price, pct_chg, vwap, industry, concept_cluster, score_breakdown_json, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `${data.id}:${item.code}`, data.id, item.code, item.name, item.board, item.rank ?? null, item.score, item.status,
      item.source_agreement ? 1 : 0, item.price ?? null, item.pct_chg ?? null, item.vwap ?? null, item.industry ?? null,
      item.concept_cluster ?? null, JSON.stringify(item.score_breakdown), item.reason
    )));
  }
  if (data.snapshots.length) {
    await c.env.DB.batch(data.snapshots.map((item) => c.env.DB.prepare(`
      INSERT INTO flow_lab_snapshots (id, run_id, source, dataset, captured_at, row_count, status, payload_json, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(item.id, data.id, item.source, item.dataset, item.captured_at, item.rows.length, item.status, JSON.stringify(item.rows), item.error ?? null)));
  }
  return c.json({ ok: true, run_id: data.id, candidate_count: data.candidates.length }, 201);
});

const flowLabCleanupSchema = z.object({
  keep_trade_days: z.number().int().min(3).max(60).default(10)
});

app.post("/flow-lab/cleanup", zValidator("json", flowLabCleanupSchema), async (c) => {
  if (!canIngestFlowLab(c)) return c.json({ error: "需要实验室采集密钥或管理员身份" }, 401);
  const { keep_trade_days: keepTradeDays } = c.req.valid("json");
  const { results: dates } = await c.env.DB.prepare(`
    SELECT DISTINCT COALESCE(trade_date, date(captured_at, '+8 hours')) AS trade_date
    FROM flow_lab_runs
    WHERE data_status IN ('ok', 'partial', 'failed')
    ORDER BY trade_date DESC
    LIMIT ?
  `).bind(keepTradeDays).all<{ trade_date: string }>();
  if (dates.length < keepTradeDays) {
    return c.json({ ok: true, skipped: true, keep_trade_days: keepTradeDays, available_trade_days: dates.length, deleted: { candidates: 0, snapshots: 0, runs: 0, paper_positions: 0 } });
  }
  const cutoff = dates.at(-1)?.trade_date;
  if (!cutoff) return c.json({ ok: true, skipped: true, keep_trade_days: keepTradeDays, available_trade_days: dates.length, deleted: { candidates: 0, snapshots: 0, runs: 0, paper_positions: 0 } });
  const olderThan = "COALESCE(trade_date, date(captured_at, '+8 hours')) < ?";
  const candidates = await c.env.DB.prepare(`DELETE FROM flow_lab_candidates WHERE run_id IN (SELECT id FROM flow_lab_runs WHERE ${olderThan})`).bind(cutoff).run();
  const snapshots = await c.env.DB.prepare(`DELETE FROM flow_lab_snapshots WHERE run_id IN (SELECT id FROM flow_lab_runs WHERE ${olderThan})`).bind(cutoff).run();
  const paperPositions = await c.env.DB.prepare("DELETE FROM flow_lab_paper_positions WHERE COALESCE(entry_trade_date, date(entry_at, '+8 hours')) < ?").bind(cutoff).run();
  const runs = await c.env.DB.prepare(`DELETE FROM flow_lab_runs WHERE ${olderThan}`).bind(cutoff).run();
  return c.json({
    ok: true,
    skipped: false,
    keep_trade_days: keepTradeDays,
    cutoff_trade_date: cutoff,
    deleted: {
      candidates: candidates.meta.changes,
      snapshots: snapshots.meta.changes,
      runs: runs.meta.changes,
      paper_positions: paperPositions.meta.changes
    }
  });
});

app.get("/flow-lab/paper-positions/open", async (c) => {
  if (!canIngestFlowLab(c)) return c.json({ error: "需要实验室采集密钥或管理员身份" }, 401);
  const { results } = await c.env.DB.prepare(`
    SELECT id, code, entry_trade_date, exit_slot, entry_at, entry_price, board, data_mode
    FROM flow_lab_paper_positions WHERE status = 'open' ORDER BY entry_at ASC
  `).all();
  return c.json({ positions: results });
});

app.post("/flow-lab/paper-positions/:id/close", zValidator("json", z.object({
  exit_at: z.string().datetime(), exit_price: z.number().positive(), notes: z.string().max(500).default("")
})), async (c) => {
  if (!canIngestFlowLab(c)) return c.json({ error: "需要实验室采集密钥或管理员身份" }, 401);
  const position = await c.env.DB.prepare("SELECT entry_price, entry_at FROM flow_lab_paper_positions WHERE id = ? AND status = 'open'").bind(c.req.param("id")).first<{ entry_price: number; entry_at: string }>();
  if (!position) return c.json({ error: "未找到开放中的模拟仓位" }, 404);
  const data = c.req.valid("json");
  if (Date.parse(data.exit_at) <= Date.parse(position.entry_at)) return c.json({ error: "纸面结算时间必须晚于入场时间" }, 400);
  const returnPct = ((data.exit_price - position.entry_price) / position.entry_price) * 100;
  await c.env.DB.prepare("UPDATE flow_lab_paper_positions SET exit_at = ?, exit_price = ?, return_pct = ?, status = 'closed', notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(data.exit_at, data.exit_price, returnPct, data.notes, c.req.param("id")).run();
  return c.json({ ok: true, return_pct: returnPct });
});

app.post("/foundation/prices", async (c) => {
  const user = requireUser(c);
  if (user instanceof Response) return user;
  await refreshFoundationPrices(c.env.DB);
  const settings = await getFoundationSettings(c.env.DB);
  const assets = await listFoundationAssets(c.env.DB, true);
  const formatted = assets.map((asset) => formatFoundationAsset(asset));
  const enriched = await enrichFoundationAssetsWithJindan(c.env.DB, formatted);
  return c.json({ settings, assets: enriched, hit_summary: buildFoundationHitSummary(formatted) });
});

app.get("/foundation/assets/:id", async (c) => {
  const user = requireUser(c);
  if (user instanceof Response) return user;
  const asset = await getFoundationAsset(c.env.DB, c.req.param("id"));
  if (!asset || !asset.enabled) return c.json({ error: "标的不存在" }, 404);
  return c.json({ asset: formatFoundationAsset(asset, true) });
});

app.get("/admin/indicators", async (c) => {
  const admin = requireAdmin(c);
  if (admin instanceof Response) return admin;
  await refreshAutoIndicators(c.env.DB);
  return c.json({ indicators: await listIndicators(c.env.DB, false) });
});

app.put(
  "/admin/indicators/:id",
  zValidator("json", z.object({
    weight: z.number().min(0).max(100),
    enabled: z.boolean(),
    source_type: z.enum(["auto", "manual", "pending"]),
    source_name: z.string().min(1),
    source_url: z.string().url().nullable().or(z.literal("")),
    threshold_note: z.string().min(1),
    near_threshold: z.number().nullable(),
    hit_threshold: z.number().nullable(),
    current_value: z.number().nullable(),
    current_text: z.string().nullable(),
    status: z.enum(["not_hit", "near", "hit", "pending", "manual", "failed"])
  })),
  async (c) => {
    const admin = requireAdmin(c);
    if (admin instanceof Response) return admin;
    const data = c.req.valid("json");
    const contribution = data.enabled ? statusScore(data.status, data.weight) : 0;
    await c.env.DB.prepare(`
      UPDATE indicators SET weight = ?, enabled = ?, source_type = ?, source_name = ?, source_url = ?,
      threshold_note = ?, near_threshold = ?, hit_threshold = ?, current_value = ?, current_text = ?,
      status = ?, contribution = ?, last_updated = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      data.weight,
      data.enabled ? 1 : 0,
      data.source_type,
      data.source_name,
      data.source_url || null,
      data.threshold_note,
      data.near_threshold,
      data.hit_threshold,
      data.current_value,
      data.current_text,
      data.status,
      contribution,
      c.req.param("id")
    ).run();
    return c.json({ ok: true, dashboard: buildDashboard(await listIndicators(c.env.DB)) });
  }
);

app.get("/admin/foundation", async (c) => {
  const admin = requireAdmin(c);
  if (admin instanceof Response) return admin;
  const settings = await getFoundationSettings(c.env.DB);
  const assets = await listFoundationAssets(c.env.DB, false);
  return c.json({ settings, assets: assets.map((item) => formatFoundationAsset(item, true)) });
});

app.put(
  "/admin/foundation/settings",
  zValidator("json", z.object({
    refresh_seconds: z.number().int().min(5).max(86400).optional(),
    trading_refresh_seconds: z.number().int().min(5).max(3600).optional(),
    offhours_refresh_seconds: z.number().int().min(30).max(86400).optional()
  })),
  async (c) => {
    const admin = requireAdmin(c);
    if (admin instanceof Response) return admin;
    const data = c.req.valid("json");
    const tradingRefresh = data.trading_refresh_seconds ?? data.refresh_seconds;
    const updates: Array<[string, number]> = [];
    if (tradingRefresh !== undefined) updates.push(["trading_refresh_seconds", tradingRefresh]);
    if (data.offhours_refresh_seconds !== undefined) updates.push(["offhours_refresh_seconds", data.offhours_refresh_seconds]);
    if (data.refresh_seconds !== undefined) updates.push(["refresh_seconds", data.refresh_seconds]);
    await Promise.all(updates.map(([key, value]) => c.env.DB.prepare("INSERT INTO foundation_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP")
      .bind(key, String(value))
      .run()));
    return c.json({ ok: true, settings: await getFoundationSettings(c.env.DB) });
  }
);

app.post(
  "/admin/foundation/assets",
  zValidator("json", foundationAssetSchema),
  async (c) => {
    const admin = requireAdmin(c);
    if (admin instanceof Response) return admin;
    const data = c.req.valid("json");
    const id = slugifyAsset(data.code, data.market);
    await upsertFoundationAsset(c.env.DB, id, data);
    return c.json({ ok: true, asset: formatFoundationAsset((await getFoundationAsset(c.env.DB, id))!, true) }, 201);
  }
);

app.put(
  "/admin/foundation/assets/:id",
  zValidator("json", foundationAssetSchema),
  async (c) => {
    const admin = requireAdmin(c);
    if (admin instanceof Response) return admin;
    const id = c.req.param("id");
    await upsertFoundationAsset(c.env.DB, id, c.req.valid("json"));
    return c.json({ ok: true, asset: formatFoundationAsset((await getFoundationAsset(c.env.DB, id))!, true) });
  }
);

app.delete("/admin/foundation/assets/:id", async (c) => {
  const admin = requireAdmin(c);
  if (admin instanceof Response) return admin;
  await c.env.DB.prepare("DELETE FROM foundation_assets WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

app.get("/jindan", async (c) => {
  const user = requireUser(c);
  if (user instanceof Response) return user;
  const latest = await getLatestJindanSnapshot(c.env.DB);
  const assets = await listJindanAssets(c.env.DB, true);
  if (!latest) return c.json({ snapshot: null, rows: [], assets_count: assets.length });
  const rows = await listJindanSnapshotRows(c.env.DB, latest.id);
  return c.json({ snapshot: latest, rows: await enrichJindanRowsWithFoundation(c.env.DB, rows), assets_count: assets.length });
});

app.post(
  "/jindan/generate",
  zValidator("json", jindanGenerateSchema),
  async (c) => {
    const admin = requireAdmin(c);
    if (admin instanceof Response) return admin;
    const reportDate = c.req.valid("json").report_date ?? todayInShanghai();
    const result = await generateJindanSnapshot(c.env.DB, c.env.TUSHARE_TOKEN, reportDate);
    return c.json({ ...result, rows: await enrichJindanRowsWithFoundation(c.env.DB, result.rows) });
  }
);

app.get("/admin/jindan", async (c) => {
  const admin = requireAdmin(c);
  if (admin instanceof Response) return admin;
  const assets = await listJindanAssets(c.env.DB, false);
  const latest = await getLatestJindanSnapshot(c.env.DB);
  return c.json({ assets, latest });
});

app.post(
  "/admin/jindan/assets",
  zValidator("json", jindanAssetSchema),
  async (c) => {
    const admin = requireAdmin(c);
    if (admin instanceof Response) return admin;
    const data = c.req.valid("json");
    const id = slugifyAsset(data.code, data.market);
    await upsertJindanAsset(c.env.DB, id, data);
    return c.json({ ok: true, asset: await getJindanAsset(c.env.DB, id) }, 201);
  }
);

app.put(
  "/admin/jindan/assets/:id",
  zValidator("json", jindanAssetSchema),
  async (c) => {
    const admin = requireAdmin(c);
    if (admin instanceof Response) return admin;
    const id = c.req.param("id");
    await upsertJindanAsset(c.env.DB, id, c.req.valid("json"));
    return c.json({ ok: true, asset: await getJindanAsset(c.env.DB, id) });
  }
);

app.delete("/admin/jindan/assets/:id", async (c) => {
  const admin = requireAdmin(c);
  if (admin instanceof Response) return admin;
  await c.env.DB.prepare("DELETE FROM jindan_assets WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

app.get("/admin/users", async (c) => {
  const admin = requireAdmin(c);
  if (admin instanceof Response) return admin;
  const { results } = await c.env.DB.prepare("SELECT id, email, name, role, disabled, created_at FROM users ORDER BY id").all();
  return c.json({ users: results });
});

app.post(
  "/admin/users",
  zValidator("json", z.object({ email: z.string().email(), name: z.string().min(1), password: z.string().min(6), role: z.enum(["admin", "user"]).default("user") })),
  async (c) => {
    const admin = requireAdmin(c);
    if (admin instanceof Response) return admin;
    const data = c.req.valid("json");
    await c.env.DB.prepare("INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)")
      .bind(data.email, data.name, await hashPassword(data.password), data.role)
      .run();
    return c.json({ ok: true }, 201);
  }
);

app.patch(
  "/admin/users/:id",
  zValidator("json", z.object({ disabled: z.boolean() })),
  async (c) => {
    const admin = requireAdmin(c);
    if (admin instanceof Response) return admin;
    await c.env.DB.prepare("UPDATE users SET disabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(c.req.valid("json").disabled ? 1 : 0, c.req.param("id")).run();
    return c.json({ ok: true });
  }
);

app.get("/admin/logs", async (c) => {
  const admin = requireAdmin(c);
  if (admin instanceof Response) return admin;
  const { results } = await c.env.DB.prepare("SELECT * FROM data_fetch_logs ORDER BY id DESC LIMIT 50").all();
  return c.json({ logs: results });
});

export const onRequest: PagesFunction<Env> = (context) => app.fetch(context.request, context.env, context as unknown as ExecutionContext);

async function ensureSeed(db: D1Database) {
  await ensureCoreSchema(db);
  await ensureFoundationSchema(db);
  await ensureJindanSchema(db);
  await ensureBtcLighthouseSchema(db);
  await ensureFlowLabSchema(db);
  const admin = await db.prepare("SELECT id FROM users WHERE email = ?").bind("admin@666.com").first();
  if (!admin) {
    await db.prepare("INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)")
      .bind("admin@666.com", "默认管理员", await hashPassword("666666"), "admin")
      .run();
  }
  const indicatorCount = await db.prepare("SELECT COUNT(*) AS count FROM indicators").first<{ count: number }>();
  if (!indicatorCount?.count) {
    const stmt = db.prepare(`
      INSERT INTO indicators (id, name, category, description, weight, source_type, source_name, source_url, threshold_note,
      near_threshold, hit_threshold, direction, current_value, current_text, status, contribution, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await db.batch(defaultIndicators.map((item) => stmt.bind(...item)));
  }
  const strategy = await db.prepare("SELECT id FROM strategies WHERE id = ?").bind("btc-dip").first();
  if (!strategy) {
    await db.prepare("INSERT INTO strategies (id, title, summary, source_note, content_json, realtime_enabled) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(
        "btc-dip",
        "BTC 日跌 12% 后 3x 低频捡漏策略",
        "BTC 日线收盘跌幅 <= -12%，次日开盘 3x 做多，持有 2 天，第 2 天收盘出。",
        "回测数据由用户提供：Binance BTCUSDT 日线，2017-08-17 至 2026-04-30，共 3179 根日 K。实时行情尝试使用 Binance 公共 K 线接口。",
        JSON.stringify(btcStrategyContent),
        1
      )
      .run();
  }
}

async function listIndicators(db: D1Database, enabledOnly = true) {
  const { results } = await db.prepare(`SELECT * FROM indicators ${enabledOnly ? "WHERE enabled = 1" : ""} ORDER BY sort_order`).all<Indicator>();
  return results.map((item) => ({
    ...item,
    enabled: Boolean(item.enabled),
    history: safeJson(item.history_json, [])
  }));
}

function buildDashboard(indicators: Awaited<ReturnType<typeof listIndicators>>) {
  const active = indicators.filter((item) => item.enabled);
  const scored = active.filter((item) => !["pending", "failed"].includes(item.status));
  const totalWeight = scored.reduce((sum, item) => sum + Number(item.weight), 0);
  const rawScore = scored.reduce((sum, item) => sum + Number(item.contribution), 0);
  const normalizedScore = totalWeight > 0 ? Math.round((rawScore / totalWeight) * 100) : 0;
  const hitCount = active.filter((item) => item.status === "hit").length;
  return {
    score: normalizedScore,
    rawScore,
    totalWeight,
    riskLevel: riskLevel(normalizedScore),
    hitCount,
    totalCount: active.length,
    connectedCount: scored.length,
    pendingCount: active.filter((item) => item.status === "pending").length,
    failedCount: active.filter((item) => item.status === "failed").length,
    indicators: active
  };
}

async function ensureCoreSchema(db: D1Database) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
        disabled INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS indicators (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        weight REAL NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        source_type TEXT NOT NULL CHECK (source_type IN ('auto', 'manual', 'pending')),
        source_name TEXT NOT NULL,
        source_url TEXT,
        threshold_note TEXT NOT NULL,
        near_threshold REAL,
        hit_threshold REAL,
        direction TEXT NOT NULL CHECK (direction IN ('gte', 'lte', 'boolean_count')),
        current_value REAL,
        current_text TEXT,
        status TEXT NOT NULL CHECK (status IN ('not_hit', 'near', 'hit', 'pending', 'manual', 'failed')),
        contribution REAL NOT NULL DEFAULT 0,
        last_updated TEXT,
        history_json TEXT NOT NULL DEFAULT '[]',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS strategies (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        source_note TEXT NOT NULL,
        content_json TEXT NOT NULL,
        realtime_enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS data_fetch_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
  ]);
}

async function ensureFoundationSchema(db: D1Database) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS foundation_assets (
        id TEXT PRIMARY KEY,
        asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'etf', 'other')),
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        market TEXT NOT NULL DEFAULT 'A股',
        enabled INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        current_price REAL,
        price_source TEXT,
        price_status TEXT NOT NULL DEFAULT 'pending' CHECK (price_status IN ('pending', 'ok', 'failed', 'manual')),
        price_error TEXT,
        price_updated_at TEXT,
        no_chase_min REAL,
        observe_min REAL,
        observe_max REAL,
        reasonable_min REAL,
        reasonable_max REAL,
        safe_min REAL,
        safe_max REAL,
        bargain_min REAL,
        bargain_max REAL,
        stop_loss REAL,
        reduce_min REAL,
        reduce_max REAL,
        sell_min REAL,
        sell_max REAL,
        keep_min REAL,
        conclusion TEXT NOT NULL DEFAULT '只观察',
        analysis_markdown TEXT NOT NULL DEFAULT '',
        analysis_json TEXT NOT NULL DEFAULT '{}',
        analysis_updated_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(code, market)
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS foundation_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare("INSERT OR IGNORE INTO foundation_settings (key, value) VALUES ('refresh_seconds', '15')"),
    db.prepare("INSERT OR IGNORE INTO foundation_settings (key, value) VALUES ('trading_refresh_seconds', '30')"),
    db.prepare("INSERT OR IGNORE INTO foundation_settings (key, value) VALUES ('offhours_refresh_seconds', '300')")
  ]);
}

async function ensureJindanSchema(db: D1Database) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS jindan_assets (
        id TEXT PRIMARY KEY,
        asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'index', 'etf', 'crypto', 'commodity', 'other')),
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        market TEXT NOT NULL DEFAULT 'A股',
        data_source TEXT NOT NULL CHECK (data_source IN ('tushare_daily', 'tushare_index_daily', 'tushare_fund_daily', 'ths_index_daily', 'binance_daily', 'yahoo_chart')),
        enabled INTEGER NOT NULL DEFAULT 1,
        highlighted INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(code, market)
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS jindan_daily_bars (
        asset_id TEXT NOT NULL,
        trade_date TEXT NOT NULL,
        open REAL,
        high REAL,
        low REAL,
        close REAL NOT NULL,
        pre_close REAL,
        pct_chg REAL,
        volume REAL,
        amount REAL,
        source TEXT NOT NULL,
        raw_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(asset_id, trade_date)
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS jindan_snapshots (
        id TEXT PRIMARY KEY,
        report_date TEXT NOT NULL,
        generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(report_date)
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS jindan_snapshot_rows (
        id TEXT PRIMARY KEY,
        snapshot_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        rank INTEGER,
        previous_rank INTEGER,
        rank_change INTEGER,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        market TEXT NOT NULL,
        asset_type TEXT NOT NULL,
        data_source TEXT NOT NULL,
        highlighted INTEGER NOT NULL DEFAULT 0,
        pct_chg REAL,
        close REAL,
        ma20 REAL,
        ma60 REAL,
        ma20_slope_pct REAL,
        atr20 REAL,
        deviation_pct REAL,
        volume_ratio REAL,
        trend_state TEXT NOT NULL CHECK (trend_state IN ('strong', 'weak', 'unknown')),
        enhanced_signal TEXT,
        enhanced_label TEXT,
        suggested_position REAL,
        suggested_action TEXT,
        filter_flags_json TEXT,
        filter_summary TEXT,
        state_changed_at TEXT,
        interval_pct REAL,
        actual_trade_date TEXT,
        source_status TEXT NOT NULL CHECK (source_status IN ('ok', 'failed', 'insufficient')),
        source_error TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(snapshot_id, asset_id)
      )
    `),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_jindan_assets_enabled ON jindan_assets(enabled, sort_order, id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_jindan_bars_asset_date ON jindan_daily_bars(asset_id, trade_date DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_jindan_snapshots_report_date ON jindan_snapshots(report_date DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_jindan_rows_snapshot_rank ON jindan_snapshot_rows(snapshot_id, rank)")
  ]);
  await ensureColumns(db, "jindan_daily_bars", {
    open: "REAL",
    high: "REAL",
    low: "REAL"
  });
  await ensureColumns(db, "jindan_snapshot_rows", {
    ma60: "REAL",
    ma20_slope_pct: "REAL",
    atr20: "REAL",
    enhanced_signal: "TEXT",
    enhanced_label: "TEXT",
    suggested_position: "REAL",
    suggested_action: "TEXT",
    filter_flags_json: "TEXT",
    filter_summary: "TEXT"
  });
}

async function ensureColumns(db: D1Database, table: string, columns: Record<string, string>) {
  const { results } = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  const existing = new Set(results.map((column) => column.name));
  for (const [name, definition] of Object.entries(columns)) {
    if (!existing.has(name)) {
      await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).run();
    }
  }
}

async function ensureBtcLighthouseSchema(db: D1Database) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS btc_lighthouse_latest (
        id TEXT PRIMARY KEY,
        strategy_version TEXT NOT NULL,
        signal_date TEXT NOT NULL,
        state TEXT NOT NULL,
        state_label TEXT NOT NULL,
        suggested_action TEXT NOT NULL,
        recommended_position REAL NOT NULL,
        current_position REAL NOT NULL,
        price REAL NOT NULL,
        bottom_score REAL NOT NULL,
        top_score REAL NOT NULL,
        bottom_groups INTEGER NOT NULL,
        trigger_summary TEXT NOT NULL,
        metrics_json TEXT NOT NULL DEFAULT '{}',
        state_json TEXT NOT NULL DEFAULT '{}',
        source_status TEXT NOT NULL CHECK (source_status IN ('ok', 'failed')),
        source_message TEXT,
        data_updated_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS btc_lighthouse_history (
        id TEXT PRIMARY KEY,
        strategy_version TEXT NOT NULL,
        signal_date TEXT NOT NULL,
        state TEXT NOT NULL,
        state_label TEXT NOT NULL,
        suggested_action TEXT NOT NULL,
        recommended_position REAL NOT NULL,
        current_position REAL NOT NULL,
        price REAL NOT NULL,
        bottom_score REAL NOT NULL,
        top_score REAL NOT NULL,
        bottom_groups INTEGER NOT NULL,
        trigger_summary TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(strategy_version, signal_date)
      )
    `)
  ]);
}

async function ensureFlowLabSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS flow_lab_runs (
      id TEXT PRIMARY KEY, strategy_version TEXT NOT NULL DEFAULT 'v1-paper', captured_at TEXT NOT NULL,
      market_state TEXT NOT NULL DEFAULT 'unknown', data_status TEXT NOT NULL DEFAULT 'pending',
      snapshot_count INTEGER NOT NULL DEFAULT 0, summary_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(captured_at)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS flow_lab_candidates (
      id TEXT PRIMARY KEY, run_id TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, board TEXT NOT NULL DEFAULT '主板',
      score REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'watch', source_agreement INTEGER NOT NULL DEFAULT 0,
      price REAL, vwap REAL, industry TEXT, concept_cluster TEXT, score_breakdown_json TEXT NOT NULL DEFAULT '{}',
      reason TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(run_id, code)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS flow_lab_snapshots (
      id TEXT PRIMARY KEY, run_id TEXT NOT NULL, source TEXT NOT NULL, dataset TEXT NOT NULL, captured_at TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, payload_json TEXT NOT NULL DEFAULT '[]', error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(run_id, source, dataset)
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_flow_lab_candidates_run_score ON flow_lab_candidates(run_id, score DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_flow_lab_snapshots_run ON flow_lab_snapshots(run_id, source, dataset)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS flow_lab_paper_positions (
      id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL, run_id TEXT NOT NULL, strategy_version TEXT NOT NULL DEFAULT 'v1-paper',
      code TEXT, entry_trade_date TEXT, data_mode TEXT NOT NULL DEFAULT 'unknown', board TEXT NOT NULL, entry_at TEXT NOT NULL, entry_price REAL NOT NULL, exit_slot TEXT NOT NULL DEFAULT '09:45', exit_at TEXT, exit_price REAL,
      position_weight REAL NOT NULL, status TEXT NOT NULL DEFAULT 'open', return_pct REAL, notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_flow_lab_positions_status ON flow_lab_paper_positions(status, entry_at DESC)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS flow_lab_live_quotes (
      code TEXT PRIMARY KEY, price REAL, pre_close REAL, pct_chg REAL, quote_time TEXT, trade_date TEXT,
      source TEXT NOT NULL DEFAULT 'ths', status TEXT NOT NULL DEFAULT 'ok', error TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_flow_lab_live_quotes_updated ON flow_lab_live_quotes(updated_at DESC)")
  ]);
  const { results: columns } = await db.prepare("PRAGMA table_info(flow_lab_paper_positions)").all<{ name: string }>();
  if (!columns.some((column) => column.name === "exit_slot")) {
    await db.prepare("ALTER TABLE flow_lab_paper_positions ADD COLUMN exit_slot TEXT NOT NULL DEFAULT '09:45'").run();
  }
  if (!columns.some((column) => column.name === "code")) {
    await db.prepare("ALTER TABLE flow_lab_paper_positions ADD COLUMN code TEXT").run();
  }
  if (!columns.some((column) => column.name === "entry_trade_date")) {
    await db.prepare("ALTER TABLE flow_lab_paper_positions ADD COLUMN entry_trade_date TEXT").run();
  }
  if (!columns.some((column) => column.name === "data_mode")) {
    await db.prepare("ALTER TABLE flow_lab_paper_positions ADD COLUMN data_mode TEXT NOT NULL DEFAULT 'unknown'").run();
  }
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_flow_lab_positions_exit_slot ON flow_lab_paper_positions(exit_slot, status, entry_at DESC)").run();
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_flow_lab_paper_unique_entry ON flow_lab_paper_positions(strategy_version, entry_trade_date, code, exit_slot)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_flow_lab_paper_grouping ON flow_lab_paper_positions(data_mode, board, exit_slot, status)").run();
}

async function getFoundationSettings(db: D1Database) {
  const { results } = await db.prepare("SELECT key, value FROM foundation_settings").all<{ key: string; value: string }>();
  const map = Object.fromEntries(results.map((item) => [item.key, item.value]));
  const tradingRefresh = clampSeconds(map.trading_refresh_seconds ?? map.refresh_seconds, 30, 5, 3600);
  const offhoursRefresh = clampSeconds(map.offhours_refresh_seconds, 300, 30, 86400);
  const isTradingTime = isAshareTradingTime();
  const activeRefresh = isTradingTime ? tradingRefresh : offhoursRefresh;
  return {
    refresh_seconds: activeRefresh,
    trading_refresh_seconds: tradingRefresh,
    offhours_refresh_seconds: offhoursRefresh,
    active_refresh_seconds: activeRefresh,
    is_trading_time: isTradingTime
  };
}

function clampSeconds(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function isAshareTradingTime(now = new Date()) {
  const chinaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
  const day = chinaTime.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = chinaTime.getHours() * 60 + chinaTime.getMinutes();
  return (minutes >= 9 * 60 + 30 && minutes <= 11 * 60 + 30) || (minutes >= 13 * 60 && minutes <= 15 * 60);
}

async function listFoundationAssets(db: D1Database, enabledOnly: boolean) {
  const { results } = await db.prepare(`SELECT * FROM foundation_assets ${enabledOnly ? "WHERE enabled = 1" : ""} ORDER BY asset_type, sort_order, id`).all<FoundationAsset>();
  return results;
}

async function getFoundationAsset(db: D1Database, id: string) {
  return db.prepare("SELECT * FROM foundation_assets WHERE id = ?").bind(id).first<FoundationAsset>();
}

async function upsertFoundationAsset(db: D1Database, id: string, data: z.infer<typeof foundationAssetSchema>) {
  const priceStatus = data.current_price === undefined ? "pending" : "manual";
  await db.prepare(`
    INSERT INTO foundation_assets (
      id, asset_type, name, code, market, enabled, sort_order, current_price, price_status, price_updated_at,
      no_chase_min, observe_min, observe_max, reasonable_min, reasonable_max, safe_min, safe_max,
      bargain_min, bargain_max, stop_loss, reduce_min, reduce_max, sell_min, sell_max, keep_min,
      conclusion, analysis_markdown, analysis_json, analysis_updated_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      asset_type = excluded.asset_type,
      name = excluded.name,
      code = excluded.code,
      market = excluded.market,
      enabled = excluded.enabled,
      sort_order = excluded.sort_order,
      current_price = COALESCE(excluded.current_price, foundation_assets.current_price),
      price_status = CASE WHEN excluded.current_price IS NULL THEN foundation_assets.price_status ELSE excluded.price_status END,
      no_chase_min = excluded.no_chase_min,
      observe_min = excluded.observe_min,
      observe_max = excluded.observe_max,
      reasonable_min = excluded.reasonable_min,
      reasonable_max = excluded.reasonable_max,
      safe_min = excluded.safe_min,
      safe_max = excluded.safe_max,
      bargain_min = excluded.bargain_min,
      bargain_max = excluded.bargain_max,
      stop_loss = excluded.stop_loss,
      reduce_min = excluded.reduce_min,
      reduce_max = excluded.reduce_max,
      sell_min = excluded.sell_min,
      sell_max = excluded.sell_max,
      keep_min = excluded.keep_min,
      conclusion = excluded.conclusion,
      analysis_markdown = excluded.analysis_markdown,
      analysis_json = excluded.analysis_json,
      analysis_updated_at = excluded.analysis_updated_at,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    id,
    data.asset_type,
    data.name,
    normalizeCode(data.code),
    data.market,
    data.enabled ? 1 : 0,
    data.sort_order,
    data.current_price ?? null,
    priceStatus,
    data.no_chase_min ?? null,
    data.observe_min ?? null,
    data.observe_max ?? null,
    data.reasonable_min ?? null,
    data.reasonable_max ?? null,
    data.safe_min ?? null,
    data.safe_max ?? null,
    data.bargain_min ?? null,
    data.bargain_max ?? null,
    data.stop_loss ?? null,
    data.reduce_min ?? null,
    data.reduce_max ?? null,
    data.sell_min ?? null,
    data.sell_max ?? null,
    data.keep_min ?? null,
    data.conclusion,
    data.analysis_markdown,
    data.analysis_json,
    data.analysis_updated_at ?? null
  ).run();
}

function formatFoundationAsset(asset: FoundationAsset, includeAnalysis = false) {
  const current = asset.current_price;
  const analysisJson = safeJson<Record<string, unknown>>(asset.analysis_json, {});
  const styleTag = resolveFoundationStyleTag(asset, analysisJson);
  const levels = {
    no_chase: rangeText(asset.no_chase_min, null, "≥"),
    observe: rangeText(asset.observe_min, asset.observe_max),
    reasonable: rangeText(asset.reasonable_min, asset.reasonable_max),
    safe: rangeText(asset.safe_min, asset.safe_max),
    bargain: rangeText(asset.bargain_min, asset.bargain_max),
    deep_value_review: deepValueReviewText(asset.stop_loss, asset.bargain_min),
    stop_loss: rangeText(null, asset.stop_loss, "≤"),
    reduce: rangeText(asset.reduce_min, asset.reduce_max),
    sell: rangeText(asset.sell_min, asset.sell_max),
    keep: rangeText(asset.keep_min, null, "≥")
  };
  const hits = current === null ? [] : [
    hitAbove("no_chase", current, asset.no_chase_min),
    hitRange("observe", current, asset.observe_min, asset.observe_max),
    hitRange("reasonable", current, asset.reasonable_min, asset.reasonable_max),
    hitRange("safe", current, asset.safe_min, asset.safe_max),
    hitRange("bargain", current, asset.bargain_min, asset.bargain_max),
    hitDeepValueReview("deep_value_review", current, asset.stop_loss, asset.bargain_min),
    hitBelow("stop_loss", current, asset.stop_loss),
    hitRange("reduce", current, asset.reduce_min, asset.reduce_max),
    hitRange("sell", current, asset.sell_min, asset.sell_max),
    hitAbove("keep", current, asset.keep_min)
  ].filter(Boolean) as string[];
  const base = {
    id: asset.id,
    asset_type: asset.asset_type,
    name: asset.name,
    code: asset.code,
    market: asset.market,
    enabled: Boolean(asset.enabled),
    sort_order: asset.sort_order,
    current_price: current,
    price_source: asset.price_source,
    price_status: asset.price_status,
    price_error: asset.price_error,
    price_updated_at: asset.price_updated_at,
    conclusion: asset.conclusion,
    analysis_updated_at: asset.analysis_updated_at,
    style_tag: styleTag,
    levels,
    hit_fields: hits
  };
  return includeAnalysis ? { ...base, raw: asset, analysis_markdown: asset.analysis_markdown, analysis_json: analysisJson } : base;
}

const foundationHitLabels: Record<FoundationPriceKey, string> = {
  no_chase: "禁止追价",
  observe: "观察区",
  reasonable: "合理区",
  safe: "安全区",
  bargain: "捡漏区",
  deep_value_review: "超跌复核",
  stop_loss: "止损位",
  reduce: "减仓区",
  sell: "卖出区",
  keep: "底仓区"
};

const foundationHitNotes: Record<FoundationPriceKey | "none", string> = {
  no_chase: "价格偏高，新仓不追，等待回落到赔率更好的区域。",
  observe: "可以跟踪观察，但还不是模型认可的主动买入区。",
  reasonable: "估值进入可讨论区，适合配合趋势做小仓或分批计划。",
  safe: "安全边际较好，若趋势也放行，可作为主要建仓区。",
  bargain: "价格足够便宜，但仍要确认基本面没有恶化。",
  deep_value_review: "价格低到需要复核逻辑的位置，不是自动抄底信号。",
  stop_loss: "跌破买入逻辑失效位，风控优先。",
  reduce: "进入偏热减仓区，新增仓位性价比不高。",
  sell: "进入分批兑现区，优先锁定收益。",
  keep: "高估到只适合保留长期底仓的区域。",
  none: "当前价格没有命中筑基预设的关键区间。"
};

const foundationPrimaryHitOrder: Array<FoundationPriceKey | "none"> = [
  "stop_loss",
  "sell",
  "reduce",
  "keep",
  "no_chase",
  "bargain",
  "safe",
  "reasonable",
  "deep_value_review",
  "observe",
  "none"
];

async function enrichFoundationAssetsWithJindan(db: D1Database, assets: FormattedFoundationAsset[]) {
  const latest = await getLatestJindanSnapshot(db);
  const rows = latest ? await listJindanSnapshotRows(db, latest.id) : [];
  const jindanMap = buildAssetLookup(rows);
  return assets.map((asset) => {
    const jindan = findAssetInLookup(jindanMap, asset.code, asset.market);
    const foundationContext = summarizeFoundationForIntegration(asset);
    const jindanContext = jindan ? summarizeJindanForIntegration(jindan) : summarizeMissingJindanForIntegration();
    return {
      ...asset,
      jindan_gate: {
        ...jindanContext,
        combined_action: computeCombinedAction(foundationContext, jindanContext)
      }
    };
  });
}

async function enrichJindanRowsWithFoundation(db: D1Database, rows: JindanSnapshotRow[]) {
  const assets = (await listFoundationAssets(db, true)).map((asset) => formatFoundationAsset(asset));
  const foundationMap = buildAssetLookup(assets);
  return rows.map((row) => {
    const foundation = findAssetInLookup(foundationMap, row.code, row.market);
    const foundationContext = foundation ? summarizeFoundationForIntegration(foundation) : summarizeMissingFoundationForIntegration();
    const jindanContext = summarizeJindanForIntegration(row);
    return {
      ...row,
      foundation_match: foundationContext,
      combined_action: foundation ? computeCombinedAction(foundationContext, jindanContext) : null
    };
  });
}

function summarizeFoundationForIntegration(asset: FormattedFoundationAsset): FoundationIntegrationContext {
  const primary = foundationPrimaryHitOrder.find((key) => key !== "none" && asset.hit_fields.includes(key)) ?? "none";
  return {
    matched: true,
    id: asset.id,
    code: asset.code,
    name: asset.name,
    current_price: asset.current_price,
    conclusion: asset.conclusion,
    primary_hit_key: primary,
    primary_hit_label: primary === "none" ? "未命中关键区" : foundationHitLabels[primary],
    primary_hit_note: foundationHitNotes[primary],
    primary_hit_level: primary === "none" ? null : asset.levels[primary],
    hit_fields: asset.hit_fields
  };
}

function summarizeMissingFoundationForIntegration(): FoundationIntegrationContext {
  return {
    matched: false,
    id: null,
    code: null,
    name: null,
    current_price: null,
    conclusion: null,
    primary_hit_key: null,
    primary_hit_label: "未纳入筑基",
    primary_hit_note: "结丹有趋势数据，但筑基没有对应标的，暂时无法判断价格赔率。",
    primary_hit_level: null,
    hit_fields: []
  };
}

function summarizeJindanForIntegration(row: JindanSnapshotRow): JindanIntegrationContext {
  return {
    matched: true,
    code: row.code,
    name: row.name,
    enhanced_signal: row.enhanced_signal,
    enhanced_label: row.enhanced_label,
    suggested_position: row.suggested_position,
    suggested_action: row.suggested_action,
    trend_state: row.trend_state,
    source_status: row.source_status
  };
}

function summarizeMissingJindanForIntegration(): JindanIntegrationContext {
  return {
    matched: false,
    code: null,
    name: null,
    enhanced_signal: null,
    enhanced_label: "未纳入结丹",
    suggested_position: null,
    suggested_action: "缺少趋势闸门，先不主动开仓。",
    trend_state: null,
    source_status: null
  };
}

function computeCombinedAction(foundation: FoundationIntegrationContext, jindan: JindanIntegrationContext): CombinedAction {
  const priceKey = foundation.primary_hit_key;
  const signal = jindan.enhanced_signal;
  const trendPosition = clampPosition(jindan.suggested_position ?? 0);
  if (!jindan.matched) {
    return {
      action: "只观察",
      suggested_position: 0,
      reason: "筑基有价格区间，但没有结丹趋势闸门，先观察不主动开仓。"
    };
  }
  if (jindan.source_status && jindan.source_status !== "ok") {
    return {
      action: "只观察",
      suggested_position: 0,
      reason: "结丹趋势数据无效，先等待下一次有效快照。"
    };
  }
  if (priceKey === "stop_loss") {
    return { action: "清仓", suggested_position: 0, reason: "筑基已命中止损位，先处理风险。" };
  }
  if (signal === "confirmed_weak") {
    return { action: "清仓", suggested_position: 0, reason: "结丹确认转弱，趋势层要求退出。" };
  }
  if (signal === "reduce_weak" || signal === "weak_pending") {
    return {
      action: trendPosition > 0 ? "减仓" : "只观察",
      suggested_position: trendPosition,
      reason: trendPosition > 0 ? "结丹转弱待确认，只允许已有仓位降到防守仓。" : "结丹转弱待确认，空仓不新开。"
    };
  }
  if (priceKey === "sell") {
    return { action: "清仓", suggested_position: 0, reason: "筑基命中卖出区，优先兑现。" };
  }
  if (priceKey === "reduce" || priceKey === "keep") {
    return { action: "减仓", suggested_position: 0.3, reason: "筑基价格偏热，只保留观察或底仓。" };
  }
  const buyable = priceKey === "reasonable" || priceKey === "safe" || priceKey === "bargain";
  if (signal === "confirmed_strong" && buyable) {
    return {
      action: "可建仓",
      suggested_position: Math.max(0.5, Math.min(trendPosition || 0.6, 0.8)),
      reason: "筑基价格进入买入区，结丹趋势确认转强。"
    };
  }
  if (signal === "probe_strong" && buyable) {
    return {
      action: "小仓试",
      suggested_position: Math.max(0.2, Math.min(trendPosition || 0.3, 0.3)),
      reason: "价格有赔率但趋势还在试仓阶段。"
    };
  }
  if ((signal === "confirmed_strong" || signal === "probe_strong") && !buyable) {
    return {
      action: "等价格",
      suggested_position: 0,
      reason: "趋势层放行，但筑基价格还没有进入买入区。"
    };
  }
  if (priceKey === "deep_value_review") {
    return {
      action: "只观察",
      suggested_position: 0,
      reason: "价格过低需要先复核基本面，不把超跌自动当买点。"
    };
  }
  return {
    action: "只观察",
    suggested_position: 0,
    reason: "价格或趋势至少有一侧没有放行。"
  };
}

function clampPosition(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function buildAssetLookup<T extends { code: string; market?: string }>(items: T[]) {
  const lookup = new Map<string, T>();
  for (const item of items) {
    for (const key of assetLookupKeys(item.code, item.market ?? "")) {
      if (!lookup.has(key)) lookup.set(key, item);
    }
  }
  return lookup;
}

function findAssetInLookup<T>(lookup: Map<string, T>, code: string, market?: string) {
  for (const key of assetLookupKeys(code, market ?? "")) {
    const matched = lookup.get(key);
    if (matched) return matched;
  }
  return null;
}

function assetLookupKeys(code: string, market: string) {
  const normalized = normalizeCode(code);
  const keys = new Set<string>();
  if (normalized) keys.add(normalized);
  const noSuffix = normalized.replace(/\.(SH|SZ|BJ|CSI|HK|US)$/i, "");
  if (noSuffix) keys.add(noSuffix);
  const digits = normalized.replace(/\D/g, "");
  if (digits.length >= 6) keys.add(digits.slice(-6));
  for (const endpoint of ["daily", "index_daily", "fund_daily"]) {
    try {
      const tushare = normalizeTushareCode(code, market, endpoint);
      keys.add(tushare);
      keys.add(tushare.replace(/\.(SH|SZ|BJ|CSI)$/i, ""));
    } catch {
      // Some crypto/commodity symbols are intentionally not Tushare-compatible.
    }
  }
  return [...keys].filter(Boolean);
}

function buildFoundationHitSummary(assets: FormattedFoundationAsset[]) {
  const labels: Record<FoundationHitKey, string> = {
    reasonable: "合理区",
    safe: "安全区",
    bargain: "捡漏区",
    deep_value_review: "超跌复核",
    stop_loss: "止损位",
    reduce: "减仓区",
    sell: "卖出区",
    keep: "底仓区"
  };
  const serialize = (key: FoundationHitKey) => {
    const matched = assets
      .filter((asset) => asset.hit_fields.includes(key))
      .map((asset) => ({
        id: asset.id,
        code: asset.code,
        name: asset.name,
        current_price: asset.current_price
      }));
    return { key, label: labels[key], count: matched.length, assets: matched };
  };
  return {
    buy: (["reasonable", "safe", "bargain"] as FoundationHitKey[]).map(serialize),
    review: (["deep_value_review"] as FoundationHitKey[]).map(serialize),
    sell: (["stop_loss", "reduce", "sell", "keep"] as FoundationHitKey[]).map(serialize)
  };
}

async function listJindanAssets(db: D1Database, enabledOnly: boolean) {
  const { results } = await db.prepare(`SELECT * FROM jindan_assets ${enabledOnly ? "WHERE enabled = 1" : ""} ORDER BY sort_order, id`).all<JindanAsset>();
  return results;
}

async function getJindanAsset(db: D1Database, id: string) {
  return db.prepare("SELECT * FROM jindan_assets WHERE id = ?").bind(id).first<JindanAsset>();
}

async function upsertJindanAsset(db: D1Database, id: string, data: z.infer<typeof jindanAssetSchema>) {
  await db.prepare(`
    INSERT INTO jindan_assets (
      id, asset_type, name, code, market, data_source, enabled, highlighted, sort_order, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      asset_type = excluded.asset_type,
      name = excluded.name,
      code = excluded.code,
      market = excluded.market,
      data_source = excluded.data_source,
      enabled = excluded.enabled,
      highlighted = excluded.highlighted,
      sort_order = excluded.sort_order,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    id,
    data.asset_type,
    data.name,
    normalizeCode(data.code),
    data.market,
    data.data_source,
    data.enabled ? 1 : 0,
    data.highlighted ? 1 : 0,
    data.sort_order
  ).run();
}

async function getLatestJindanSnapshot(db: D1Database) {
  return db.prepare("SELECT * FROM jindan_snapshots ORDER BY report_date DESC, generated_at DESC LIMIT 1").first<JindanSnapshot>();
}

async function getPreviousJindanSnapshot(db: D1Database, reportDate: string) {
  return db.prepare("SELECT * FROM jindan_snapshots WHERE report_date < ? ORDER BY report_date DESC, generated_at DESC LIMIT 1").bind(reportDate).first<JindanSnapshot>();
}

async function listJindanSnapshotRows(db: D1Database, snapshotId: string) {
  const { results } = await db.prepare("SELECT * FROM jindan_snapshot_rows WHERE snapshot_id = ? ORDER BY rank IS NULL, rank, name, code")
    .bind(snapshotId)
    .all<JindanSnapshotRow>();
  return results;
}

async function generateJindanSnapshot(db: D1Database, tushareToken: string | undefined, reportDate: string) {
  const assets = await listJindanAssets(db, true);
  const previousSnapshot = await getPreviousJindanSnapshot(db, reportDate);
  const previousRankMap = previousSnapshot ? await getJindanPreviousRankMap(db, previousSnapshot.id) : new Map<string, number>();
  const previousPositionMap = previousSnapshot ? await getJindanPreviousPositionMap(db, previousSnapshot.id) : new Map<string, number>();
  const computedRows = await Promise.all(assets.map(async (asset) => {
    try {
      const bars = await refreshJindanAssetBars(db, asset, tushareToken, reportDate);
      return computeJindanRow(asset, bars, reportDate, previousPositionMap.get(asset.id) ?? null);
    } catch (error) {
      return buildJindanErrorRow(asset, error instanceof Error ? error.message : String(error));
    }
  }));
  const sortable = computedRows
    .filter((row) => row.source_status === "ok" && row.deviation_pct !== null)
    .sort((left, right) => {
      if (left.asset_type !== right.asset_type) return left.asset_type.localeCompare(right.asset_type);
      return (right.deviation_pct ?? -Infinity) - (left.deviation_pct ?? -Infinity);
    });
  const groupCounters = new Map<string, number>();
  const rankMap = new Map<string, number>();
  for (const row of sortable) {
    const nextRank = (groupCounters.get(row.asset_type) ?? 0) + 1;
    groupCounters.set(row.asset_type, nextRank);
    rankMap.set(row.asset_id, nextRank);
  }
  const rows = computedRows.map((row) => {
    const rank = rankMap.get(row.asset_id) ?? null;
    const previousRank = previousRankMap.get(row.asset_id) ?? null;
    return {
      ...row,
      rank,
      previous_rank: previousRank,
      rank_change: rank !== null && previousRank !== null ? previousRank - rank : null
    };
  }).sort((left, right) => {
    if (left.asset_type !== right.asset_type) return left.asset_type.localeCompare(right.asset_type);
    if (left.rank !== null && right.rank !== null) return left.rank - right.rank;
    if (left.rank !== null) return -1;
    if (right.rank !== null) return 1;
    return left.name.localeCompare(right.name, "zh-CN") || left.code.localeCompare(right.code);
  });
  const snapshotId = `jindan-${reportDate}`;
  await db.prepare("INSERT INTO jindan_snapshots (id, report_date, generated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(report_date) DO UPDATE SET generated_at = CURRENT_TIMESTAMP")
    .bind(snapshotId, reportDate)
    .run();
  await db.prepare("DELETE FROM jindan_snapshot_rows WHERE snapshot_id = ?").bind(snapshotId).run();
  if (rows.length) {
    await db.batch(rows.map((row) => db.prepare(`
      INSERT INTO jindan_snapshot_rows (
        id, snapshot_id, asset_id, rank, previous_rank, rank_change, code, name, market, asset_type, data_source, highlighted,
        pct_chg, close, ma20, ma60, ma20_slope_pct, atr20, deviation_pct, volume_ratio, trend_state,
        enhanced_signal, enhanced_label, suggested_position, suggested_action, filter_flags_json, filter_summary,
        state_changed_at, interval_pct, actual_trade_date, source_status, source_error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `${snapshotId}-${row.asset_id}`,
      snapshotId,
      row.asset_id,
      row.rank,
      row.previous_rank,
      row.rank_change,
      row.code,
      row.name,
      row.market,
      row.asset_type,
      row.data_source,
      row.highlighted,
      row.pct_chg,
      row.close,
      row.ma20,
      row.ma60,
      row.ma20_slope_pct,
      row.atr20,
      row.deviation_pct,
      row.volume_ratio,
      row.trend_state,
      row.enhanced_signal,
      row.enhanced_label,
      row.suggested_position,
      row.suggested_action,
      row.filter_flags_json,
      row.filter_summary,
      row.state_changed_at,
      row.interval_pct,
      row.actual_trade_date,
      row.source_status,
      row.source_error
    )));
  }
  await logFetch(db, "jindan", "ok", `generated ${reportDate}: ${rows.length} assets`);
  const snapshot = await getLatestJindanSnapshot(db);
  return { ok: true, snapshot, rows: snapshot ? await listJindanSnapshotRows(db, snapshot.id) : [], assets_count: assets.length };
}

async function getJindanPreviousRankMap(db: D1Database, snapshotId: string) {
  const { results } = await db.prepare("SELECT asset_id, rank FROM jindan_snapshot_rows WHERE snapshot_id = ? AND rank IS NOT NULL").bind(snapshotId).all<{ asset_id: string; rank: number }>();
  return new Map(results.map((row) => [row.asset_id, row.rank]));
}

async function getJindanPreviousPositionMap(db: D1Database, snapshotId: string) {
  const { results } = await db.prepare("SELECT asset_id, suggested_position FROM jindan_snapshot_rows WHERE snapshot_id = ? AND suggested_position IS NOT NULL")
    .bind(snapshotId)
    .all<{ asset_id: string; suggested_position: number }>();
  return new Map(results.map((row) => [row.asset_id, row.suggested_position]));
}

async function refreshJindanAssetBars(db: D1Database, asset: JindanAsset, tushareToken: string | undefined, reportDate: string) {
  const fetched = await fetchJindanBars(asset, tushareToken, reportDate);
  if (fetched.length) {
    await db.batch(fetched.map((bar) => db.prepare(`
      INSERT INTO jindan_daily_bars (
        asset_id, trade_date, open, high, low, close, pre_close, pct_chg, volume, amount, source, raw_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(asset_id, trade_date) DO UPDATE SET
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        pre_close = excluded.pre_close,
        pct_chg = excluded.pct_chg,
        volume = excluded.volume,
        amount = excluded.amount,
        source = excluded.source,
        raw_json = excluded.raw_json,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      asset.id,
      bar.trade_date,
      bar.open,
      bar.high,
      bar.low,
      bar.close,
      bar.pre_close,
      bar.pct_chg,
      bar.volume,
      bar.amount,
      bar.source,
      bar.raw_json
    )));
  }
  const { results } = await db.prepare("SELECT * FROM jindan_daily_bars WHERE asset_id = ? AND trade_date <= ? ORDER BY trade_date DESC LIMIT 90")
    .bind(asset.id, reportDate)
    .all<JindanDailyBar>();
  return results.reverse();
}

async function fetchJindanBars(asset: JindanAsset, tushareToken: string | undefined, reportDate: string): Promise<JindanDailyBar[]> {
  if (asset.data_source === "binance_daily") return fetchBinanceDailyBars(asset, reportDate);
  if (asset.data_source === "yahoo_chart") return fetchYahooChartBars(asset, reportDate);
  if (asset.data_source === "ths_index_daily") {
    try {
      return await fetchThsIndexDailyBars(asset, reportDate);
    } catch (error) {
      if (shouldUseThsIndex(asset) || !tushareToken) throw error;
      const fallbackBars = await fetchTushareDailyBars(asset, tushareToken, reportDate);
      return fallbackBars.length ? fallbackBars : Promise.reject(error);
    }
  }
  if (shouldUseThsIndex(asset)) return fetchThsIndexDailyBars(asset, reportDate);
  const tushareBars = await fetchTushareDailyBars(asset, tushareToken, reportDate);
  if (tushareBars.length >= 20) return tushareBars;
  if (shouldUseThsIndex(asset)) {
    const thsBars = await fetchThsIndexDailyBars(asset, reportDate);
    if (thsBars.length >= 20) return thsBars;
  }
  const yahooSymbol = yahooSymbolForAsset(asset);
  if (!yahooSymbol) return tushareBars;
  const yahooBars = await fetchYahooChartBars(asset, reportDate);
  return yahooBars.length >= 20 ? yahooBars : tushareBars;
}

async function fetchTushareDailyBars(asset: JindanAsset, token: string | undefined, reportDate: string): Promise<JindanDailyBar[]> {
  if (!token) throw new Error("TUSHARE_TOKEN 未配置");
  const endpoint = asset.asset_type === "etf" || asset.data_source === "tushare_fund_daily"
    ? "fund_daily"
    : asset.data_source === "tushare_index_daily" || asset.data_source === "ths_index_daily"
    ? (shouldUseTushareGlobalIndex(asset) ? "index_global" : "index_daily")
    : "daily";
  const endDate = compactDate(reportDate);
  const startDate = compactDate(addDays(reportDate, -140));
  const response = await fetch("https://api.tushare.pro", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "manfu-jindan/0.1" },
    body: JSON.stringify({
      api_name: endpoint,
      token,
      params: { ts_code: normalizeTushareCode(asset.code, asset.market, endpoint), start_date: startDate, end_date: endDate },
      fields: "ts_code,trade_date,open,high,low,close,pre_close,pct_chg,vol,amount"
    })
  });
  if (!response.ok) throw new Error(`Tushare HTTP ${response.status}`);
  const payload = await response.json() as { code?: number; msg?: string; data?: { fields: string[]; items: unknown[][] } };
  if (payload.code !== 0) throw new Error(payload.msg || `Tushare 返回异常 ${payload.code}`);
  const fields = payload.data?.fields ?? [];
  const items = payload.data?.items ?? [];
  const factorMap = asset.data_source === "tushare_daily" ? await fetchTushareAdjFactors(asset, token, startDate, endDate) : new Map<string, number>();
  const rawBars = items.map((item) => {
    const row = Object.fromEntries(fields.map((field, index) => [field, item[index]])) as Record<string, unknown>;
    const tradeDate = dashedDate(String(row.trade_date));
    return {
      asset_id: asset.id,
      trade_date: tradeDate,
      open: finiteOrNull(row.open),
      high: finiteOrNull(row.high),
      low: finiteOrNull(row.low),
      close: Number(row.close),
      pre_close: finiteOrNull(row.pre_close),
      pct_chg: percentToRatio(row.pct_chg),
      volume: finiteOrNull(row.vol),
      amount: finiteOrNull(row.amount),
      source: `tushare:${endpoint}`,
      raw_json: JSON.stringify(row)
    };
  }).filter((bar) => Number.isFinite(bar.close)).sort((left, right) => left.trade_date.localeCompare(right.trade_date));
  if (!factorMap.size) return rawBars;
  const latestFactor = [...rawBars].reverse().map((bar) => factorMap.get(bar.trade_date)).find((value) => value && Number.isFinite(value));
  if (!latestFactor) return rawBars;
  const adjusted = rawBars.map((bar) => {
    const factor = factorMap.get(bar.trade_date);
    return factor ? {
      ...bar,
      open: bar.open === null ? null : bar.open * factor / latestFactor,
      high: bar.high === null ? null : bar.high * factor / latestFactor,
      low: bar.low === null ? null : bar.low * factor / latestFactor,
      close: bar.close * factor / latestFactor,
      pre_close: null,
      source: `${bar.source}:qfq`
    } : bar;
  });
  return adjusted.map((bar, index) => ({
    ...bar,
    pre_close: index > 0 ? adjusted[index - 1].close : bar.pre_close,
    pct_chg: index > 0 && adjusted[index - 1].close > 0 ? bar.close / adjusted[index - 1].close - 1 : bar.pct_chg
  }));
}

async function fetchTushareAdjFactors(asset: JindanAsset, token: string, startDate: string, endDate: string) {
  const response = await fetch("https://api.tushare.pro", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "manfu-jindan/0.1" },
    body: JSON.stringify({
      api_name: "adj_factor",
      token,
      params: { ts_code: normalizeTushareCode(asset.code, asset.market, "daily"), start_date: startDate, end_date: endDate },
      fields: "trade_date,adj_factor"
    })
  });
  if (!response.ok) return new Map<string, number>();
  const payload = await response.json() as { code?: number; data?: { fields: string[]; items: unknown[][] } };
  if (payload.code !== 0) return new Map<string, number>();
  const fields = payload.data?.fields ?? [];
  const items = payload.data?.items ?? [];
  return new Map(items.map((item) => {
    const row = Object.fromEntries(fields.map((field, index) => [field, item[index]])) as Record<string, unknown>;
    return [dashedDate(String(row.trade_date)), Number(row.adj_factor)] as const;
  }).filter(([, value]) => Number.isFinite(value)));
}

async function fetchBinanceDailyBars(asset: JindanAsset, reportDate: string): Promise<JindanDailyBar[]> {
  const symbol = asset.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=1d&limit=90`, {
    headers: { "User-Agent": "manfu-jindan/0.1" }
  });
  if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);
  const payload = await response.json() as unknown[][];
  const bars = payload.map((item, index) => {
    const tradeDate = new Date(Number(item[0])).toISOString().slice(0, 10);
    const close = Number(item[4]);
    const previousClose = index > 0 ? Number(payload[index - 1][4]) : null;
    return {
      asset_id: asset.id,
      trade_date: tradeDate,
      open: finiteOrNull(item[1]),
      high: finiteOrNull(item[2]),
      low: finiteOrNull(item[3]),
      close,
      pre_close: previousClose,
      pct_chg: previousClose && previousClose > 0 ? close / previousClose - 1 : null,
      volume: finiteOrNull(item[5]),
      amount: finiteOrNull(item[7]),
      source: "binance:klines:1d",
      raw_json: JSON.stringify(item)
    };
  }).filter((bar) => bar.trade_date <= reportDate && Number.isFinite(bar.close));
  return bars;
}

async function fetchYahooChartBars(asset: JindanAsset, reportDate: string): Promise<JindanDailyBar[]> {
  const symbol = yahooSymbolForAsset(asset);
  if (!symbol) throw new Error(`Yahoo 暂无映射：${asset.code}`);
  const period2 = Math.floor(new Date(`${addDays(reportDate, 1)}T00:00:00Z`).getTime() / 1000);
  const period1 = Math.floor(new Date(`${addDays(reportDate, -180)}T00:00:00Z`).getTime() / 1000);
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d`, {
    headers: { "User-Agent": "Mozilla/5.0 manfu-jindan/0.1" }
  });
  if (!response.ok) throw new Error(`Yahoo HTTP ${response.status}`);
  const payload = await response.json() as {
    chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null>; volume?: Array<number | null> }> } }>; error?: { description?: string } }
  };
  const result = payload.chart?.result?.[0];
  if (!result?.timestamp?.length) throw new Error(payload.chart?.error?.description || "Yahoo 无日线数据");
  const quote = result.indicators?.quote?.[0] ?? {};
  const bars = result.timestamp.map((timestamp, index) => {
    const close = quote.close?.[index] ?? null;
    const previousClose = index > 0 ? quote.close?.[index - 1] ?? null : null;
    return {
      asset_id: asset.id,
      trade_date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: quote.open?.[index] === null || quote.open?.[index] === undefined ? null : Number(quote.open[index]),
      high: quote.high?.[index] === null || quote.high?.[index] === undefined ? null : Number(quote.high[index]),
      low: quote.low?.[index] === null || quote.low?.[index] === undefined ? null : Number(quote.low[index]),
      close: Number(close),
      pre_close: previousClose === null ? null : Number(previousClose),
      pct_chg: previousClose && close ? Number(close) / Number(previousClose) - 1 : null,
      volume: quote.volume?.[index] === null || quote.volume?.[index] === undefined ? null : Number(quote.volume[index]),
      amount: null,
      source: `yahoo:${symbol}`,
      raw_json: JSON.stringify({ timestamp, open: quote.open?.[index] ?? null, high: quote.high?.[index] ?? null, low: quote.low?.[index] ?? null, close, volume: quote.volume?.[index] ?? null })
    };
  }).filter((bar) => bar.trade_date <= reportDate && Number.isFinite(bar.close) && bar.close > 0);
  return bars;
}

async function fetchThsIndexDailyBars(asset: JindanAsset, reportDate: string): Promise<JindanDailyBar[]> {
  const code = normalizeCode(asset.code);
  const response = await fetch(`https://d.10jqka.com.cn/v6/line/48_${encodeURIComponent(code)}/01/all.js`, {
    headers: { "User-Agent": "Mozilla/5.0 manfu-jindan/0.1", Referer: "https://q.10jqka.com.cn/" }
  });
  if (!response.ok) throw new Error(`同花顺指数 HTTP ${response.status}`);
  const text = await response.text();
  const start = text.indexOf("(");
  const end = text.lastIndexOf(")");
  if (start < 0 || end <= start) throw new Error("同花顺指数日线解析失败");
  const payload = JSON.parse(text.slice(start + 1, end)) as { sortYear?: Array<[number, number]>; dates?: string; price?: string; volumn?: string; priceFactor?: number };
  const dates = expandThsDates(payload.sortYear ?? [], payload.dates ?? "");
  const prices = (payload.price ?? "").split(",").map(Number);
  const volumes = (payload.volumn ?? "").split(",").map((value) => finiteOrNull(value));
  const factor = Number(payload.priceFactor || 1000);
  const bars = dates.map((tradeDate, index) => {
    const group = prices.slice(index * 4, index * 4 + 4).filter((value) => Number.isFinite(value)).map((value) => value / factor);
    const close = prices[index * 4] / factor;
    const previousClose = index > 0 ? prices[(index - 1) * 4] / factor : null;
    return {
      asset_id: asset.id,
      trade_date: tradeDate,
      open: group[3] ?? null,
      high: group.length ? Math.max(...group) : null,
      low: group.length ? Math.min(...group) : null,
      close,
      pre_close: previousClose && previousClose > 0 ? previousClose : null,
      pct_chg: previousClose && previousClose > 0 && close > 0 ? close / previousClose - 1 : null,
      volume: volumes[index] ?? null,
      amount: null,
      source: "ths:index:line",
      raw_json: JSON.stringify({ tradeDate, prices: group, close, volume: volumes[index] ?? null })
    };
  }).filter((bar) => bar.trade_date <= reportDate && Number.isFinite(bar.close) && bar.close > 0);
  return bars.slice(-120);
}

function computeJindanRow(asset: JindanAsset, bars: JindanDailyBar[], reportDate: string, previousPosition: number | null = null): Omit<JindanSnapshotRow, "id" | "snapshot_id" | "rank" | "previous_rank" | "rank_change"> & { asset_id: string } {
  const available = bars.filter((bar) => bar.trade_date <= reportDate && Number.isFinite(bar.close));
  if (available.length < 20) return buildJindanInsufficientRow(asset, available.at(-1)?.trade_date ?? null, `日线不足 20 条：${available.length}`);
  const latestIndex = available.length - 1;
  const latest = available[latestIndex];
  const ma20Series = available.map((_, index) => index < 19 ? null : jindanAverage(available.slice(index - 19, index + 1).map((bar) => bar.close)));
  const ma20 = ma20Series[latestIndex] ?? jindanAverage(available.slice(latestIndex - 19, latestIndex + 1).map((bar) => bar.close));
  const ma60 = available.length >= 60 ? jindanAverage(available.slice(latestIndex - 59, latestIndex + 1).map((bar) => bar.close)) : null;
  const ma20FiveDaysAgo = latestIndex >= 5 ? ma20Series[latestIndex - 5] : null;
  const ma20SlopePct = ma20FiveDaysAgo && ma20FiveDaysAgo > 0 ? ma20 / ma20FiveDaysAgo - 1 : null;
  const atrResult = computeJindanAtr20(available, latestIndex);
  const atr20 = atrResult.value;
  const deviation = latest.close / ma20 - 1;
  const volumeWindow = available.slice(Math.max(0, latestIndex - 5), latestIndex).map((bar) => bar.volume).filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);
  const volumeRatio = latest.volume !== null && latest.volume > 0 && volumeWindow.length === 5 ? latest.volume / jindanAverage(volumeWindow) : null;
  const states = available.map((bar, index) => {
    const ma = ma20Series[index];
    if (ma === null) return null;
    return bar.close >= ma ? "strong" as const : "weak" as const;
  });
  const currentState = states[latestIndex] ?? "unknown";
  const enhanced = computeJindanEnhancedSignal({
    state: currentState,
    close: latest.close,
    ma20,
    ma60,
    ma20SlopePct,
    atr20,
    volumeRatio,
    previousPosition,
    atrEstimated: atrResult.estimated,
    latestIndex,
    bars: available,
    ma20Series
  });
  let stateChangedAt: string | null = null;
  let intervalPct: number | null = null;
  for (let index = latestIndex; index >= 20; index -= 1) {
    if (states[index] && states[index - 1] && states[index] !== states[index - 1]) {
      stateChangedAt = available[index].trade_date;
      const baseClose = available[index - 1].close;
      intervalPct = baseClose > 0 ? latest.close / baseClose - 1 : null;
      break;
    }
  }
  return {
    asset_id: asset.id,
    code: asset.code,
    name: asset.name,
    market: asset.market,
    asset_type: asset.asset_type,
    data_source: asset.data_source,
    highlighted: asset.highlighted,
    pct_chg: latest.pct_chg ?? (latest.pre_close && latest.pre_close > 0 ? latest.close / latest.pre_close - 1 : null),
    close: latest.close,
    ma20,
    ma60,
    ma20_slope_pct: ma20SlopePct,
    atr20,
    deviation_pct: deviation,
    volume_ratio: volumeRatio,
    trend_state: currentState,
    enhanced_signal: enhanced.signal,
    enhanced_label: enhanced.label,
    suggested_position: enhanced.position,
    suggested_action: enhanced.action,
    filter_flags_json: JSON.stringify(enhanced.filters),
    filter_summary: enhanced.summary,
    state_changed_at: stateChangedAt,
    interval_pct: intervalPct,
    actual_trade_date: latest.trade_date,
    source_status: "ok",
    source_error: null
  };
}

function computeJindanAtr20(bars: JindanDailyBar[], latestIndex: number) {
  if (latestIndex < 19) return { value: null, estimated: true };
  let estimated = false;
  const ranges = bars.slice(latestIndex - 19, latestIndex + 1).map((bar, offset) => {
    const index = latestIndex - 19 + offset;
    const previousClose = bars[index - 1]?.close ?? bar.pre_close ?? bar.close;
    const high = bar.high !== null && Number.isFinite(bar.high) && bar.high > 0 ? bar.high : Math.max(bar.close, previousClose);
    const low = bar.low !== null && Number.isFinite(bar.low) && bar.low > 0 ? bar.low : Math.min(bar.close, previousClose);
    if (bar.high === null || bar.high === undefined || bar.low === null || bar.low === undefined) estimated = true;
    return Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose));
  }).filter((value) => Number.isFinite(value) && value >= 0);
  return ranges.length === 20 ? { value: jindanAverage(ranges), estimated } : { value: null, estimated: true };
}

function computeJindanEnhancedSignal(input: {
  state: "strong" | "weak" | "unknown";
  close: number;
  ma20: number;
  ma60: number | null;
  ma20SlopePct: number | null;
  atr20: number | null;
  volumeRatio: number | null;
  previousPosition: number | null;
  atrEstimated: boolean;
  latestIndex: number;
  bars: JindanDailyBar[];
  ma20Series: Array<number | null>;
}) {
  if (input.state === "unknown") {
    return jindanEnhancedResult("unknown", "数据不足", null, "不做仓位动作，等待有效日线", [], "增强信号需要至少 20 条有效日线");
  }
  const bullish = input.state === "strong";
  const directionText = bullish ? "转强" : "转弱";
  const atrBoundary = input.atr20 === null ? null : bullish ? input.ma20 + input.atr20 * 0.5 : input.ma20 - input.atr20 * 0.5;
  const fixedBoundary = bullish ? input.ma20 * 1.01 : input.ma20 * 0.99;
  const volatilityBoundary = atrBoundary ?? fixedBoundary;
  const volatilityBufferPassed = bullish ? input.close > volatilityBoundary : input.close < volatilityBoundary;
  const volatilityBufferNote = input.atr20 === null
    ? "ATR20缺失，临时退回固定1%缓冲"
    : `${input.atrEstimated ? "估算" : "源OHLC"} ATR20 的 0.5 倍缓冲，已替代固定1%`;
  const consecutivePassed = [input.latestIndex - 1, input.latestIndex].every((index) => {
    const ma = input.ma20Series[index];
    const close = input.bars[index]?.close;
    if (ma === null || close === undefined) return false;
    return bullish ? close >= ma : close <= ma;
  });
  const slopePassed = input.ma20SlopePct === null ? false : bullish ? input.ma20SlopePct > 0 : input.ma20SlopePct < 0;
  const ma60Passed = input.ma60 === null ? false : bullish ? input.close >= input.ma60 : input.close <= input.ma60;
  const volumePassed = input.volumeRatio === null ? false : input.volumeRatio >= 1;
  const volumeNote = input.volumeRatio === null
    ? "量比缺失，不能确认量能"
    : bullish
      ? input.volumeRatio >= 1
        ? "转强时量比不低于1，量能配合趋势"
        : input.volumeRatio < 0.8
          ? "转强但量比低于0.8，缩量突破，降级为观察"
          : "转强量比低于1，量能确认不足"
      : input.volumeRatio >= 1
        ? "转弱时量比不低于1，放量跌破更可信"
        : "转弱但量比低于1，跌破确认不足";
  const filters = [
    jindanFilter("volatility_buffer", input.atr20 === null ? "波动缓冲(1%)" : "波动缓冲(ATR)", volatilityBufferPassed, volatilityBufferNote),
    jindanFilter("two_day_confirm", "连续2日确认", consecutivePassed, bullish ? "连续2日收在 MA20 上方" : "连续2日收在 MA20 下方"),
    jindanFilter("ma20_slope", "MA20斜率", slopePassed, bullish ? "MA20 最近5日向上" : "MA20 最近5日向下"),
    jindanFilter("ma60_background", "MA60背景", ma60Passed, bullish ? "收盘价位于 MA60 上方" : "收盘价位于 MA60 下方"),
    jindanFilter("volume_confirm", "量能确认", volumePassed, volumeNote)
  ];
  const passCount = filters.filter((item) => item.passed).length;
  const blocked = filters.filter((item) => !item.passed).map((item) => item.label);
  const summary = blocked.length ? `拦截：${blocked.join("、")}` : "五项过滤全部通过";
  if (bullish) {
    if (passCount === filters.length) {
      return jindanEnhancedResult("confirmed_strong", "确认转强", 0.6, "趋势仓可到60%；若已有仓位，可按60%上限持有或补齐", filters, summary);
    }
    if (passCount >= 3) {
      return jindanEnhancedResult("probe_strong", "观察转强", 0.3, "只允许轻仓30%；等五项过滤全部通过再加到60%", filters, summary);
    }
    return jindanEnhancedResult("range_filtered", "震荡过滤", 0, `原始${directionText}未通过增强过滤，观望0%，不追入`, filters, summary);
  }
  if (passCount === filters.length) {
    return jindanEnhancedResult("confirmed_weak", "确认转弱", 0, "趋势仓退出到0%；等待重新转强", filters, summary);
  }
  const reducedWeakPosition = input.previousPosition !== null && input.previousPosition > 0 ? Math.min(input.previousPosition, 0.3) : 0;
  if (passCount >= 3) {
    return jindanEnhancedResult(
      "reduce_weak",
      "观察转弱",
      reducedWeakPosition,
      reducedWeakPosition > 0 ? "已有趋势仓先降到30%；空仓不新开，等确认转强再入场" : "空仓不新开；观察转弱只用于持仓者降到30%",
      filters,
      summary
    );
  }
  return jindanEnhancedResult(
    "weak_pending",
    "弱势待确认",
    reducedWeakPosition,
    reducedWeakPosition > 0 ? "不新开仓；已有趋势仓最多保留30%观察" : "空仓继续观望0%；弱势待确认不作为买入信号",
    filters,
    summary
  );
}

function jindanFilter(key: string, label: string, passed: boolean, note: string) {
  return { key, label, passed, note };
}

function jindanEnhancedResult(signal: string, label: string, position: number | null, action: string, filters: Array<{ key: string; label: string; passed: boolean; note: string }>, summary: string) {
  return { signal, label, position, action, filters, summary };
}

function buildJindanInsufficientRow(asset: JindanAsset, actualTradeDate: string | null, reason: string): Omit<JindanSnapshotRow, "id" | "snapshot_id" | "rank" | "previous_rank" | "rank_change"> & { asset_id: string } {
  return {
    ...buildJindanBaseRow(asset),
    actual_trade_date: actualTradeDate,
    source_status: "insufficient",
    source_error: reason
  };
}

function buildJindanErrorRow(asset: JindanAsset, error: string): Omit<JindanSnapshotRow, "id" | "snapshot_id" | "rank" | "previous_rank" | "rank_change"> & { asset_id: string } {
  return {
    ...buildJindanBaseRow(asset),
    source_status: "failed",
    source_error: error
  };
}

function buildJindanBaseRow(asset: JindanAsset): Omit<JindanSnapshotRow, "id" | "snapshot_id" | "rank" | "previous_rank" | "rank_change"> & { asset_id: string } {
  return {
    asset_id: asset.id,
    code: asset.code,
    name: asset.name,
    market: asset.market,
    asset_type: asset.asset_type,
    data_source: asset.data_source,
    highlighted: asset.highlighted,
    pct_chg: null,
    close: null,
    ma20: null,
    ma60: null,
    ma20_slope_pct: null,
    atr20: null,
    deviation_pct: null,
    volume_ratio: null,
    trend_state: "unknown",
    enhanced_signal: null,
    enhanced_label: null,
    suggested_position: null,
    suggested_action: null,
    filter_flags_json: null,
    filter_summary: null,
    state_changed_at: null,
    interval_pct: null,
    actual_trade_date: null,
    source_status: "failed",
    source_error: null
  };
}

function normalizeTushareCode(code: string, market: string, endpoint = "daily") {
  const normalized = normalizeCode(code);
  const upper = normalized.toUpperCase();
  const alias: Record<string, string> = {
    "1B0688": "000688.SH",
    "1B0016": "000016.SH",
    "1B0852": "000852.SH",
    "1B0819": "000819.SH",
    "1B0932": "000932.SH",
    H30035: "H30035.CSI",
    H30590: "H30590.CSI",
    "931994": "931994.CSI",
    HSI: "HSI",
    HSCEI: "HSCEI",
    HSCE: "HSCEI",
    IXIC: "IXIC",
    QQQ: "IXIC",
    SPY: "SPX",
    SPX: "SPX",
    DJI: "DJI"
  };
  if (alias[upper]) return alias[upper];
  if (endpoint === "index_global") return upper;
  if (/^\d{6}\.(SH|SZ|BJ)$/i.test(normalized)) return normalized.toUpperCase();
  if (!/^\d{6}$/.test(normalized)) return normalized.toUpperCase();
  if (endpoint === "index_daily" && normalized === "000813") return "000813.CSI";
  if (endpoint === "index_daily") return normalized.startsWith("399") ? `${normalized}.SZ` : `${normalized}.SH`;
  if (endpoint === "fund_daily") return normalized.startsWith("5") ? `${normalized}.SH` : `${normalized}.SZ`;
  if (market.includes("北") || normalized.startsWith("8") || normalized.startsWith("4")) return `${normalized}.BJ`;
  if (normalized.startsWith("6") || normalized.startsWith("5") || normalized.startsWith("9")) return `${normalized}.SH`;
  return `${normalized}.SZ`;
}

function shouldUseTushareGlobalIndex(asset: JindanAsset) {
  const code = normalizeCode(asset.code).toUpperCase();
  return !asset.market.includes("A股") || ["HSI", "HSCEI", "HSCE", "IXIC", "SPX", "SPY", "DJI"].includes(code);
}

function yahooSymbolForAsset(asset: JindanAsset) {
  const code = normalizeCode(asset.code).toUpperCase();
  const alias: Record<string, string> = {
    QQQ: "QQQ",
    NDX: "^NDX",
    "纳指100": "^NDX",
    SPY: "SPY",
    HSI: "^HSI",
    AUUSDO: "GC=F",
    XAUUSD: "GC=F",
    GOLD: "GC=F",
    AGUSDO: "SI=F",
    XAGUSD: "SI=F",
    SILVER: "SI=F"
  };
  if (alias[code]) return alias[code];
  if (asset.data_source === "yahoo_chart" && /^[A-Z0-9.=^/-]+$/.test(code)) return code;
  if (asset.market.includes("美") && /^[A-Z.]{1,8}$/.test(code)) return code;
  return null;
}

function shouldUseThsIndex(asset: JindanAsset) {
  return asset.asset_type === "index" && /^88\d{4}$/.test(normalizeCode(asset.code));
}

function expandThsDates(sortYear: Array<[number, number]>, dateText: string) {
  const mmdds = dateText.split(",").filter(Boolean);
  const years = sortYear.flatMap(([year, count]) => Array.from({ length: Number(count) }, () => Number(year)));
  return mmdds.map((mmdd, index) => {
    const year = years[index] ?? years.at(-1) ?? new Date().getFullYear();
    return `${year}-${mmdd.slice(0, 2)}-${mmdd.slice(2, 4)}`;
  });
}

function jindanAverage(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentToRatio(value: unknown) {
  const parsed = finiteOrNull(value);
  return parsed === null ? null : parsed / 100;
}

function finiteOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function todayInShanghai() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function addDays(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function compactDate(dateText: string) {
  return dateText.replace(/-/g, "");
}

function dashedDate(dateText: string) {
  if (/^\d{8}$/.test(dateText)) return `${dateText.slice(0, 4)}-${dateText.slice(4, 6)}-${dateText.slice(6, 8)}`;
  return dateText;
}

function inferAssetStyle(asset: FoundationAsset, analysisJson: Record<string, unknown>) {
  const explicit = firstString(
    analysisJson.asset_subtype,
    analysisJson.asset_style,
    analysisJson.valuation_method,
    analysisJson.price_band_method
  );
  const explicitStyle = [
    "QDII/互联网",
    "宽基ETF",
    "主题ETF",
    "周期/资源",
    "制造/设备",
    "成长",
    "金融",
    "高股息",
    "港美/中概"
  ].find((style) => explicit.includes(style));
  if (explicitStyle) return explicitStyle;
  const text = `${explicit} ${asset.name} ${asset.market} ${asset.analysis_markdown}`.toLowerCase();
  if (asset.asset_type === "etf") {
    if (/qdii|港股|美股|海外|中概|互联网/.test(text)) return "QDII/互联网";
    if (/主题|粮食|农业|种业|农化|commodity|sector/.test(text)) return "主题ETF";
    if (/宽基|沪深300|中证500|创业板|科创|上证|broad/.test(text)) return "宽基ETF";
    return "ETF";
  }
  if (/周期|煤|硅|金属|化工|资源|cyclical|resource/.test(text)) return "周期/资源";
  if (/制造|设备|电网|订单|manufacturing|equipment/.test(text)) return "制造/设备";
  if (/港股|美股|qdii/i.test(asset.market) && /qdii|港股|美股|海外|中概|互联网/.test(text)) return "港美/中概";
  if (/主题|粮食|农业|种业|农化|commodity|sector/.test(text)) return "主题";
  if (/成长|科技|growth|technology|ai|软件|半导体/.test(text)) return "成长";
  if (/银行|保险|券商|bank|insurance|brokerage/.test(text)) return "金融";
  if (/高股息|红利|公用事业|utility|dividend/.test(text)) return "高股息";
  if (asset.asset_type === "stock") return "待分类";
  return "其他";
}

function resolveFoundationStyleTag(asset: FoundationAsset, analysisJson: Record<string, unknown>) {
  const subtype = firstString(analysisJson.asset_subtype);
  return subtype || inferAssetStyle(asset, analysisJson);
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

async function refreshFoundationPrices(db: D1Database) {
  const assets = await listFoundationAssets(db, true);
  const tencentAssets = assets.filter((asset) => canUseTencentQuote(asset));
  const otherAssets = assets.filter((asset) => !canUseTencentQuote(asset));
  const tencentQuotes = await fetchTencentQuotes(tencentAssets);
  await Promise.allSettled([
    ...tencentAssets.map((asset) => updateFoundationQuote(db, asset, tencentQuotes.get(asset.id) ?? { ok: false as const, error: "Tencent quote missing" })),
    ...otherAssets.map(async (asset) => updateFoundationQuote(db, asset, await fetchFoundationQuote(asset)))
  ]);
}

async function updateFoundationQuote(db: D1Database, asset: FoundationAsset, quote: FoundationQuoteResult) {
    if (quote.ok) {
      await db.prepare(`
        UPDATE foundation_assets SET current_price = ?, price_source = ?, price_status = 'ok', price_error = NULL,
        price_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(quote.price, quote.source, asset.id).run();
    } else {
      await db.prepare(`
        UPDATE foundation_assets SET price_status = 'failed', price_error = ?, price_updated_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(quote.error.slice(0, 240), asset.id).run();
    }
}

async function fetchFoundationQuote(asset: FoundationAsset): Promise<FoundationQuoteResult> {
  try {
    if (asset.market.toLowerCase().includes("btc") || asset.code.toUpperCase().includes("BTC")) {
      const response = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT", { headers: { "User-Agent": "manfu-dashboard/0.1" } });
      if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);
      const json = await response.json() as { price?: string };
      const price = Number(json.price);
      if (!Number.isFinite(price)) throw new Error("Binance price parse failed");
      return { ok: true, price, source: "Binance BTCUSDT" };
    }
    const symbol = toTencentSymbol(asset.code);
    if (!symbol) return { ok: false, error: "暂不支持该标的自动报价" };
    const response = await fetch(`https://qt.gtimg.cn/q=${symbol}`, { headers: { "User-Agent": "Mozilla/5.0 manfu-dashboard/0.1" } });
    if (!response.ok) throw new Error(`腾讯行情 HTTP ${response.status}`);
    const text = await response.text();
    const fields = text.split("\"")[1]?.split("~") ?? [];
    const price = Number(fields[3]);
    if (!Number.isFinite(price) || price <= 0) throw new Error("腾讯行情价格解析失败");
    return { ok: true, price, source: "腾讯证券实时行情" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function canUseTencentQuote(asset: FoundationAsset) {
  return Boolean(toTencentSymbol(asset.code)) && !asset.market.toLowerCase().includes("btc") && !asset.code.toUpperCase().includes("BTC");
}

async function fetchTencentQuotes(assets: FoundationAsset[]) {
  const result = new Map<string, FoundationQuoteResult>();
  const entries = assets.map((asset) => ({ asset, symbol: toTencentSymbol(asset.code) })).filter((entry) => entry.symbol);
  for (let index = 0; index < entries.length; index += 80) {
    const chunk = entries.slice(index, index + 80);
    try {
      const response = await fetch(`https://qt.gtimg.cn/q=${chunk.map((entry) => entry.symbol).join(",")}`, { headers: { "User-Agent": "Mozilla/5.0 manfu-dashboard/0.1" } });
      if (!response.ok) throw new Error(`Tencent quote HTTP ${response.status}`);
      const text = await response.text();
      const quotesBySymbol = parseTencentQuoteText(text);
      for (const { asset, symbol } of chunk) {
        const quote = quotesBySymbol.get(symbol);
        result.set(asset.id, quote ?? { ok: false, error: "Tencent quote parse failed" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const { asset } of chunk) result.set(asset.id, { ok: false, error: message });
    }
  }
  return result;
}

function parseTencentQuoteText(text: string) {
  const result = new Map<string, FoundationQuoteResult>();
  for (const line of text.split(";")) {
    const symbol = line.match(/v_([^=]+)=/)?.[1];
    const fields = line.split("\"")[1]?.split("~") ?? [];
    const price = Number(fields[3]);
    if (!symbol) continue;
    if (Number.isFinite(price) && price > 0) {
      result.set(symbol, { ok: true, price, source: "腾讯证券实时行情" });
    } else {
      result.set(symbol, { ok: false, error: "Tencent quote price parse failed" });
    }
  }
  return result;
}

function toTencentSymbol(code: string) {
  const digits = normalizeCode(code).replace(/\D/g, "");
  if (!digits) return "";
  if (/^(6|5|9)/.test(digits)) return `sh${digits}`;
  if (/^(0|1|2|3)/.test(digits)) return `sz${digits}`;
  return "";
}

function slugifyAsset(code: string, market: string) {
  return `${market.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")}-${normalizeCode(code).toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`.replace(/^-+|-+$/g, "");
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function rangeText(min: number | null, max: number | null, mode: "range" | "≥" | "≤" = "range") {
  if (mode === "≥") return min === null ? "--" : `≥ ${formatNumber(min)}`;
  if (mode === "≤") return max === null ? "--" : `≤ ${formatNumber(max)}`;
  if (min !== null && max !== null) return `${formatNumber(min)} - ${formatNumber(max)}`;
  if (min !== null) return `≥ ${formatNumber(min)}`;
  if (max !== null) return `≤ ${formatNumber(max)}`;
  return "--";
}

function deepValueReviewText(stopLoss: number | null, bargainMin: number | null) {
  if (stopLoss === null || bargainMin === null) return "--";
  return `${formatNumber(stopLoss)} - ${formatNumber(bargainMin)}`;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(value >= 1000 ? 0 : 2).replace(/\.?0+$/g, "");
}

function hitRange(key: string, price: number, min: number | null, max: number | null) {
  if (min === null || max === null) return null;
  return price >= min && price < max ? key : null;
}

function hitAbove(key: string, price: number, min: number | null) {
  return min !== null && price >= min ? key : null;
}

function hitBelow(key: string, price: number, max: number | null) {
  return max !== null && price <= max ? key : null;
}

function hitDeepValueReview(key: string, price: number, stopLoss: number | null, bargainMin: number | null) {
  if (stopLoss === null || bargainMin === null) return null;
  return price > stopLoss && price < bargainMin ? key : null;
}

async function canRefreshBtcLighthouse(c: AppContext) {
  const token = c.req.header("x-refresh-token") || c.req.query("token");
  if (c.env.BTC_LIGHTHOUSE_REFRESH_TOKEN && token === c.env.BTC_LIGHTHOUSE_REFRESH_TOKEN) return true;
  return requireAdmin(c);
}

async function getBtcLighthouseLatest(db: D1Database) {
  return db.prepare("SELECT * FROM btc_lighthouse_latest WHERE id = ?").bind(BTC_LIGHTHOUSE_ID).first<BtcLighthouseLatest>();
}

async function listBtcLighthouseHistory(db: D1Database) {
  const { results } = await db.prepare("SELECT * FROM btc_lighthouse_history WHERE strategy_version = ? ORDER BY signal_date DESC LIMIT 60")
    .bind(BTC_LIGHTHOUSE_VERSION)
    .all<BtcLighthouseLatest & { payload_json: string; created_at: string }>();
  return results;
}

function shouldRefreshBtcLighthouse(latest: BtcLighthouseLatest) {
  const updated = Date.parse(latest.updated_at);
  if (!Number.isFinite(updated)) return true;
  return Date.now() - updated > 1000 * 60 * 60 * 20;
}

async function refreshBtcLighthouse(db: D1Database) {
  const rows = buildBtcMetricRows(await fetchBtcCoinMetricsRows());
  const signal = buildBtcLighthouseSignal(rows);
  const metricsJson = JSON.stringify(signal.metrics);
  const stateJson = JSON.stringify(signal.stateDetails);
  await db.prepare(`
    INSERT INTO btc_lighthouse_latest (
      id, strategy_version, signal_date, state, state_label, suggested_action, recommended_position,
      current_position, price, bottom_score, top_score, bottom_groups, trigger_summary, metrics_json,
      state_json, source_status, source_message, data_updated_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok', ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      strategy_version = excluded.strategy_version,
      signal_date = excluded.signal_date,
      state = excluded.state,
      state_label = excluded.state_label,
      suggested_action = excluded.suggested_action,
      recommended_position = excluded.recommended_position,
      current_position = excluded.current_position,
      price = excluded.price,
      bottom_score = excluded.bottom_score,
      top_score = excluded.top_score,
      bottom_groups = excluded.bottom_groups,
      trigger_summary = excluded.trigger_summary,
      metrics_json = excluded.metrics_json,
      state_json = excluded.state_json,
      source_status = excluded.source_status,
      source_message = excluded.source_message,
      data_updated_at = excluded.data_updated_at,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    BTC_LIGHTHOUSE_ID,
    BTC_LIGHTHOUSE_VERSION,
    signal.signalDate,
    signal.state,
    signal.stateLabel,
    signal.suggestedAction,
    signal.recommendedPosition,
    signal.currentPosition,
    signal.price,
    signal.bottomScore,
    signal.topScore,
    signal.bottomGroups,
    signal.triggerSummary,
    metricsJson,
    stateJson,
    BTC_LIGHTHOUSE_SOURCE,
    signal.signalDate
  ).run();
  await db.prepare(`
    INSERT INTO btc_lighthouse_history (
      id, strategy_version, signal_date, state, state_label, suggested_action, recommended_position,
      current_position, price, bottom_score, top_score, bottom_groups, trigger_summary, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(strategy_version, signal_date) DO UPDATE SET
      state = excluded.state,
      state_label = excluded.state_label,
      suggested_action = excluded.suggested_action,
      recommended_position = excluded.recommended_position,
      current_position = excluded.current_position,
      price = excluded.price,
      bottom_score = excluded.bottom_score,
      top_score = excluded.top_score,
      bottom_groups = excluded.bottom_groups,
      trigger_summary = excluded.trigger_summary,
      payload_json = excluded.payload_json
  `).bind(
    `${BTC_LIGHTHOUSE_VERSION}-${signal.signalDate}`,
    BTC_LIGHTHOUSE_VERSION,
    signal.signalDate,
    signal.state,
    signal.stateLabel,
    signal.suggestedAction,
    signal.recommendedPosition,
    signal.currentPosition,
    signal.price,
    signal.bottomScore,
    signal.topScore,
    signal.bottomGroups,
    signal.triggerSummary,
    JSON.stringify(signal)
  ).run();
  await logFetch(db, "btc-lighthouse", "ok", `${signal.signalDate} ${signal.stateLabel} ${signal.suggestedAction}`);
  return (await getBtcLighthouseLatest(db))!;
}

async function fetchBtcCoinMetricsRows() {
  const params = new URLSearchParams({
    assets: "btc",
    metrics: "PriceUSD,CapMVRVCur,CapMrktCurUSD,IssTotUSD",
    frequency: "1d",
    start_time: "2011-01-01",
    page_size: "10000"
  });
  const response = await fetch(`https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?${params.toString()}`, {
    headers: { "User-Agent": "manfu-btc-lighthouse/0.1" }
  });
  if (!response.ok) throw new Error(`Coin Metrics HTTP ${response.status}`);
  const json = await response.json() as { data?: BtcRawMetric[] };
  const rows = json.data ?? [];
  if (rows.length < 1600) throw new Error("Coin Metrics returned insufficient BTC history");
  return rows;
}

function buildBtcMetricRows(rawRows: BtcRawMetric[]) {
  const rows = rawRows
    .map((row) => ({
      date: row.time.slice(0, 10),
      price: Number(row.PriceUSD),
      mvrv: Number(row.CapMVRVCur),
      marketCap: Number(row.CapMrktCurUSD),
      issuedUsd: Number(row.IssTotUSD)
    }))
    .filter((row) => [row.price, row.mvrv, row.marketCap, row.issuedUsd].every((value) => Number.isFinite(value) && value > 0))
    .sort((a, b) => a.date.localeCompare(b.date));
  let ath = 0;
  const marketCaps: number[] = [];
  const ma111Values: Array<number | null> = [];
  const ma350Values: Array<number | null> = [];
  const piCrosses: boolean[] = [];
  const metricRows: BtcMetricRow[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    ath = Math.max(ath, row.price);
    marketCaps.push(row.marketCap);
    const ma200d = rollingAverage(rows, i, 200, 200, "price");
    const ma200w = rollingAverage(rows, i, 1400, 1000, "price");
    const ma20w = rollingAverage(rows, i, 140, 100, "price");
    const ma111d = rollingAverage(rows, i, 111, 111, "price");
    const ma350d = rollingAverage(rows, i, 350, 350, "price");
    const ma2y = rollingAverage(rows, i, 730, 500, "price");
    ma111Values.push(ma111d);
    ma350Values.push(ma350d === null ? null : ma350d * 2);
    const prev111 = ma111Values[i - 1];
    const prev350x2 = ma350Values[i - 1];
    const ma350dX2 = ma350Values[i];
    const piCross = ma111d !== null && ma350dX2 !== null && prev111 !== null && prev350x2 !== null && ma111d > ma350dX2 && prev111 <= prev350x2;
    piCrosses.push(piCross);
    const realizedCap = row.marketCap / row.mvrv;
    const capStd = expandingStd(marketCaps, 365);
    const puellMean = rollingAverage(rows, i, 365, 365, "issuedUsd");
    const base: BtcMetricRow = {
      date: row.date,
      price: row.price,
      mvrv: row.mvrv,
      marketCap: row.marketCap,
      issuedUsd: row.issuedUsd,
      ath,
      drawdown: row.price / ath - 1,
      ma200d,
      ma200w,
      ma20w,
      ma111d,
      ma350dX2,
      ma2yX5: ma2y === null ? null : ma2y * 5,
      realizedCap,
      mvrvZ: capStd === null ? null : (row.marketCap - realizedCap) / capStd,
      nupl: 1 - 1 / row.mvrv,
      puell: puellMean === null ? null : row.issuedUsd / puellMean,
      mayer: ma200d === null ? null : row.price / ma200d,
      piCycleRecent: piCrosses.slice(Math.max(0, i - 29), i + 1).some(Boolean),
      bottomScore: 0,
      topScore: 0,
      bottomGroups: 0
    };
    base.bottomScore = btcBottomScore(base);
    base.topScore = btcTopScore(base);
    base.bottomGroups = btcBottomGroups(base);
    metricRows.push(base);
  }
  return metricRows.filter((row) => row.date >= "2012-01-01");
}

function rollingAverage<T extends { price: number; issuedUsd: number }>(rows: T[], index: number, window: number, minPeriods: number, key: "price" | "issuedUsd") {
  const start = Math.max(0, index - window + 1);
  const values = rows.slice(start, index + 1).map((row) => Number(row[key])).filter(Number.isFinite);
  if (values.length < minPeriods) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function expandingStd(values: number[], minPeriods: number) {
  if (values.length < minPeriods) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length - 1);
  return Math.sqrt(variance);
}

function btcBottomScore(row: BtcMetricRow) {
  let score = 0;
  score += row.drawdown <= -0.30 ? 10 : 0;
  score += row.drawdown <= -0.40 ? 10 : 0;
  score += row.drawdown <= -0.50 ? 10 : 0;
  score += row.drawdown <= -0.60 ? 10 : 0;
  score += row.mvrv < 1.30 ? 10 : 0;
  score += row.mvrv < 1.10 ? 15 : 0;
  score += row.mvrv < 0.95 ? 15 : 0;
  score += row.nupl !== null && row.nupl < 0.25 ? 10 : 0;
  score += row.nupl !== null && row.nupl < 0.00 ? 15 : 0;
  score += row.puell !== null && row.puell < 0.80 ? 10 : 0;
  score += row.puell !== null && row.puell < 0.50 ? 10 : 0;
  score += row.mayer !== null && row.mayer < 1.00 ? 10 : 0;
  score += row.mayer !== null && row.mayer < 0.80 ? 10 : 0;
  score += row.ma200w !== null && row.price <= row.ma200w * 1.10 ? 10 : 0;
  score += row.ma200w !== null && row.price <= row.ma200w ? 10 : 0;
  return score;
}

function btcTopScore(row: BtcMetricRow) {
  let score = 0;
  score += row.mvrv > 2.5 ? 10 : 0;
  score += row.mvrv > 3.5 ? 15 : 0;
  score += row.mvrv > 5.0 ? 20 : 0;
  score += row.mvrvZ !== null && row.mvrvZ > 4.0 ? 10 : 0;
  score += row.mvrvZ !== null && row.mvrvZ > 6.0 ? 15 : 0;
  score += row.mvrvZ !== null && row.mvrvZ > 8.0 ? 20 : 0;
  score += row.nupl !== null && row.nupl > 0.55 ? 10 : 0;
  score += row.nupl !== null && row.nupl > 0.70 ? 15 : 0;
  score += row.nupl !== null && row.nupl > 0.80 ? 20 : 0;
  score += row.puell !== null && row.puell > 2.0 ? 10 : 0;
  score += row.puell !== null && row.puell > 3.0 ? 15 : 0;
  score += row.puell !== null && row.puell > 4.0 ? 15 : 0;
  score += row.mayer !== null && row.mayer > 1.8 ? 10 : 0;
  score += row.mayer !== null && row.mayer > 2.4 ? 20 : 0;
  score += row.ma2yX5 !== null && row.price > row.ma2yX5 ? 20 : 0;
  score += row.piCycleRecent ? 25 : 0;
  return score;
}

function btcBottomGroups(row: BtcMetricRow) {
  const drawdown = row.drawdown <= -0.40;
  const value = row.mvrv < 1.30 || (row.nupl !== null && row.nupl < 0.25);
  const miner = row.puell !== null && row.puell < 0.80;
  const trendCheap = (row.mayer !== null && row.mayer < 1.00) || (row.ma200w !== null && row.price <= row.ma200w * 1.10);
  return [drawdown, value, miner, trendCheap].filter(Boolean).length;
}

function btcTriggerRecord(
  row: BtcMetricRow,
  next: BtcMetricRow,
  action: BtcTriggerRecord["action"],
  actionLabel: string,
  targetPosition: number,
  reason: string
): BtcTriggerRecord {
  return {
    signalDate: row.date,
    executionDate: next.date,
    action,
    actionLabel,
    executionPrice: next.price,
    signalPrice: row.price,
    targetPosition,
    bottomScore: row.bottomScore,
    topScore: row.topScore,
    bottomGroups: row.bottomGroups,
    drawdown: row.drawdown,
    mvrv: row.mvrv,
    nupl: row.nupl,
    puell: row.puell,
    mayer: row.mayer,
    reason
  };
}

function buildBtcMatureSignals(row: BtcMetricRow, vars: { btc: number; avgEntry: number; cyclePeak: number; matureReduced: boolean }): BtcMatureSignal[] {
  const hasPosition = vars.btc > 0 && vars.avgEntry > 0 && vars.cyclePeak > 0;
  const peakMultiple = hasPosition ? vars.cyclePeak / vars.avgEntry : null;
  const drawdownFromPeak = hasPosition ? row.price / vars.cyclePeak - 1 : null;
  const trendBroken = hasPosition && row.ma20w !== null && row.price < row.ma20w;
  return BTC_MATURE_MULTIPLES.map((item) => {
    const reached = peakMultiple !== null && peakMultiple >= item.multiple;
    const active = reached && drawdownFromPeak !== null && drawdownFromPeak <= -0.15 && trendBroken;
    const triggerPrice = reached && hasPosition ? vars.cyclePeak * 0.85 : null;
    const targetPeakPrice = hasPosition ? vars.avgEntry * item.multiple : null;
    const distanceToMultiple = peakMultiple === null ? null : Math.max(0, item.multiple - peakMultiple);
    const action = active
      ? item.role === "default"
        ? vars.matureReduced
          ? "默认已减仓，等待最终清仓条件"
          : "默认标准触发，建议减仓 35%"
        : item.role === "defensive"
          ? "防守标准触发，提示风险升高"
          : "进攻标准触发，强牛假设也应保护利润"
      : reached
        ? "已进入成熟区，等待回撤与 20 周线确认"
        : "未进入成熟区";
    const note = item.role === "default"
      ? "系统默认执行标准"
      : item.role === "defensive"
        ? "更早保护利润，容易卖飞"
        : "更能吃鱼身，可能等不到";
    return {
      multiple: item.multiple,
      label: item.label,
      role: item.role,
      reached,
      active,
      peakMultiple,
      drawdownFromPeak,
      triggerPrice,
      targetPeakPrice,
      distanceToMultiple,
      action,
      note
    };
  });
}

function buildBtcLighthouseSignal(rows: BtcMetricRow[]) {
  const buyLevels = BTC_BUY_LEVELS;
  let cash = 100;
  let btc = 0;
  let avgEntry = 0;
  let cyclePeak = 0;
  let topWatch = false;
  let watchPeak = 0;
  let matureReduced = false;
  const bought = new Set<number>();
  const triggers: BtcTriggerRecord[] = [];

  for (let i = 0; i < rows.length - 1; i += 1) {
    const row = rows[i];
    const next = rows[i + 1];
    const price = row.price;
    const execPrice = next.price;
    const equity = cash + btc * price;
    if (btc > 0) cyclePeak = Math.max(cyclePeak, price);
    if (row.bottomScore >= 45 && row.bottomGroups >= 4) {
      topWatch = false;
      watchPeak = 0;
      matureReduced = false;
    }
    if (row.topScore >= 110 && btc > 0) {
      topWatch = true;
      watchPeak = Math.max(watchPeak, price);
    }
    if (topWatch) watchPeak = Math.max(watchPeak, price);
    const watchBreak = topWatch && ((watchPeak > 0 && price <= watchPeak * 0.70) || (row.ma20w !== null && price < row.ma20w));
    const matureReduce = btc > 0 && !matureReduced && avgEntry > 0 && row.bottomGroups < 4 && cyclePeak / avgEntry >= 4 && price <= cyclePeak * 0.85 && row.ma20w !== null && price < row.ma20w;
    const matureFinal = btc > 0 && matureReduced && cyclePeak > 0 && price <= cyclePeak * 0.70 && row.ma20w !== null && price < row.ma20w;
    const shouldSell = btc > 0 && (row.topScore >= 210 || watchBreak || matureReduce || matureFinal);
    if (shouldSell) {
      const sellAction = row.topScore >= 210
        ? { action: "SELL_EXTREME" as const, label: "极端顶部清仓", reason: "top_score >= 210，进入极端顶部清仓规则" }
        : watchBreak
          ? { action: "SELL_CONFIRM" as const, label: "顶部观察后清仓", reason: "top_score 曾进入观察区，随后出现 30% 回撤或跌破 20 周线" }
          : matureReduce
            ? { action: "SELL_MATURE_TREND" as const, label: "成熟牛市减仓 35%", reason: "持仓峰值超过成本 4 倍，回撤超过 15%，且跌破 20 周线，先保护 35% 利润" }
            : { action: "SELL_MATURE_TREND" as const, label: "成熟牛市最终清仓", reason: "成熟牛市已减仓后，继续回撤超过 30% 且跌破 20 周线" };
      const sellBtc = matureReduce ? btc * 0.35 : btc;
      cash += sellBtc * execPrice * (1 - 0.00075);
      btc -= sellBtc;
      const afterEquity = cash + btc * execPrice;
      const targetPosition = afterEquity > 0 ? (btc * execPrice) / afterEquity : 0;
      triggers.push(btcTriggerRecord(row, next, sellAction.action, sellAction.label, targetPosition, sellAction.reason));
      if (matureReduce) {
        matureReduced = true;
      }
      if (btc <= 1e-12) {
        btc = 0;
        avgEntry = 0;
        cyclePeak = 0;
        topWatch = false;
        watchPeak = 0;
        matureReduced = false;
        bought.clear();
      }
    } else {
      for (const [level, fraction] of buyLevels) {
        if (row.bottomScore >= level && row.bottomGroups >= 4 && !bought.has(level) && cash > 0) {
          const notional = Math.min(equity * fraction, cash);
          const newBtc = notional * (1 - 0.00075) / execPrice;
          avgEntry = btc + newBtc > 0 ? (btc * avgEntry + newBtc * execPrice) / (btc + newBtc) : execPrice;
          btc += newBtc;
          cash -= notional;
          cyclePeak = Math.max(cyclePeak, execPrice);
          bought.add(level);
          const targetPosition = Math.min(1, Array.from(bought)
            .reduce((sum, boughtLevel) => sum + (buyLevels.find(([item]) => item === boughtLevel)?.[1] ?? 0), 0));
          triggers.push(btcTriggerRecord(
            row,
            next,
            "BUY",
            `买入 ${Math.round(fraction * 100)}%，目标仓位 ${Math.round(targetPosition * 100)}%`,
            targetPosition,
            `bottom_score >= ${level} 且 bottom_groups >= 4/4`
          ));
        }
      }
    }
  }

  const latest = rows[rows.length - 1];
  const equity = cash + btc * latest.price;
  const currentPosition = equity > 0 ? (btc * latest.price) / equity : 0;
  const pending = pendingBtcAction(latest, { btc, cash, avgEntry, cyclePeak, topWatch, watchPeak, matureReduced, bought });
  const matureSignals = buildBtcMatureSignals(latest, { btc, avgEntry, cyclePeak, matureReduced });
  return {
    signalDate: latest.date,
    state: pending.state,
    stateLabel: pending.stateLabel,
    suggestedAction: pending.suggestedAction,
    recommendedPosition: pending.recommendedPosition,
    currentPosition,
    price: latest.price,
    bottomScore: latest.bottomScore,
    topScore: latest.topScore,
    bottomGroups: latest.bottomGroups,
    triggerSummary: pending.triggerSummary,
    metrics: {
      mvrv: latest.mvrv,
      nupl: latest.nupl,
      puell: latest.puell,
      mayer: latest.mayer,
      drawdown: latest.drawdown,
      ma20w: latest.ma20w,
      ma200d: latest.ma200d,
      ma200w: latest.ma200w,
      mvrvZ: latest.mvrvZ,
      piCycleRecent: latest.piCycleRecent
    },
    stateDetails: {
      avgEntry,
      cyclePeak,
      topWatch,
      watchPeak,
      matureReduced,
      peakMultiple: btc > 0 && avgEntry > 0 ? cyclePeak / avgEntry : null,
      drawdownFromPositionPeak: btc > 0 && cyclePeak > 0 ? latest.price / cyclePeak - 1 : null,
      matureSignals,
      cash,
      btc,
      boughtLevels: Array.from(bought),
      triggers: triggers.slice().reverse()
    }
  };
}

function pendingBtcAction(row: BtcMetricRow, vars: { btc: number; cash: number; avgEntry: number; cyclePeak: number; topWatch: boolean; watchPeak: number; matureReduced: boolean; bought: Set<number> }) {
  let topWatch = vars.topWatch;
  let watchPeak = vars.watchPeak;
  if (row.bottomScore >= 45 && row.bottomGroups >= 4) {
    topWatch = false;
    watchPeak = 0;
  }
  if (row.topScore >= 110 && vars.btc > 0) {
    topWatch = true;
    watchPeak = Math.max(watchPeak, row.price);
  }
  if (topWatch) watchPeak = Math.max(watchPeak, row.price);
  const watchBreak = topWatch && ((watchPeak > 0 && row.price <= watchPeak * 0.70) || (row.ma20w !== null && row.price < row.ma20w));
  const matureReduce = vars.btc > 0 && !vars.matureReduced && vars.avgEntry > 0 && row.bottomGroups < 4 && vars.cyclePeak / vars.avgEntry >= 4 && row.price <= vars.cyclePeak * 0.85 && row.ma20w !== null && row.price < row.ma20w;
  const matureFinal = vars.btc > 0 && vars.matureReduced && vars.cyclePeak > 0 && row.price <= vars.cyclePeak * 0.70 && row.ma20w !== null && row.price < row.ma20w;
  if (vars.btc > 0 && row.topScore >= 210) return btcAction("clear", 0, "极端顶部清仓", "top_score >= 210，进入极端顶部清仓规则");
  if (vars.btc > 0 && watchBreak) return btcAction("clear", 0, "顶部观察后清仓", "top_score 曾进入观察区，随后出现 30% 回撤或跌破 20 周线");
  const markEquity = vars.cash + vars.btc * row.price;
  const currentPosition = markEquity > 0 ? (vars.btc * row.price) / markEquity : 0;
  if (vars.btc > 0 && matureReduce) return btcAction("top_watch", currentPosition * 0.65, "成熟牛市减仓 35%", "持仓峰值超过成本 4 倍，回撤超过 15%，且跌破 20 周线，先保护 35% 利润");
  if (vars.btc > 0 && matureFinal) return btcAction("clear", 0, "成熟牛市最终清仓", "成熟牛市已减仓后，继续回撤超过 30% 且跌破 20 周线");
  const buyLevels = BTC_BUY_LEVELS;
  const triggeredBuys = buyLevels.filter(([level]) => row.bottomScore >= level && row.bottomGroups >= 4 && !vars.bought.has(level));
  if (triggeredBuys.length > 0 && vars.cash > 0) {
    const target = Math.min(1, Array.from(new Set([...Array.from(vars.bought), ...triggeredBuys.map(([level]) => level)]))
      .reduce((sum, level) => sum + (buyLevels.find(([item]) => item === level)?.[1] ?? 0), 0));
    const state = target >= 0.95 ? "full" : target >= 0.60 ? "build_2" : "build_1";
    return btcAction(state, target, `建仓到 ${Math.round(target * 100)}%`, `底部四组共振，bottom_score=${row.bottomScore}`);
  }
  if (vars.matureReduced && vars.btc > 0) return btcAction("top_watch", currentPosition, "顶部保护后持有", "已做成熟牛市减仓，剩余仓位等待最终趋势破坏或重新进入底部区");
  if (topWatch && vars.btc > 0) return btcAction("top_watch", currentPosition, "顶部观察，暂不卖出", "顶部热度进入观察区，等待趋势确认");
  if (vars.btc <= 0) return btcAction("empty", 0, "空仓等待", "没有满足底部四组共振");
  return btcAction(btcStateForPosition(currentPosition), currentPosition, "继续持有", "持仓中，未出现清仓条件");
}

function btcStateForPosition(position: number): BtcSignalState {
  if (position >= 0.95) return "full";
  if (position >= 0.60) return "build_2";
  if (position > 0) return "build_1";
  return "empty";
}

function btcAction(state: BtcSignalState, recommendedPosition: number, suggestedAction: string, triggerSummary: string) {
  const labels: Record<BtcSignalState, string> = {
    empty: "空仓等待",
    build_1: "建仓一档",
    build_2: "建仓二档",
    full: "满仓持有",
    top_watch: "顶部观察",
    clear: "清仓信号"
  };
  return { state, stateLabel: labels[state], suggestedAction, recommendedPosition, triggerSummary };
}

function formatBtcLighthouse(row: BtcLighthouseLatest) {
  const stateDetails = safeJson<Record<string, unknown>>(row.state_json, {});
  return {
    ...row,
    metrics: safeJson(row.metrics_json, {}),
    state_details: stateDetails,
    triggers: Array.isArray(stateDetails.triggers) ? stateDetails.triggers : []
  };
}

function formatBtcHistoryRow(row: BtcLighthouseLatest & { payload_json: string; created_at: string }) {
  return {
    signal_date: row.signal_date,
    state: row.state,
    state_label: row.state_label,
    suggested_action: row.suggested_action,
    recommended_position: row.recommended_position,
    current_position: row.current_position,
    price: row.price,
    bottom_score: row.bottom_score,
    top_score: row.top_score,
    bottom_groups: row.bottom_groups,
    trigger_summary: row.trigger_summary,
    payload: safeJson(row.payload_json, {}),
    created_at: row.created_at
  };
}

async function fetchBtcSpotTicker(): Promise<BtcRealtimeTicker> {
  const binance = await fetchBinanceBtcSpotTicker();
  if (binance.status === "ok") return binance;

  const coinbase = await fetchCoinbaseBtcSpotTicker();
  if (coinbase.status === "ok") {
    return {
      ...coinbase,
      message: binance.message ? `Binance unavailable: ${binance.message}` : undefined
    };
  }

  return {
    source: "BTC realtime quote",
    symbol: "BTC",
    price: null,
    priceChangePercent: null,
    updatedAt: new Date().toISOString(),
    status: "failed",
    message: `Binance: ${binance.message ?? "failed"}; Coinbase: ${coinbase.message ?? "failed"}`
  };
}

async function fetchBinanceBtcSpotTicker(): Promise<BtcRealtimeTicker> {
  try {
    const response = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", {
      headers: { "User-Agent": "manfu-btc-lighthouse/0.1" }
    });
    if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);
    const json = await response.json() as { symbol?: string; lastPrice?: string; priceChangePercent?: string; closeTime?: number };
    const price = Number(json.lastPrice);
    const priceChangePercent = Number(json.priceChangePercent);
    if (!Number.isFinite(price)) throw new Error("Binance ticker price parse failed");
    return {
      source: "Binance BTCUSDT 实时行情",
      symbol: json.symbol ?? "BTCUSDT",
      price,
      priceChangePercent: Number.isFinite(priceChangePercent) ? priceChangePercent : null,
      updatedAt: Number.isFinite(json.closeTime) ? new Date(Number(json.closeTime)).toISOString() : new Date().toISOString(),
      status: "ok"
    };
  } catch (error) {
    return {
      source: "Binance BTCUSDT 实时行情",
      symbol: "BTCUSDT",
      price: null,
      priceChangePercent: null,
      updatedAt: new Date().toISOString(),
      status: "failed",
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

async function fetchCoinbaseBtcSpotTicker(): Promise<BtcRealtimeTicker> {
  try {
    const [tickerResponse, statsResponse] = await Promise.all([
      fetch("https://api.exchange.coinbase.com/products/BTC-USD/ticker", {
        headers: { "User-Agent": "manfu-btc-lighthouse/0.1" }
      }),
      fetch("https://api.exchange.coinbase.com/products/BTC-USD/stats", {
        headers: { "User-Agent": "manfu-btc-lighthouse/0.1" }
      })
    ]);
    if (!tickerResponse.ok) throw new Error(`Coinbase ticker HTTP ${tickerResponse.status}`);

    const ticker = await tickerResponse.json() as { price?: string; time?: string };
    const price = Number(ticker.price);
    if (!Number.isFinite(price)) throw new Error("Coinbase ticker price parse failed");

    let priceChangePercent: number | null = null;
    if (statsResponse.ok) {
      const stats = await statsResponse.json() as { open?: string };
      const open = Number(stats.open);
      if (Number.isFinite(open) && open > 0) {
        priceChangePercent = ((price - open) / open) * 100;
      }
    }

    return {
      source: "Coinbase BTC-USD 实时行情",
      symbol: "BTC-USD",
      price,
      priceChangePercent,
      updatedAt: ticker.time ? new Date(ticker.time).toISOString() : new Date().toISOString(),
      status: "ok"
    };
  } catch (error) {
    return {
      source: "Coinbase BTC-USD 实时行情",
      symbol: "BTC-USD",
      price: null,
      priceChangePercent: null,
      updatedAt: new Date().toISOString(),
      status: "failed",
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

async function getBtcRealtime(db: D1Database) {
  try {
    const response = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=3", {
      headers: { "User-Agent": "manfu-dashboard/0.1" }
    });
    if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);
    const rows = await response.json() as unknown[][];
    const lastClosed = rows.length >= 2 ? rows[rows.length - 2] : rows[0];
    const open = Number(lastClosed[1]);
    const close = Number(lastClosed[4]);
    const changePct = ((close - open) / open) * 100;
    await db.prepare("INSERT INTO data_fetch_logs (source, status, message) VALUES (?, ?, ?)")
      .bind("binance-btcusdt", "ok", `BTCUSDT daily change ${changePct.toFixed(2)}%`)
      .run();
    return {
      source: "Binance BTCUSDT 日线",
      date: new Date(Number(lastClosed[0])).toISOString().slice(0, 10),
      open,
      close,
      high: Number(lastClosed[2]),
      low: Number(lastClosed[3]),
      changePct,
      triggered: changePct <= -12,
      action: changePct <= -12 ? "已触发：次日开盘 3x 入场，持有 2 天。" : "未触发：等待日线收盘跌幅 <= -12%。",
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await db.prepare("INSERT INTO data_fetch_logs (source, status, message) VALUES (?, ?, ?)")
      .bind("binance-btcusdt", "failed", message)
      .run();
    return { source: "Binance BTCUSDT 日线", error: "实时数据获取失败", message, updatedAt: new Date().toISOString() };
  }
}

async function refreshAutoIndicators(db: D1Database) {
  const tasks = [refreshJisiluTemperature(db), refreshIndexMaBreaks(db)];
  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === "rejected") {
      await logFetch(db, "auto-indicators", "failed", result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  }
}

async function refreshJisiluTemperature(db: D1Database) {
  const response = await fetch("https://www.jisilu.cn/data/indicator/12", {
    headers: { "User-Agent": "Mozilla/5.0 manfu-dashboard/0.1" }
  });
  if (!response.ok) throw new Error(`集思录温度计 HTTP ${response.status}`);
  const html = await response.text();
  const parsed = parseJisiluTemperature(html);
  const text = `${parsed.date} PB温度${parsed.pbTemp.toFixed(2)} 中值${parsed.pbMedian.toFixed(2)}；PE温度${parsed.peTemp.toFixed(2)} 收益率中值${parsed.peYield.toFixed(2)}%；国债收益率${parsed.baseYtm.toFixed(2)}%`;
  await updateIndicatorAuto(db, "jisilu-temp", {
    sourceType: "auto",
    sourceName: "集思录 A股全市场温度计",
    sourceUrl: "https://www.jisilu.cn/data/indicator/12",
    value: parsed.pbTemp,
    text,
    status: thresholdStatus(parsed.pbTemp, 80, 90, "gte"),
    contribution: null,
    thresholdNote: "集思录说明：PB/PE中值基于扣除停牌股、1年内新股、ST等后的全市场中位数；温度为当前中值在历史序列中的百分位。当前以 PB温度 80/90 作为接近/达标阈值。"
  });
  const valuationTemp = Math.max(parsed.pbTemp, parsed.peTemp);
  await updateIndicatorAuto(db, "all-a-pe-pb", {
    sourceType: "auto",
    sourceName: "集思录 A股全市场温度计",
    sourceUrl: "https://www.jisilu.cn/data/indicator/12",
    value: valuationTemp,
    text: `${parsed.date} PB中值${parsed.pbMedian.toFixed(2)}，PB温度${parsed.pbTemp.toFixed(2)}；PE收益率中值${parsed.peYield.toFixed(2)}%，PE温度${parsed.peTemp.toFixed(2)}`,
    status: thresholdStatus(valuationTemp, 80, 90, "gte"),
    contribution: null,
    thresholdNote: "使用集思录全市场 PB温度与 PE温度的较高值作为估值热度代表，80/90 为接近/达标。"
  });
  const spread = parsed.peYield - parsed.baseYtm;
  await updateIndicatorAuto(db, "erp", {
    sourceType: "auto",
    sourceName: "集思录 A股全市场温度计",
    sourceUrl: "https://www.jisilu.cn/data/indicator/12",
    value: spread,
    text: `${parsed.date} PE收益率中值${parsed.peYield.toFixed(2)}% - 国债收益率${parsed.baseYtm.toFixed(2)}% = ${spread.toFixed(2)}%`,
    status: "not_hit",
    contribution: 0,
    thresholdNote: "自动展示股债收益差。该指标方向为越低越危险，正式达标阈值需后续按历史分位校准；当前不贡献顶部评分。"
  });
  await logFetch(db, "jisilu-temperature", "ok", text);
}

async function refreshIndexMaBreaks(db: D1Database) {
  const indexes = [
    { name: "上证指数", symbol: "sh000001" },
    { name: "沪深300", symbol: "sh000300" },
    { name: "中证500", symbol: "sh000905" },
    { name: "创业板指", symbol: "sz399006" }
  ];
  const rows = await Promise.all(indexes.map(async (item) => {
    const url = `https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=${item.symbol},day,,,80`;
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 manfu-dashboard/0.1" } });
    if (!response.ok) throw new Error(`腾讯证券 K线 HTTP ${response.status}`);
    const json = await response.json() as { data?: Record<string, { day?: string[][] }> };
    const klines = json.data?.[item.symbol]?.day ?? [];
    if (klines.length < 60) throw new Error(`${item.name} K线不足 60 条`);
    const closes = klines.map((line) => Number(line[2]));
    const close = closes.at(-1) ?? 0;
    const ma20 = average(closes.slice(-20));
    const ma60 = average(closes.slice(-60));
    return { ...item, date: klines.at(-1)?.[0] ?? "", close, ma20, ma60, below20: close < ma20, below60: close < ma60 };
  }));
  const below20 = rows.filter((item) => item.below20).length;
  const below60 = rows.filter((item) => item.below60).length;
  const status = below20 >= 3 || below60 >= 2 ? "hit" : below20 >= 2 || below60 >= 1 ? "near" : "not_hit";
  const text = `${rows[0]?.date ?? ""} MA20下方${below20}/4，MA60下方${below60}/4；${rows.map((item) => `${item.name}${item.below20 ? "破MA20" : "在MA20上"}${item.below60 ? "/破MA60" : ""}`).join("，")}`;
  await updateIndicatorAuto(db, "ma-breaks", {
    sourceType: "auto",
    sourceName: "腾讯证券指数日 K 线",
    sourceUrl: "https://gu.qq.com/",
    value: below20,
    text,
    status,
    contribution: null,
    thresholdNote: "自动跟踪上证指数、沪深300、中证500、创业板指：2 个指数跌破 MA20 或 1 个跌破 MA60 为接近，3 个跌破 MA20 或 2 个跌破 MA60 为达标。"
  });
  await logFetch(db, "tencent-index-ma", "ok", text);
}

function parseJisiluTemperature(html: string) {
  const dates = parseStringArray(html, "__date");
  const pbMedian = last(parseNumberArray(html, "median_PB"));
  const pbTemp = last(parseNumberArray(html, "median_PB_t"));
  const peYield = last(parseNumberArray(html, "median_PE"));
  const peTemp = last(parseNumberArray(html, "median_PE_t"));
  const baseYtm = last(parseNumberArray(html, "base_ytm"));
  const date = dates.at(-1);
  if (!date || [pbMedian, pbTemp, peYield, peTemp, baseYtm].some((item) => !Number.isFinite(item))) {
    throw new Error("集思录温度计数据解析失败");
  }
  return { date, pbMedian, pbTemp, peYield, peTemp, baseYtm };
}

function parseNumberArray(html: string, key: string) {
  const match = html.match(new RegExp(`${key}:\\s*\\[([^\\]]+)\\]`));
  if (!match) return [];
  return match[1].split(",").map((item) => Number(item.trim())).filter((item) => Number.isFinite(item));
}

function parseStringArray(html: string, key: string) {
  const match = html.match(new RegExp(`var ${key}\\s*=\\s*\\[([^\\]]+)\\]`));
  if (!match) return [];
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((item) => item[1]);
}

function last(values: number[]) {
  return values[values.length - 1];
}

function average(values: number[]) {
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

async function updateIndicatorAuto(db: D1Database, id: string, data: {
  sourceType: "auto" | "manual" | "pending";
  sourceName: string;
  sourceUrl: string | null;
  value: number | null;
  text: string;
  status: Indicator["status"];
  contribution: number | null;
  thresholdNote: string;
}) {
  const indicator = await db.prepare("SELECT weight FROM indicators WHERE id = ?").bind(id).first<{ weight: number }>();
  if (!indicator) return;
  const contribution = data.contribution ?? statusScore(data.status, Number(indicator.weight));
  await db.prepare(`
    UPDATE indicators SET source_type = ?, source_name = ?, source_url = ?, current_value = ?, current_text = ?,
    status = ?, contribution = ?, threshold_note = ?, last_updated = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(data.sourceType, data.sourceName, data.sourceUrl, data.value, data.text, data.status, contribution, data.thresholdNote, id).run();
}

function thresholdStatus(value: number, near: number, hit: number, direction: "gte" | "lte"): Indicator["status"] {
  if (direction === "gte") {
    if (value >= hit) return "hit";
    if (value >= near) return "near";
    return "not_hit";
  }
  if (value <= hit) return "hit";
  if (value <= near) return "near";
  return "not_hit";
}

async function logFetch(db: D1Database, source: string, status: string, message: string) {
  await db.prepare("INSERT INTO data_fetch_logs (source, status, message) VALUES (?, ?, ?)")
    .bind(source, status, message.slice(0, 500))
    .run();
}

function statusScore(status: string, weight: number) {
  if (status === "hit") return weight;
  if (status === "near") return weight * 0.5;
  return 0;
}

function riskLevel(score: number) {
  if (score <= 30) return "低风险";
  if (score <= 50) return "偏热";
  if (score <= 70) return "高温";
  if (score <= 85) return "顶部风险明显";
  return "极端顶部风险";
}

function requireUser(c: AppContext) {
  const user = c.get("user");
  return user ?? c.json({ error: "请先登录" }, 401);
}

function requireAdmin(c: AppContext) {
  const user = c.get("user");
  if (!user) return c.json({ error: "请先登录" }, 401);
  if (user.role !== "admin") return c.json({ error: "需要管理员权限" }, 403);
  return user;
}

function canIngestFlowLab(c: AppContext) {
  const configuredToken = c.env.FLOW_LAB_INGEST_TOKEN;
  const authorization = c.req.header("Authorization") ?? "";
  if (configuredToken && authorization === `Bearer ${configuredToken}`) return true;
  const hostname = new URL(c.req.url).hostname;
  if ((hostname === "127.0.0.1" || hostname === "localhost") && c.req.header("X-Flow-Lab-Local") === "1") return true;
  return c.get("user")?.role === "admin";
}

function formatFlowLabCandidate(row: Record<string, unknown>) {
  return {
    ...row,
    rank: row.rank === null || row.rank === undefined ? null : Number(row.rank),
    pct_chg: row.pct_chg === null || row.pct_chg === undefined ? null : Number(row.pct_chg),
    appearances: Number(row.appearances ?? 1),
    source_agreement: Boolean(row.source_agreement),
    score_breakdown: safeJson(String(row.score_breakdown_json ?? "{}"), {})
  };
}

function formatFlowLabSnapshot(row: Record<string, unknown>) {
  return { ...row, rows: safeJson(String(row.payload_json ?? "[]"), []) };
}

async function refreshFlowLabQuotes(db: D1Database, candidates: Array<Record<string, unknown>>, forceRefresh = false) {
  const codes = [...new Set(candidates.map((item) => String(item.code ?? "")).filter((code) => /^\d{6}$/.test(code)))];
  if (!codes.length) return [];
  const placeholders = codes.map(() => "?").join(",");
  const { results: cached } = await db.prepare(`SELECT * FROM flow_lab_live_quotes WHERE code IN (${placeholders})`).bind(...codes).all<FlowLabLiveQuote>();
  const cacheByCode = new Map(cached.map((item) => [item.code, item]));
  const staleCodes = codes.filter((code) => forceRefresh || !isFreshFlowLabQuote(cacheByCode.get(code)));
  const fetched = await fetchFlowLabLiveQuotes(staleCodes);
  if (fetched.length) {
    await db.batch(fetched.map((quote) => db.prepare(`
      INSERT INTO flow_lab_live_quotes (code, price, pre_close, pct_chg, quote_time, trade_date, source, status, error, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(code) DO UPDATE SET price = excluded.price, pre_close = excluded.pre_close, pct_chg = excluded.pct_chg,
        quote_time = excluded.quote_time, trade_date = excluded.trade_date, source = excluded.source, status = excluded.status,
        error = excluded.error, updated_at = CURRENT_TIMESTAMP
    `).bind(quote.code, quote.price, quote.pre_close, quote.pct_chg, quote.quote_time, quote.trade_date, quote.source, quote.status, quote.error)));
  }
  const refreshedByCode = new Map([...cached, ...fetched].map((item) => [item.code, item]));
  return candidates.map((candidate) => {
    const quote = refreshedByCode.get(String(candidate.code));
    const risk = flowLabQuoteRisk(String(candidate.board ?? "主板"), quote?.pct_chg ?? null, quote?.status ?? "failed");
    return {
      code: String(candidate.code), price: quote?.price ?? null, pre_close: quote?.pre_close ?? null, pct_chg: quote?.pct_chg ?? null,
      quote_time: quote?.quote_time ?? null, refreshed_at: quote?.updated_at ?? null, trade_date: quote?.trade_date ?? null, source: quote?.source ?? "ths",
      status: quote?.status ?? "failed", error: quote?.error ?? null, score_penalty: risk.penalty, risk: risk.message, blocked: risk.blocked
    };
  });
}

function isFreshFlowLabQuote(quote?: FlowLabLiveQuote) {
  if (!quote) return false;
  const updatedAt = Date.parse(`${quote.updated_at.replace(" ", "T")}Z`);
  return Number.isFinite(updatedAt) && Date.now() - updatedAt < 10_000;
}

async function fetchFlowLabLiveQuotes(codes: string[]) {
  if (!codes.length) return [];
  const tencentQuotes = await fetchTencentFlowLabQuotes(codes);
  const missingCodes = codes.filter((code) => !tencentQuotes.has(code));
  const fallbackQuotes = await mapWithConcurrency(missingCodes, 8, fetchThsLiveQuote);
  return [...tencentQuotes.values(), ...fallbackQuotes];
}

async function fetchTencentFlowLabQuotes(codes: string[]) {
  const result = new Map<string, FlowLabLiveQuote>();
  const entries = codes.map((code) => ({ code, symbol: toTencentSymbol(code) })).filter((entry) => entry.symbol);
  for (let index = 0; index < entries.length; index += 80) {
    const chunk = entries.slice(index, index + 80);
    try {
      const response = await fetch(`https://qt.gtimg.cn/q=${chunk.map((entry) => entry.symbol).join(",")}`, {
        headers: { "User-Agent": "Mozilla/5.0 manfu-dashboard/0.1" }
      });
      if (!response.ok) throw new Error(`Tencent quote HTTP ${response.status}`);
      const text = await response.text();
      const parsed = parseTencentFlowLabQuoteText(text);
      for (const { code, symbol } of chunk) {
        const quote = parsed.get(symbol);
        if (quote) result.set(code, { ...quote, code });
      }
    } catch {
      // Fallback to the THS minute quote below. Do not poison the whole batch when Tencent is temporarily unavailable.
    }
  }
  return result;
}

function parseTencentFlowLabQuoteText(text: string) {
  const result = new Map<string, Omit<FlowLabLiveQuote, "code">>();
  for (const line of text.split(";")) {
    const symbol = line.match(/v_([^=]+)=/)?.[1];
    const fields = line.split("\"")[1]?.split("~") ?? [];
    if (!symbol) continue;
    const price = Number(fields[3]);
    const preClose = Number(fields[4]);
    const pctChg = Number(fields[32]);
    const timeText = String(fields[30] ?? "");
    const quoteTime = timeText.length >= 12
      ? `${timeText.slice(0, 4)}-${timeText.slice(4, 6)}-${timeText.slice(6, 8)} ${timeText.slice(8, 10)}:${timeText.slice(10, 12)}:${timeText.slice(12, 14) || "00"}`
      : null;
    const tradeDate = timeText.length >= 8 ? timeText.slice(0, 8) : null;
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(preClose) || preClose <= 0) continue;
    const status = tradeDate === chinaCompactDate() ? (isAshareTradingTime() ? "live" : "closed") : "stale";
    result.set(symbol, {
      price,
      pre_close: preClose,
      pct_chg: Number.isFinite(pctChg) ? pctChg : ((price - preClose) / preClose) * 100,
      quote_time: quoteTime,
      trade_date: tradeDate,
      source: "tencent",
      status,
      error: null,
      updated_at: new Date().toISOString()
    });
  }
  return result;
}

async function fetchThsLiveQuote(code: string): Promise<FlowLabLiveQuote> {
  const market = code.startsWith("6") ? "hs" : "sz";
  try {
    const response = await fetch(`https://d.10jqka.com.cn/v6/time/${market}_${code}/last.js`, { headers: { Referer: "https://q.10jqka.com.cn/", "User-Agent": "Mozilla/5.0" } });
    if (!response.ok) throw new Error(`同花顺分时请求失败：${response.status}`);
    const text = await response.text();
    const start = text.indexOf("(");
    const end = text.lastIndexOf(")");
    if (start < 0 || end <= start) throw new Error("同花顺分时响应格式变化");
    const payload = JSON.parse(text.slice(start + 1, end));
    const item = payload?.[`${market}_${code}`];
    const bars = String(item?.data ?? "").split(";").filter(Boolean);
    const last = bars.at(-1)?.split(",") ?? [];
    const price = Number(last[1]);
    const preClose = Number(item?.pre);
    if (!Number.isFinite(price) || !Number.isFinite(preClose) || preClose <= 0) throw new Error("同花顺分时价格字段不完整");
    const tradeDate = String(item?.date ?? "");
    const quoteTime = last[0]?.length === 4 ? `${tradeDate.slice(0, 4)}-${tradeDate.slice(4, 6)}-${tradeDate.slice(6, 8)} ${last[0].slice(0, 2)}:${last[0].slice(2)}` : null;
    const status = tradeDate === chinaCompactDate() ? (isAshareTradingTime() ? "live" : "closed") : "stale";
    return { code, price, pre_close: preClose, pct_chg: ((price - preClose) / preClose) * 100, quote_time: quoteTime, trade_date: tradeDate || null, source: "ths", status, error: null, updated_at: new Date().toISOString() };
  } catch (error) {
    return { code, price: null, pre_close: null, pct_chg: null, quote_time: null, trade_date: null, source: "ths", status: "failed", error: error instanceof Error ? error.message : String(error), updated_at: new Date().toISOString() };
  }
}

function flowLabQuoteRisk(board: string, pctChg: number | null, status: string) {
  if (status !== "live" || pctChg === null || pctChg <= 0) return { penalty: 0, blocked: false, message: null };
  const hot = board === "主板" ? 5 : 9;
  const hard = board === "主板" ? 8 : 14;
  if (pctChg >= hard) return { penalty: 30, blocked: true, message: `实时涨幅 ${pctChg.toFixed(2)}% 过高：禁止追高` };
  if (pctChg >= hot) return { penalty: 15, blocked: false, message: `实时涨幅 ${pctChg.toFixed(2)}% 偏高：研究分下调 15 分` };
  return { penalty: 0, blocked: false, message: null };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const output: R[] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await fn(items[index]);
    }
  }));
  return output;
}

function chinaCompactDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now).replaceAll("-", "");
}

function formatFlowLabPaperPosition(row: Record<string, unknown>) {
  return {
    ...row,
    position_weight: Number(row.position_weight ?? 0),
    entry_price: Number(row.entry_price ?? 0),
    exit_price: row.exit_price === null ? null : Number(row.exit_price),
    return_pct: row.return_pct === null ? null : Number(row.return_pct)
  };
}

async function getCurrentUser(db: D1Database, cookieHeader: string) {
  const sessionId = parseCookie(cookieHeader).mf_session;
  if (!sessionId) return null;
  const user = await db.prepare(`
    SELECT users.id, users.email, users.name, users.role, users.disabled
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ? AND sessions.expires_at > CURRENT_TIMESTAMP AND users.disabled = 0
  `).bind(sessionId).first<User>();
  return user ?? null;
}

function publicUser(user: User) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const iterations = 100000;
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  return `pbkdf2$${iterations}$${base64(salt)}$${base64(new Uint8Array(bits))}`;
}

async function verifyPassword(password: string, stored: string) {
  const [kind, iterationsText, saltText, hashText] = stored.split("$");
  if (kind !== "pbkdf2") return false;
  const salt = fromBase64(saltText);
  const expected = fromBase64(hashText);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: Number(iterationsText), hash: "SHA-256" }, key, 256);
  return timingSafeEqual(expected, new Uint8Array(bits));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a[i] ^ b[i];
  return out === 0;
}

function base64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function parseCookie(header: string) {
  return Object.fromEntries(header.split(";").map((part) => part.trim().split("=")).filter((item) => item.length === 2));
}

function setCookie(c: AppContext, name: string, value: string, expiresAt: string) {
  const secure = new URL(c.req.url).protocol === "https:" ? " Secure;" : "";
  c.header("Set-Cookie", `${name}=${value}; HttpOnly;${secure} SameSite=Lax; Path=/; Expires=${new Date(expiresAt).toUTCString()}`);
}

function safeJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
