#!/usr/bin/env python3
"""v4.1 第四轮补丁（修复版）：ensurePersonTabsMounted 重试 + IS_MOBILE 强制 true"""

JS_PATH = "/Users/zhongjiangzhang/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a6b760c59af87f56c47b958/assets/app-mobile-v4.1.js"

with open(JS_PATH, "r", encoding="utf-8") as f:
    js = f.read()

IS_MOBILE_TPL = "var IS_MOBILE = window.innerWidth <= 900 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);"
NEW_MOBILE_V4 = """  // v4.1 FIX: lunyu-mvp-mobile-v*.html 是独立移动端，桌面浏览器预览也生效
  var IS_MOBILE = true;
  if (!IS_MOBILE) return;"""
NEW_MOBILE_V3 = NEW_MOBILE_V4

# 修复 1：ensurePersonTabsMounted 重试机制
partial_target = '    var sections = [qaBlock, dpBlock, spBlock, meBlock].filter(function(x){ return !!x; });\n    if (sections.length < 2) return;\n    personTabsMounted = true;'
partial_replacement = '    var sections = [qaBlock, dpBlock, spBlock, meBlock].filter(function(x){ return !!x; });\n    if (sections.length < 2) { if (__tabsRetryCount < 8) { __tabsRetryCount++; setTimeout(ensurePersonTabsMounted, 250 * __tabsRetryCount); } return; }\n    __tabsRetryCount = 0;\n    personTabsMounted = true;'
if partial_target in js:
    js = js.replace(partial_target, partial_replacement)
    # 加 __tabsRetryCount 变量声明
    js = js.replace(
        '  var personTabsMounted = false;\n  function ensurePersonTabsMounted() {',
        '  var personTabsMounted = false;\n  var __tabsRetryCount = 0;\n  function ensurePersonTabsMounted() {'
    )
    print("[1] ensurePersonTabsMounted retry added")
else:
    print("[1] WARNING: ensurePersonTabsMounted target NOT FOUND")

# 修复 2：mobileV4Patch 里的 IS_MOBILE
idx4 = js.find('(function mobileV4Patch(){')
if idx4 >= 0:
    idx4_is = js.find(IS_MOBILE_TPL, idx4)
    idx4_end = js.find('})();', idx4 + 1)
    if idx4_is >= 0 and (idx4_end < 0 or idx4_is < idx4_end):
        js = js[:idx4_is] + NEW_MOBILE_V4 + js[idx4_is + len(IS_MOBILE_TPL):]
        print("[2] mobileV4Patch IS_MOBILE replaced")
    else:
        print("[2] WARNING: mobileV4Patch IS_MOBILE not found in scope")

# 修复 3：mobileV3Patch 里的 IS_MOBILE
idx3 = js.find('(function mobileV3Patch(){')
if idx3 >= 0:
    idx3_is = js.find(IS_MOBILE_TPL, idx3)
    idx3_end = js.find('})();', idx3 + 1)
    if idx3_is >= 0 and (idx3_end < 0 or idx3_is < idx3_end):
        js = js[:idx3_is] + NEW_MOBILE_V3 + js[idx3_is + len(IS_MOBILE_TPL):]
        print("[3] mobileV3Patch IS_MOBILE replaced")
    else:
        print("[3] WARNING: mobileV3Patch IS_MOBILE not found in scope")

# 统计 IS_MOBILE = true 的剩余数量
print(f"[stats] IS_MOBILE = true occurrences: {js.count('var IS_MOBILE = true;')}")
print(f"[stats] old IS_MOBILE patterns remaining: {js.count(IS_MOBILE_TPL)}")

with open(JS_PATH, "w", encoding="utf-8") as f:
    f.write(js)
print(f"[DONE] patched {len(js)} chars")
