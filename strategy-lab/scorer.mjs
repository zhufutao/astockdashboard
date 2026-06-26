import { clusterConcept } from "./membership-mapper.mjs";
import { fetchThsVwap } from "./vwap.mjs";

const topSectorRank = 15;
const maxMinuteLookups = 20;

export async function scoreCandidates(db, snapshots, options = {}) {
  const capturedAt = options.capturedAt ?? new Date();
  const marketState = options.marketState ?? "unknown";
  const fetchMinute = options.fetchMinute ?? fetchThsVwap;
  const byKey = new Map(snapshots.map((item) => [`${item.source}:${item.dataset}`, item]));
  const thsComplete = ["individual", "industry", "concept"].every((dataset) => {
    const snapshot = byKey.get(`ths:${dataset}`);
    return snapshot?.status === "ok" && snapshot.rows.length >= 50;
  });
  const stocks = new Map();
  addIndividualRows(stocks, byKey.get("ths:individual")?.rows ?? []);
  const strongIndustries = strongSectorSet(byKey, "industry");
  const strongConcepts = strongSectorSet(byKey, "concept");
  const memberships = readMemberships(db);
  const previous = previousSnapshot(db, capturedAt);
  const base = [...stocks.entries()].map(([code, stock]) => buildBaseCandidate({ code, stock, memberships, strongIndustries, strongConcepts, thsComplete, previous }))
    .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
  const minuteCandidates = base.filter((item) => item.preliminary).slice(0, maxMinuteLookups);
  const factors = await fetchMinuteFactors(minuteCandidates, capturedAt, fetchMinute);
  return base.map((item) => finalizeCandidate(item, factors.get(item.code), { capturedAt, marketState })).slice(0, 50);
}

function buildBaseCandidate({ code, stock, memberships, strongIndustries, strongConcepts, thsComplete, previous }) {
  const membership = memberships.get(code);
  const concepts = safeJson(membership?.concepts_json, []).map((item) => typeof item === "string" ? item : item.name).filter(Boolean);
  const clusters = safeJson(membership?.clusters_json, concepts.map(clusterConcept)).filter(Boolean);
  const industryHit = Boolean(membership?.industry && strongIndustries.has(membership.industry));
  const matchedClusters = [...new Set(clusters.filter((cluster) => strongConcepts.has(cluster)))];
  const rankScore = ((51 - stock.rank) / 50) * 20;
  const netScore = stock.net > 0 ? 20 : 0;
  const sectorScore = (industryHit ? 15 : 0) + Math.min(20, matchedClusters.length * 10);
  const raw = (thsComplete ? 25 : 0) + rankScore + netScore + sectorScore;
  const heat = priceHeat(boardFor(code), stock.pct);
  const score = Math.max(0, Math.round(Math.min(100, raw / 80 * 100) - heat.penalty));
  const acceleration = accelerationFor(stock, previous);
  return {
    code,
    name: stock.name,
    board: boardFor(code),
    stock,
    score,
    membership,
    industryHit,
    conceptHits: matchedClusters.length,
    conceptCluster: matchedClusters.join(" / ") || null,
    heat,
    thsComplete,
    acceleration,
    preliminary: score >= 65 && thsComplete && membership && industryHit && matchedClusters.length >= 1,
    score_breakdown: {
      ths_data_complete: thsComplete ? 25 : 0,
      rank_strength: round(rankScore),
      net_positive: netScore,
      sector_resonance: sectorScore,
      five_minute_acceleration: acceleration.ready ? 10 : 0,
      price_extension: -heat.penalty
    }
  };
}

function finalizeCandidate(item, factor, context) {
  const missing = [
    !item.thsComplete && "同花顺榜单不完整",
    !item.membership && "归属映射缺失",
    !item.industryHit && "行业榜未共振",
    item.conceptHits < 1 && "概念榜未共振",
    !item.acceleration.ready && item.acceleration.message,
    !factor?.ready && (factor?.message ?? "同花顺分钟 VWAP 未就绪")
  ].filter(Boolean);
  const risks = [
    context.marketState === "unknown" && "大盘闸门未就绪",
    context.marketState === "amber" && "大盘闸门黄灯：继续观察",
    context.marketState === "red" && "大盘闸门红灯：禁止模拟入场",
    item.heat.message,
    factor?.overextended && `高于 VWAP ${(factor.deviationPct * 100).toFixed(2)}%，避免追高`
  ].filter(Boolean);
  const inEntryWindow = isEntryWindow(context.capturedAt);
  const canPaperEntry = item.preliminary && item.acceleration.ready && factor?.ready && !factor.overextended && !item.heat.blocked && context.marketState === "green" && inEntryWindow;
  const baseWatched = item.score >= 65 && item.thsComplete && item.membership;
  const hardBlock = !item.thsComplete || !item.membership || context.marketState === "red";
  const status = canPaperEntry ? "paper_entry" : hardBlock ? "blocked" : baseWatched ? "watch" : "blocked";
  const currentPrice = factor?.lastPrice ?? item.stock.price ?? null;
  const state = canPaperEntry ? "符合纸面入场" : !inEntryWindow ? "等待 09:50 入场窗口" : status === "blocked" ? "已阻断" : "继续观察";
  return {
    code: item.code,
    name: item.name,
    board: item.board,
    score: item.score,
    status,
    source_agreement: item.thsComplete,
    price: currentPrice,
    vwap: factor?.vwap ?? null,
    industry: item.membership?.industry ?? null,
    concept_cluster: item.conceptCluster,
    score_breakdown: { ...item.score_breakdown, market_gate: context.marketState === "green" ? 5 : 0, vwap_position: factor?.ready && !factor.overextended ? 5 : 0 },
    reason: `${state}；同花顺净流入榜；行业${item.industryHit ? "共振" : "未共振"}；概念簇命中 ${item.conceptHits} 个；${[...missing, ...risks].filter(Boolean).join("、") || "证据完整"}`,
    ...(canPaperEntry ? { paper_entry: { at: toShanghaiIso(factor.lastTime), price: factor.lastPrice, position_weight: item.board === "主板" ? 0.08 : 0.05, exit_slots: ["09:30", "09:35", "09:45", "10:00"] } } : {})
  };
}

