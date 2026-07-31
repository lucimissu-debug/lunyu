#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v6-fix 离线验证 Python 版 v2（修正 text 字段不带引号的提取逻辑）"""
import json, re, os
BASE = "/Users/zhongjiangzhang/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a6b760c59af87f56c47b958"
with open(os.path.join(BASE, "assets", "data-bundle.js"), "r", encoding="utf-8") as f:
    bundle = f.read()

def extract_json(marker, src):
    start = src.find(marker)
    assert start != -1, f"marker not found: {marker[:40]}"
    start_json = src.index('=', start) + 1
    while src[start_json] in ' \n\r\t': start_json += 1
    assert src[start_json] == '{', f"JSON must start with {{ at {start_json}, got {src[start_json:start_json+10]}"
    depth = 0; i = start_json; in_str = False; esc = False
    while i < len(src):
        c = src[i]
        if in_str:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == '"': in_str = False
        else:
            if c == '"': in_str = True
            elif c == '{': depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0: return src[start_json:i+1]
        i += 1
    raise RuntimeError("JSON not closed")

trans_json = extract_json('translations_yangbojun', bundle)
comm_json  = extract_json('commentaries', bundle)
print(f"[OK] translations JSON: {len(trans_json)} bytes")
print(f"[OK] commentaries JSON: {len(comm_json)} bytes")

T = json.loads(trans_json)
C = json.loads(comm_json)

meta_key = '_meta' if '_meta' in T else ('meta' if 'meta' in T else None)
meta = T.get(meta_key, {}) if meta_key else {}
print(f"translations meta: filled_count={meta.get('filled_count')}, status={meta.get('status')}, version={meta.get('version')}")
tc = T['chapters']
print(f"translations chapters key 数: {len(tc)}")
print(f"commentaries chapters key 数: {len(C.get('chapters',{}))}")

# 提取 LUNYU_DATA.text 数组（`text: [{id:"xueer-01",...}]`）
# 找 `\n    text: [` 位置
MARKER = '\n    text: ['
start = bundle.find(MARKER)
assert start != -1, "text marker not found"
start_arr = start + len(MARKER) - 1  # 指向 '['
# 匹配括号深度
depth = 0; i = start_arr; in_str = False; esc = False
while i < len(bundle):
    c = bundle[i]
    if in_str:
        if esc: esc = False
        elif c == '\\': esc = True
        elif c == '"': in_str = False
    else:
        if c == '"': in_str = True
        elif c == '[': depth += 1
        elif c == ']':
            depth -= 1
            if depth == 0:
                text_arr_src = bundle[start_arr:i+1]
                break
    i += 1
else:
    raise RuntimeError("text array not closed")
print(f"[OK] 提取 lunyu text 数组: {len(text_arr_src)} bytes")
text_arr = json.loads(text_arr_src)
LUNYU_IDS = [c['id'] for c in text_arr]
print(f"lunyuText id 数: {len(LUNYU_IDS)}")

# 抽样 10 章
SAMPLE = [
  'xueer-01','xueer-02','xiangdang-15','xiangdang-16','xiangdang-17',
  'xianjin-25','weizheng-12','bayi-10','shuer-04','zilu-30',
]
PH_RE = re.compile(r'(敬请期待|资料整理|translation unavailable|待补充)', re.I)
print("\n--- 抽样 10 章译文 ---")
ok_sample = 0
for sid in SAMPLE:
    e = tc.get(sid)
    txt = ''
    if e:
        if isinstance(e, str):
            txt = e
        elif isinstance(e, dict):
            for k in ('yangbojun','text','baihua','白话文译文','白话译文','translation','trans'):
                if k in e and isinstance(e[k],str) and e[k].strip(): txt = e[k]; break
            if not txt:
                for v in e.values():
                    if isinstance(v,str) and v.strip(): txt = v; break
    ph = bool(PH_RE.search(txt))
    empty = len(txt.strip()) < 4
    if not ph and not empty: ok_sample += 1
    print(f"  [{'❌PH' if ph else ('❌空' if empty else '✅')}] {sid:15s} len={len(txt):4d}  开头={txt[:24]!r}")

# 全量扫
global_missing = 0; global_ph = 0; global_empty = 0
for lid in LUNYU_IDS:
    e = tc.get(lid)
    if not e: global_missing += 1; continue
    txt = ''
    if isinstance(e, str):
        txt = e
    elif isinstance(e, dict):
        for k in ('yangbojun','text','baihua','白话文译文','白话译文','translation','trans'):
            if k in e and isinstance(e[k],str) and e[k].strip(): txt = e[k]; break
        if not txt:
            for v in e.values():
                if isinstance(v,str) and v.strip(): txt = v; break
    if PH_RE.search(txt): global_ph += 1
    if len(txt.strip()) < 4: global_empty += 1
print(f"\n--- 全量 {len(LUNYU_IDS)} 章扫描 ---")
print(f"  missing key（译文没挂上）: {global_missing}")
print(f"  placeholder（敬请期待） : {global_ph}")
print(f"  空翻译(<4字)            : {global_empty}")
final = (global_missing == 0 and global_ph == 0 and global_empty == 0 and ok_sample == len(SAMPLE))
print("\n" + ("✅✅✅ 100% 离线可用：抽样 10/10 通过，全量 0 missing / 0 placeholder / 0 empty" if final else "❌ 验证失败"))
