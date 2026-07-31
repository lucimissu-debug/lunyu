#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v6 深度翻译核对：text字段名修正 + 乡党篇全文对译 + 全文翻译错位率统计"""
import json, os, re, sys

BASE = "/Users/zhongjiangzhang/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a6b760c59af87f56c47b958"

# 手工解析 data-bundle.js text 数组（这次正确用 text 字段名）
with open(os.path.join(BASE, "assets", "data-bundle.js"), "r", encoding="utf-8") as f:
    bundle = f.read()

# 平衡括号找 text: [...] 范围
start_idx = bundle.find('text: [')
start_bracket = bundle.index('[', start_idx)
depth = 0; i = start_bracket
in_str = False; quote = None
while i < len(bundle):
    c = bundle[i]
    if in_str:
        if c == '\\': i += 2; continue
        if c == quote: in_str = False
    else:
        if c in ('"', "'"): in_str = True; quote = c
        elif c == '[': depth += 1
        elif c == ']':
            depth -= 1
            if depth == 0: break
    i += 1
end_bracket = i + 1

text_js = bundle[start_bracket:end_bracket]

# JS → JSON
def js_to_json(s):
    out = []; i = 0
    while i < len(s):
        c = s[i]
        if c in ('"', "'"):
            q = c; out.append('"')
            j = i + 1
            while j < len(s):
                ch = s[j]
                if ch == '\\': out.append(s[j:j+2]); j += 2; continue
                if ch == q: break
                if ch == '"': out.append('\\"')
                else: out.append(ch)
                j += 1
            out.append('"'); i = j + 1; continue
        if c in '{,':
            j = i + 1
            while j < len(s) and s[j] in ' \t\n\r': j += 1
            if re.match(r'[a-zA-Z_$]', s[j]):
                k = j
                while k < len(s) and re.match(r'[a-zA-Z0-9_$]', s[k]): k += 1
                ident = s[j:k]
                m = k
                while m < len(s) and s[m] in ' \t\n\r': m += 1
                if m < len(s) and s[m] == ':':
                    out.append(c + '"' + ident + '":')
                    i = m + 1; continue
        out.append(c); i += 1
    return ''.join(out)

text = json.loads(js_to_json(text_js))
print(f"[INFO] lunyuText: {len(text)} (字段示例 keys: {list(text[0].keys()) if text else 'N/A'})")

with open(os.path.join(BASE, "assets", "translations_yangbojun.json"), "r", encoding="utf-8") as f:
    trans = json.load(f)

# ========== 深度 A：乡党篇全文 text vs translation 逐节比对 ==========
xiangdang = [c for c in text if c["id"].startswith("xiangdang-")]
xiangdang.sort(key=lambda c: int(c["id"].split("-")[1]))
print(f"\n{'='*70}")
print(f"【深度 A】乡党篇全文逐节核对（共 {len(xiangdang)} 节）")
print(f"{'='*70}")

problems = []
for c in xiangdang:
    cid = c["id"]; num = int(cid.split("-")[1])
    t_orig = c.get("text", "").strip()
    t_tr = (trans.get("chapters",{}).get(cid,{}).get("translation") or "").strip()
    # heuristic: 原文含句号/问号总数 vs 译文核心句数
    orig_sent = len(re.findall(r'[。？！]', t_orig)) or 1
    # 检查「原文里有 季康子/康子 但译文里没有」等错配
    keywords = ["康子","季康子","厩焚","马棚","君赐","朋友死","寝不尸","色斯举","雌雉","太庙","迅雷","升车","齐衰","负版","盛馔"]
    mismatched_kw = []
    for kw in keywords:
        if kw in t_orig and kw not in t_tr:
            # 译文可能用了其他词（如「马棚失了火」= 厩焚），再放宽：翻译中相关同义词
            syn = {"厩焚":["马棚","失了火","失火","马房"], "康子":["季康子","馈药","赠药","送药","药品"], "雌雉":["山梁","野鸡"], "太庙":["太庙里"], "迅雷":["雷霆","雷暴","大风"], "升车":["上车"], "齐衰":["穿孝服","丧服"], "盛馔":["丰盛的","盛宴"], "君赐食":["国君赐给食物","君主赏赐食物"], "君赐腥":["国君赐给生肉"], "君赐生":["国君赐给活物"], "寝不尸":["睡觉不像死尸"], "色斯举":["脸色一动","野鸡飞起来"], "朋友死":["朋友去世"], "负版者":["背负国家图籍的人"]}
            found_syn = any(s in t_tr for s in syn.get(kw, []))
            if not found_syn:
                mismatched_kw.append(kw)
    # 短原文 vs 长译文（长度异常比例）
    len_ratio = len(t_tr) / max(1, len(t_orig))
    suspicious_len = len_ratio < 0.4 or len_ratio > 6.0
    mark = ""
    if mismatched_kw or suspicious_len:
        mark = " ⚠️  " + ("缺关键词:"+','.join(mismatched_kw) if mismatched_kw else "") + (f" 长比={len_ratio:.2f}" if suspicious_len else "")
        problems.append({"id": cid, "num": num, "kind": "mismatch", "detail": mark, "orig": t_orig, "trans": t_tr})
    print(f"\nxiangdang-{num:02d} orig({len(t_orig)}字): {t_orig}")
    print(f"           译({len(t_tr)}字): {t_tr[:160]}{'…' if len(t_tr)>160 else ''}{mark}")

