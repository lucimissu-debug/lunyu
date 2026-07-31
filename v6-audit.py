#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v6 翻译核对（纯 Python，不依赖 node）"""
import json, os, re, sys

BASE = "/Users/zhongjiangzhang/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a6b760c59af87f56c47b958"

# 1. 读 data-bundle.js，找 text 数组里的每个 { id: "...", title: "...", original: "...", ... }
#    手工 parse 太慢，直接用正则抓所有形如 id:"xueer-01",original:"...."，用 JSON 风格的字段做匹配
with open(os.path.join(BASE, "assets", "data-bundle.js"), "r", encoding="utf-8") as f:
    bundle = f.read()

# 2. 找 window.LUNYU_DATA = {text:[...]} 的模式
# 更可靠：从 bundle 里找到 text: [ 开始到 ], 结束的范围，把它变成合法 JSON
# 方法：找 text: 后面的 [ ... ]，平衡括号
start_idx = bundle.find('text: [')
if start_idx == -1:
    print("FATAL: no text: [ found"); sys.exit(1)

start_bracket = bundle.index('[', start_idx)
depth = 0
i = start_bracket
while i < len(bundle):
    c = bundle[i]
    if c == '[': depth += 1
    elif c == ']':
        depth -= 1
        if depth == 0: break
    elif c == '"':
        # skip string content including escapes
        j = i + 1
        while j < len(bundle):
            if bundle[j] == '\\':
                j += 2
                continue
            if bundle[j] == '"':
                break
            j += 1
        i = j
    i += 1
end_bracket = i + 1

text_js = bundle[start_bracket:end_bracket]  # should be a valid JS array literal

# 把 JS object literal 转成 JSON：把 { id: "x", ... } 改成 { "id": "x", ... }
# 只处理我们关心的字段名（已知字符串字段），并且字段名必须是 identifier: " 或 identifier:' 或 identifier:[ 或 identifier:{ 或数字
def js_literal_to_json(s):
    # s 是一个平衡括号的 JS 数组字面量
    # 1. 处理对象 key: 匹配 ( 开头的 , 或 { 后面紧跟 ident:  )
    #    正则：找 ({|,)\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:
    #    但需要跳过字符串
    out = []
    i = 0
    while i < len(s):
        c = s[i]
        if c == '"' or c == "'":
            # 字符串，整段保留
            quote = c
            out.append('"')  # JSON only allows double quote
            j = i + 1
            while j < len(s):
                ch = s[j]
                if ch == '\\':
                    # escape, keep as-is
                    out.append(s[j:j+2])
                    j += 2
                    continue
                if ch == quote:
                    break
                if ch == '"':
                    # 内部双引号转义
                    out.append('\\"')
                else:
                    out.append(ch)
                j += 1
            out.append('"')
            i = j + 1
            continue
        # 检测 identifier: (对象键)
        if c in '{,' and i + 1 < len(s):
            # 读后面的空白 + identifier
            j = i + 1
            while j < len(s) and s[j] in ' \t\n\r': j += 1
            # j 现在应该是 identifier 的开头
            if re.match(r'[a-zA-Z_$]', s[j]):
                k = j
                while k < len(s) and re.match(r'[a-zA-Z0-9_$]', s[k]): k += 1
                ident = s[j:k]
                # 跳过 k 后面的空白 + 冒号
                m = k
                while m < len(s) and s[m] in ' \t\n\r': m += 1
                if m < len(s) and s[m] == ':':
                    # 是对象键
                    out.append(c)
                    out.append('"')
                    out.append(ident)
                    out.append('":')
                    i = m + 1
                    continue
        # 普通字符
        out.append(c)
        i += 1
    return ''.join(out)

text_json = js_literal_to_json(text_js)
text = json.loads(text_json)
print(f"[INFO] lunyuText count: {len(text)}")

# 3. 读 translations 和 commentaries
with open(os.path.join(BASE, "assets", "translations_yangbojun.json"), "r", encoding="utf-8") as f:
    trans = json.load(f)
with open(os.path.join(BASE, "assets", "commentaries.json"), "r", encoding="utf-8") as f:
    comms = json.load(f)

print(f"[INFO] translations chapters: {len(trans.get('chapters',{}))} (filled_count: {trans.get('_meta',{}).get('filled_count')})")
print(f"[INFO] commentaries chapters: {len(comms.get('chapters',{}))} (filled_count: {comms.get('_meta',{}).get('filled_count')})")

# ========= 核对 1：缺失/占位翻译 =========
EMPTY_MARKERS = ['译文录入中','翻译资料，敬请期待','敬请期待','暂无翻译','待补充','（待补）','校对中','待定']
def is_bad(t):
    if not t: return True
    s = t.strip()
    if not s or len(s) < 5: return True
    for m in EMPTY_MARKERS:
        if m in s: return True
    return False

