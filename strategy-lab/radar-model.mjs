export function buildRadarCandidate(row, membership) {
  return {
    code: row.code,
    name: row.cells[2] || row.code,
    board: boardFor(row.code),
    rank: row.rank,
    score: 0,
    status: "watch",
    source_agreement: true,
    price: positiveNumber(row.cells[3]),
    pct_chg: percent(row.cells[4]),
    industry: membership?.industry ?? null,
    concept_cluster: conceptText(membership?.concepts_json),
    score_breakdown: {},
    reason: "同花顺主力净流入额前 50"
  };
}

export function boardFor(code) {
  return code.startsWith("688") ? "科创板" : code.startsWith("30") ? "创业板" : code.startsWith("8") || code.startsWith("4") ? "北交所" : "主板";
}

export function priceRisk(board, pct) {
  if (pct === null || pct === undefined || pct <= 0) return null;
  const mainBoard = board === "主板";
  const warning = mainBoard ? 5 : 9;
  const highRisk = mainBoard ? 8 : 14;
  if (pct >= highRisk) return "high";
  if (pct >= warning) return "warning";
  return null;
}

function positiveNumber(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function percent(value) {
  const parsed = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function conceptText(value) {
  try {
    return JSON.parse(value ?? "[]").map((item) => typeof item === "string" ? item : item.name).filter(Boolean).slice(0, 3).join(" / ") || null;
  } catch {
    return null;
  }
}
