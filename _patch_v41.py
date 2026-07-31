#!/usr/bin/env python3
"""v4.1 精准补丁：修复 3 大问题"""

import re

JS_PATH = "/Users/zhongjiangzhang/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a6b760c59af87f56c47b958/assets/app-mobile-v4.1.js"
CSS_PATH = "/Users/zhongjiangzhang/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a6b760c59af87f56c47b958/assets/app-mobile-v4.1.css"

# ============== 1. JS 修复 ==============
with open(JS_PATH, "r", encoding="utf-8") as f:
    js = f.read()

# 修复 1a：click 委托监听两个 ID（#v3-open-drawer 和 #v4-open-drawer）
js = js.replace(
    "if (e.target.closest('#v4-open-drawer')) { openDrawer(); return; }",
    "if (e.target.closest('#v4-open-drawer') || e.target.closest('#v3-open-drawer')) { openDrawer(); return; }"
)

# 修复 1b：mountPersonDrawer 先检查 DOM 是否已存在（复用 v3 已创建的）
old_mount = """  var drawerMounted = false;
  function mountPersonDrawer() {
    if (drawerMounted) return;
    drawerMounted = true;
    // 子吸顶条
    var sub = document.createElement('div');
    sub.id = 'v3-person-sub-nav';
    sub.className = 'person-sub-nav';
    sub.innerHTML =
      '<div class="person-sub-nav-inner">' +
        '<div class="psn-current">' +
          '<div class="av" id="v3-psn-av">孔</div>' +
          '<div class="meta">' +
            '<div class="name" id="v3-psn-name">孔子</div>' +
            '<div class="grp"  id="v3-psn-grp">至圣先师 · 《论语》核心</div>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="psn-switch-btn" id="v4-open-drawer">📋 切换人物</button>' +
      '</div>';
    document.body.appendChild(sub);
    // mask
    var mask = document.createElement('div');
    mask.id = 'v3-person-drawer-mask';
    mask.className = 'person-drawer-mask';
    document.body.appendChild(mask);
    // drawer
    var dr = document.createElement('div');
    dr.id = 'v3-person-drawer';
    dr.className = 'person-drawer';
    dr.setAttribute('role', 'dialog');
    dr.setAttribute('aria-modal', 'true');
    dr.innerHTML =
      '<div class="pd-handle"></div>' +
      '<div class="pd-head">' +
        '<div class="title">切换人物 · 34位论语登场人物</div>' +
        '<button type="button" class="close" id="v3-drawer-close">关闭</button>' +
      '</div>' +
      '<div class="pd-body" id="v3-pd-body"></div>';
    document.body.appendChild(dr);
  }"""

new_mount = """  var drawerMounted = false;
  function mountPersonDrawer() {
    if (drawerMounted) return;
    drawerMounted = true;
    // v4.1 FIX: 先复用 v3 已创建的 DOM（避免重复注入 + 事件监听错位）
    var sub = document.getElementById('v3-person-sub-nav');
    if (sub) {
      var oldBtn = sub.querySelector('#v3-open-drawer');
      if (oldBtn) { oldBtn.id = 'v4-open-drawer'; oldBtn.setAttribute('data-v3-fallback', '1'); }
    } else {
      sub = document.createElement('div');
      sub.id = 'v3-person-sub-nav';
      sub.className = 'person-sub-nav';
      sub.innerHTML =
        '<div class="person-sub-nav-inner">' +
          '<div class="psn-current">' +
            '<div class="av" id="v3-psn-av">孔</div>' +
            '<div class="meta">' +
              '<div class="name" id="v3-psn-name">孔子</div>' +
              '<div class="grp"  id="v3-psn-grp">至圣先师 · 《论语》核心</div>' +
            '</div>' +
          '</div>' +
          '<button type="button" class="psn-switch-btn" id="v4-open-drawer">📋 切换人物</button>' +
        '</div>';
      document.body.appendChild(sub);
    }
    var mask = document.getElementById('v3-person-drawer-mask');
    if (!mask) {
      mask = document.createElement('div');
      mask.id = 'v3-person-drawer-mask';
      mask.className = 'person-drawer-mask';
      document.body.appendChild(mask);
    }
    var dr = document.getElementById('v3-person-drawer');
    if (!dr) {
      dr = document.createElement('div');
      dr.id = 'v3-person-drawer';
      dr.className = 'person-drawer';
      dr.setAttribute('role', 'dialog');
      dr.setAttribute('aria-modal', 'true');
      dr.innerHTML =
        '<div class="pd-handle"></div>' +
        '<div class="pd-head">' +
          '<div class="title">切换人物 · 34位论语登场人物</div>' +
          '<button type="button" class="close" id="v3-drawer-close">关闭</button>' +
        '</div>' +
        '<div class="pd-body" id="v3-pd-body"></div>';
      document.body.appendChild(dr);
    }
  }"""

