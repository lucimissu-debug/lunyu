#!/usr/bin/env python3
"""v4.1 最终补丁：4 Tab 挂载改为 setInterval 轮询（最可靠）"""

JS_PATH = "/Users/zhongjiangzhang/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a6b760c59af87f56c47b958/assets/app-mobile-v4.1.js"

with open(JS_PATH, "r", encoding="utf-8") as f:
    js = f.read()

# 完全替换 ensurePersonTabsMounted 开头的重试逻辑为 setInterval 轮询
# 先找到 TABS 数组声明，把轮询代码加在 mobileV4Patch 最后

# 找到 mobileV4Patch 最后的 fallback 代码之后加轮询
old_fallback_end = """  // 点击人物 Tab 后 1 秒再兜底挂载一次
  document.addEventListener('click', function(e) {
    if (e.target.closest('.nav-tab[data-tab="persons"]')) {
      setTimeout(_fallbackBuildDrawer, 300);
      setTimeout(_fallbackEnsureTabs, 800);
      setTimeout(_fallbackEnsureTabs, 1600);
    }
    if (e.target.closest('.nav-tab[data-tab="filter"]')) {
      setTimeout(_fallbackRemoveSummary, 100);
      setTimeout(_fallbackRemoveSummary, 500);
    }
  }, true);

})();"""

new_fallback_end = """  // 点击人物 Tab 后 1 秒再兜底挂载一次
  document.addEventListener('click', function(e) {
    if (e.target.closest('.nav-tab[data-tab="persons"]')) {
      setTimeout(_fallbackBuildDrawer, 300);
      setTimeout(_fallbackEnsureTabs, 800);
      setTimeout(_fallbackEnsureTabs, 1600);
    }
    if (e.target.closest('.nav-tab[data-tab="filter"]')) {
      setTimeout(_fallbackRemoveSummary, 100);
      setTimeout(_fallbackRemoveSummary, 500);
    }
  }, true);

  // -------- 12) v4.1 终极兜底：4 Tab 用 setInterval 轮询挂载 --------
  // 每 500ms 检查一次 person-detail-panel 是否有 #stat-strip-qa，有就挂载 Tab
  // 最多 20 次（10 秒），挂载成功后立即停止
  var __tabsPollCount = 0;
  var __tabsPollTimer = setInterval(function() {
    __tabsPollCount++;
    var pdp = document.querySelector('.person-detail-panel');
    var ready = pdp && pdp.querySelector(':scope > #stat-strip-qa') && pdp.querySelector(':scope > #block-mentioned');
    if (ready && !personTabsMounted) {
      clearInterval(__tabsPollTimer);
      __tabsPollTimer = null;
      try {
        ensurePersonTabsMounted();
        switchPersonTab('stats');
      } catch(e) {}
      // 再 double check
      setTimeout(function(){
        if (!personTabsMounted) { try { ensurePersonTabsMounted(); switchPersonTab('stats'); } catch(e){} }
      }, 150);
      return;
    }
    if (__tabsPollCount >= 20) {
      clearInterval(__tabsPollTimer);
      __tabsPollTimer = null;
    }
  }, 500);
  // 每次切到人物 Tab 重置轮询（防止之前的 person-detail-panel 被清空后重新渲染）
  document.addEventListener('click', function(e){
    if (e.target.closest('.nav-tab[data-tab="persons"]')) {
      __tabsPollCount = 0;
      if (__tabsPollTimer) clearInterval(__tabsPollTimer);
      __tabsPollTimer = setInterval(arguments.callee, 500);
    }
  }, true);

})();"""

# 注意上面的 arguments.callee 在 setInterval 里不能直接用，重新写一下
new_fallback_end = """  // 点击人物 Tab 后 1 秒再兜底挂载一次
  document.addEventListener('click', function(e) {
    if (e.target.closest('.nav-tab[data-tab="persons"]')) {
      setTimeout(_fallbackBuildDrawer, 300);
      setTimeout(_fallbackEnsureTabs, 800);
      setTimeout(_fallbackEnsureTabs, 1600);
    }
    if (e.target.closest('.nav-tab[data-tab="filter"]')) {
      setTimeout(_fallbackRemoveSummary, 100);
      setTimeout(_fallbackRemoveSummary, 500);
    }
  }, true);

  // -------- 12) v4.1 终极兜底：4 Tab 用 setInterval 轮询挂载 --------
  var __tabsPollCount = 0;
  function __tabsPollFn() {
    __tabsPollCount++;
    var pdp = document.querySelector('.person-detail-panel');
    var ready = pdp && pdp.querySelector(':scope > #stat-strip-qa') && pdp.querySelector(':scope > #block-mentioned');
    if (ready && !personTabsMounted) {
      if (__tabsPollTimer) { clearInterval(__tabsPollTimer); __tabsPollTimer = null; }
      try { ensurePersonTabsMounted(); switchPersonTab('stats'); } catch(e) {}
      setTimeout(function(){
        if (!personTabsMounted) { try { ensurePersonTabsMounted(); switchPersonTab('stats'); } catch(e){} }
      }, 150);
      return;
    }
    if (__tabsPollCount >= 20) {
      if (__tabsPollTimer) { clearInterval(__tabsPollTimer); __tabsPollTimer = null; }
    }
  }
  var __tabsPollTimer = setInterval(__tabsPollFn, 500);
  // 每次切到人物 Tab 重置轮询
  document.addEventListener('click', function(e){
    if (e.target.closest('.nav-tab[data-tab="persons"]')) {
      __tabsPollCount = 0;
      if (__tabsPollTimer) clearInterval(__tabsPollTimer);
      __tabsPollTimer = setInterval(__tabsPollFn, 500);
    }
  }, true);

})();"""

