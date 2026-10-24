# 验证记录 · 2026-10-24

- 项目 `npm test`：7个测试文件，77项通过（原54项 + 新23项）。新增项覆盖正低分不再显示无错、双零/双高分、null、缺失卡片、越界分数、伪造引文、陈述伪装聊天、分项不一致、重复计分、趣味引用、截图待核验、安全清理、旧mock迁移、Schema及例子。
- 根目录 `npm run test:cloud`：9项通过。
- `npm run typecheck`、`build:server`、`build:weapp`、`build:h5`：均成功。H5有体积警告；微信使用游客AppID，非真机验收。
- Skill `quick_validate.py` 与独立JSON Schema校验通过。Schema由项目Zod类型生成，不手写另一套字段定义。
- 14个明确标注虚构的中文边界案例建档，含家务冲突类型启发案例。它们的边界预期不是统计金标准。
- 对3个独立原始场景进行盲式模型试跑，未给测试者期望答案：协商暂停、转述第三方辱骂并反对、明确暴力威胁。3份输出均通过Schema和项目validateOutput。前两案保留未知维度null，第三案安全模式且全部null、关闭趣味卡。原始输出保存在assets/forward-tests；输入见下。

## 原始输入
1. A.happened：我现在情绪太激动，需要半小时冷静，八点回来聊。 B.happened：好，八点再聊。
2. A.happened：我朋友说“你就是个废物”，我当场说我不同意，也不许他这样说你。 B.happened：谢谢你没有认同他。
3. A.happened：你敢走我就打你。 B.happened：我要离开。
三案context.participation均为双方参与、只有以上片段。

## 迭代中修正
1. 旧规则总分<=2被判无明显过错：v2阈值改为0，增加正低分回归。
2. 初始证据卡只有被评估side：补充speaker以区分说话人、被评估方和上传者。
3. 新卡片校验抛出普通Error会变成服务器500：包装成JudgeError/INVALID_EVIDENCE_CARD，便于导入时纠错。
4. 旧Mock参考值缺少新卡片：v2不强行迁移或杜撰引文，退回明确无评分流程演示。
5. tsx CLI因IPC权限失败：改用node --import tsx成功导出契约。初始Python缺jsonschema，安装声明依赖后验证通过。

这些结果不代表模型在真实情侣聊天上的准确率。未开展真实图片OCR或付费API多模态评测；未验证浏览器视觉布局、微信真机或线上部署。