js = js.replace(old_mount, new_mount)

# 修复 1c：buildDrawerContent 重试逻辑 + 已构建则跳过
old_build_start = """  function buildDrawerContent() {
    var body = document.getElementById('v3-pd-body');
    if (!body) return;
    var src = null;
    try {
      if (typeof window.LUNYU_PERSONS !== 'undefined' && window.LUNYU_PERSONS && window.LUNYU_PERSONS.length) {
        src = window.LUNYU_PERSONS;
      } else if (typeof window.LUNYU_PERSON_MAP !== 'undefined') {
        src = Object.keys(window.LUNYU_PERSON_MAP).map(function(k){ return window.LUNYU_PERSON_MAP[k]; });
      }
    } catch (e) { src = null; }
    if (!src || !src.length) return;"""

new_build_start = """  var _buildTries = 0;
  function buildDrawerContent() {
    var body = document.getElementById('v3-pd-body');
    if (!body) return;
    if (body.querySelectorAll('.pd-cell').length > 0) return;
    var src = null;
    try {
      if (typeof window.LUNYU_PERSONS !== 'undefined' && window.LUNYU_PERSONS && window.LUNYU_PERSONS.length) {
        src = window.LUNYU_PERSONS;
      } else if (typeof window.LUNYU_PERSON_MAP !== 'undefined') {
        src = Object.keys(window.LUNYU_PERSON_MAP).map(function(k){ return window.LUNYU_PERSON_MAP[k]; });
      }
    } catch (e) { src = null; }
    if ((!src || !src.length) && _buildTries < 3) {
      _buildTries++;
      setTimeout(buildDrawerContent, 80 * _buildTries);
      return;
    }
    if (!src || !src.length) return;
    _buildTries = 0;"""

js = js.replace(old_build_start, new_build_start)

# 修复 1d：defaultSelectKongzi 构建时序
old_default = """  function defaultSelectKongzi() {
    // 先确保吸顶 DOM 已 mount（但不打开抽屉）
    if (!drawerMounted) { mountPersonDrawer(); setTimeout(buildDrawerContent, 10); }"""

new_default = """  function defaultSelectKongzi() {
    // 先确保吸顶 DOM 已 mount（但不打开抽屉），并强制构建抽屉内容
    if (!drawerMounted) { mountPersonDrawer(); }
    setTimeout(buildDrawerContent, 30);"""

js = js.replace(old_default, new_default)

