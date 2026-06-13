import { Context, Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

type Env = {
  DB: D1Database;
  APP_NAME?: string;
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

const app = new Hono<{ Bindings: Env; Variables: { user: User | null } }>().basePath("/api");
type AppContext = Context<{ Bindings: Env; Variables: { user: User | null } }>;

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

app.get("/foundation", async (c) => {
  const user = requireUser(c);
  if (user instanceof Response) return user;
  const settings = await getFoundationSettings(c.env.DB);
  const assets = await listFoundationAssets(c.env.DB, true);
  return c.json({ settings, assets: assets.map((asset) => formatFoundationAsset(asset)) });
});

app.post("/foundation/prices", async (c) => {
  const user = requireUser(c);
  if (user instanceof Response) return user;
  await refreshFoundationPrices(c.env.DB);
  const settings = await getFoundationSettings(c.env.DB);
  const assets = await listFoundationAssets(c.env.DB, true);
  return c.json({ settings, assets: assets.map((asset) => formatFoundationAsset(asset)) });
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
  zValidator("json", z.object({ refresh_seconds: z.number().int().min(5).max(3600) })),
  async (c) => {
    const admin = requireAdmin(c);
    if (admin instanceof Response) return admin;
    const { refresh_seconds } = c.req.valid("json");
    await c.env.DB.prepare("INSERT INTO foundation_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP")
      .bind("refresh_seconds", String(refresh_seconds))
      .run();
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
    db.prepare("INSERT OR IGNORE INTO foundation_settings (key, value) VALUES ('refresh_seconds', '15')")
  ]);
}

async function getFoundationSettings(db: D1Database) {
  const { results } = await db.prepare("SELECT key, value FROM foundation_settings").all<{ key: string; value: string }>();
  const map = Object.fromEntries(results.map((item) => [item.key, item.value]));
  return { refresh_seconds: Math.max(5, Number(map.refresh_seconds ?? 15) || 15) };
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
  const levels = {
    no_chase: rangeText(asset.no_chase_min, null, "≥"),
    observe: rangeText(asset.observe_min, asset.observe_max),
    reasonable: rangeText(asset.reasonable_min, asset.reasonable_max),
    safe: rangeText(asset.safe_min, asset.safe_max),
    bargain: rangeText(asset.bargain_min, asset.bargain_max),
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
    style_tag: inferAssetStyle(asset, analysisJson),
    levels,
    hit_fields: hits
  };
  return includeAnalysis ? { ...base, raw: asset, analysis_markdown: asset.analysis_markdown, analysis_json: analysisJson } : base;
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

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

async function refreshFoundationPrices(db: D1Database) {
  const assets = await listFoundationAssets(db, true);
  await Promise.allSettled(assets.map(async (asset) => {
    const quote = await fetchFoundationQuote(asset);
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
  }));
}

async function fetchFoundationQuote(asset: FoundationAsset): Promise<{ ok: true; price: number; source: string } | { ok: false; error: string }> {
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

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(value >= 1000 ? 0 : 2).replace(/\.?0+$/g, "");
}

function hitRange(key: string, price: number, min: number | null, max: number | null) {
  if (min === null || max === null) return null;
  return price >= min && price <= max ? key : null;
}

function hitAbove(key: string, price: number, min: number | null) {
  return min !== null && price >= min ? key : null;
}

function hitBelow(key: string, price: number, max: number | null) {
  return max !== null && price <= max ? key : null;
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
