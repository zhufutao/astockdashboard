#!/usr/bin/env node
/**
 * 早盘资金榜雷达：仅记录同花顺「个股资金流」按主力净流入额降序的前 50 条。
 * 行业、概念是上榜个股的低频归属映射，不参与本轮榜单筛选。
 */
import { DatabaseSync } from "node:sqlite";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { enrichCandidateMemberships } from "./membership-mapper.mjs";
import { buildRadarCandidate } from "./radar-model.mjs";

const root = process.cwd();
const dataDir = join(root, "local-data", "flow-lab");
const maxRows = 50;
const retentionDays = clampRetentionDays(process.env.FLOW_LAB_RETENTION_DAYS);
const now = new Date();
const runId = `flow-${now.toISOString().replace(/[:.]/g, "-")}`;

mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(join(dataDir, "flow-lab.sqlite"));
db.exec(`
  CREATE TABLE IF NOT EXISTS raw_snapshots (
    id TEXT PRIMARY KEY, captured_at TEXT NOT NULL, source TEXT NOT NULL, dataset TEXT NOT NULL,
    row_count INTEGER NOT NULL, status TEXT NOT NULL, payload_json TEXT NOT NULL, error TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_raw_snapshots_time ON raw_snapshots(captured_at DESC);
  CREATE TABLE IF NOT EXISTS maintenance_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

if (!isMorningCollectionWindow(now) && !process.argv.includes("--force")) {
  db.close();
  console.log(JSON.stringify({ status: "skipped", reason: "采集时间仅限交易日 09:30–10:30；盘外测试请显式传入 --force" }, null, 2));
  process.exit(0);
}

const snapshot = await collectIndividualLeaderboard();
persist(snapshot);

const membership = snapshot.status === "ok"
  ? await enrichCandidateMemberships(db, [snapshot]).catch((error) => ({ status: "failed", message: error instanceof Error ? error.message : String(error) }))
  : { status: "skipped", message: "个股榜采集失败，未更新归属映射" };
const candidates = snapshot.status === "ok" ? buildRadarCandidates(db, snapshot.rows) : [];
const tradeDate = chinaDate(now);
const summary = {
  id: runId,
  captured_at: now.toISOString(),
  trade_date: tradeDate,
  status: snapshot.status === "ok" ? "ok" : "failed",
  snapshots: 1,
  rows: snapshot.rows.length,
  failed: snapshot.status === "ok" ? [] : ["ths/individual"],
  source_mode: "ths_individual_radar",
  membership,
  candidate_count: candidates.length
};

appendFileSync(join(dataDir, `${tradeDate}.jsonl`), `${JSON.stringify({ summary, snapshots: [snapshot] })}\n`, "utf8");
await uploadToManfu(summary, snapshot, candidates);
summary.cleanup = await cleanupOncePerTradeDay(tradeDate);
summary.local_cleanup = pruneLocalSnapshots();
db.close();
console.log(JSON.stringify(summary, null, 2));

async function collectIndividualLeaderboard() {
  const url = "https://data.10jqka.com.cn/funds/ggzjl/field/zjjlr/order/DESC/page/1/";
  try {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!response.ok) throw new Error(`同花顺个股资金榜请求失败：${response.status}`);
    const html = new TextDecoder("gb18030").decode(await response.arrayBuffer());
    const tbody = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] ?? "";
    const rows = [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map((match) => [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cleanHtmlCell(cell[1])))
      .filter((cells) => cells.length >= 9)
      .slice(0, maxRows)
      .map((cells, index) => ({ rank: index + 1, code: findCode(cells.join(" ")), cells }));
    if (rows.length < maxRows) throw new Error("同花顺个股资金榜不足 50 条，本轮不计入上榜次数");
    return { id: `${runId}:ths:individual`, source: "ths", dataset: "individual", captured_at: now.toISOString(), status: "ok", rows };
  } catch (error) {
    return { id: `${runId}:ths:individual`, source: "ths", dataset: "individual", captured_at: now.toISOString(), status: "failed", rows: [], error: error instanceof Error ? error.message : String(error) };
  }
}

function buildRadarCandidates(database, rows) {
  const memberships = new Map(database.prepare("SELECT code, industry, concepts_json FROM candidate_memberships").all().map((item) => [item.code, item]));
  return rows.filter((row) => row.code).map((row) => buildRadarCandidate(row, memberships.get(row.code)));
}

function persist(result) {
  db.prepare(`INSERT OR REPLACE INTO raw_snapshots (id, captured_at, source, dataset, row_count, status, payload_json, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(result.id, result.captured_at, result.source, result.dataset, result.rows.length, result.status, JSON.stringify(result.rows), result.error ?? null);
}

async function uploadToManfu(summary, snapshot, candidates) {
  const baseUrl = process.env.FLOW_LAB_API_URL?.replace(/\/$/, "");
  const token = process.env.FLOW_LAB_INGEST_TOKEN;
  if (!baseUrl || !token) return;
  const response = await fetch(`${baseUrl}/api/flow-lab/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Flow-Lab-Local": "1" },
    body: JSON.stringify({
      id: summary.id,
      captured_at: summary.captured_at,
      trade_date: summary.trade_date,
      strategy_version: "v3-ths-radar",
      market_state: "unknown",
      data_status: summary.status,
      snapshot_count: 1,
      summary,
      candidates,
      snapshots: [{ id: snapshot.id, source: snapshot.source, dataset: snapshot.dataset, captured_at: snapshot.captured_at, status: snapshot.status, rows: snapshot.rows, error: snapshot.error ?? null }]
    })
  });
  if (!response.ok) throw new Error(`慢富资金榜雷达上传失败：${response.status} ${await response.text()}`);
}

async function cleanupOncePerTradeDay(tradeDate) {
  const key = "remote_cleanup_trade_date";
  const done = db.prepare("SELECT value FROM maintenance_state WHERE key = ?").get(key);
  if (done?.value === tradeDate) return { status: "skipped", reason: "今日已清理" };
  const baseUrl = process.env.FLOW_LAB_API_URL?.replace(/\/$/, "");
  const token = process.env.FLOW_LAB_INGEST_TOKEN;
  if (!baseUrl || !token) return { status: "skipped", reason: "未配置线上上传凭据" };
  const response = await fetch(`${baseUrl}/api/flow-lab/cleanup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Flow-Lab-Local": "1" },
    body: JSON.stringify({ keep_trade_days: retentionDays })
  });
  if (!response.ok) throw new Error(`慢富资金榜历史清理失败：${response.status} ${await response.text()}`);
  const result = await response.json();
  db.prepare("INSERT INTO maintenance_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, tradeDate);
  return { status: "ok", ...result };
}

function pruneLocalSnapshots() {
  const dates = db.prepare("SELECT DISTINCT date(captured_at, '+8 hours') AS trade_date FROM raw_snapshots ORDER BY trade_date DESC LIMIT ?").all(retentionDays);
  if (dates.length < retentionDays) return { status: "skipped", available_trade_days: dates.length };
  const cutoff = dates.at(-1)?.trade_date;
  const result = db.prepare("DELETE FROM raw_snapshots WHERE date(captured_at, '+8 hours') < ?").run(cutoff);
  return { status: "ok", cutoff_trade_date: cutoff, deleted: result.changes };
}

function findCode(text) { return text.match(/(?:^|\D)([0368]\d{5})(?:\D|$)/)?.[1] ?? null; }
function cleanHtmlCell(value) { return value.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(); }
function chinaDate(date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(date); }
function clampRetentionDays(value) { const parsed = Number(value); return Number.isInteger(parsed) ? Math.max(3, Math.min(60, parsed)) : 10; }
function isMorningCollectionWindow(date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const day = parts.find((item) => item.type === "weekday")?.value;
  const time = Number(parts.find((item) => item.type === "hour")?.value ?? 0) * 100 + Number(parts.find((item) => item.type === "minute")?.value ?? 0);
  return !["Sat", "Sun"].includes(day ?? "") && time >= 930 && time <= 1030;
}
