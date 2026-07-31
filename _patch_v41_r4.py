#!/usr/bin/env python3
"""v4.1 第四轮补丁：ensurePersonTabsMounted 加重试机制 + 桌面浏览器兼容"""

JS_PATH = "/Users/zhongjiangzhang/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a6b760c59af87f56c47b958/assets/app-mobile-v4.1.js"

with open(JS_PATH, "r", encoding="utf-8") as f:
    js = f.read()

# 修复：ensurePersonTabsMounted 找不到 sections 时，不 return，而是 setTimeout 重试
old_ensure = """  var personTabsMounted = false;
  function ensurePersonTabsMounted() {
    if (personTabsMounted) return;
    var detail = document.querySelector('.person-detail-panel');
    if (!detail) return;
    // v4.1 FIX: 人物详情实际结构（按顺序）：
    //   0 person-header  1 person-bio
    //   2 stat-strip#stat-strip-qa  = 提问统计 (TABS[0] stats)
    //   3 stat-strip#stat-strip-dp  = 对话互动 (TABS[1] dialog)
    //   4 collection-block#block-spoken = 说话合集 (TABS[2] speeches)
    //   5 collection-block#block-mentioned = 被提及合集 (TABS[3] mentioned)
    var qaBlock = detail.querySelector(':scope > #stat-strip-qa');
    var dpBlock = detail.querySelector(':scope > #stat-strip-dp');
    var spBlock = detail.querySelector(':scope > #block-spoken');
    var meBlock = detail.querySelector(':scope > #block-mentioned');
    var sections = [qaBlock, dpBlock, spBlock, meBlock].filter(function(x){ return !!x; });
    if (sections.length < 2) return;
    personTabsMounted = true;"""

new_ensure = """  var personTabsMounted = false;
  var __tabsRetryCount = 0;
  function ensurePersonTabsMounted() {
    if (personTabsMounted) return;
    var detail = document.querySelector('.person-detail-panel');
    if (!detail) {
      // v4.1 FIX: 找不到详情面板，重试（最多 8 次）
      if (__tabsRetryCount < 8) { __tabsRetryCount++; setTimeout(ensurePersonTabsMounted, 200 * __tabsRetryCount); }
      return;
    }
    var qaBlock = detail.querySelector(':scope > #stat-strip-qa');
    var dpBlock = detail.querySelector(':scope > #stat-strip-dp');
    var spBlock = detail.querySelector(':scope > #block-spoken');
    var meBlock = detail.querySelector(':scope > #block-mentioned');
    var sections = [qaBlock, dpBlock, spBlock, meBlock].filter(function(x){ return !!x; });
    // v4.1 FIX: sections 不足 2 个（详情还没渲染完成）→ 重试最多 8 次
    if (sections.length < 2) {
      if (__tabsRetryCount < 8) {
        __tabsRetryCount++;
        setTimeout(ensurePersonTabsMounted, 250 * __tabsRetryCount);
      }
      return;
    }
    __tabsRetryCount = 0;
    personTabsMounted = true;"""

if old_ensure in js:
    js = js.replace(old_ensure, new_ensure)
    print("[1] ensurePersonTabsMounted retry added")
else:
    print("[1] ensurePersonTabsMounted anchor NOT FOUND! Trying partial...")
    # 尝试部分匹配
    if 'var sections = [qaBlock, dpBlock, spBlock, meBlock].filter(function(x){ return !!x; });' in js:
        js = js.replace(
            '    var sections = [qaBlock, dpBlock, spBlock, meBlock].filter(function(x){ return !!x; });\n    if (sections.length < 2) return;\n    personTabsMounted = true;',
            '    var sections = [qaBlock, dpBlock, spBlock, meBlock].filter(function(x){ return !!x; });\n    if (sections.length < 2) { if (__tabsRetryCount < 8) { __tabsRetryCount++; setTimeout(ensurePersonTabsMounted, 250 * __tabsRetryCount); } return; }\n    __tabsRetryCount = 0;\n    personTabsMounted = true;'
        )
        js = js.replace(
            '  var personTabsMounted = false;\n  function ensurePersonTabsMounted() {',
            '  var personTabsMounted = false;\n  var __tabsRetryCount = 0;\n  function ensurePersonTabsMounted() {'
        )
        print("[1b] partial fix applied")
    else:
        print("[1c] FAILED - check manually")

# 修复 2：同时把 IS_MOBILE 的判断放宽——即使在桌面浏览器预览，只要是 mobile 版 HTML 也执行
old_is_mobile_v4 = """  var IS_MOBILE = window.innerWidth <= 900 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (!IS_MOBILE) return;"""

new_is_mobile_v4 = """  // v4.1 FIX: 桌面浏览器预览时（宽度 > 900）也生效，因为是独立的 mobile 版 HTML
  var IS_MOBILE = true;  // lunyu-mvp-mobile-v*.html 是独立移动端，永远按移动端逻辑
  // var IS_MOBILE = window.innerWidth <= 900 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (!IS_MOBILE) return;"""

# 有两个 patch：mobileV4Patch 和 mobileV3Patch，都需要改
count_v4 = js.count('(function mobileV4Patch(){')
count_v3 = js.count('(function mobileV3Patch(){')
print(f"Found mobileV4Patch={count_v4}, mobileV3Patch={count_v3}")

# v4 patch 的 IS_MOBILE
if old_is_mobile_v4 in js:
    c_before = js.count(old_is_mobile_v4)
    js = js.replace(old_is_mobile_v4, new_is_mobile_v4)
    c_after = js.count(new_is_mobile_v4)
    print(f"[2] IS_MOBILE v4: replaced {c_before} → {c_after} occurrences")
else:
    print("[2] v4 IS_MOBILE pattern not found, trying looser match...")
    # 松一点匹配
    loose = "var IS_MOBILE = window.innerWidth <= 900 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);"
    if loose in js:
        # 只替换 mobileV4Patch 之后的第一个
        idx = js.find('(function mobileV4Patch(){')
        if idx >= 0:
            idx2 = js.find(loose, idx)
            idx3 = js.find('})();', idx)
            if idx2 >= 0 and (idx3 < 0 or idx2 < idx3):
                js = js[:idx2] + new_is_mobile_v4 + js[idx2 + len(loose):]
                print("[2b] v4 IS_MOBILE replaced via position")

# v3 patch 的 IS_MOBILE（同样改成 true）
new_is_mobile_v3 = new_is_mobile_v4.replace('mobile 版 HTML', 'v3 mobile HTML')

# 先找 mobileV3Patch 函数里的 IS_MOBILE
idx_v3 = js.find('(function mobileV3Patch(){')
if idx_v3 >= 0:
    loose_v3_tpl = loose
    idx_v3_is = js.find(loose_v3_tpl, idx_v3)
    idx_v3_end = js.find('})();', idx_v3 + 1)
    if idx_v3_is >= 0 and (idx_v3_end < 0 or idx_v3_is < idx_v3_end):
        v3_new = """  // v4.1 FIX: 桌面预览也生效
  var IS_MOBILE = true;
  if (!IS_MOBILE) return;"""
        js = js[:idx_v3_is] + v3_new + js[idx_v3_is + len(loose_v3_tpl):]
        print("[3] v3 IS_MOBILE replaced via position")

with open(JS_PATH, "w", encoding="utf-8") as f:
    f.write(js)
print(f"[DONE] JS patch round 4 applied: {len(js)} chars")
