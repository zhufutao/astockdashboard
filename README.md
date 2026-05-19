# 慢富

慢富是一个极简投资数据看板，第一版包含：

- A 股见顶仪表盘
- BTC 日跌 12% 后 3x 低频捡漏策略
- 管理员登录与后台管理
- Cloudflare Pages Functions + D1 部署结构

## 默认账号

- 邮箱：`admin@666.com`
- 密码：`666666`

首次访问 API 时会自动写入默认管理员、见顶指标和 BTC 策略种子数据。密码使用 PBKDF2 哈希存储。

## 本地开发

```bash
npm install
npm run build
wrangler d1 create manfu-db
npm run db:migrate:local
npm run cf:dev
```

如果 PowerShell 无法执行 `npm.ps1`，请使用 `npm.cmd`：

```bash
npm.cmd install
npm.cmd run build
```

## Cloudflare 部署

1. 在 Cloudflare 创建 D1 数据库，例如 `manfu-db`。
2. 将 `wrangler.toml` 里的 `database_id` 替换为真实 D1 ID。
3. 执行迁移：

```bash
wrangler d1 execute manfu-db --remote --file=./migrations/0001_init.sql
```

4. 在 Cloudflare Pages 连接 GitHub 仓库。
5. 构建命令：`npm run build`
6. 输出目录：`dist`
7. 绑定 D1：变量名 `DB`，数据库 `manfu-db`。

## 数据原则

A 股见顶仪表盘不编造数据：

- 能稳定从公开来源获取的指标，后续接入自动抓取。
- 暂时无法稳定获取的指标显示为 `待接入` 或 `手动配置`。
- 后台可以配置当前值、状态、权重、阈值说明和数据源。
- 当前评分只基于已接入或手动配置的指标，待接入和获取失败不参与分母。

BTC 策略实时数据尝试使用 Binance 公共接口：

```text
https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=3
```

如果 Binance 不可用，页面显示实时数据获取失败，但不影响策略说明和回测表展示。

## V1 指标池

- 集思录 A 股温度计
- 全 A PE / PB 分位
- 股债风险溢价 / 股债收益差
- 全 A 成交额
- 成交额 / 流通市值
- 全 A 换手率
- 融资余额
- 融资买入额占成交额
- 创新高个股占比
- 上涨家数占比
- 主要指数跌破 MA20 / MA60
- 百度 / 微信搜索指数：牛市、炒股、开户、券商
- 新发基金规模 / 爆款基金数量
- 券商板块走势
- 涨停家数、炸板率、连板高度

## BTC 策略口径

回测数据由需求提供：

- 数据：Binance `BTCUSDT` 日线
- 范围：`2017-08-17` 到 `2026-04-30`
- 样本：`3179` 根日 K
- 主策略：日线收盘跌幅 `<= -12%`
- 入场：次日开盘买入做多
- 杠杆：首选 `3x`
- 持有：`2 天`
- 出场：第 2 天收盘

页面保留风险提示：回测不代表未来收益，3x 仍有高风险，不建议 10x、20x 高杠杆抄底。
