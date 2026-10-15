# 情侣法庭 · Couple Court V1

可运行的私密争议分析原型：Taro 4 + React + TypeScript，微信小程序 / H5，Express + Node 24 内置 SQLite。不是法律咨询工具，无司法效力。仅在本地运行，未部署网站或发布小程序。

## 下载完整 Demo

[下载源码及 H5 / 微信 / 服务端构建包](https://github.com/Ekonoio/Couple-Court/raw/refs/heads/main/deliverables/Couple-Court-V1.zip)。若浏览器未直接下载，可打开 [构建包文件页](https://github.com/Ekonoio/Couple-Court/blob/main/deliverables/Couple-Court-V1.zip) 下载原始文件。私有仓库需要先登录有访问权限的 GitHub 账号。

完整包包含源码、锁定依赖清单、运行文档和三类构建产物，不包含模型密钥、真实案件数据或 node_modules。校验值见 [SHA256SUMS.txt](https://github.com/Ekonoio/Couple-Court/blob/main/deliverables/SHA256SUMS.txt)。这是可下载项目包；仓库本身不提供在线运行网站。

支持同一设备独立陈述、邀请异地参与、单方分析；聊天截图上传、人物标注、排序、预览；提交锁定；服务端一次多模态 LLM 调用；结构化校验；程序计算总分；判决书；案件及图片删除；开发者虚构案例与回归对比。

## 快速运行（Windows / macOS / Linux）

需要 **Node.js 24.x** 和 npm。SQLite 使用 `node:sqlite`，不需要安装数据库服务或编译数据库插件。首先进入本仓库根目录：

```sh
npm ci
npm run dev
```

H5 开发服务位于本机 **10086** 端口，API 位于 **3001** 端口。浏览器手动访问本机 10086 端口即可，所有 `/api` 请求经开发代理转发。默认监听 `127.0.0.1`，默认 **Mock**，不使用任何付费模型。若 Taro 用户配置目录不可写，安装阶段需要先在当前系统用户的主目录中创建 `.taro4.0/index.json`（内容 `{}`）；不要更改 HOME 或关闭 TLS 验证。

需要配置时，将 `.env.example` 复制为根目录 `.env`，填写后重启服务。PowerShell 可用 `Copy-Item .env.example .env`，POSIX 可用 `cp .env.example .env`。不要提交 `.env`、`.data`、日志或访问凭证。

快速试用：发起审理 → 填写名称、起因和经过 → 选择同一台手机 → 确认材料处理说明 → 甲方陈述并锁定 → 交给乙方填写 → 审理 → 查看结果 → 删除案件。

**Mock 的边界**：普通案件只演示真实流程，所有分数为“不可评分”，不会把预设分数冒充推理。开发者实验室的八个虚构案例有明确标注的人工参考输出，用于测试页面和规则计算，不能证明模型公平性。

## 构建和检查

```sh
npm run typecheck
npm test
npm run build:server
npm run build:weapp
npm run build:h5
npm start
```

最后一条启动编译后的 API，并提供已构建的 H5 静态文件，使用本机 **3001** 端口。应用配置、Prompt 和规则 JSON 保留在仓库中，启动命令必须在根目录执行。`npm run build` 顺序构建服务端、微信和生产 H5。

| 交付 | 位置 |
| --- | --- |
| 微信构建产物 | `apps/miniapp/dist/weapp/` |
| H5 构建产物 | `apps/miniapp/dist/h5/` |
| 后端构建产物 | `dist/server/index.js` |
| 独立评分规则 | `packages/court-rules/config/v1.json` |
| 独立 AI Prompt | `packages/judge/prompts/judge-v1.md` |
| 共享结构 / 校验 | `packages/shared/src/index.ts` |
| 虚构案例 | `tests/cases/index.ts` |
| 数据和开发者凭证（不提交） | `.data/` |

构建产物已在此环境实际生成，未加入 Git。克隆源代码后可按以上命令重建。

## 使用真实 LLM

在服务端 `.env` 配置以下字段；客户端永远不读取模型密钥：

```dotenv
LLM_MODE=real
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4.1-mini
LLM_API_KEY=<仅在本地安全填写，不要发到聊天中>
```

模型必须支持 **Chat Completions、多模态图片和 `response_format: json_schema`**。兼容服务商可更改 BASE_URL / MODEL / KEY；不支持该协议的服务商需增加 Judge 适配器，不能仅改提供商标签。一次审理只调用一次，不自动重试、投票或多轮追问。失败会明确报错且不生成判决；修正配置后可以重试。结构错误日志仅记录错误代码与时间，不记录聊天、响应正文或密钥。

调用前页面会确认第三方材料处理。启用真实模式后先使用虚构案例验收；这可能产生提供商费用。若处于网络受限的云环境，还需要在环境设置允许所选模型域名（例如 `api.openai.com`），并通过安全环境设置提供密钥。费用仅在提供商返回用量且设置输入/输出费率时估算，单位为美元/百万 token，不内置可能过时的价格。

## 微信小程序

```sh
npm run build:weapp
# 开发监听
npm run dev:weapp
```

微信开发者工具导入 **`apps/miniapp/dist/weapp`**。默认 `touristappid` 只用于无凭证编译；设置根目录 `.env` 中的 `WEAPP_APPID` 后重新构建，将写入生成的工具配置。真机联网需要有效 AppID、备案/合法 request/uploadFile/downloadFile 域名和可访问的 HTTPS API，在 `TARO_APP_API_BASE` 配置地址后重新编译。不得将模型 KEY 配到任何 `TARO_APP_*` 字段。

微信邀请使用页面分享 `pages/index/index?invite=…`，按钮调用微信小程序分享；H5 使用 URL 的 hash 参数。二者不互相冒充。没有 AppID 时完成编译不代表真机或微信分享验收通过。代码未上传或发布到微信。

手机访问本地 API 时，`127.0.0.1` 指手机自身，不是电脑；当前默认地址仅适合电脑本地流程。跨设备试用必须显式配置可达的 API / H5 地址、CORS 和网络，并由参与者自行发送邀请；本项目不会公开部署。抖音留有平台适配层，但未安装目标插件、未编译或测试。

## 开发者实验室

运行 `npm run dev` 后，从 H5 开发首页进入“开发者实验室”。读取本地 `.data/dev-token` 文件中的独立凭证，粘贴到实验室登录框；也可通过服务端 `DEV_ACCESS_TOKEN` 设置。不要公开此凭证。开发者凭证仅保留在页面内存，刷新后需重新输入。

实验室支持：八个虚构案例、可用模型和规则版本、身份交换、原始结构化输出、用量 / 耗时 / 可得费用、保存参考结果、同案例同身份状态下的新旧逐项分数及理由对比。修改规则需新增带不同版本的 JSON，重启/刷新实验室配置后运行；新维度和评分范围自动进入真实调用 Schema、校验和页面。Mock 参考值是 V1 人工样例，改变维度结构后需要相应维护样例，不能据此评价新规则的真实推理效果。

后端必须同时满足 `NODE_ENV=development` 和正确 `X-Dev-Token`，且不接受真实 caseId。生产前端构建不包含实验室页面。生产后端设置 `NODE_ENV=production` 后，全部 `/api/dev/*` 返回 404。**前端构建环境与后端运行环境是独立开关。**

## 自动化浏览器验收

```sh
npm run build:h5:dev
npx playwright install chromium
npm run test:e2e
```

此云机器已提供 Chromium，测试自动使用它；其他机器需按上面命令安装，或设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`。测试启动独立的 3002 端口服务，使用 `.data/e2e.sqlite` 和专用测试凭证，只产生虚构材料。报告与截图在 `test-results/`，不提交。

运行生产 H5 构建会覆盖开发 H5 产物，因此下次测试实验室需先重建开发版本。

生产隔离验收：先 `npm run build`，再 `npm run test:production`。云端可复用安装脚本位于 `scripts/environment-setup.sh`，已实际执行；它面向当前 `/workspace/Couple-Court` 路径，Windows本地直接使用前面的 npm 命令。

## 隐私与已知边界

案件使用 256 位随机独立甲乙凭证，数据库仅存凭证摘要。邀请本身即乙方的访问能力，持有者可访问乙方材料，请只交给对方；无账号/实名验证，无法确认屏幕后真实身份。同设备切换会替换本机当前凭证，不是设备级防窥隔离。清除浏览器存储会丢失访问权限，本版没有账号恢复或案件列表。

截图保存在 SQLite BLOB 中，无公开静态 URL；所有读写经过角色鉴权。上传只接受实际可解码的 JPEG / PNG / WebP，每张最多 8MB、2400万像素，每方最多6张；重编码移除元数据并限制尺寸。正式提交前对方不能获取原始陈述和截图；双方完成后公开；无秘密证据。案件基本描述是创建者提供的陈述，不自动认定为客观事实。

默认保存7天，可设1–30天；启动及每小时清理，过期访问也会即时失效。任一有效参与者可删除全案并级联删除截图，进行中审理需结束后删除。SQLite 启用 secure_delete 并截断 WAL，但这不承诺云磁盘快照/备份或第三方模型的数据已经物理擦除。数据库和截图未做应用层加密，运行机器应仅供受信任开发者使用。

V1 仅支持单进程后端。审理中并发请求共享一个 Promise，判决持久化后重复提交返回同一结果。崩溃后会恢复可重试状态；外部模型已计费但响应未持久化时，无法保证跨进程崩溃的 exactly-once 计费。服务端有基本速率和上传限制，不是面向公网的滥用防护系统。

完整产品说明见 [docs/PRODUCT.md](docs/PRODUCT.md)，规则见 [docs/SCORING_RULES.md](docs/SCORING_RULES.md)，验收结果、限制和下一步见 [docs/TESTING.md](docs/TESTING.md)。
