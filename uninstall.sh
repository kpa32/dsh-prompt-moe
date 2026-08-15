#!/usr/bin/env bash
# prompt-moe 卸载：插件出 profile + 预设目录删除
set -e

for prof in headless web; do
  dsh plugin --profile "$prof" remove prompt-moe 2>/dev/null || true
done

rm -rf ~/.dsh/.agent-presets/prompt-moe
echo "[prompt-moe] uninstalled: headless ✓ web ✓ preset ✓"
