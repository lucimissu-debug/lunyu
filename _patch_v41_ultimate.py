#!/usr/bin/env python3
"""v4.1 FINAL补丁：Tab 挂载改为内联代码执行，不依赖函数作用域"""

JS_PATH = "/Users/zhongjiangzhang/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a6b760c59af87f56c47b958/assets/app-mobile-v4.1.js"

with open(JS_PATH, "r", encoding="utf-8") as f:
    js = f.read()

# 替换整个 12) 终极兜底模块，用内联代码执行
old_poll = """  // -------- 12) v4.1 终极兜底：4 Tab 用 setInterval 轮询挂载 --------
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

# 新的轮询函数：直接内联挂载代码
new_poll = """  // -------- 12) v4.1 终极兜底：4 Tab 内联挂载（不依赖任何外部函数） --------
  var __TABS_INLINE = [{key:'stats',label:'提问统计',icon:'📊'},{key:'dialog',label:'对话互动',icon:'💬'},{key:'speeches',label:'说话合集',icon:'🗣'},{key:'mentioned',label:'被提及',icon:'👤'}];
  var __tabsPollCount = 0;
  var __tabsPollTimer = null;
  function __tabsPollFn() {
    __tabsPollCount++;
    var pdp = document.querySelector('.person-detail-panel');
    if (!pdp) return;
    var qa = pdp.querySelector(':scope > #stat-strip-qa');
    var dp = pdp.querySelector(':scope > #stat-strip-dp');
    var sp = pdp.querySelector(':scope > #block-spoken');
    var me = pdp.querySelector(':scope > #block-mentioned');
    if (!qa || !dp || !sp || !me) return;
    // 所有 4 个区块都存在了 → 立即挂载
    if (pdp.querySelector('.v4-p-tabs')) {
      // 已经挂载了，直接结束
      if (__tabsPollTimer) { clearInterval(__tabsPollTimer); __tabsPollTimer = null; }
      // 确保第一个 Tab active
      try {
        var tabs = pdp.querySelectorAll('.v4-p-tab');
        var secs = pdp.querySelectorAll('.person-section');
        if (tabs.length && !pdp.querySelector('.v4-p-tab.active')) tabs[0].classList.add('active');
        if (secs.length && !pdp.querySelector('.person-section.active')) secs[0].classList.add('active');
      } catch(e){}
      return;
    }
    // ==== 内联挂载代码 ====
    var sections = [qa, dp, sp, me];
    for (var i = 0; i < sections.length && i < __TABS_INLINE.length; i++) {
      sections[i].classList.add('person-section', 'v4-p-section', 'v4-p-' + __TABS_INLINE[i].key);
      sections[i].setAttribute('data-tab-key', __TABS_INLINE[i].key);
    }
    var bio = pdp.querySelector(':scope > .person-bio');
    var tabsWrap = document.createElement('div');
    tabsWrap.className = 'v4-p-tabs';
    __TABS_INLINE.forEach(function(t){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'v4-p-tab';
      b.setAttribute('data-tab-key', t.key);
      b.innerHTML = '<span class="ic">' + t.icon + '</span><span class="lb">' + t.label + '</span>';
      tabsWrap.appendChild(b);
    });
    if (bio && bio.nextSibling) pdp.insertBefore(tabsWrap, bio.nextSibling);
    else if (qa) pdp.insertBefore(tabsWrap, qa);
    else pdp.insertBefore(tabsWrap, pdp.firstChild);
    // Tab 点击切换
    tabsWrap.addEventListener('click', function(ev){
      var t = ev.target.closest('.v4-p-tab'); if (!t) return;
      var key = t.getAttribute('data-tab-key');
      var tb = pdp.querySelectorAll('.v4-p-tab');
      var sc = pdp.querySelectorAll('.person-section');
      tb.forEach(function(tt){ tt.classList.toggle('active', tt.getAttribute('data-tab-key')===key); });
      var idx = -1; for (var k=0;k<__TABS_INLINE.length;k++) if (__TABS_INLINE[k].key===key) idx=k;
      sc.forEach(function(s,j){ s.classList.toggle('active', j===idx); });
    });
    // 激活第一个 Tab
    var tabs0 = pdp.querySelectorAll('.v4-p-tab');
    var secs0 = pdp.querySelectorAll('.person-section');
    if (tabs0.length > 0) tabs0[0].classList.add('active');
    if (secs0.length > 0) secs0[0].classList.add('active');
    // 标记：把 personTabsMounted 变量也设为 true（在本作用域里）
    try { personTabsMounted = true; } catch(e){}
    // 停止轮询
    if (__tabsPollTimer) { clearInterval(__tabsPollTimer); __tabsPollTimer = null; }
    if (__tabsPollCount >= 20 && !__tabsPollTimer) {}
  }
  __tabsPollTimer = setInterval(__tabsPollFn, 400);
  // 每次切到人物 Tab 重置轮询
  document.addEventListener('click', function(e){
    if (e.target.closest('.nav-tab[data-tab="persons"]')) {
      __tabsPollCount = 0;
      if (__tabsPollTimer) clearInterval(__tabsPollTimer);
      __tabsPollTimer = setInterval(__tabsPollFn, 400);
    }
  }, true);

})();"""

if old_poll in js:
    js = js.replace(old_poll, new_poll)
    print("[1] polling module replaced with inline code")
else:
    print("[1] FAILED: old polling pattern not found!")
    # 打印 location 帮助调试
    idx12 = js.find('// -------- 12)')
    print(f"  [12) marker] at {idx12}")
    end_v4 = js.find('})();', js.find('(function mobileV4Patch(){'))
    print(f"  [v4 end] at {end_v4}")

with open(JS_PATH, "w", encoding="utf-8") as f:
    f.write(js)
print(f"[DONE] {len(js)} chars")
