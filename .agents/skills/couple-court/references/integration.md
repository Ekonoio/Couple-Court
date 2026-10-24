# 接入与验证

## 已检查的两份项目
- 本地 Sites Demo：`/workspace/sites/couple-court-demo`，起始提交 `f32cf9d`。业务代码在 `project/`，Taro + React + TypeScript；已有独立规则、Zod输出、手动模型实验室、共同材料确认流程。
- GitHub `Ekonoio/Couple-Court` main 树 `3b0b57767717bcb6e0e6731dc1b56157f2abb0fb`：结构较旧，尚无拆分的 judge/core.ts 和 case-core。不能直接用本地文件覆盖主分支。
- 安装的7个 LoveLab CN Skill 已读取；保留原样。GitHub 原版7个Skill及 `.agents/skills/LOVELAB-LICENSE.txt` 不修改，许可证为 MIT / Copyright (c) 2026 Hsiu-Chi Tsai(thc1006)。本Skill独立实现评分，不宣称是Gottman心理测量。

## 数据通路
`Material → sourcesFor → prompt + rules v2 → 模型JSON → Zod + validateOutput → summarize → JudgmentView`

规则文件 `packages/court-rules/config/v2.json`，四维各0～5，总分各0～20。读取 `getRules('2.0.0')`；v1保留，现有生产默认不自动切换。开发者实验室可选v2后导出Prompt、粘贴真实模型JSON并导入，已有导入路径会执行新校验。旧mock样例没有新证据卡，不套用旧分数冒充v2结果；v2 mock保持null。

输出增加 evidenceCards 与 highlights；v2必须提供，旧版可省略。JSON Schema在 `packages/judge/contracts/output.schema.json`；示例和sources在同目录。总分不由模型生成，`completeJudgment`统一计算并在关键证据不足时隐藏。卡片分数是所属维度的重复展示，不能再累加。前端保持判决卡、双方总分/分项格、理由/建议，新增证据原文和改写/名场面。

`evidenceCard.side`是被评估方，`speaker`是引文说话人（可unknown），`ref`标识出处，三者不同。文本摘录能验连续原文，不证明事实真实；图片转写只标为needs_image_review。前端应同时展示出处与核验状态。

## 可重复命令
在本地Demo的project目录运行：
```
npm test
npm run typecheck
npm run build:weapp
npm run build:h5
node --import tsx scripts/export-court-contract.ts packages/judge/contracts
```
Skill独立JSON校验：先 `python -m pip install -r scripts/requirements.txt`，再 `python scripts/validate.py assets/example.json`。该脚本不代替项目引用/业务校验。

## 接入补丁
`assets/demo-integration.patch`是针对上述本地Demo起始版本的完整源码补丁，包含规则、契约、校验、Taro卡片、测试、手动实验室兼容；不是针对旧GitHub main的直接覆盖包。
先在工作分支运行 `git apply --check <patch>`，通过后才 `git apply <patch>`。本次已修改的Demo无需再次应用。补丁包含project前缀及app/court/api.ts；独立旧仓库须先对齐新Demo结构，不能强行去掉路径前缀套用。

## 局限
未部署线上、未切换生产默认规则、未调用付费API；无真实微信AppID真机验收。完整模型API多模态链路未测。已检索公开截图，但未保存授权不明的原图，测试语料均明确虚构。14个类型案例有验收边界；其中3个进行了独立模型完整JSON试跑，其余不能宣称已做真实模型评测。没有双人标注的一致性研究，0～5不是科学标定。
自动校验能发现缺字段、越界分数、虚构引用、总分和卡片不一致、明显重复原文、无依据趣味引用；无法保证语义真实、角色归属、反讽判断或换说法后的重复事件完全正确。短句黑名单只是补充，不能代替模型风格审查。
