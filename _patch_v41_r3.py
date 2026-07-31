#!/usr/bin/env python3
"""v4.1 第三轮补丁：修复 section ID 不匹配 + renderPerson 不存在的兜底"""

JS_PATH = "/Users/zhongjiangzhang/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a6b760c59af87f56c47b958/assets/app-mobile-v4.1.js"

with open(JS_PATH, "r", encoding="utf-8") as f:
    js = f.read()

# 修复 1：所有 .page-section#tab-persons → .page-section#section-persons
count = js.count('#tab-persons')
print(f"Found {count} occurrences of #tab-persons")
js = js.replace('.page-section#tab-persons.active', '.page-section#section-persons.active')
# 同时也要检查有没有不带 .page-section 的
js = js.replace("'#tab-persons'", "'#section-persons'")
js = js.replace('.page-section#tab-persons', '.page-section#section-persons')
print(f"Remaining #tab-persons: {js.count('#tab-persons')}")

# 修复 2：defaultSelectKongzi 中如果没有 renderPerson 就触发 DOM click
old_dsk = """  function defaultSelectKongzi() {
    // 先确保吸顶 DOM 已 mount（但不打开抽屉），并强制构建抽屉内容
    if (!drawerMounted) { mountPersonDrawer(); }
    setTimeout(buildDrawerContent, 30);
    var id = 'kongzi';
    var name = '孔子';
    var group = '至圣先师';
    // 优先调用 renderPerson
    if (typeof window.renderPerson === 'function') {
      try { window.renderPerson(id); } catch(e) {}
    }
    updateSubNav(name, id, group);
    setTimeout(function(){
      highlightDrawerActive(id);
      ensurePersonTabsMounted();
      switchPersonTab('stats');  // 默认打开「提问统计」Tab
    }, 300);
  }"""