# 修复 2：4 Tab 选择器使用实际结构（stat-strip + collection-block）
old_tabs = """  var personTabsMounted = false;
  function ensurePersonTabsMounted() {
    if (personTabsMounted) return;
    var detail = document.querySelector('.person-detail-panel');
    if (!detail) return;
    // 找到所有的 section（顺序 = 提问/对话/说话/被提及）
    var sections = detail.querySelectorAll(':scope > .person-section, :scope > section');
    if (!sections || sections.length < 2) return;  // 没内容不做
    personTabsMounted = true;
    // 给每个 section 标 class
    for (var i = 0; i < sections.length && i < TABS.length; i++) {
      sections[i].classList.add('person-section', 'v4-p-section', 'v4-p-' + TABS[i].key);
      sections[i].setAttribute('data-tab-key', TABS[i].key);
    }
    // 插入 Tab 栏（在个人介绍之后、第一个 section 之前）
    var intro = detail.querySelector(':scope > .person-header, :scope > .person-intro');
    var tabsWrap = document.createElement('div');
    tabsWrap.className = 'v4-p-tabs';
    TABS.forEach(function(t){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'v4-p-tab';
      b.setAttribute('data-tab-key', t.key);
      b.innerHTML = '<span class="ic">' + t.icon + '</span><span class="lb">' + t.label + '</span>';
      tabsWrap.appendChild(b);
    });
    if (intro && intro.nextSibling) detail.insertBefore(tabsWrap, intro.nextSibling);
    else detail.insertBefore(tabsWrap, detail.firstChild);
    // Tab 点击事件（事件委托）
    tabsWrap.addEventListener('click', function(ev){
      var t = ev.target.closest('.v4-p-tab');
      if (!t) return;
      switchPersonTab(t.getAttribute('data-tab-key'));
    });
  }
  function switchPersonTab(key) {
    var tabs = document.querySelectorAll('.person-detail-panel .v4-p-tab');
    var sections = document.querySelectorAll('.person-detail-panel .person-section');
    tabs.forEach(function(t){
      t.classList.toggle('active', t.getAttribute('data-tab-key') === key);
    });
    // 按顺序对应
    var idx = -1;
    for (var i = 0; i < TABS.length; i++) if (TABS[i].key === key) idx = i;
    sections.forEach(function(s, i){
      s.classList.toggle('active', i === idx);
    });
  }"""

new_tabs = """  var personTabsMounted = false;
  function ensurePersonTabsMounted() {
    if (personTabsMounted) return;
    var detail = document.querySelector('.person-detail-panel');
    if (!detail) return;
    // v4.1 FIX: 实际结构顺序：
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
    personTabsMounted = true;
    for (var i = 0; i < sections.length && i < TABS.length; i++) {
      sections[i].classList.add('person-section', 'v4-p-section', 'v4-p-' + TABS[i].key);
      sections[i].setAttribute('data-tab-key', TABS[i].key);
    }
    // 插入 Tab 栏（person-bio 之后 → bio.nextSibling）
    var bio = detail.querySelector(':scope > .person-bio');
    var tabsWrap = document.createElement('div');
    tabsWrap.className = 'v4-p-tabs';
    TABS.forEach(function(t){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'v4-p-tab';
      b.setAttribute('data-tab-key', t.key);
      b.innerHTML = '<span class="ic">' + t.icon + '</span><span class="lb">' + t.label + '</span>';
      tabsWrap.appendChild(b);
    });
    if (bio && bio.nextSibling) detail.insertBefore(tabsWrap, bio.nextSibling);
    else if (qaBlock) detail.insertBefore(tabsWrap, qaBlock);
    else detail.insertBefore(tabsWrap, detail.firstChild);
    tabsWrap.addEventListener('click', function(ev){
      var t = ev.target.closest('.v4-p-tab');
      if (!t) return;
      switchPersonTab(t.getAttribute('data-tab-key'));
    });
  }
  function switchPersonTab(key) {
    var tabs = document.querySelectorAll('.person-detail-panel .v4-p-tab');
    var sections = document.querySelectorAll('.person-detail-panel .person-section');
    tabs.forEach(function(t){
      t.classList.toggle('active', t.getAttribute('data-tab-key') === key);
    });
    var idx = -1;
    for (var i = 0; i < TABS.length; i++) if (TABS[i].key === key) idx = i;
    sections.forEach(function(s, i){
      s.classList.toggle('active', i === idx);
    });
  }"""

js = js.replace(old_tabs, new_tabs)