async function fetchMinuteFactors(candidates, capturedAt, fetchMinute) {
  const output = new Map();
  await Promise.all(candidates.map(async (item) => {
    try {
      const result = await fetchMinute(item.code, chinaDate(capturedAt));
      const last = result.last_bar;
      if (!last?.close || !result.vwap) throw new Error("同花顺分钟字段不完整");
      const deviationPct = (last.close - result.vwap) / result.vwap;
      output.set(item.code, { ready: sameChinaDate(last.time, capturedAt), lastPrice: last.close, lastTime: last.time, vwap: result.vwap, deviationPct, overextended: deviationPct > 0.025, message: sameChinaDate(last.time, capturedAt) ? null : "同花顺分钟数据日期过期" });
    } catch (error) { output.set(item.code, { ready: false, message: error instanceof Error ? error.message : String(error) }); }
  }));
  return output;
}

function previousSnapshot(db, capturedAt) {
  try {
    const row = db.prepare(`SELECT captured_at, payload_json FROM raw_snapshots WHERE source = 'ths' AND dataset = 'individual' AND status = 'ok' AND captured_at < ? ORDER BY captured_at DESC LIMIT 1`).get(capturedAt.toISOString());
    if (!row) return new Map();
    const delta = Date.parse(capturedAt) - Date.parse(row.captured_at);
    if (delta < 180_000 || delta > 720_000 || chinaDate(new Date(row.captured_at)) !== chinaDate(capturedAt)) return new Map();
    return new Map(safeJson(row.payload_json, []).map(parseThsIndividual).filter((item) => item?.code).map((item) => [item.code, item]));
  } catch { return new Map(); }
}

function accelerationFor(stock, previous) {
  const prior = previous.get(stock.code);
  if (!prior) return { ready: false, message: "等待上一轮 5 分钟快照" };
  const delta = stock.net - prior.net;
  const rankImprovement = prior.rank - stock.rank;
  return { ready: delta > 0 && (rankImprovement >= 0 || stock.rank <= 10), delta, rankImprovement, message: "5 分钟资金未同步加速" };
}

function readMemberships(db) { try { return new Map(db.prepare("SELECT code, industry, concepts_json, clusters_json FROM candidate_memberships").all().map((item) => [item.code, item])); } catch { return new Map(); } }
function addIndividualRows(stocks, rows) { for (const row of rows) { const parsed = parseThsIndividual(row); if (parsed?.code) stocks.set(parsed.code, parsed); } }
function parseThsIndividual(row) { const cells = row.cells; return { code: row.code, name: cells[2], rank: row.rank, price: number(cells[3]), pct: percent(cells[4]), net: money(cells[8]) }; }
function strongSectorSet(byKey, dataset) { const rows = byKey.get(`ths:${dataset}`)?.rows ?? []; return new Set(rows.slice(0, topSectorRank).filter((row) => money(row.cells[6]) > 0).map((row) => dataset === "concept" ? clusterConcept(row.cells[1] ?? "") : row.cells[1]).filter(Boolean)); }
function number(value) { const parsed = Number(String(value ?? "").replace(/,/g, "")); return Number.isFinite(parsed) ? parsed : null; }
function percent(value) { const parsed = Number(String(value ?? "").replace("%", "")); return Number.isFinite(parsed) ? parsed / 100 : null; }
function money(value) { const text = String(value ?? "").replace(/,/g, ""); const parsed = Number(text.replace(/[亿万%]/g, "")); if (!Number.isFinite(parsed)) return 0; return text.includes("亿") ? parsed * 100_000_000 : text.includes("万") ? parsed * 10_000 : parsed; }
function boardFor(code) { return code.startsWith("688") ? "科创板" : code.startsWith("30") ? "创业板" : code.startsWith("8") || code.startsWith("4") ? "北交所" : "主板"; }
export function priceHeat(board, pct) {
  if (pct === null || pct === undefined || pct <= 0) return { penalty: 0, blocked: false, message: null };
  const hot = board === "主板" ? 0.05 : 0.09;
  const hard = board === "主板" ? 0.08 : 0.14;
  if (pct >= hard) return { penalty: 30, blocked: true, message: `当日涨幅 ${(pct * 100).toFixed(2)}% 过高：禁止追高` };
  if (pct >= hot) return { penalty: 15, blocked: false, message: `当日涨幅 ${(pct * 100).toFixed(2)}% 偏高：研究分下调 15 分` };
  return { penalty: 0, blocked: false, message: null };
}
function safeJson(value, fallback) { try { return JSON.parse(value ?? ""); } catch { return fallback; } }
function round(value) { return Math.round(value * 10) / 10; }
function chinaDate(date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date(date)).replaceAll("-", ""); }
function sameChinaDate(value, date) { return String(value ?? "").slice(0, 10).replaceAll("-", "") === chinaDate(date); }
function isEntryWindow(date) { const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date); const value = Number(parts.find((item) => item.type === "hour")?.value ?? 0) * 100 + Number(parts.find((item) => item.type === "minute")?.value ?? 0); return value >= 950 && value < 955; }
function toShanghaiIso(value) { return `${String(value).replace(" ", "T")}:00+08:00`; }
