// prompt-moe — 每 8k 字符注入风格锚点提醒（persona 在 preset 里，见 ~/.dsh/.agent-presets/prompt-moe）。
// 挂载：bundle patch（cordis.patch.yml）；PROMPT.md 与本文件同目录，保存即生效。
export const name = "prompt-moe";

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createUserMessage } from "file:///C:/Users/kpa/AppData/Roaming/npm/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm/lib/index.js";

// repo 位置免疫：相对本文件解析，目录搬家不用改代码
const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(HERE, "state.json");
const FALLBACK = "You are a helpful software engineer assistant.";

/** state.json: { [agentId]: { chars, lastInject } } */
function loadState() {
  try {
    if (existsSync(STATE_FILE)) {
      const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
      if (s && typeof s === "object" && !Array.isArray(s)) return s;
    }
  } catch { /* 损坏则重建 */ }
  return {};
}
function saveState(s) {
  try { writeFileSync(STATE_FILE, JSON.stringify(s)); } catch { /* 不阻塞 */ }
}

/** 本轮新消息里 assistant 输出的字符数（thinking+text）。claimed 只含本轮新增，累加不重复计。 */
function countAssistantChars(messages) {
  let n = 0;
  for (const m of messages) {
    if (m.role !== "assistant") continue;
    const c = m.content;
    if (Array.isArray(c)) {
      for (const p of c) {
        const t = p && (p.text ?? p.thinking);
        if (typeof t === "string") n += t.length;
      }
    } else if (typeof c === "string") n += c.length;
  }
  return n;
}

export function apply(ctx, config = {}) {
  const anchorEvery = config.anchorEvery ?? 8000;
  const anchorText = String(config.anchorText ?? FALLBACK).trim();
  const state = loadState();

  // agent/pre-step 是 waterfall（agent.ts:234 发射，签名 (payload, next)）。
  // payload.messages = inbox.claim() 的本轮新消息；payload.agent 由 dispatcher 注入。
  ctx.on("agent/pre-step", async (payload, next) => {
    const decision = await next();
    if (decision.kind !== "enter") return decision;

    const agentId = payload.agent?.id ?? "global";
    const st = (state[agentId] ??= { chars: 0, lastInject: 0 });
    st.chars += countAssistantChars(payload.messages); // 累计本轮新增
    saveState(state);
    if (st.chars - st.lastInject < anchorEvery) return decision;

    const anchor = createUserMessage({
      content: [
        { type: "text", text: `Style anchor — staying in flow: ${anchorText}` },
      ],
      source: { kind: "plugin", plugin: name },
    });
    // 官方 instructions 同款插入：锚点放本轮消息最前端（近端，模型每轮可见）
    const lastClaimedIndex = decision.messages.findLastIndex((m) =>
      payload.messages.includes(m)
    );
    st.lastInject = st.chars;
    saveState(state);
    return {
      kind: "enter",
      messages: decision.messages.toSpliced(lastClaimedIndex + 1, 0, anchor),
    };
  });
}
