# Couple Court V1 下载包

下载 [Couple-Court-V1.zip](Couple-Court-V1.zip)，并解压其中的 `Couple-Court` 文件夹。

包中包含完整源码、环境变量示例、运行说明、测试报告，以及已编译的 H5、微信小程序和 Node.js 服务端。默认使用明确标注的 Mock 模式。真实 LLM 和微信真机测试尚需模型凭证、AppID 及可达的 HTTPS API。

不包含 `node_modules`、`.env`、私人案件数据库、开发者访问凭证或日志。

需要 Node.js 24。在解压后的根目录运行 `npm ci` 安装依赖，再运行 `npm start` 启动后端和 H5；开发模式使用 `npm run dev`。微信开发者工具导入 `apps/miniapp/dist/weapp`。完整说明见根目录 README。

GitHub 网页查看 ZIP 时，可使用文件页的“下载原始文件”功能。私有仓库需登录有访问权限的 GitHub 账号。

SHA-256 校验清单见 [SHA256SUMS.txt](SHA256SUMS.txt)。