# ========== 深度 B：全文翻译错位检测（keyword overlap + 长度异常） ==========
print(f"\n{'='*70}")
print(f"【深度 B】全文 498 章翻译错位率检测")
print(f"{'='*70}")

# 专有名词：人名+地名+典型词，原文出现的话译文里应该有对应
PROPER = ["孔子","子曰","子路","子贡","颜回","颜渊","曾子","冉有","季康子","孟懿子","孟武伯","子游","子夏","子张","公西华","樊迟","原思","宰我","仲弓","闵子骞","南容","孔子退朝","齐景公","哀公","定公","叶公","卫灵公","管仲","公山弗扰","佛肸","阳货","武城","泰山","太庙","陈","蔡","卫"]

global_issues = []
for c in text:
    cid = c["id"]
    t_orig = c.get("text","").strip(); t_tr = (trans.get("chapters",{}).get(cid,{}).get("translation") or "").strip()
    if not t_orig or not t_tr:
        global_issues.append({"id":cid, "kind":"empty", "orig":t_orig[:60], "trans":t_tr[:60]})
        continue
    # 长度比
    r = len(t_tr) / max(1, len(t_orig))
    if r < 0.35 or r > 7.0:
        global_issues.append({"id":cid, "kind":"len", "ratio":f"{r:.2f}", "orig":t_orig[:80], "trans":t_tr[:80]})
        continue
    # 专有名词错配：原文里的专有名词，译文里完全找不到（包括译文的同义词放宽太复杂，这里只做硬检测——只 flag 强错配）
    miss = []
    for p in PROPER:
        if p in t_orig and p not in t_tr:
            # 宽松：孔子=孔丘=孔夫子/夫子=先生，子曰=孔子说/孔子道
            syn = {"孔子":["孔夫子","夫子","孔丘"], "子曰":["孔子说","孔子答道","孔子回答","孔子说过","先生说"], "季康子":["康子"], "孟懿子":["懿子"], "孟武伯":["武伯"], "颜渊":["颜回"], "曾子":["曾参"], "宰我":["宰予"], "公西华":["公西赤"], "原思":["原宪"], "南容":["南宫适"], "齐景公":["景公"], "哀公":["鲁哀公"], "定公":["鲁定公"], "叶公":["沈诸梁"], "卫灵公":["灵公"], "公山弗扰":["公山不狃"], "佛肸":["佛肸召"], "阳货":["阳虎"]}
            ok = False
            for s in syn.get(p, []):
                if s in t_tr: ok = True; break
            # 再放宽：子路子贡子游子夏子张樊迟这些一般人名会保留原样
            if not ok: miss.append(p)
    if len(miss) >= 3:  # 至少缺 3 个专有名词才 flag（减少误报）
        global_issues.append({"id":cid, "kind":"proper", "missing":miss, "orig":t_orig[:80], "trans":t_tr[:80]})

print(f"\n总问题数: {len(global_issues)} / {len(text)} = {len(global_issues)/len(text)*100:.1f}%")
by_kind = {}
for g in global_issues:
    by_kind[g["kind"]] = by_kind.get(g["kind"], 0) + 1
print(f"按类型分: {by_kind}")
if global_issues:
    print("\n全部问题清单:")
    for g in global_issues:
        if g["kind"] == "proper":
            print(f"  [PROPER] {g['id']} 缺专有名词: {g['missing']} | 原文: {g['orig']} | 译文: {g['trans']}")
        elif g["kind"] == "len":
            print(f"  [LEN] {g['id']} 长比={g['ratio']} | 原文({len(g['orig'])}): {g['orig']} | 译文({len(g['trans'])}): {g['trans']}")
        else:
            print(f"  [EMPTY] {g['id']} orig='{g['orig']}' trans='{g['trans']}'")

# ========== 写详细报告 ==========
report_path = os.path.join(BASE, "assets", "v6_deep_trans_audit.json")
report = {
    "xiangdang_summary": {
        "total_sections": len(xiangdang),
        "problems": len(problems),
        "xiangdang_problems": problems
    },
    "global_summary": {
        "total": len(text),
        "total_issues": len(global_issues),
        "issue_rate_pct": round(len(global_issues)/len(text)*100, 2),
        "by_kind": by_kind,
        "global_issues": global_issues
    }
}
with open(report_path, "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
print(f"\n详细报告: {report_path}")
print("DONE")
