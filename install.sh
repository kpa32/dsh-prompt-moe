#!/usr/bin/env bash
# prompt-moe 安装：插件 bundle 进 profile + 预设复制到用户根
set -e
cd "$(dirname "$0")"

for prof in headless web; do
  dsh plugin --profile "$prof" remove dsh-prompt-moe 2>/dev/null || true
  dsh plugin --profile "$prof" remove prompt-moe 2>/dev/null || true   # 旧包名清理
  dsh plugin --profile "$prof" add .
done

rm -rf ~/.dsh/.agent-presets/prompt-moe
mkdir -p ~/.dsh/.agent-presets/prompt-moe
cp preset/agent.cordis.yml preset/preset.yml ~/.dsh/.agent-presets/prompt-moe/
echo "[prompt-moe] installed: headless ✓ web ✓ preset ✓"