# 修复 3：筛选 fp-summary → 删除创建逻辑，主动删除
old_filter = """  // -------- 8) 筛选页：去掉 (X 胶囊) + 加已选摘要 --------
  function fixFilterToggleButton() {
    var panel = document.querySelector('.filter-panel-single');
    if (!panel) return;
    var btn = panel.querySelector('.fp-toggle-btn');
    if (!btn) return;
    // 按钮文字里的「展开筛选器（X 胶囊）▾」→ 只留「展开筛选器 ▾」
    var txt = btn.textContent || '';
    if (txt.indexOf('展开') !== -1) btn.textContent = '展开筛选器 ▾';
    else if (txt.indexOf('收起') !== -1) btn.textContent = '收起筛选器 ▴';
    // 如果还没有 fp-summary，插一个
    if (!panel.querySelector('.fp-summary')) {
      var sum = document.createElement('div');
      sum.className = 'fp-summary';
      updateFilterSummary(panel, sum);
      var fg = panel.querySelector('.fp-global');
      if (fg) fg.appendChild(sum);
    }
  }
  function updateFilterSummary(panel, sumEl) {
    if (!sumEl) sumEl = panel.querySelector('.fp-summary');
    if (!sumEl) return;
    // 统计每个维度已选数量
    var dims = panel.querySelectorAll(':scope > .f-dim');
    var parts = [];
    dims.forEach(function(d){
      var t = (d.querySelector(':scope > .f-dim-title') || {}).textContent || '';
      if (!t) return;
      var total = d.querySelectorAll('.f-capsule').length;
      var active = d.querySelectorAll('.f-capsule.active, .f-capsule.selected').length;
      // 没选任何胶囊 = 全选（因为筛选器默认全选逻辑）→ 显示"全部"
      var state = (total > 0 && active === 0) ? '全部' : (active + '/' + total);
      parts.push(t + ' <b>' + state + '</b>');
    });
    sumEl.innerHTML = '当前：' + parts.join(' · ');
  }
  // 初次执行
  setTimeout(fixFilterToggleButton, 600);
  // 每次点击筛选胶囊 / 切 filter Tab → 刷新摘要
  document.addEventListener('click', function(e){
    if (e.target.closest('.f-capsule') || e.target.closest('.nav-tab[data-tab="filter"]')) {
      setTimeout(fixFilterToggleButton, 50);
    }
  }, true);
  // 每次展开/收起筛选器 → 同步按钮文字
  var _ob;
  try {
    _ob = new MutationObserver(function(muts){
      muts.forEach(function(m){
        if (m.target && m.target.classList && m.target.classList.contains('filter-panel-single')) {
          fixFilterToggleButton();
        }
      });
    });
    setTimeout(function(){
      var p = document.querySelector('.filter-panel-single');
      if (p) _ob.observe(p, { attributes: true, attributeFilter: ['class'] });
    }, 800);
  } catch(e) {}"""

new_filter = """  // -------- 8) 筛选页：去掉 (X 胶囊) + 移除 fp-summary 摘要行（v4.1） --------
  function fixFilterToggleButton() {
    var panel = document.querySelector('.filter-panel-single');
    if (!panel) return;
    // v4.1 FIX: 删除所有 fp-summary 元素
    var sums = panel.querySelectorAll('.fp-summary');
    for (var i = 0; i < sums.length; i++) {
      try { sums[i].parentNode.removeChild(sums[i]); } catch(e) {}
    }
    var btn = panel.querySelector('.fp-toggle-btn');
    if (!btn) return;
    var txt = btn.textContent || '';
    if (txt.indexOf('展开') !== -1) btn.textContent = '展开筛选器 ▾';
    else if (txt.indexOf('收起') !== -1) btn.textContent = '收起筛选器 ▴';
  }
  setTimeout(fixFilterToggleButton, 50);
  setTimeout(fixFilterToggleButton, 500);
  setTimeout(fixFilterToggleButton, 1200);
  document.addEventListener('click', function(e){
    if (e.target.closest('.f-capsule') || e.target.closest('.nav-tab[data-tab="filter"]')) {
      setTimeout(fixFilterToggleButton, 30);
      setTimeout(fixFilterToggleButton, 200);
    }
  }, true);
  var _ob;
  try {
    _ob = new MutationObserver(function(muts){
      muts.forEach(function(m){
        if (m.target && m.target.classList && m.target.classList.contains('filter-panel-single')) {
          fixFilterToggleButton();
        }
      });
    });
    setTimeout(function(){
      var p = document.querySelector('.filter-panel-single');
      if (p) _ob.observe(p, { attributes: true, attributeFilter: ['class'] });
    }, 600);
  } catch(e) {}"""

js = js.replace(old_filter, new_filter)

