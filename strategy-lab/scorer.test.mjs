import test from "node:test";
import assert from "node:assert/strict";
import { priceHeat } from "./scorer.mjs";

test("主板涨幅过热会扣研究分，极端涨幅阻断纸面入场", () => {
  assert.deepEqual(priceHeat("主板", 0.055), { penalty: 15, blocked: false, message: "当日涨幅 5.50% 偏高：研究分下调 15 分" });
  assert.deepEqual(priceHeat("主板", 0.081), { penalty: 30, blocked: true, message: "当日涨幅 8.10% 过高：禁止追高" });
});

test("创业板保留更高波动容忍度", () => {
  assert.deepEqual(priceHeat("创业板", 0.10), { penalty: 15, blocked: false, message: "当日涨幅 10.00% 偏高：研究分下调 15 分" });
});
