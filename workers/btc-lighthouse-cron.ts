type Env = {
  MANFU_BTC_LIGHTHOUSE_REFRESH_URL: string;
  BTC_LIGHTHOUSE_REFRESH_TOKEN: string;
};

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(refreshBtcLighthouse(env));
  }
};

async function refreshBtcLighthouse(env: Env) {
  if (!env.MANFU_BTC_LIGHTHOUSE_REFRESH_URL || !env.BTC_LIGHTHOUSE_REFRESH_TOKEN) {
    throw new Error("Missing MANFU_BTC_LIGHTHOUSE_REFRESH_URL or BTC_LIGHTHOUSE_REFRESH_TOKEN");
  }
  const response = await fetch(env.MANFU_BTC_LIGHTHOUSE_REFRESH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-refresh-token": env.BTC_LIGHTHOUSE_REFRESH_TOKEN
    },
    body: JSON.stringify({ source: "cloudflare-cron" })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`BTC lighthouse refresh failed: ${response.status} ${text.slice(0, 240)}`);
  }
}