# 修复 4：removeOriginalPersonList 延后到 2s 再清空
old_remove = """  // -------- 2) 清空原 person-list-panel DOM（减少节点，减少 querySelectorAll 遍历成本） --------
  function removeOriginalPersonList() {
    var panel = document.querySelector('.person-list-panel');
    if (panel && !panel.classList.contains('v4-removed')) {
      panel.classList.add('v4-removed');
      // 把里面 34 条 .person-list-item 全部清空（保留面板壳以避免原渲染逻辑报错）
      var container = panel.querySelector('.person-groups-scroll, .person-list') || panel;
      try { container.innerHTML = ''; } catch(e) {}
    }
  }
  setTimeout(removeOriginalPersonList, 300);
  document.addEventListener('click', function(e){
    if (e.target.closest('.nav-tab[data-tab="persons"]')) setTimeout(removeOriginalPersonList, 200);
  }, true);"""

new_remove = """  // -------- 2) 清空原 person-list-panel DOM（v4.1: 延后到 2s 再清空） --------
  var _personListRemoved = false;
  function removeOriginalPersonList() {
    if (_personListRemoved) return;
    var panel = document.querySelector('.person-list-panel');
    if (panel && !panel.classList.contains('v4-removed')) {
      panel.classList.add('v4-removed');
      var container = panel.querySelector('.person-groups-scroll, .person-list') || panel;
      try { container.innerHTML = ''; } catch(e) {}
      _personListRemoved = true;
    }
  }
  setTimeout(removeOriginalPersonList, 2000);
  document.addEventListener('click', function(e){
    if (e.target.closest('.nav-tab[data-tab="persons"]')) setTimeout(removeOriginalPersonList, 500);
  }, true);"""

js = js.replace(old_remove, new_remove)

with open(JS_PATH, "w", encoding="utf-8") as f:
    f.write(js)
print("[OK] JS patched:", len(js), "chars")

# ============== 2. CSS 修复 ==============
with open(CSS_PATH, "r", encoding="utf-8") as f:
    css = f.read()

# A: fp-summary 强制隐藏
fp_hide_css = """
/* v4.1 筛选页：强制隐藏 fp-summary（用户不需要这行信息） */
@media (max-width: 900px) {
  .filter-panel-single .fp-summary,
  .fp-global .fp-summary,
  div.fp-summary {
    display: none !important;
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    opacity: 0 !important;
    overflow: hidden !important;
    pointer-events: none !important;
  }
}
"""
css += fp_hide_css

# B: v4-p-tabs z-index 保险 + person-section 显示/隐藏逻辑
old_tabs_css = """/* v4 人物详情 4 Tab 胶囊切换 */
@media (max-width: 900px) {
  .v4-p-tabs {
    position: sticky;
    top: calc(var(--nav-h, 120px) + 52px);
    z-index: 800;
    background: rgba(250, 247, 242, 0.94);
    -webkit-backdrop-filter: saturate(180%) blur(10px);
    backdrop-filter: saturate(180%) blur(10px);
    padding: 6px;
    margin: 16px -4px 0;
    border-radius: 999px;
    border: 1px solid var(--rule);
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2px;
    contain: layout;
  }"""

new_tabs_css = """/* v4.1 人物详情 4 Tab 胶囊切换（z-index + contain 保险） */
@media (max-width: 900px) {
  .v4-p-tabs {
    position: sticky !important;
    top: calc(var(--nav-h, 120px) + 52px) !important;
    inset: auto auto auto auto !important;
    z-index: 999 !important;
    background: rgba(250, 247, 242, 0.96) !important;
    -webkit-backdrop-filter: saturate(180%) blur(10px);
    backdrop-filter: saturate(180%) blur(10px);
    padding: 6px 4px;
    margin: 12px 0 16px 0;
    border-radius: 999px;
    border: 1px solid var(--rule);
    display: grid !important;
    grid-template-columns: repeat(4, 1fr);
    gap: 2px;
    contain: layout paint;
    isolation: isolate;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  /* v4.1 Tab 切换核心：非 active 的 section 隐藏 */
  .person-detail-panel .person-section {
    display: none !important;
    margin-top: 0;
  }
  .person-detail-panel .person-section.active {
    display: block !important;
  }"""

css = css.replace(old_tabs_css, new_tabs_css)

with open(CSS_PATH, "w", encoding="utf-8") as f:
    f.write(css)
print("[OK] CSS patched:", len(css), "chars")
print("DONE")