new_dsk = """  function defaultSelectKongzi() {
    // 先确保吸顶 DOM 已 mount（但不打开抽屉），并强制构建抽屉内容
    if (!drawerMounted) { mountPersonDrawer(); }
    setTimeout(buildDrawerContent, 30);
    var id = 'kongzi';
    var name = '孔子';
    var group = '至圣先师';
    // v4.1 FIX: 优先调用 renderPerson；不存在则触发 DOM .person-list-item click（兜底）
    var rendered = false;
    if (typeof window.renderPerson === 'function') {
      try { window.renderPerson(id); rendered = true; } catch(e) { rendered = false; }
    }
    if (!rendered) {
      setTimeout(function(){
        var item = document.querySelector('.person-list-item[data-person-id="' + id + '"]');
        if (!item) {
          // 再按文本找
          var all = document.querySelectorAll('.person-list-item');
          for (var i = 0; i < all.length; i++) {
            var txt = (all[i].textContent || '');
            if (txt.indexOf('孔子') !== -1 || txt.indexOf('孔丘') !== -1) { item = all[i]; break; }
          }
        }
        if (item) { try { item.click(); } catch(e) {} }
      }, 100);
    }
    updateSubNav(name, id, group);
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

js = js.replace(old_dsk, new_dsk)

# 修复 3：v3 patch 里的 defaultSelectKongzi 也要改（如果存在的话）
old_v3_dsk = """  function defaultSelectKongzi() {
    var id = findPersonIdByName('孔子') || 'kongzi';
    // 尝试触发 .person-list-item[data-person-id=xxx] 的点击（让原有逻辑渲染详情）
    setTimeout(function(){
      var item = document.querySelector('.person-list-item[data-person-id="' + id + '"]');
      if (!item) {
        // 再按文本找
        var all = document.querySelectorAll('.person-list-item');
        for (var i = 0; i < all.length; i++) {
          var txt = (all[i].querySelector('.pm-name') || {}).textContent || '';
          if (txt.indexOf('孔子') !== -1 || txt.indexOf('孔丘') !== -1) { item = all[i]; break; }
        }
      }
      if (item) {
        item.click();
      }
      // 把吸顶条内容同步成孔子
      syncPersonSubNavFromDetail(id, item);
    }, 100);
  }"""

new_v3_dsk = """  function defaultSelectKongzi() {
    var id = findPersonIdByName('孔子') || 'kongzi';
    // v4.1 FIX: 如果 renderPerson 存在直接调
    var rendered = false;
    if (typeof window.renderPerson === 'function') {
      try { window.renderPerson(id); rendered = true; } catch(e) { rendered = false; }
    }
    setTimeout(function(){
      var item = document.querySelector('.person-list-item[data-person-id="' + id + '"]');
      if (!item) {
        var all = document.querySelectorAll('.person-list-item');
        for (var i = 0; i < all.length; i++) {
          var txt = (all[i].querySelector('.person-info-mini .name') || all[i].querySelector('.pm-name') || {}).textContent || '';
          if (txt.indexOf('孔子') !== -1 || txt.indexOf('孔丘') !== -1) { item = all[i]; break; }
        }
      }
      if (item && !rendered) { try { item.click(); } catch(e) {} }
      syncPersonSubNavFromDetail(id, item);
    }, rendered ? 100 : 50);
  }"""

if old_v3_dsk in js:
    js = js.replace(old_v3_dsk, new_v3_dsk)
    print("v3 defaultSelectKongzi replaced")
else:
    print("v3 defaultSelectKongzi NOT found - check manually")

# 修复 4：v3 patch 中 findPersonIdByName 用的 DOM 选择器也要改（.pm-name → .person-info-mini .name 兼容）
old_find = """  function findPersonIdByName(name) {
    // 优先从全局 map 里查
    if (typeof window.LUNYU_PERSON_MAP !== 'undefined') {
      for (var k in window.LUNYU_PERSON_MAP) {
        var p = window.LUNYU_PERSON_MAP[k];
        if ((p.name_cn || p.name || '') === name) return p.id || k;
      }
    }
    // 兜底从 DOM 找
    var it = document.querySelector('.person-list-item .pm-name');
    document.querySelectorAll('.person-list-item').forEach(function(el){
      var t = (el.querySelector('.pm-name') || {}).textContent || '';
      if (t.indexOf(name) !== -1) { return (el.getAttribute('data-person-id') || ''); }
    });
    return null;
  }"""

new_find = """  function findPersonIdByName(name) {
    if (typeof window.LUNYU_PERSON_MAP !== 'undefined') {
      for (var k in window.LUNYU_PERSON_MAP) {
        var p = window.LUNYU_PERSON_MAP[k];
        if ((p.name_cn || p.name || '') === name) return p.id || k;
      }
    }
    // v4.1 FIX: DOM 选择器兼容 .person-info-mini .name 和 .pm-name
    var all = document.querySelectorAll('.person-list-item');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var t = (el.querySelector('.person-info-mini .name') || el.querySelector('.pm-name') || {}).textContent || '';
      if (t.indexOf(name) !== -1) { return el.getAttribute('data-person-id') || ''; }
    }
    return null;
  }"""

if old_find in js:
    js = js.replace(old_find, new_find)
    print("findPersonIdByName replaced")
else:
    print("findPersonIdByName NOT found - check manually")

# 修复 5：v3 patch buildPersonGroups 里 DOM 兜底选择器也要改
old_v3_build_dom = """    } else {
      // 兜底：从 DOM 里扒
      document.querySelectorAll('.person-list-item').forEach(function(it){
        var id = it.getAttribute('data-person-id');
        var nm = (it.querySelector('.pm-name') || {}).textContent || '';
        var avatar = (it.querySelector('.person-avatar') || {}).textContent || nm.charAt(0);
        var grp = (it.closest('.person-group') || {}).getAttribute('data-group-name') || '';
        if (id) people.push({ id: id, name: nm, name_cn: nm, group: grp, avatar: avatar });
      });
    }"""

new_v3_build_dom = """    } else {
      // v4.1 FIX: DOM 兜底选择器兼容
      document.querySelectorAll('.person-list-item').forEach(function(it){
        var id = it.getAttribute('data-person-id');
        var nmEl = it.querySelector('.person-info-mini .name') || it.querySelector('.pm-name');
        var nm = nmEl ? (nmEl.textContent || '').trim() : '';
        var avatar = (it.querySelector('.person-avatar') || {}).textContent || nm.charAt(0) || '?';
        var grpEl = it.closest('.person-group');
        var grp = grpEl ? (grpEl.getAttribute('data-group-name') || '') : '';
        if (id) people.push({ id: id, name: nm, name_cn: nm, group: grp, avatar: avatar });
      });
    }"""

if old_v3_build_dom in js:
    js = js.replace(old_v3_build_dom, new_v3_build_dom)
    print("v3 buildPersonGroups DOM fallback replaced")
else:
    print("v3 buildPersonGroups DOM fallback NOT found - check manually")

# 修复 6：v3 syncPersonSubNavFromDetail 里的选择器也要改
old_sync_txt = "var t = (el.querySelector('.pm-name') || {}).textContent || '';"
new_sync_txt = "var t = (el.querySelector('.person-info-mini .name') || el.querySelector('.pm-name') || {}).textContent || '';"
js = js.replace(old_sync_txt, new_sync_txt)

with open(JS_PATH, "w", encoding="utf-8") as f:
    f.write(js)

print(f"[OK] JS patch round 3 applied: {len(js)} chars")
