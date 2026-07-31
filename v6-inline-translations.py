#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v6-fix：把 498 章翻译内联进 data-bundle.js，彻底离线可用（file:///微信分享/GitHub Pages 全场景）
  - 把 translations_yangbojun.json 转成 window.LUNYU_DATA.translations_yangbojun
  - 把 commentaries.json 转成 window.LUNYU_DATA.commentaries
  - 保持原来的 text/persons/ann_*/LUNYU_ENUM/LUNYU_BOOKS 不变
  - 同步加载，完全不依赖 fetch
"""
import json, os, re

BASE = "/Users/zhongjiangzhang/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a6b760c59af87f56c47b958"

with open(os.path.join(BASE, "assets", "data-bundle.js"), "r", encoding="utf-8") as f:
    bundle = f.read()
with open(os.path.join(BASE, "assets", "translations_yangbojun.json"), "r", encoding="utf-8") as f:
    trans = json.load(f)
with open(os.path.join(BASE, "assets", "commentaries.json"), "r", encoding="utf-8") as f:
    comms = json.load(f)

# 压缩一下（去掉缩进，省空间），498 章约 600KB
trans_json_min = json.dumps(trans, ensure_ascii=False, separators=(',', ':'))
comms_json_min = json.dumps(comms, ensure_ascii=False, separators=(',', ':'))

print(f"[INFO] translations JSON minified: {len(trans_json_min)} bytes")
print(f"[INFO] commentaries JSON minified: {len(comms_json_min)} bytes")

# 找到 LUNYU_DATA 闭合的 })(); 之前的位置插入两个字段
# 做法：在 console.log('[LunYu] 数据加载完成...') 之前，给 window.LUNYU_DATA 加两个属性
insert_code = f"""
  // ===== v6-fix：翻译 + 名家解读 内联，100% 离线可用，完全不依赖 fetch =====
  // 之前 fetch 在 file:///微信分享/弱网时必败，导致所有译文显示「敬请期待」
  window.LUNYU_DATA.translations_yangbojun = {trans_json_min};
  window.LUNYU_DATA.commentaries           = {comms_json_min};
  console.log('[LunYu] 离线解读层挂载完成: translations=' + Object.keys(window.LUNYU_DATA.translations_yangbojun.chapters || {{}}).length + '章, commentaries=' + Object.keys(window.LUNYU_DATA.commentaries.chapters || {{}}).length + '章');
"""

target = "console.log('[LunYu] 数据加载完成:"
if target not in bundle:
    print("FATAL: target marker not found in data-bundle.js"); exit(1)

new_bundle = bundle.replace(target, insert_code + "\n  " + target, 1)
assert len(new_bundle) > len(bundle), "替换失败！"

out_path = os.path.join(BASE, "assets", "data-bundle.js")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(new_bundle)
print(f"[INFO] 新 data-bundle.js 写出: {out_path} ({len(new_bundle)} bytes, 原 {len(bundle)} bytes, +{len(new_bundle)-len(bundle)} bytes)")

# 简单 sanity：读回 JS，找两个 marker
with open(out_path, "r", encoding="utf-8") as f:
    check = f.read()
m1 = "translations_yangbojun" in check
m2 = '"xiangdang-16"' in check and '厩焚' in check
m3 = "commentaries" in check
print(f"\nSanity: translations_yangbojun 字段存在={m1}, xiangdang-16 厩焚翻译内嵌={m2}, commentaries 字段存在={m3}")
if m1 and m2 and m3:
    print("✅ data-bundle.js 内联成功")
else:
    print("❌ 内联失败")
    exit(1)
print("DONE")
