/** 同花顺公开分时数据：用于纸面 VWAP 与 T+1 结算。 */
export async function fetchThsMinuteBars(code, tradingDate = chinaTradingDate()) {
  const market = code.startsWith("6") ? "hs" : "sz";
  const response = await fetch(`https://d.10jqka.com.cn/v6/time/${market}_${code}/last.js`, {
    headers: { Referer: "https://q.10jqka.com.cn/", "User-Agent": "Mozilla/5.0" }
  });
  if (!response.ok) throw new Error(`同花顺分时请求失败：${response.status}`);
  const text = await response.text();
  const payload = parseCallbackPayload(text);
  const data = payload?.[`${market}_${code}`];
  if (!data?.data || !data?.date) throw new Error("同花顺分时数据字段不完整");
  const bars = String(data.data).split(";").map((line) => parseMinuteBar(line, data.date)).filter((item) => item.close > 0 && item.volume > 0 && item.turnover > 0);
  if (!bars.length) throw new Error("同花顺分时没有可用成交数据");
  return { code, market, trading_date: String(data.date), requested_date: tradingDate, bars };
}

export async function fetchThsVwap(code, tradingDate = chinaTradingDate()) {
  const minute = await fetchThsMinuteBars(code, tradingDate);
  const totals = minute.bars.reduce((sum, bar) => ({ shares: sum.shares + bar.volume, turnover: sum.turnover + bar.turnover }), { shares: 0, turnover: 0 });
  if (!totals.shares) throw new Error("同花顺分时没有可用成交量");
  return {
    code,
    bars: minute.bars.length,
    vwap: totals.turnover / totals.shares,
    last_bar: minute.bars.at(-1),
    minute_bars: minute.bars
  };
}

export function minuteBarAtOrAfter(bars, slot) {
  return bars.find((bar) => bar.time.slice(11, 16) >= slot) ?? null;
}

function parseCallbackPayload(text) {
  const start = text.indexOf("(");
  const end = text.lastIndexOf(")");
  if (start < 0 || end <= start) throw new Error("同花顺分时响应格式变化");
  return JSON.parse(text.slice(start + 1, end));
}

function parseMinuteBar(line, date) {
  const [clock, close, turnover, average, volume] = String(line).split(",");
  const normalizedClock = clock.length === 4 ? `${clock.slice(0, 2)}:${clock.slice(2)}` : clock;
  return {
    time: `${String(date).slice(0, 4)}-${String(date).slice(4, 6)}-${String(date).slice(6, 8)} ${normalizedClock}`,
    close: Number(close),
    turnover: Number(turnover),
    average: Number(average),
    volume: Number(volume)
  };
}

function chinaTradingDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replaceAll("-", "");
}
