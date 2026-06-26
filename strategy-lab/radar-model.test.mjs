import test from "node:test";
import assert from "node:assert/strict";
import { buildRadarCandidate, priceRisk } from "./radar-model.mjs";

test("资金榜行保留股票归属、价格和涨跌幅", () => {
  const row = { rank: 3, code: "300308", cells: ["3", "300308", "中际旭创", "1367.88", "7.19%"] };
  const membership = { industry: "通信设备", concepts_json: JSON.stringify([{ name: "CPO" }, { name: "算力" }, { name: "人工智能" }, { name: "光通信" }]) };
  assert.deepEqual(buildRadarCandidate(row, membership), {
    code: "300308", name: "中际旭创", board: "创业板", rank: 3, score: 0, status: "watch", source_agreement: true,
    price: 1367.88, pct_chg: 7.19, industry: "通信设备", concept_cluster: "CPO / 算力 / 人工智能", score_breakdown: {}, reason: "同花顺主力净流入额前 50"
  });
});

test("分板涨幅风险采用不同阈值", () => {
  assert.equal(priceRisk("主板", 5), "warning");
  assert.equal(priceRisk("主板", 8), "high");
  assert.equal(priceRisk("创业板", 8), null);
  assert.equal(priceRisk("科创板", 9), "warning");
  assert.equal(priceRisk("创业板", 14), "high");
});
