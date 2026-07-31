#!/usr/bin/env python3
"""v4.1 第五轮（最终）补丁：确保 4 Tab 100% 挂载"""

JS_PATH = "/Users/zhongjiangzhang/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a6b760c59af87f56c47b958/assets/app-mobile-v4.1.js"

with open(JS_PATH, "r", encoding="utf-8") as f:
    js = f.read()

# 修复：_watchPersonDetail 启动后立即执行一次 ensurePersonTabsMounted（如果已经渲染完了）
old_watch_start = """  var _personDetailMO = null;
  function _watchPersonDetail() {
    if (_personDetailMO) return;
    try {
      var pdp = document.querySelector('.person-detail-panel');
      if (!pdp) return;
      _personDetailMO = new MutationObserver(function(muts) {
        // 每次人物详情变化，尝试挂载 Tab + 切换
        var need = false;
        for (var mi = 0; mi < muts.length; mi++) {
          if (muts[mi].addedNodes && muts[mi].addedNodes.length > 0) { need = true; break; }
        }
        if (need) {
          setTimeout(function(){
            ensurePersonTabsMounted();
            switchPersonTab('stats');
          }, 50);
          setTimeout(function(){
            ensurePersonTabsMounted();
            switchPersonTab('stats');
          }, 200);
        }
      });
      _personDetailMO.observe(pdp, { childList: true, subtree: false });
    } catch(e) { _personDetailMO = null; }
  }
  setTimeout(_watchPersonDetail, 500);
  setTimeout(_watchPersonDetail, 1500);"""

new_watch_start = """  var _personDetailMO = null;
  function _watchPersonDetail() {
    if (_personDetailMO) return;
    try {
      var pdp = document.querySelector('.person-detail-panel');
      if (!pdp) return;
      // v4.1 FIX: 启动观察前立即检查一次（如果详情已经渲染完成）
      var qa = pdp.querySelector(':scope > #stat-strip-qa');
      if (qa) {
        setTimeout(function(){ ensurePersonTabsMounted(); switchPersonTab('stats'); }, 0);
        setTimeout(function(){ ensurePersonTabsMounted(); switchPersonTab('stats'); }, 80);
        setTimeout(function(){ ensurePersonTabsMounted(); switchPersonTab('stats'); }, 250);
      }
      _personDetailMO = new MutationObserver(function(muts) {
        var need = false;
        for (var mi = 0; mi < muts.length; mi++) {
          if (muts[mi].addedNodes && muts[mi].addedNodes.length > 0) { need = true; break; }
        }
        if (need) {
          setTimeout(function(){ ensurePersonTabsMounted(); switchPersonTab('stats'); }, 50);
          setTimeout(function(){ ensurePersonTabsMounted(); switchPersonTab('stats'); }, 200);
          setTimeout(function(){ ensurePersonTabsMounted(); switchPersonTab('stats'); }, 600);
        }
      });
      _personDetailMO.observe(pdp, { childList: true, subtree: false });
    } catch(e) { _personDetailMO = null; }
  }
  setTimeout(_watchPersonDetail, 300);
  setTimeout(_watchPersonDetail, 800);
  setTimeout(_watchPersonDetail, 1500);
  setTimeout(_watchPersonDetail, 3000);"""

if old_watch_start in js:
    js = js.replace(old_watch_start, new_watch_start)
    print("[1] _watchPersonDetail enhanced")
else:
    print("[1] WARNING: _watchPersonDetail anchor not found")

# 修复2：重试次数从 8 加到 15，确保最长等待 ~11 秒
if '__tabsRetryCount < 8' in js:
    js = js.replace('__tabsRetryCount < 8', '__tabsRetryCount < 15')
    print("[2] retry count updated to 15")
else:
    print("[2] retry count check pattern not found")

# 修复3：defaultSelectKongzi 里的 setTimeout 再加一次 3s 的兜底
old_dsk_2set = """    updateSubNav(name, id, group);
    setTimeout(function(){
      highlightDrawerActive(id);
      ensurePersonTabsMounted();
      switchPersonTab('stats');
    }, 500);
    setTimeout(function(){
      ensurePersonTabsMounted();
      switchPersonTab('stats');
    }, 1200);
  }"""

new_dsk_2set = """    updateSubNav(name, id, group);
    setTimeout(function(){
      highlightDrawerActive(id);
      ensurePersonTabsMounted();
      switchPersonTab('stats');
    }, 500);
    setTimeout(function(){
      ensurePersonTabsMounted();
      switchPersonTab('stats');
    }, 1200);
    setTimeout(function(){
      ensurePersonTabsMounted();
      switchPersonTab('stats');
    }, 2500);
    setTimeout(function(){
      ensurePersonTabsMounted();
      switchPersonTab('stats');
    }, 4500);
  }"""

if old_dsk_2set in js:
    js = js.replace(old_dsk_2set, new_dsk_2set)
    print("[3] defaultSelectKongzi extra fallbacks added")
else:
    print("[3] WARNING: defaultSelectKongzi anchor not found, trying partial...")
    partial_pattern = "    setTimeout(function(){\n      ensurePersonTabsMounted();\n      switchPersonTab('stats');\n    }, 1200);\n  }"
    if partial_pattern in js:
        js = js.replace(partial_pattern,
            "    setTimeout(function(){\n      ensurePersonTabsMounted();\n      switchPersonTab('stats');\n    }, 1200);\n    setTimeout(function(){\n      ensurePersonTabsMounted();\n      switchPersonTab('stats');\n    }, 2500);\n    setTimeout(function(){\n      ensurePersonTabsMounted();\n      switchPersonTab('stats');\n    }, 4500);\n  }")
        print("[3b] partial pattern replaced")

with open(JS_PATH, "w", encoding="utf-8") as f:
    f.write(js)
print(f"[DONE] patched {len(js)} chars")