if old_fallback_end in js:
    js = js.replace(old_fallback_end, new_fallback_end)
    print("[1] polling fallback added successfully")
else:
    print("[1] anchor pattern not found! Trying to find location of last })(); in mobileV4Patch...")
    # 找 mobileV4Patch 的最后一个 })();
    idx_v4_start = js.find('(function mobileV4Patch(){')
    idx_v4_end = js.find('})();', idx_v4_start + 1)
    if idx_v4_start >= 0 and idx_v4_end >= 0:
        # 确认是 mobileV3Patch 之前的那个 })();
        idx_v3_start = js.find('(function mobileV3Patch(){')
        if idx_v4_end < idx_v3_start:
            print(f"[1b] found location: v4 end at {idx_v4_end}, v3 starts at {idx_v3_start}")
            # 在 })(); 前插入轮询代码
            insert_code = """
  // -------- 12) v4.1 终极兜底：4 Tab 用 setInterval 轮询挂载 --------
  var __tabsPollCount = 0;
  function __tabsPollFn() {
    __tabsPollCount++;
    var pdp = document.querySelector('.person-detail-panel');
    var ready = pdp && pdp.querySelector(':scope > #stat-strip-qa') && pdp.querySelector(':scope > #block-mentioned');
    if (ready && !personTabsMounted) {
      if (__tabsPollTimer) { clearInterval(__tabsPollTimer); __tabsPollTimer = null; }
      try { ensurePersonTabsMounted(); switchPersonTab('stats'); } catch(e) {}
      setTimeout(function(){
        if (!personTabsMounted) { try { ensurePersonTabsMounted(); switchPersonTab('stats'); } catch(e){} }
      }, 150);
      return;
    }
    if (__tabsPollCount >= 20) {
      if (__tabsPollTimer) { clearInterval(__tabsPollTimer); __tabsPollTimer = null; }
    }
  }
  var __tabsPollTimer = setInterval(__tabsPollFn, 500);
  document.addEventListener('click', function(e){
    if (e.target.closest('.nav-tab[data-tab="persons"]')) {
      __tabsPollCount = 0;
      if (__tabsPollTimer) clearInterval(__tabsPollTimer);
      __tabsPollTimer = setInterval(__tabsPollFn, 500);
    }
  }, true);

"""
            js = js[:idx_v4_end] + insert_code + js[idx_v4_end:]
            print("[1c] polling fallback inserted at correct location")
        else:
            print("[1d] WARNING: v4 end >= v3 start, may have wrong location")
    else:
        print("[1e] FAILED: cannot locate v4 patch boundaries")

# 同时清理：把 ensurePersonTabsMounted 里的 setTimeout 递归重试去掉，避免冲突
# 但保留 __tabsRetryCount 声明（改为 0 但不用）
old_retry_in_ensure = """    var sections = [qaBlock, dpBlock, spBlock, meBlock].filter(function(x){ return !!x; });
    if (sections.length < 2) {
      if (__tabsRetryCount < 15) {
        __tabsRetryCount++;
        setTimeout(ensurePersonTabsMounted, 250 * __tabsRetryCount);
      }
      return;
    }
    __tabsRetryCount = 0;"""
new_retry_in_ensure = """    var sections = [qaBlock, dpBlock, spBlock, meBlock].filter(function(x){ return !!x; });
    // v4.1: 递归重试已改为外部 setInterval 轮询，这里找不到就直接返回
    if (sections.length < 2) return;"""

if old_retry_in_ensure in js:
    js = js.replace(old_retry_in_ensure, new_retry_in_ensure)
    print("[2] old recursive retry removed")
else:
    print("[2] old retry pattern not found - may already be different")

with open(JS_PATH, "w", encoding="utf-8") as f:
    f.write(js)
print(f"[DONE] patched {len(js)} chars")
