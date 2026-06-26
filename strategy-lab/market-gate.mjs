/** 同花顺 A 股市场页的涨跌家数与大盘评级，只在页面同源浏览器上下文中读取。 */
export async function collectThsMarketGate(page, capturedAt = new Date()) {
  await page.goto("https://q.10jqka.com.cn/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1_500);
  const market = await readRenderedMarket(page) ?? await readIndexFlash(page);
  const fresh = isTradingWindow(capturedAt) && market.rise + market.fall > 0;
  const state = fresh ? evaluateMarketState(market) : "unknown";
  return {
    id: `market:${capturedAt.toISOString().replace(/[:.]/g, "-")}`,
    source: "ths",
    dataset: "market",
    captured_at: capturedAt.toISOString(),
    status: "ok",
    rows: [
      { rank: 1, code: "market-rise", cells: ["上涨家数", String(market.rise)] },
      { rank: 2, code: "market-fall", cells: ["下跌家数", String(market.fall)] },
      { rank: 3, code: "market-rating", cells: ["大盘评级", market.rating.toFixed(1)] },
      { rank: 4, code: "market-limit-up", cells: ["涨停家数", String(market.limitUp)] },
      { rank: 5, code: "market-limit-down", cells: ["跌停家数", String(market.limitDown)] }
    ],
    gate: { state, fresh, ...market }
  };
}

async function readIndexFlash(page) {
  try {
    const response = await page.evaluate(async () => {
      const result = await fetch("/api.php?t=indexflash", { credentials: "same-origin" });
      return { ok: result.ok, status: result.status, text: await result.text() };
    });
    if (!response.ok) throw new Error(`同花顺市场接口失败：${response.status}`);
    return parseIndexFlash(response.text);
  } catch {
    return { rise: 0, fall: 0, rating: 0, limitUp: 0, limitDown: 0 };
  }
}

async function readRenderedMarket(page) {
  const values = await page.evaluate(() => ({
    details: [...document.querySelectorAll(".hcharts-list .detail")].map((item) => item.textContent?.replace(/\s+/g, " ").trim() ?? ""),
    rating: document.querySelector("#dppj .data-label strong")?.textContent?.trim() ?? ""
  }));
  const breadth = values.details[0]?.match(/上涨：\s*(\d+)只\s*下跌：\s*(\d+)只/);
  const limits = values.details[1]?.match(/涨停：\s*(\d+)只\s*跌停：\s*(\d+)只/);
  const rating = Number(values.rating);
  if (!breadth || !Number.isFinite(rating) || rating <= 0) return null;
  return { rise: Number(breadth[1]), fall: Number(breadth[2]), rating, limitUp: Number(limits?.[1] ?? 0), limitDown: Number(limits?.[2] ?? 0) };
}

export function evaluateMarketState(market) {
  const breadth = market.rise / Math.max(1, market.fall);
  if (market.rating < 4 || breadth < 0.65 || market.limitDown > market.limitUp) return "red";
  if (market.rating < 6 || breadth < 1) return "amber";
  return "green";
}

export function parseIndexFlash(text) {
  const normalized = String(text).trim().replace(/^\(/, "").replace(/\);?$/, "");
  let payload;
  try { payload = JSON.parse(normalized); } catch { throw new Error("同花顺市场接口响应格式变化"); }
  const breadth = payload?.zdfb_data;
  const lastLimit = payload?.zdt_data?.last_zdt ?? {};
  const rise = Number(breadth?.znum);
  const fall = Number(breadth?.dnum);
  const rating = Number(payload?.dppj_data);
  const limitUp = Number(lastLimit?.ztzs ?? 0);
  const limitDown = Number(lastLimit?.dtzs ?? 0);
  if (![rise, fall, rating].every(Number.isFinite)) throw new Error("同花顺市场数据字段不完整");
  return { rise, fall, rating, limitUp: Number.isFinite(limitUp) ? limitUp : 0, limitDown: Number.isFinite(limitDown) ? limitDown : 0 };
}

function isTradingWindow(date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const day = parts.find((item) => item.type === "weekday")?.value;
  const value = Number(parts.find((item) => item.type === "hour")?.value ?? 0) * 100 + Number(parts.find((item) => item.type === "minute")?.value ?? 0);
  return !["Sat", "Sun"].includes(day ?? "") && ((value >= 930 && value <= 1130) || (value >= 1300 && value <= 1500));
}
