import test from "node:test";
import assert from "node:assert/strict";
import { evaluateMarketState, parseIndexFlash } from "./market-gate.mjs";
import { minuteBarAtOrAfter } from "./vwap.mjs";

test("同花顺大盘评级与广度共同放行绿灯", () => {
  assert.equal(evaluateMarketState({ rise: 2300, fall: 1200, rating: 7, limitUp: 55, limitDown: 4 }), "green");
});

test("同花顺大盘评级低或广度失衡时红灯", () => {
  assert.equal(evaluateMarketState({ rise: 600, fall: 1800, rating: 5, limitUp: 5, limitDown: 30 }), "red");
});

test("解析同花顺 indexflash 的涨跌家数与评级", () => {
  const market = parseIndexFlash('{"zdfb_data":{"znum":2100,"dnum":1300},"zdt_data":{"last_zdt":{"ztzs":66,"dtzs":5}},"dppj_data":7.2}');
  assert.deepEqual(market, { rise: 2100, fall: 1300, rating: 7.2, limitUp: 66, limitDown: 5 });
});

test("结算选取窗口后首个可成交分钟", () => {
  const bar = minuteBarAtOrAfter([
    { time: "2026-06-22 09:29", close: 10 },
    { time: "2026-06-22 09:30", close: 10.2 },
    { time: "2026-06-22 09:31", close: 10.1 }
  ], "09:30");
  assert.equal(bar?.close, 10.2);
});
