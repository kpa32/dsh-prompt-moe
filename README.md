# prompt-moe

修改系统提示词，影响 MoE 路由——让 DeepSeek V4 干活像资深工程师。

## 前因后果

### 观察：同一个模型，两种人格

统计 684 个 pi 会话的思维链，发现 DeepSeek V4 pro 默认说话风格：

- `let me` 复读机（14.2 次/千词）——每句都"让我想想"但只是复述
- `maybe` 骑墙（4.4~17 次/千词）——决策密度极低
- **脑补验证**：嘴上说"测试通过"，实际从不跑测试命令

同一模型在 OpenCode GA 平台的思维链：

- `let me` 0.16、`maybe` 0.05（差 88~340 倍）
- 进行时叙述（`i'm` 9.6 次/千词）："I'm setting up..." 边说边干
- **证据信仰**：写完必跑真实验证（`node --check`、数值单测、像素统计）

### 假设：提示词是 MoE 路由开关

DeepSeek V4 是 MoE 架构，路由逐 token 决定、每 token 选 8 个专家。系统提示词里：

- **身份句** = 路由锚点（初始专家分布）
- **行为词** = 持续牵引（思维链里每个词都是下一个 token 的路由信号）

官方默认 persona（"You are a coding agent powered by...") 激活的是"通用编码助手"分布，所以干活像实习生。**改提示词 = 改写路由偏好 = 换专家分布。**

### 实验迭代（多轮身份测试）

| 版本 | 身份 | 结果 |
|---|---|---|
| #8 Claude Code 真身 | 复刻 Claude 开头 | let me 复活 10/k |
| #10 opencode 身份句 | 同款开头 | let me 5.1/k，i'm 0.1 |
| #11 opencode 全文 329 行 | 官方全提示词 | let me 反弹 6.8/k |
| #13 technical lead | "你是技术负责人" | **灾难**：只规划不干活（1 条思维链 21217 词、0 工具调用）|
| hands-on senior engineer | 第一人称进行时 | 行为巨变：真执行 |

关键教训：

- **"派活的人"不干活**：`technical lead` 是布置任务的身份，规划完就停——身份词选错=激活错专家
- **第一人称进行时防表演**：`You should...` 触发"应答表演"（复述指令），`I'm building...` 无表演对象，直接进入执行态
- **词义强度 < 语料共现路由**：`proving` 语义更重但语料里共现 `theorem`（漂向数学），`testing` 共现 `npm`/`assert`（工程锚点）——弃 proving 留 testing

## 优化思路

### 八词链

```
You are a product-minded senior engineer.
I'm building in batches: researching, planning, designing,
implementing, testing, debugging, shipping.
```

- `product-minded senior engineer`：身份锚点（跨领域通用，不窄化路由）
- 八个行为词：持续牵引，覆盖完整开发循环
- `planning` 在链内紧接 `implementing`——避免独立规划阶段变成任务终点（#13 教训）

### 双通道注入

1. **persona 段**：每轮 system prompt 都在（一次性身份）
2. **锚点提醒**：累计 8k 字符注入一条 `Style anchor — staying in flow: [八词链]`——长会话防思维链漂移（实测 9 次压缩后身份句被推到 7 万词外，let me 从 3.6 回升到 14）

### 功能全保留，只改身份

基于官方 `standard` 预设逐行 diff：24 个插件行（工具/plan-mode/压缩/委派/ask-user）**一字未动**，只改：

- persona 文本（身份）
- 关掉官方 harness 身份句（"You are an AI agent powered by DeepSeek Harness"）——唯一身份
- bash 工具在 Windows 启用（git bash 需在 PATH）

## 实测效果

| 指标（每千词） | 默认提示词 | prompt-moe |
|---|---|---|
| let me | 14.2 | 5.3（少压缩工况更低） |
| maybe | 4.4~17.1 | 2.5 |
| 犹豫词组（hmm/wait/but） | 高 | 低 |
| 自测行为 | 脑补"测试通过" | 自发写 smoke.test.js + playwright 截图验证 |
| 决策密度 | 骑墙 | 拍板（maybe 全是自问自答式确认） |

行为对比：默认版"环境侦查员"（翻旧文件、curl wiki、不写正事）；prompt-moe 版"工匠"（装依赖、修包冲突、debug 链最短 9 词一条）。

## 安装

前置：已装 dsh（`@deepseek-ai/dsh`）。

```bash
git clone <this-repo>
cd prompt-moe
bash install.sh
```

- 插件 → `dsh plugin --profile {headless,web} add .`
- 预设 → 复制到 `~/.dsh/.agent-presets/prompt-moe/`

web 新建会话选「提示词MoE」预设。

## 文件

```
prompt-moe/
├── package.json          bundle manifest（dsh.bundle）
├── cordis.patch.yml      host 层：关官方身份句 + bash-restore
├── dsh-prompt-moe.mjs     插件：agent/pre-step 每 8k 字符注入锚点
├── preset/
│   ├── agent.cordis.yml  standard 全功能复刻；persona + anchor 文本都在这
│   └── preset.yml        name: 提示词MoE
└── install.sh / uninstall.sh
```

改提示词：编辑 `preset/agent.cordis.yml` 的 `persona` 行 `text`（身份）或 `anchor` 行 `anchorText`（提醒），重跑 install.sh 并重启 web。

## 卸载

```bash
bash uninstall.sh   # = 两 profile remove + 删用户预设目录
```

## 免责

- 锚点文本/身份词是经验产物，不是咒语——换模型版本后建议用标准任务重测基线
- 本插件通过替换 system prompt 影响 MoE 路由分布，不修改 dsh 源码
