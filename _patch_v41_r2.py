#!/usr/bin/env python3
"""v4.1 第二轮补丁：修复 buildDrawerContent DOM 兜底 + 4 Tab 兜底调用"""

JS_PATH = "/Users/zhongjiangzhang/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a6b760c59af87f56c47b958/assets/app-mobile-v4.1.js"

with open(JS_PATH, "r", encoding="utf-8") as f:
    js = f.read()

# 修复 1：buildDrawerContent 在最后一次重试失败后，使用 DOM 兜底
old_fallback = """    if ((!src || !src.length) && _buildTries < 3) {
      _buildTries++;
      setTimeout(buildDrawerContent, 80 * _buildTries);
      return;
    }
    if (!src || !src.length) return;
    _buildTries = 0;"""

new_fallback = """    if ((!src || !src.length) && _buildTries < 3) {
      _buildTries++;
      setTimeout(buildDrawerContent, 80 * _buildTries);
      return;
    }
    // v4.1 FIX: 最后一次重试还是没有 LUNYU_PERSONS → 使用 DOM 兜底
    if (!src || !src.length) {
      var domPeople = [];
      try {
        document.querySelectorAll('.person-list-item').forEach(function(it){
          var id = it.getAttribute('data-person-id');
          var nmEl = it.querySelector('.person-info-mini .name, .pm-name');
          var nm = nmEl ? (nmEl.textContent || '').trim() : '';
          var avEl = it.querySelector('.person-avatar');
          var avatar = avEl ? (avEl.textContent || '').trim().charAt(0) : (nm.charAt(0) || '?');
          var grpEl = it.closest('.person-group');
          var grp = grpEl ? (grpEl.getAttribute('data-group-name') || '') : '';
          if (id) domPeople.push({ id: id, name_cn: nm, name: nm, group: grp, avatar: avatar });
        });
      } catch(e) { domPeople = []; }
      if (domPeople.length > 0) {
        src = domPeople;
      } else {
        return;
      }
    }
    _buildTries = 0;"""

js = js.replace(old_fallback, new_fallback)

# 修复 2：在 mobileV4Patch 末尾添加 4 Tab 兜底调用
# 找到 mobileV4Patch 的最后几行
old_end = """  // -------- 10) 初始化：persons Tab → 默认选孔子 + 子吸顶条 class 切换 --------
  function refreshPersonsUI() {
    var active = document.querySelector('.page-section#tab-persons.active') ||
                 (location.hash || '').indexOf('persons') !== -1;
    document.body.classList.toggle('v3-persons-active', !!active);
    if (active) defaultSelectKongzi();
  }
  setTimeout(refreshPersonsUI, 550);
  document.addEventListener('click', function(e){
    if (e.target.closest('.nav-tab')) setTimeout(refreshPersonsUI, 180);
  }, true);
  window.addEventListener('hashchange', refreshPersonsUI);

})();"""

new_end = """  // -------- 10) 初始化：persons Tab → 默认选孔子 + 子吸顶条 class 切换 --------
  function refreshPersonsUI() {
    var active = document.querySelector('.page-section#tab-persons.active') ||
                 (location.hash || '').indexOf('persons') !== -1;
    document.body.classList.toggle('v3-persons-active', !!active);
    if (active) defaultSelectKongzi();
  }
  setTimeout(refreshPersonsUI, 550);
  document.addEventListener('click', function(e){
    if (e.target.closest('.nav-tab')) setTimeout(refreshPersonsUI, 180);
  }, true);
  window.addEventListener('hashchange', refreshPersonsUI);

  // -------- 11) v4.1 兜底：确保 4 Tab 一定会挂载（不论原渲染逻辑时序如何） --------
  // 在 500ms / 1200ms / 2500ms 各尝试一次挂载 Tab + 切换到 stats
  function _fallbackEnsureTabs() {
    try { ensurePersonTabsMounted(); switchPersonTab('stats'); } catch(e) {}
  }
  function _fallbackBuildDrawer() {
    try { if (!drawerMounted) mountPersonDrawer(); buildDrawerContent(); } catch(e) {}
  }
  function _fallbackRemoveSummary() {
    try { fixFilterToggleButton(); } catch(e) {}
  }
  setTimeout(_fallbackBuildDrawer, 400);
  setTimeout(_fallbackBuildDrawer, 1000);
  setTimeout(_fallbackEnsureTabs, 700);
  setTimeout(_fallbackEnsureTabs, 1400);
  setTimeout(_fallbackEnsureTabs, 2600);
  setTimeout(_fallbackRemoveSummary, 300);
  setTimeout(_fallbackRemoveSummary, 900);
  setTimeout(_fallbackRemoveSummary, 1800);
  // 点击人物 Tab 后 1 秒再兜底挂载一次
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

js = js.replace(old_end, new_end)

# 修复 3：在人物详情面板点击切换后再兜底挂载一次 Tab（patch renderPerson 包装器）
# 之前的 _origRenderPerson 包装逻辑已经写了，但如果 renderPerson 是 undefined 就不会触发
# 所以再加一个基于 MutationObserver 的兜底
old_wrap = """  // 人物详情每次切换人后，重新确保 Tab 栏存在 + 默认开第一个
  var _origRenderPerson = typeof window.renderPerson === 'function' ? window.renderPerson : null;
  if (_origRenderPerson) {
    window.renderPerson = function(id) {
      var r = _origRenderPerson.apply(this, arguments);
      setTimeout(function(){
        ensurePersonTabsMounted();
        switchPersonTab('stats');
        // 同步吸顶条文字
        var nm = '';
        var hd = document.querySelector('.person-detail-panel .person-name');
        if (hd) nm = hd.textContent.trim();
        if (nm) updateSubNav(nm, id, null);
        highlightDrawerActive(id);
      }, 200);
      return r;
    };
  }"""

new_wrap = """  // 人物详情每次切换人后，重新确保 Tab 栏存在 + 默认开第一个
  var _origRenderPerson = typeof window.renderPerson === 'function' ? window.renderPerson : null;
  var _personDetailMO = null;
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
  setTimeout(_watchPersonDetail, 1500);

  if (_origRenderPerson) {
    window.renderPerson = function(id) {
      var r = _origRenderPerson.apply(this, arguments);
      setTimeout(function(){
        ensurePersonTabsMounted();
        switchPersonTab('stats');
        var nm = '';
        var hd = document.querySelector('.person-detail-panel .person-name');
        if (hd) nm = hd.textContent.trim();
        if (nm) updateSubNav(nm, id, null);
        highlightDrawerActive(id);
      }, 200);
      return r;
    };
  } else {
    // v4.1 FIX: 即使没有 renderPerson（从 DOM .person-list-item 点击触发），
    // 也通过拦截 click 事件检测人物切换
    document.addEventListener('click', function(e) {
      var it = e.target.closest('.person-list-item');
      if (it) {
        var id = it.getAttribute('data-person-id');
        setTimeout(function(){
          ensurePersonTabsMounted();
          switchPersonTab('stats');
          var nm = '';
          var hd = document.querySelector('.person-detail-panel .person-name');
          if (hd) nm = hd.textContent.trim();
          if (nm) updateSubNav(nm, id, null);
          highlightDrawerActive(id);
        }, 250);
        setTimeout(function(){
          ensurePersonTabsMounted();
          switchPersonTab('stats');
        }, 600);
      }
    }, true);
  }"""

js = js.replace(old_wrap, new_wrap)

with open(JS_PATH, "w", encoding="utf-8") as f:
    f.write(js)

print("[OK] JS patch round 2 applied:", len(js), "chars")
