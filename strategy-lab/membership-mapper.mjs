/**
 * Candidate-only stock -> industry/concept mapper.
 * Uses THS basic pages for Shenwan industry + concept affinity. Results are cached locally;
 * membership is a slow-changing reference dataset, never a five-minute fetch.
 */
const cacheDays = 30;

export async function enrichCandidateMemberships(db, snapshots) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS candidate_memberships (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT,
      concepts_json TEXT NOT NULL DEFAULT '[]',
      clusters_json TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
  `);
  const codes = [...new Map(snapshots
    .filter((item) => item.dataset === "individual")
    .flatMap((item) => item.rows)
    .filter((row) => row.code)
    .map((row) => [row.code, row.cells[2] ?? ""]))].slice(0, 100);
  if (!codes.length) return { status: "skipped", message: "本轮没有可映射的个股" };

  const token = process.env.TUSHARE_TOKEN;
  const staleBefore = Date.now() - cacheDays * 86400_000;
  let refreshed = 0;
  for (const [code, name] of codes) {
    const cached = db.prepare("SELECT fetched_at FROM candidate_memberships WHERE code = ?").get(code);
    if (cached && Date.parse(cached.fetched_at) > staleBefore) continue;
    const ths = await fetchThsMembership(code);
    const fallbackIndustry = !ths.industry && token ? await fetchTushareIndustry(token, code) : null;
    const industry = ths.industry || fallbackIndustry;
    const conceptNames = ths.concepts.map((item) => item.name);
    const clusters = [...new Set(conceptNames.map(clusterConcept).filter(Boolean))];
    db.prepare(`INSERT INTO candidate_memberships (code, name, industry, concepts_json, clusters_json, source, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET name = excluded.name, industry = excluded.industry, concepts_json = excluded.concepts_json,
        clusters_json = excluded.clusters_json, source = excluded.source, fetched_at = excluded.fetched_at`)
      .run(code, name || code, industry, JSON.stringify(ths.concepts), JSON.stringify(clusters), ths.industry ? "ths_basic" : "tushare_fallback", new Date().toISOString());
    refreshed += 1;
  }
  return { status: "ok", candidate_count: codes.length, refreshed, source: "ths_basic" };
}

async function fetchThsMembership(code) {
  const response = await fetch(`https://basic.10jqka.com.cn/${code}/`, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`同花顺基础资料请求失败：${response.status}`);
  const html = new TextDecoder("gb18030").decode(await response.arrayBuffer());
  const industry = html.match(/所属申万行业：<\/span>\s*<span[^>]*>([^<]+)<\/span>/)?.[1]?.trim() ?? null;
  const conceptSection = html.slice(html.indexOf("概念贴合度排名"), html.indexOf("概念贴合度排名") + 12_000);
  const concepts = [...conceptSection.matchAll(/title="此概念在该股票中走势贴合度排名第([一二三])"[\s\S]{0,500}?>([^<]+)<em\s+class="ccept_top[123]"/g)]
    .map((match) => ({ name: match[2].trim(), rank: ({ 一: 1, 二: 2, 三: 3 })[match[1]] }))
    .filter((item) => item.name);
  if (!industry && !concepts.length) throw new Error("同花顺基础资料未解析到行业或概念字段");
  return { industry, concepts };
}

async function fetchTushareIndustry(token, code) {
  const basic = await tushare(token, "stock_basic", { ts_code: toTsCode(code) }, "ts_code,name,industry");
  const base = basic.data?.items?.[0] ?? [];
  return valueFor(basic.data?.fields ?? [], base, "industry") || null;
}

async function tushare(token, api_name, params, fields) {
  const response = await fetch("https://api.tushare.pro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_name, token, params, fields })
  });
  if (!response.ok) throw new Error(`Tushare ${api_name} 请求失败：${response.status}`);
  const payload = await response.json();
  if (payload.code !== 0) throw new Error(`Tushare ${api_name} 返回 ${payload.code}：${payload.msg ?? "未知错误"}`);
  return payload;
}

function toTsCode(code) {
  return `${code}.${code.startsWith("6") ? "SH" : code.startsWith("8") || code.startsWith("4") ? "BJ" : "SZ"}`;
}

function valueFor(fields, row, name) {
  const index = fields.indexOf(name);
  return index >= 0 ? row[index] : null;
}

export function clusterConcept(name) {
  if (/算力|CPO|光模块|液冷|服务器|AI芯片|人工智能/.test(name)) return "AI算力";
  if (/半导体|芯片|先进封装|存储芯片/.test(name)) return "半导体";
  if (/5G|通信|卫星通信|光通信/.test(name)) return "通信";
  if (/机器人|人形机器人|工业母机|机器视觉/.test(name)) return "机器人";
  if (/新能源|储能|锂电|光伏|风电/.test(name)) return "新能源";
  return name;
}
