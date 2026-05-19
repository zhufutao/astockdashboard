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

const app = new Hono<{ Bindings: Env; Variables: { user: User | null } }>().basePath("/api");
type AppContext = Context<{ Bindings: Env; Variables: { user: User | null } }>;

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

app.get("/admin/indicators", async (c) => {
  const admin = requireAdmin(c);
  if (admin instanceof Response) return admin;
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
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, key, 256);
  return `pbkdf2$120000$${base64(salt)}$${base64(new Uint8Array(bits))}`;
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
  c.header("Set-Cookie", `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=${new Date(expiresAt).toUTCString()}`);
}

function safeJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