missing = []
for c in text:
    t = trans.get('chapters',{}).get(c['id'],{}).get('translation')
    if is_bad(t):
        missing.append({'id':c['id'], 'title':c.get('title',''), 'original':c.get('original','')[:60], 'translation':(t or '')[:80]})
print(f"\n=== 核对 1：缺失/占位翻译 ===")
print(f"缺失/占位: {len(missing)} / {len(text)}")
if missing:
    for m in missing:
        print(f"  - {m['id']} 「{m['title']}」 translation=「{m['translation'].strip()}」")
else:
    print("  ✓ 498 章 translation 字段都有实际内容。")

# ========= 核对 2：乡党篇 15/16/17 =========
print(f"\n=== 核对 2：乡党篇（xiangdang）15/16/17 ===")
for n in ['15','16','17']:
    ch_id = f'xiangdang-{n}'
    ch = next((c for c in text if c['id'] == ch_id), None)
    tr = trans.get('chapters',{}).get(ch_id,{}).get('translation')
    if ch:
        print(f"\n【{ch_id}】{ch.get('title','')}")
        print(f"  原文: {ch.get('original','')}")
        print(f"  译文: {tr.strip() if tr else '(N/A)'}")
    else:
        print(f"【{ch_id}】 不存在！")

# ========= 核对 3：翻译错位检测 =========
CLASSICAL = ['子曰','子谓','对曰','问曰','孔子曰','子贡曰','子路曰','曾子曰','有子曰','子夏曰','子张曰','冉有曰','仲弓问','樊迟问','宪问','诗云','书云']

def similarity(a, b):
    sa = set(a); sb = set(b)
    inter = sum(1 for c in sa if c in sb)
    return inter / max(1, max(len(a), len(b)))

misaligned = []
for c in text:
    tr = (trans.get('chapters',{}).get(c['id'],{}).get('translation') or '').strip()
    if not tr: continue
    orig = c.get('original','')
    # 规则 A：白话译文里出现文言起手词
    for mk in CLASSICAL:
        if mk in tr:
            misaligned.append({'kind':'A','id':c['id'],'marker':mk,'title':c.get('title',''),'te':tr[:80]})
            break
    # 规则 B：高相似度
    sim = similarity(orig, tr)
    if sim > 0.72 and len(orig) > 12:
        misaligned.append({'kind':'B','id':c['id'],'sim':f'{sim:.2f}','title':c.get('title',''),'te':tr[:80],'oe':orig[:80]})

print(f"\n=== 核对 3：翻译错位检测（文言词/高相似度） ===")
print(f"可疑: {len(misaligned)}")
if misaligned:
    for m in misaligned:
        if m['kind']=='A':
            print(f"  [A] {m['id']} 「{m['title']}」 译文中有「{m['marker']}」 → {m['te']}")
        else:
            print(f"  [B] {m['id']} 「{m['title']}」 sim={m['sim']} | 原:{m['oe']} | 译:{m['te']}")
else:
    print("  ✓ 未检测到明显错位。")

# ========= 核对 4：commentaries 缺失 =========
print(f"\n=== 核对 4：commentaries 缺失 ===")
cmiss = []
for c in text:
    cm = comms.get('chapters',{}).get(c['id'])
    cm_list = cm.get('commentaries', []) if cm else []
    any_real = any((x.get('content') or '').strip() and x.get('status') != 'todo' for x in cm_list)
    if not any_real:
        cmiss.append(f"{c['id']} {c.get('title','')}")
print(f"名家解读缺失: {len(cmiss)}")
for m in cmiss: print('  -', m)

# ========= 写报告 =========
report = {
    'summary': {
        'lunyuText': len(text),
        'translations': len(trans.get('chapters',{})),
        'trans_filled': trans.get('_meta',{}).get('filled_count'),
        'commentaries': len(comms.get('chapters',{})),
        'comm_filled': comms.get('_meta',{}).get('filled_count'),
        'missing_trans': len(missing),
        'misaligned': len(misaligned),
        'comm_missing': len(cmiss),
    },
    'missing_translations': missing,
    'misaligned': misaligned,
    'comm_missing': cmiss,
    'xiangdang_15_17': []
}
for n in ['15','16','17']:
    ch_id = f'xiangdang-{n}'
    ch = next((c for c in text if c['id'] == ch_id), None)
    if ch:
        report['xiangdang_15_17'].append({
            'id': ch_id, 'title': ch.get('title',''),
            'original': ch.get('original',''),
            'translation': trans.get('chapters',{}).get(ch_id,{}).get('translation')
        })
    else:
        report['xiangdang_15_17'].append({'id': ch_id, 'notFound': True})

report_path = os.path.join(BASE, 'assets', 'v6_data_audit_report.json')
with open(report_path, 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
print(f"\n报告: {report_path}")
print("DONE")
