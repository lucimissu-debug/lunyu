/* ============================================
   论语·探索 MVP - 交互逻辑
   3大功能：随机漫步 / 人物浏览 / 多维筛选
   ============================================ */

(function () {
  'use strict';

  // ====== 全局引用 ======
  const D = window.LUNYU_DATA;
  const ENUM = window.LUNYU_ENUM;
  const BOOKS = window.LUNYU_BOOKS;
  const App = {};
  window.LUNYU_APP = App;

  // ====== 颜色（从CSS变量读取供ECharts使用） ======
  App.colors = {};
  function loadColors() {
    const st = getComputedStyle(document.documentElement);
    App.colors = {
      bg: st.getPropertyValue('--bg').trim() || '#faf7f2',
      bg2: st.getPropertyValue('--bg2').trim() || '#f3ede2',
      ink: st.getPropertyValue('--ink').trim() || '#2c2416',
      muted: st.getPropertyValue('--muted').trim() || '#7a6e5a',
      rule: st.getPropertyValue('--rule').trim() || '#d9cfbc',
      accent: st.getPropertyValue('--accent').trim() || '#8b4513',
      accent2: st.getPropertyValue('--accent2').trim() || '#556b2f',
      gold: st.getPropertyValue('--gold').trim() || '#b8860b'
    };
  }

  // ====== 辅助函数 ======
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getChapterById(id) {
    return D.text.find(c => c.id === id);
  }

  function getPersonById(id) {
    return D.persons.find(p => p.id === id);
  }

  function getPersonByName(name) {
    return D.persons.find(p => p.name_cn === name || p.style === name || p.style.includes(name));
  }

  function getChapterStyle(id) {
    return D.ann_style[id]?.style_type;
  }

  function getChapterThemes(id) {
    return D.ann_themes[id]?.themes || [];
  }

  function getChapterQA(id) {
    return D.ann_qa[id];
  }

  function getChapterPersons(id) {
    return D.ann_persons[id] || {};
  }

  function getPersonName(id) {
    const p = getPersonById(id);
    return p ? p.name_cn : (id || '未知');
  }

  function catClass(category) {
    // ⚠ 返回值必须严格对应 app.css 里 .f-person-XXX.active 的类名
    // 德行=virtue(竹简绿)  言语=speech(赭石棕)  政事=politics(暗金)  文学=literature(深湖蓝)
    // 师/时君权臣/隐士/贤人/其他 用 cat-shi/cat-jun/cat-yin/cat-xian/other（深褐）
    const map = {
      '师': 'cat-shi',
      '德行': 'virtue', '德行（宗圣）': 'virtue',
      '言语': 'speech',
      '政事': 'politics', '政事（后进）': 'politics',
      '文学': 'literature',
      '问学者': 'literature',   // 问学者归入"文学"色（深湖蓝，学术相关）
      '时君权臣': 'cat-jun',
      '隐士': 'cat-yin',
      '贤人': 'cat-xian'
    };
    return map[category] || 'other';
  }

  // ====== 章节获取完整标注 ======
  function enrichChapter(ch) {
    if (!ch) return null;
    const enriched = { ...ch };
    enriched.style_type = getChapterStyle(ch.id);
    enriched.style_cn = ENUM.style_type[enriched.style_type] || enriched.style_type;
    enriched.themes = getChapterThemes(ch.id);
    enriched.themes_cn = enriched.themes.map(t => ENUM.themes[t] || t);
    enriched.qa = getChapterQA(ch.id);
    enriched.persons = getChapterPersons(ch.id);
    const book = BOOKS.find(b => b.pinyin === ch.book_pinyin);
    enriched.book_cn_full = book ? book.cn : ch.book_cn;
    return enriched;
  }

  // ====== 路由 ======
  App.currentTab = 'random';
  App.currentChapterId = null;
  App.currentPersonId = null;
  App.currentQAType = 'ask_ren';

  function switchTab(tabName) {
    App.currentTab = tabName;
    $$('.nav-tab').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tabName);
    });
    $$('.page-section').forEach(el => {
      el.classList.toggle('active', el.id === `section-${tabName}`);
    });
    location.hash = tabName;

    // 渲染对应内容
    if (tabName === 'random') {
      // 如果有指定章节则显示，否则随机
      if (App.currentChapterId) showRandomChapter(App.currentChapterId);
      else showRandomChapter();
    } else if (tabName === 'persons') {
      if (!App.currentPersonId && D.persons.length) {
        App.currentPersonId = D.persons[0].id;
      }
      renderPersonsPage();
    } else if (tabName === 'filter') {
      renderFilterPage();
    }

  }

  // 判断 URL 是否带有「显式指定语义」的 query 参数（如 ?VV=xxx / ?s=xxx / ?share 等）
  // —— 有 query = 这个链接是被显式构造出来的（分享、测试、书签），hash 中的 chapterId 应当尊重
  // —— 无 query = 浏览器记住了上次浏览的 hash（纯刷新/直接打开页面），此时忽略遗留的 chapterId，强制重新随机
  function urlHasExplicitQuery() {
    const search = location.search || '';
    // 去掉空串，只要有任何非空的 query 对就视为「显式指定」
    const stripped = search.replace(/^\?/, '').trim();
    if (!stripped) return false;
    // 排除空值（例如 lone ? 或 ?=&= 之类无意义）
    const pairs = stripped.split('&').filter(p => p.length > 0 && p !== '=');
    return pairs.length > 0;
  }

  function parseHash() {
    const h = location.hash.replace(/^#/, '');
    if (!h) return { tab: 'random' };
    // chapter:xxx 格式
    if (h.startsWith('chapter:')) {
      const explicit = urlHasExplicitQuery();
      if (explicit) {
        // 有 query 参数 → 视为分享/书签链接，尊重指定章节
        return { tab: 'random', chapterId: h.slice(8) };
      } else {
        // 无 query → 纯刷新遗留，本次忽略 chapterId，改走随机（保证每次打开都不一样）
        // 顺手把旧 hash 清掉，避免 showRandomChapter 里再 replaceState 时误判
        return { tab: 'random', _ignoreLegacyChapter: true };
      }
    }
    // person:xxx
    if (h.startsWith('person:')) {
      return { tab: 'persons', personId: h.slice(7) };
    }

    return { tab: h };
  }

  window.addEventListener('hashchange', handleHash);

  function handleHash() {
    const r = parseHash();
    if (r._ignoreLegacyChapter) {
      // 纯刷新场景：强制清掉遗留 chapterId，确保 switchTab 里走 showRandomChapter() 无参 → 真随机
      App.currentChapterId = null;
      // 清掉浏览器地址栏的遗留 hash，避免用户复制粘贴分享到固定章
      history.replaceState(null, '', location.pathname + (location.search || '') + '#random');
    } else if (r.chapterId) {
      App.currentChapterId = r.chapterId;
    }
    if (r.personId) {
      App.currentPersonId = r.personId;
    }

    switchTab(r.tab || 'random');
  }

  // ==================================================
  // 功能1：随机漫步模式
  // ==================================================
  function showRandomChapter(forceId) {
    const display = $('#random-chapter-display');
    if (!display) return;
    display.classList.add('fading');

    setTimeout(() => {
      let ch;
      if (forceId) {
        ch = enrichChapter(getChapterById(forceId));
        if (!ch) ch = enrichChapter(randomItem(D.text));
      } else {
        ch = enrichChapter(randomItem(D.text));
      }
      App.currentChapterId = ch.id;

      // 更新 URL hash
      if (!location.hash.startsWith('#chapter:')) {
        history.replaceState(null, '', '#chapter:' + ch.id);
      }

      renderChapterDisplay(display, ch);
      display.classList.remove('fading');
    }, 120);
  }

  function renderChapterDisplay(container, ch) {
    const speakerIds = ch.persons?.speakers || [];
    const speakerNames = speakerIds.map(getPersonName);

    // 生成标签
    const tagsHtml = [];
    if (ch.style_cn) {
      tagsHtml.push(`<span class="tag tag-style">${ch.style_cn}</span>`);
    }
    ch.themes_cn.forEach(t => {
      tagsHtml.push(`<span class="tag tag-theme">${t}</span>`);
    });
    speakerNames.forEach(n => {
      tagsHtml.push(`<span class="tag tag-person">${n}</span>`);
    });

    container.innerHTML = `
      <div class="chapter-meta">
        <span class="book-name">《${ch.book_cn}》第${toChineseNum(ch.verse_num)}章</span>
        <span class="verse-id">· ${ch.id}</span>
      </div>
      <div class="chapter-text">${ch.text}</div>
      <div class="chapter-tags">${tagsHtml.join('')}</div>
    `;

    // 三个导航按钮：上一章 / 随机 / 下一章
    // 【全书 498 章循环】：按钮始终可用，跨越篇/篇首尾相接（尧曰03 → 学而01 → ...）
    const actionsContainer = $('#random-chapter-actions');
    if (actionsContainer) {
      const prevCh = getAdjacentChapterGlobal(ch, -1);
      const nextCh = getAdjacentChapterGlobal(ch, +1);
      const prevTitle = '上一章：' + chapterTitleText(prevCh);
      const nextTitle = '下一章：' + chapterTitleText(nextCh);

      actionsContainer.innerHTML = `
        <button class="btn btn-nav" id="btn-prev-chapter" title="${prevTitle}">
          ⏮ 上一章
        </button>
        <button class="btn btn-primary btn-random" id="btn-random-next">🎲 随机</button>
        <button class="btn btn-nav" id="btn-next-chapter" title="${nextTitle}">
          下一章 ⏭
        </button>
      `;

      $('#btn-prev-chapter').onclick = () => {
        const target = getAdjacentChapterGlobal(ch, -1);
        if (target) showRandomChapter(target.id);
      };
      $('#btn-random-next').onclick = () => showRandomChapter();
      $('#btn-next-chapter').onclick = () => {
        const target = getAdjacentChapterGlobal(ch, +1);
        if (target) showRandomChapter(target.id);
      };
    }

    // 删除了复制文本和分享链接功能（用户不需要）
    const utilContainer = $('#random-chapter-utility');
    if (utilContainer) {
      utilContainer.innerHTML = '';
    }
  }

  // 跳转到相邻章节（+1 / -1）
  // 【全书 498 章循环】跨篇自然衔接，尧曰03 → 学而01 → ...
  function jumpAdjacentChapter(curCh, delta) {
    const target = getAdjacentChapterGlobal(curCh, delta);
    if (target) showRandomChapter(target.id);
  }

  function toChineseNum(n) {
    const digits = ['零','一','二','三','四','五','六','七','八','九'];
    if (n < 10) return digits[n];
    if (n < 20) return '十' + (n % 10 === 0 ? '' : digits[n % 10]);
    if (n < 100) {
      const t = Math.floor(n / 10), o = n % 10;
      return digits[t] + '十' + (o === 0 ? '' : digits[o]);
    }
    return String(n);
  }

  // ================================================================
  // 全书全局章序助手（支持 498 章循环翻阅，不局限于同一篇）
  //   D.text 原始顺序 = 《学而》01 → 《尧曰》03（全书 498 章正序）
  //   prev(delta=-1) / next(delta=+1) 取模实现头尾相接循环
  // ================================================================
  function getGlobalChapterIndex(chapterId) {
    const idx = D.text.findIndex(c => c.id === chapterId);
    return idx >= 0 ? idx : 0;
  }
  function getAdjacentChapterGlobal(curCh, delta) {
    const total = D.text.length; // 498
    const curIdx = getGlobalChapterIndex(curCh.id);
    const nextIdx = (curIdx + delta + total) % total; // 加 total 再取模，避免负数
    return D.text[nextIdx];
  }
  function chapterTitleText(ch) {
    // 返回 《篇名》第X章 的中文格式（用于按钮 title 提示）
    return '《' + ch.book_cn + '》第' + toChineseNum(ch.verse_num) + '章';
  }

  function jumpSameSpeaker(ch) {
    const speakerIds = ch.persons?.speakers || [];
    if (!speakerIds.length) return;
    const sp = speakerIds[0];
    // 找出所有该人说话的章节（排除当前）
    const candidates = D.text.filter(c => {
      if (c.id === ch.id) return false;
      const ps = getChapterPersons(c.id);
      return ps?.speakers?.includes(sp);
    });
    if (!candidates.length) return;
    const target = randomItem(candidates);
    showRandomChapter(target.id);
  }

  function jumpSameTheme(ch) {
    const themes = ch.themes || getChapterThemes(ch.id);
    if (!themes.length) return;
    const theme = themes[0];
    const candidates = D.text.filter(c => {
      if (c.id === ch.id) return false;
      const ts = getChapterThemes(c.id);
      return ts?.includes(theme);
    });
    if (!candidates.length) return;
    const target = randomItem(candidates);
    showRandomChapter(target.id);
  }

  function jumpSameBook(ch) {
    // 同篇，优先相邻章
    const sameBook = D.text.filter(c => c.book_pinyin === ch.book_pinyin);
    if (sameBook.length <= 1) {
      // 只有一章就随机其他
      showRandomChapter();
      return;
    }
    // 找相邻章（verse_num +/-1），如果相邻章存在则优先
    const neighbors = sameBook.filter(c => Math.abs(c.verse_num - ch.verse_num) === 1);
    let target;
    if (neighbors.length) {
      target = randomItem(neighbors);
    } else {
      target = randomItem(sameBook.filter(c => c.id !== ch.id));
    }
    showRandomChapter(target.id);
  }

  function jumpSameQA(ch) {
    const qa = ch.qa || getChapterQA(ch.id);
    if (!qa?.is_qa || !qa.question_type) return;
    const qt = qa.question_type;
    const candidates = D.text.filter(c => {
      if (c.id === ch.id) return false;
      const q = getChapterQA(c.id);
      return q?.is_qa && q.question_type === qt;
    });
    if (!candidates.length) return;
    const target = randomItem(candidates);
    showRandomChapter(target.id);
  }

  function copyChapter(ch) {
    const txt = `《${ch.book_cn}》第${toChineseNum(ch.verse_num)}章（${ch.id}）\n\n${ch.text}`;
    navigator.clipboard?.writeText(txt).then(() => {
      flashMsg('已复制到剪贴板');
    }).catch(() => {
      // fallback
      prompt('请手动复制：', txt);
    });
  }

  function shareChapter(ch) {
    const url = location.origin + location.pathname + '#chapter:' + ch.id;
    navigator.clipboard?.writeText(url).then(() => {
      flashMsg('分享链接已复制：' + url);
    }).catch(() => {
      prompt('请手动复制链接：', url);
    });
  }

  function flashMsg(msg) {
    let el = $('#flash-msg');
    if (!el) {
      el = document.createElement('div');
      el.id = 'flash-msg';
      Object.assign(el.style, {
        position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
        background: 'var(--ink)', color: 'var(--bg)', padding: '10px 20px',
        borderRadius: '6px', fontSize: '13px', zIndex: 9999,
        opacity: '0', transition: 'opacity 200ms ease', pointerEvents: 'none'
      });
      document.body.appendChild(el);
    }
    el.textContent = msg;
    requestAnimationFrame(() => el.style.opacity = '1');
    clearTimeout(flashMsg._t);
    flashMsg._t = setTimeout(() => el.style.opacity = '0', 1800);
  }

  // ==================================================
  // 功能2：人物卡片浏览
  // ==================================================
  function renderPersonsPage() {
    renderPersonList();
    renderPersonDetail();
  }

  function renderPersonList() {
    const panel = $('#person-list-panel');
    if (!panel) return;

    // 按分类分组
    const groups = {};
    D.persons.forEach(p => {
      const cat = p.category || '其他';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });

    let html = '<div class="person-groups-scroll">';
    Object.entries(groups).forEach(([cat, persons]) => {
      html += `<div class="person-group">`;
      html += `<div class="person-group-title">${cat}（${persons.length}人）</div>`;
      persons.forEach(p => {
        const active = p.id === App.currentPersonId ? 'active' : '';
        const styleTxt = p.style ? ` · ${p.style}` : '';
        html += `
          <div class="person-list-item ${active}" data-person-id="${p.id}">
            <div class="person-avatar ${catClass(p.category)}">${p.name_cn.charAt(0)}</div>
            <div class="person-info-mini">
              <div class="name-line"><span class="name">${p.name_cn}</span><span class="style">${styleTxt}</span></div>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    });
    html += '</div>';

    panel.innerHTML = html;

    // 绑定点击
    panel.querySelectorAll('.person-list-item').forEach(el => {
      el.addEventListener('click', () => {
        App.currentPersonId = el.dataset.personId;
        location.hash = 'person:' + App.currentPersonId;
        renderPersonList();
        renderPersonDetail();
      });
    });
  }

  function renderPersonDetail() {
    const panel = $('#person-detail-panel');
    if (!panel) return;
    const p = getPersonById(App.currentPersonId);
    if (!p) {
      panel.innerHTML = '<div class="empty-state">请选择一个人物</div>';
      return;
    }

    // 收集该人物相关章节
    const spokenChapters = []; // 作为说话人
    const mentionedChapters = []; // 被提及
    const qaAsked = []; // 作为提问者
    const qaTypes = {}; // {type: count}
    const dialoguePartners = {}; // {personId: count} 对话人物

    D.text.forEach(ch => {
      const ps = getChapterPersons(ch.id);
      const qa = getChapterQA(ch.id);
      const isSpeaker = ps?.speakers?.includes(p.id);
      const isMentioned = ps?.mentioned?.includes(p.id);
      const isAddressee = ps?.addressees?.includes(p.id);

      if (isSpeaker) spokenChapters.push(enrichChapter(ch));
      if (isMentioned && !isSpeaker) mentionedChapters.push(enrichChapter(ch));

      // 统计问答
      if (qa?.is_qa && qa.questioner === p.id) {
        qaAsked.push({ chapter: enrichChapter(ch), qa });
        const t = qa.question_type || 'ask_other';
        qaTypes[t] = (qaTypes[t] || 0) + 1;
      }

      // 对话对象（同一章里出现的其他人物）
      // 【统计口径与展开卡片时完全一致】：只要当前人物在该章任一身份出现（说话/受话/被提及），
      // 就把该章里所有其他身份的人都计为对话伙伴章数，避免按钮章数 ≠ 实际展开卡片数
      const allPInChapter = new Set([...(ps?.speakers || []), ...(ps?.addressees || []), ...(ps?.mentioned || [])]);
      if (allPInChapter.has(p.id)) {
        allPInChapter.delete(p.id);
        allPInChapter.forEach(otherId => {
          dialoguePartners[otherId] = (dialoguePartners[otherId] || 0) + 1;
        });
      }
    });

    const ageTxt = p.age_diff === 0 ? '（孔子本人）' :
      (p.age_diff != null ? `少孔子${Math.abs(p.age_diff)}岁` : '生卒年不详');

    const tagsHtml = (p.tags || []).map(t => `<span class="person-tag">${t}</span>`).join('');

    // ================================================================
    // 构建「提问统计」摘要条（可点击手风琴式）
    // 点击某问题类型标签 → 就地展开该人物此类问题的全部章节
    // 章节>10：先显示前5章 + 「查看全部N章→筛选面板」按钮
    // 再次点击 → 收起
    // ================================================================
    let qaStatHtml = '';
    if (qaAsked.length > 0) {
      const sortedQA = Object.entries(qaTypes).sort((a, b) => b[1] - a[1]);
      const qaTotal = qaAsked.length;
      const qaTags = sortedQA.map(([k, v]) => {
        const cn = ENUM.question_type[k] || k;
        const pct = Math.round((v / qaTotal) * 100);
        // 点击时会通过 data 属性携带类型，由 document 级事件委托处理
        return `
          <span class="stat-tag qa-tag clickable"
                data-stat-type="qa_type"
                data-qa-key="${k}"
                data-cur-person="${p.id}"
                data-count="${v}"
                title="点击查看这${v}章 ${cn} · ${v}次（${pct}%）">
            <span class="st-label">${cn}</span>
            <span class="st-count">${v}次</span>
            <span class="st-bar"><span class="st-fill" style="width:${pct}%"></span></span>
          </span>
        `;
      }).join('');
      qaStatHtml = `
        <div class="stat-strip" id="stat-strip-qa">
          <div class="stat-strip-title">
            <span class="st-icon">📊</span>
            <span class="st-title-text">提问统计</span>
            <span class="st-total">共问过 <b>${qaTotal}</b> 次 · 点击标签查看具体章节</span>
          </div>
          <div class="stat-tags-row">${qaTags}</div>
          <!-- 展开的章节列表占位，点击标签后 JS 注入 -->
          <div class="stat-expand-area" id="stat-expand-qa"></div>
        </div>
      `;
    }

    // ================================================================
    // 构建「对话人物」摘要条（穷尽所有人物 · 可点击手风琴式）
    // 不再用 Top6+其他合并，全部列出；>20 人时视觉上紧凑排列
    // 点击某人物标签 → 就地展开「当前人物×该人物」共同出现的章节
    // ================================================================
    let dialogueStatHtml = '';
    const dpEntries = Object.entries(dialoguePartners).sort((a, b) => b[1] - a[1]);
    if (dpEntries.length > 0) {
      const totalDp = dpEntries.length;
      const dpMax = dpEntries[0][1];

      // 穷尽：不合并「其他 N 人」，全部列出来
      const dpTags = dpEntries.map(([id, v]) => {
        const name = getPersonName(id);
        const pct = Math.round((v / dpMax) * 100);
        return `
          <span class="stat-tag dp-tag clickable"
                data-stat-type="dp_partner"
                data-dp-id="${id}"
                data-cur-person="${p.id}"
                data-count="${v}"
                title="点击查看 ${p.name_cn} × ${name} 共同出现的 ${v} 章">
            <span class="st-name">${name}</span>
            <span class="st-num">${v}章</span>
            <span class="st-mbar"><span class="st-mfill" style="width:${pct}%"></span></span>
          </span>
        `;
      }).join('');

      dialogueStatHtml = `
        <div class="stat-strip" id="stat-strip-dp">
          <div class="stat-strip-title">
            <span class="st-icon">👥</span>
            <span class="st-title-text">对话互动</span>
            <span class="st-total">涉及 <b>${totalDp}</b> 人 · 点击人物查看共同章节</span>
          </div>
          <div class="stat-tags-row ${totalDp >= 15 ? 'dense' : ''}">${dpTags}</div>
          <!-- 展开的章节列表占位 -->
          <div class="stat-expand-area" id="stat-expand-dp"></div>
        </div>
      `;
    }

    panel.innerHTML = `
      <div class="person-header">
        <div class="person-avatar ${catClass(p.category)}" style="width:72px;height:72px;font-size:28px;">${p.name_cn.charAt(0)}</div>
        <div class="person-header-info">
          <div class="person-name">${p.name_cn}</div>
          <div class="person-style-line">
            <span class="label">字</span> ${p.style || '（无）'} · ${ageTxt}
          </div>
          <div class="person-facts">
            <div class="person-fact"><span class="label">籍贯</span>${p.origin || '未考'}</div>
            <div class="person-fact"><span class="label">家世</span>${p.background || '未详'}</div>
            <div class="person-fact"><span class="label">四科</span>${p.category || '其他'}</div>
            <div class="person-fact"><span class="label">出场</span>约${p.lunyu_appearances_estimate || 0}次</div>
          </div>
          <div class="person-tags">${tagsHtml}</div>
        </div>
      </div>

      <div class="person-bio">${p.short_bio || '生平不详'}</div>

      ${qaStatHtml}
      ${dialogueStatHtml}

      <div class="collection-block" id="block-spoken">
        <div class="section-title-row">
          <div class="section-title">💬 说话合集（${spokenChapters.length}章）</div>
          <div class="section-toolbar">
            <span class="toolbar-hint">📚 穷尽无遗漏 · 点击篇名可折叠</span>
          </div>
        </div>
        <div class="collection-content" id="person-spoken-list"></div>
      </div>

      <div class="collection-block" id="block-mentioned">
        <div class="section-title-row">
          <div class="section-title">📝 被提及合集（${mentionedChapters.length}章）</div>
          <div class="section-toolbar">
            <span class="toolbar-hint">📚 穷尽无遗漏 · 点击篇名可折叠</span>
          </div>
        </div>
        <div class="collection-content" id="person-mentioned-list"></div>
      </div>
    `;

    // 渲染三段式合集（精选 + 按篇穷尽 + 跳筛选）
    renderFullCollection({
      containerId: 'person-spoken-list',
      chapters: spokenChapters,
      person: p,
      type: 'spoken',
      filterPayload: {
        type: 'person_spoken',
        personId: p.id
      }
    });

    renderFullCollection({
      containerId: 'person-mentioned-list',
      chapters: mentionedChapters,
      person: p,
      type: 'mentioned',
      filterPayload: {
        type: 'person_mentioned',
        personId: p.id
      }
    });

    // 绑定摘要条标签的手风琴点击事件（事件委托）
    bindStatTagClicks();
  }

  // ================================================================
  // 摘要条标签点击：手风琴式就地展开章节列表
  // ================================================================
  function bindStatTagClicks() {
    // 提问统计标签
    document.querySelectorAll('.stat-tag.qa-tag.clickable').forEach(tag => {
      tag.addEventListener('click', () => {
        const curPersonId = tag.dataset.curPerson;
        const qaKey = tag.dataset.qaKey;
        const count = parseInt(tag.dataset.count || '0', 10);
        const target = document.getElementById('stat-expand-qa');
        if (!target) return;

        // 切换：如果已经是激活状态 → 收起
        const isActive = tag.classList.contains('active');
        // 先把所有同级激活标签取消
        document.querySelectorAll('.stat-tag.qa-tag.clickable').forEach(t => t.classList.remove('active'));
        if (isActive) {
          target.innerHTML = '';
          target.classList.remove('show');
          return;
        }
        tag.classList.add('active');

        // 收集：当前人物作为提问者 + 问答类型 = qaKey 的所有章节
        const chapters = [];
        D.text.forEach(ch => {
          const qa = getChapterQA(ch.id);
          if (qa?.is_qa && qa.questioner === curPersonId && qa.question_type === qaKey) {
            chapters.push(enrichChapter(ch));
          }
        });

        target.innerHTML = buildStatExpandHtml({
          chapters,
          count,
          title: `${ENUM.question_type[qaKey] || qaKey} 共 ${count} 次`,
          filterPayload: {
            type: 'qa_type',
            personId: curPersonId,
            qaKey: qaKey
          }
        });
        target.classList.add('show');
        bindStatExpandInner(target);
      });
    });

    // 对话人物标签
    document.querySelectorAll('.stat-tag.dp-tag.clickable').forEach(tag => {
      tag.addEventListener('click', () => {
        const curPersonId = tag.dataset.curPerson;
        const dpId = tag.dataset.dpId;
        const count = parseInt(tag.dataset.count || '0', 10);
        const target = document.getElementById('stat-expand-dp');
        if (!target) return;

        const isActive = tag.classList.contains('active');
        document.querySelectorAll('.stat-tag.dp-tag.clickable').forEach(t => t.classList.remove('active'));
        if (isActive) {
          target.innerHTML = '';
          target.classList.remove('show');
          return;
        }
        tag.classList.add('active');

        // 收集：当前人物 和 dpId 两人「共同出现」的所有章节
        const chapters = [];
        D.text.forEach(ch => {
          const ps = getChapterPersons(ch.id);
          const allP = [
            ...(ps?.speakers || []),
            ...(ps?.addressees || []),
            ...(ps?.mentioned || [])
          ];
          const set = new Set(allP);
          if (set.has(curPersonId) && set.has(dpId)) {
            chapters.push(enrichChapter(ch));
          }
        });

        const dpName = getPersonName(dpId);
        const curName = getPersonName(curPersonId);
        target.innerHTML = buildStatExpandHtml({
          chapters,
          count,
          title: `${curName} × ${dpName} 共同章节 共 ${chapters.length} 章`,
          filterPayload: {
            type: 'dp_partners',
            personIds: [curPersonId, dpId]
          }
        });
        target.classList.add('show');
        bindStatExpandInner(target);
      });
    });
  }

  // ================================================================
  // 构造展开区 HTML：标题 + 章节列表（≤10章全显示，>10章显示前5章+跳转按钮）
  // ================================================================
    // ================================================================
  // 构造展开区 HTML：标题 + 穷尽全部章卡片（就地展开，不跳筛选面板）
  //   【为什么不跳筛选面板】——逻辑不同：
  //     · 人物页：孔子 × 仲由 = 两人的「交集」（同一章共同出现）
  //     · 筛选面板：孔子 + 仲由 = 两人的「并集」（任一出现即命中）
  //   所以展开区直接穷尽所有匹配章，最清晰无歧义
  // ================================================================
  function buildStatExpandHtml({ chapters, count, title, filterPayload }) {
    const total = chapters.length;
    let listHtml = '';
    if (total === 0) {
      listHtml = '<div class="empty-state" style="padding:16px;">暂无匹配章节（标注数据中未找到）</div>';
    } else {
      // 全部按原顺序渲染，不再只显示前5章 + 跳转按钮
      listHtml = chapters.map(ch => verseCardHtml(ch)).join('');
    }
    return `
      <div class="stat-expand-header">
        <span class="expand-title">${title}</span>
        <span class="expand-total-hint">📚 共 ${total} 章 · 全部穷尽展开 · 点击章节查看原文</span>
      </div>
      <div class="stat-expand-list">${listHtml}</div>
    `;
  }

  function verseCardHtml(ch, opts) {
    opts = opts || {};
    const featured = opts.featured ? '<span class="feat-star" title="精选推荐">⭐</span>' : '';
    return `
      <div class="verse-list-item ${opts.featured ? 'feat' : ''}" data-chapter-id="${ch.id}">
        <div class="v-title">
          ${featured}
          《${ch.book_cn}》第${toChineseNum(ch.verse_num)}章 · ${ch.id}
        </div>
        <div class="v-preview">${ch.text.slice(0, 80)}${ch.text.length > 80 ? '……' : ''}</div>
      </div>
    `;
  }

  // ================================================================
  // 《论语》经典名句种子（用于孔子的精选推荐）
  // 包含大众熟知的40+条名句id
  // ================================================================
  const FAMOUS_QUOTE_IDS = [
    // 学而
    'xueer-01', 'xueer-02', 'xueer-03', 'xueer-04', 'xueer-08', 'xueer-15', 'xueer-16',
    // 为政
    'weizheng-01', 'weizheng-04', 'weizheng-11', 'weizheng-12', 'weizheng-15', 'weizheng-17',
    // 八佾
    'bayi-01', 'bayi-18', 'bayi-20',
    // 里仁
    'liren-01', 'liren-03', 'liren-05', 'liren-08', 'liren-10', 'liren-14', 'liren-17',
    // 公冶长
    'gongyechang-10', 'gongyechang-27',
    // 雍也
    'yongye-11', 'yongye-18', 'yongye-22', 'yongye-24', 'yongye-30',
    // 述而
    'shuer-02', 'shuer-07', 'shuer-08', 'shuer-15', 'shuer-22', 'shuer-29', 'shuer-34',
    // 泰伯
    'taibo-02', 'taibo-07', 'taibo-13',
    // 子罕
    'zihan-01', 'zihan-04', 'zihan-17', 'zihan-19', 'zihan-26', 'zihan-28', 'zihan-29',
    // 先进
    'xianjin-01', 'xianjin-20', 'xianjin-26',
    // 颜渊
    'yanyuan-01', 'yanyuan-02', 'yanyuan-04', 'yanyuan-05', 'yanyuan-06', 'yanyuan-07', 'yanyuan-15', 'yanyuan-17', 'yanyuan-19', 'yanyuan-20', 'yanyuan-23',
    // 子路
    'zilu-03', 'zilu-04', 'zilu-19', 'zilu-20', 'zilu-21', 'zilu-23', 'zilu-27', 'zilu-28', 'zilu-29', 'zilu-30',
    // 宪问
    'xianwen-03', 'xianwen-24', 'xianwen-28', 'xianwen-30', 'xianwen-32', 'xianwen-34', 'xianwen-35', 'xianwen-37', 'xianwen-39', 'xianwen-42',
    // 卫灵公
    'weilinggong-02', 'weilinggong-03', 'weilinggong-04', 'weilinggong-08', 'weilinggong-16', 'weilinggong-18', 'weilinggong-19', 'weilinggong-20', 'weilinggong-21', 'weilinggong-23', 'weilinggong-24', 'weilinggong-27', 'weilinggong-29', 'weilinggong-30', 'weilinggong-34', 'weilinggong-35', 'weilinggong-36', 'weilinggong-38', 'weilinggong-39', 'weilinggong-40', 'weilinggong-41',
    // 季氏
    'jishi-01', 'jishi-03', 'jishi-04', 'jishi-07', 'jishi-08', 'jishi-10',
    // 阳货
    'yanghuo-02', 'yanghuo-06', 'yanghuo-12', 'yanghuo-14', 'yanghuo-17', 'yanghuo-20', 'yanghuo-25',
    // 微子
    'weizi-05', 'weizi-06', 'weizi-07', 'weizi-08',
    // 子张
    'zizhang-04', 'zizhang-06', 'zizhang-13', 'zizhang-22', 'zizhang-24',
    // 尧曰
    'yaoyue-03'
  ];

  // ================================================================
  // 精选章节选择器
  // 孔子：优先名句种子 + 篇均匀分布（10-12章）
  // 非孔子（弟子）：优先该弟子的提问 + 孔子评价该弟子 + 该弟子说话
  // ================================================================
  function selectFeaturedChapters(chapters, person, collectionType) {
    if (!chapters || chapters.length === 0) return [];
    const MAX = Math.min(12, chapters.length);
    const MIN = Math.min(6, chapters.length);
    const result = [];
    const resultSet = new Set();

    const pick = (ch) => {
      if (!resultSet.has(ch.id) && chapters.find(c => c.id === ch.id)) {
        result.push(chapters.find(c => c.id === ch.id));
        resultSet.add(ch.id);
      }
    };

    if (person.id === 'kongzi') {
      // ========== 孔子精选：名句种子命中 + 篇覆盖均衡 ==========
      // 1. 先把在名句种子里的挑出来
      const famous = chapters.filter(c => FAMOUS_QUOTE_IDS.includes(c.id));
      famous.forEach(pick);

      // 2. 不够的话，按篇均匀补充（每篇补 1 条，直到凑够 MAX）
      if (result.length < MIN) {
        const byBook = {}; // {book_pinyin: [chapters]}
        chapters.forEach(ch => {
          if (!resultSet.has(ch.id)) {
            if (!byBook[ch.book_pinyin]) byBook[ch.book_pinyin] = [];
            byBook[ch.book_pinyin].push(ch);
          }
        });
        // 每篇按序抽 1 条，轮询
        const books = Object.keys(byBook);
        let cursor = 0;
        while (result.length < MAX && books.length > 0) {
          const book = books[cursor % books.length];
          if (byBook[book] && byBook[book].length > 0) {
            pick(byBook[book].shift());
          } else {
            // 这篇没了，从 books 移除
            books.splice(cursor % books.length, 1);
            continue;
          }
          cursor++;
        }
      }
    } else {
      // ========== 弟子/其他人精选：提问 > 孔子评价 > 说话 > 其他 ==========
      const tier1 = []; // 提问（该人是 questioner）
      const tier2 = []; // 孔子评价此人（孔子说话 + 此人在 mentioned 里）
      const tier3 = []; // 该人说话（如果是说话合集）
      const tier4 = []; // 剩下的

      chapters.forEach(ch => {
        const qa = getChapterQA(ch.id);
        const ps = getChapterPersons(ch.id);
        const speakers = ps?.speakers || [];
        const mentioned = ps?.mentioned || [];

        if (qa?.questioner === person.id) {
          tier1.push(ch);
        } else if (
          speakers.includes('kongzi') && mentioned.includes(person.id)
        ) {
          tier2.push(ch);
        } else if (
          (collectionType === 'spoken' && speakers.includes(person.id)) ||
          (collectionType === 'mentioned' && mentioned.includes(person.id))
        ) {
          tier3.push(ch);
        } else {
          tier4.push(ch);
        }
      });

      // 每个 tier 取一些，保证覆盖
      [tier1, tier2, tier3, tier4].forEach(tier => {
        // 每个 tier 最多取 6 条，不够就全取
        const take = tier.slice(0, 6);
        take.forEach(pick);
      });

      // 还不够？补 tier1/tier2 中剩下的
      if (result.length < MIN) {
        [...tier1, ...tier2, ...tier3, ...tier4].forEach(pick);
      }

      // 截到 MAX
      if (result.length > MAX) {
        result.length = MAX;
      }
    }

    // 按原 chapter 顺序排序
    const orderMap = new Map(chapters.map((c, i) => [c.id, i]));
    result.sort((a, b) => (orderMap.get(a.id) || 0) - (orderMap.get(b.id) || 0));
    return result;
  }

  // ================================================================
  // 三段式合集渲染器（精选 + 按篇穷尽目录 + 跳筛选面板）
  // ================================================================
    // ================================================================
  // 合集渲染器：按篇穷尽手风琴（无精选段、不跳筛选面板）
  //   人物页的「说话合集」「被提及合集」统一使用此渲染
  //   - 不跳筛选面板（逻辑不同：人物是 交集，筛选面板是 并集）
  //   - 按篇分组，默认全部展开；支持篇名折叠/展开、全展开/全收起
  // ================================================================
  function renderFullCollection({ containerId, chapters, person, type, filterPayload }) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const total = chapters.length;

    // 保存到 App 备用
    if (!App._collections) App._collections = {};
    App._collections[type] = chapters;
    App._collections[containerId] = { chapters, person, type };

    if (total === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:24px;">无相关章节</div>';
      return;
    }

    // === 按篇分组穷尽目录 ===
    const byBook = {};
    BOOKS.forEach(b => { byBook[b.pinyin] = { info: b, chapters: [] }; });
    chapters.forEach(ch => {
      if (byBook[ch.book_pinyin]) byBook[ch.book_pinyin].chapters.push(ch);
    });

    const bookEntries = BOOKS
      .map(b => ({ info: b, list: byBook[b.pinyin].chapters }))
      .filter(x => x.list.length > 0);

    const booksHtml = bookEntries.map(entry => {
      const count = entry.list.length;
      // 全部默认展开（穷尽），箭头默认向下 ▾
      return `
        <div class="book-folder" data-book="${entry.info.pinyin}">
          <div class="book-folder-header" data-action="toggle-book">
            <span class="bk-arrow">▸</span>
            <span class="bk-name">《${entry.info.cn}》</span>
            <span class="bk-count">${count}章</span>
          </div>
          <div class="book-folder-body">
            <div class="verse-list verse-list-dense">
              ${entry.list.map(ch => verseCardHtml(ch)).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // 顶部信息条：统计 + 全展开/全收起工具（无跳筛选面板按钮）
    const actionHtml = `
      <div class="coll-action-bar">
        <div class="coll-stat">
          <span>📚 共覆盖 <b>${bookEntries.length}</b> 篇 <b>${total}</b> 章</span>
          <span class="coll-stat-divider">|</span>
          <span>全部穷尽展开 · 无需跳转筛选面板</span>
        </div>
        <div class="cb-tools">
          <button class="btn btn-small btn-ghost" data-action="expand-all-books">🔽 全部展开</button>
          <button class="btn btn-small btn-ghost" data-action="collapse-all-books">🔼 全部收起</button>
        </div>
      </div>
    `;

    const dirHtml = `<div class="coll-books">${booksHtml}</div>`;
    container.innerHTML = actionHtml + dirHtml;

    // === 绑定交互 ===
    // 章节卡片 → 「漫步」页读原文
    container.querySelectorAll('.verse-list-item').forEach(item => {
      item.addEventListener('click', () => {
        const cid = item.dataset.chapterId;
        // 卡片点击 → 打开研读 Modal，不跳漫步页（保留用户当前上下文）
        showCardDetail(cid);
        // （研读窗模式：不修改 hash，保持用户当前页面上下文，不跳漫步页）
      });
    });
    // 篇折叠手风琴
    container.querySelectorAll('[data-action="toggle-book"]').forEach(h => {
      h.addEventListener('click', () => {
        const folder = h.parentElement;
        folder.classList.toggle('open');
        const arrow = h.querySelector('.bk-arrow');
        if (arrow) arrow.textContent = folder.classList.contains('open') ? '▾' : '▸';
      });
    });
    // 全展开 / 全收起
    const exAll = container.querySelector('[data-action="expand-all-books"]');
    const colAll = container.querySelector('[data-action="collapse-all-books"]');
    if (exAll) exAll.addEventListener('click', () => {
      container.querySelectorAll('.book-folder').forEach(f => {
        f.classList.add('open');
        const a = f.querySelector('.bk-arrow'); if (a) a.textContent = '▾';
      });
    });
    if (colAll) colAll.addEventListener('click', () => {
      container.querySelectorAll('.book-folder').forEach(f => {
        f.classList.remove('open');
        const a = f.querySelector('.bk-arrow'); if (a) a.textContent = '▸';
      });
    });
  }

  // ================================================================
  // 小搜索框：关键词过滤当前合集（仅影响前端显示，不修改源数据）
  // ================================================================
  function filterCollectionByKeyword(collectionType, kw) {
    if (!App._collections || !App._collections[collectionType]) return;
    const mapping = {
      spoken: 'person-spoken-list',
      mentioned: 'person-mentioned-list'
    };
    const containerId = mapping[collectionType];
    const container = document.getElementById(containerId);
    const meta = App._collections[containerId];
    if (!container || !meta) return;
    const { chapters, person, type, filterPayload } = meta;

    if (!kw) {
      // 清空搜索 → 重绘原始三段式
      renderFullCollection({
        containerId, chapters, person, type, filterPayload
      });
      return;
    }

    // 有搜索词：直接把整个合集区替换为过滤结果列表
    const kwLow = kw.toLowerCase();
    const filtered = chapters.filter(ch => {
      if (!ch.text) return false;
      return ch.text.toLowerCase().includes(kwLow) ||
             (ch.book_cn && ch.book_cn.includes(kw)) ||
             (ch.id && ch.id.toLowerCase().includes(kwLow));
    });

    // 高亮处理（简单替换包裹）
    const safeEscape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const highlight = text => {
      if (!kw) return text;
      const re = new RegExp(safeEscape(kw), 'gi');
      return text.replace(re, m => `<mark class="kw-hit">${m}</mark>`);
    };

    const verseHtml = filtered.slice(0, 100).map(ch => `
      <div class="verse-list-item" data-chapter-id="${ch.id}">
        <div class="v-title">《${ch.book_cn}》第${toChineseNum(ch.verse_num)}章 · ${ch.id}</div>
        <div class="v-preview">${highlight(ch.text.slice(0, 120))}${ch.text.length > 120 ? '……' : ''}</div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="coll-search-info">
        🔍 关键词「<b>${kw}</b>」匹配 <b>${filtered.length}</b> 章
        ${filtered.length > 100 ? `（当前显示前 100 章）` : ''}
        <button class="btn btn-small btn-ghost" data-action="clear-search">清除搜索</button>
      </div>
      ${filtered.length === 0
        ? '<div class="empty-state" style="padding:20px;">无匹配章节，请换个关键词</div>'
        : `<div class="verse-list">${verseHtml}</div>`
      }
    `;

    // 绑定
    container.querySelectorAll('.verse-list-item').forEach(item => {
      item.addEventListener('click', () => {
        const cid = item.dataset.chapterId;
        // 卡片点击 → 打开研读 Modal，不跳漫步页（保留用户当前上下文）
        showCardDetail(cid);
        // （研读窗模式：不修改 hash，保持用户当前页面上下文，不跳漫步页）
      });
    });
    const clearBtn = container.querySelector('[data-action="clear-search"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        // 找到对应搜索 input 清空，再重绘
        const inp = document.querySelector(`.mini-search[data-collection="${collectionType}"]`);
        if (inp) inp.value = '';
        filterCollectionByKeyword(collectionType, '');
      });
    }
  }

  // 绑定展开区内部的点击：章节卡片跳转 + 查看全部按钮跳转筛选面板
    function bindStatExpandInner(target) {
    if (!target) return;
    // 章节卡片 → 「漫步」页读原文
    target.querySelectorAll('.verse-list-item').forEach(item => {
      item.addEventListener('click', () => {
        const cid = item.dataset.chapterId;
        // 卡片点击 → 打开研读 Modal，不跳漫步页（保留用户当前上下文）
        showCardDetail(cid);
        // （研读窗模式：不修改 hash，保持用户当前页面上下文，不跳漫步页）
      });
    });
    // 【不再提供跳筛选面板】——人物页是交集逻辑，筛选面板是并集逻辑，跳转反而混淆
  }


  // （旧版 applyFilterFromPayload 已移除，新的版本在 renderFilterPage 附近，使用 v3 全选逻辑）

  function renderVerseList(sel, chapters) {
    const el = $(sel);
    if (!el) return;
    if (!chapters.length) {
      el.innerHTML = '<div class="empty-state" style="padding:24px;">无相关章节</div>';
      return;
    }
    el.innerHTML = chapters.map(ch => `
      <div class="verse-list-item" data-chapter-id="${ch.id}">
        <div class="v-title">《${ch.book_cn}》第${toChineseNum(ch.verse_num)}章 · ${ch.id}</div>
        <div class="v-preview">${ch.text.slice(0, 60)}${ch.text.length > 60 ? '……' : ''}</div>
      </div>
    `).join('');

    el.querySelectorAll('.verse-list-item').forEach(item => {
      item.addEventListener('click', () => {
        const cid = item.dataset.chapterId;
        // 卡片点击 → 打开研读 Modal，不跳漫步页（保留用户当前上下文）
        showCardDetail(cid);
        // （研读窗模式：不修改 hash，保持用户当前页面上下文，不跳漫步页）
      });
    });
  }

  function renderQAChart(qaTypes) {
    const dom = document.getElementById('chart-qa-types');
    if (!dom || !window.echarts) return;
    // 先清空已有实例
    const existing = echarts.getInstanceByDom(dom);
    if (existing) existing.dispose();
    const chart = echarts.init(dom);
    const entries = Object.entries(qaTypes);
    if (!entries.length) {
      dom.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:80px 0;">该人物无提问记录</div>';
      return;
    }
    // 如果分类太多（>6），饼图不要显示全部文字标签，用 tooltip 辅助
    const manySlices = entries.length > 6;
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: p => (ENUM.question_type[p.name] || p.name) + '<br/>' + p.value + '次'
      },
      color: [App.colors.accent, App.colors.accent2, App.colors.gold, '#c87533', '#8aa85c', '#d4a747', '#a06a3c', '#6b7f45', '#b8955a', '#7d5a30', App.colors.muted, '#5c5040'],
      series: [{
        type: 'pie',
        // 环形图缩小内半径，保证外标签有空间
        radius: ['32%', '58%'],
        center: ['50%', '52%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: App.colors.bg2, borderWidth: 2 },
        minAngle: 3, // 极小值扇形不坍缩为一条线
        label: {
          show: !manySlices, // 分类太多时隐藏外部标签，只保留tooltip
          formatter: p => (ENUM.question_type[p.name] || p.name) + ' ' + p.value + '次',
          color: App.colors.ink,
          fontSize: 11,
          lineHeight: 14,
          alignTo: 'labelLine',
          edgeDistance: 10,
          distanceToLabelLine: 5
        },
        labelLine: {
          show: !manySlices,
          length: 10,
          length2: 8,
          lineStyle: { color: App.colors.muted }
        },
        emphasis: {
          label: { show: true, fontSize: 12, fontWeight: 'bold' }
        },
        data: entries.map(([k, v]) => ({ name: k, value: v }))
      }]
    });
    chart.resize();
    window.addEventListener('resize', () => chart.resize());
  }

  function renderDialogueChart(partners) {
    const dom = document.getElementById('chart-dialogue');
    if (!dom || !window.echarts) return;
    const existing = echarts.getInstanceByDom(dom);
    if (existing) existing.dispose();
    const chart = echarts.init(dom);
    const entries = Object.entries(partners).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (!entries.length) {
      dom.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:80px 0;">暂无对话记录</div>';
      return;
    }
    // 计算最长名字的像素宽度，为左边缘留出足够空间（每个中文字约 12px）
    const longestNameLen = Math.max(...entries.map(([id]) => getPersonName(id).length));
    const leftMargin = Math.max(70, Math.min(130, longestNameLen * 12 + 20));

    chart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 10, right: 40, bottom: 20, left: leftMargin, containLabel: false },
      xAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: App.colors.rule } },
        axisLabel: { color: App.colors.muted, fontSize: 10 },
        splitLine: { lineStyle: { color: App.colors.rule, type: 'dashed' } },
        minInterval: 1
      },
      yAxis: {
        type: 'category',
        data: entries.map(([id]) => getPersonName(id)).reverse(),
        axisLine: { lineStyle: { color: App.colors.rule } },
        axisLabel: {
          color: App.colors.ink,
          fontSize: 11,
          fontFamily: 'Noto Serif SC, Songti SC, STSong, serif',
          // 长名字截断 + hover 在 tooltip 显示全称
          formatter: val => val.length > 6 ? val.slice(0, 5) + '…' : val
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: params => {
          const p = params[0];
          return p.name + '<br/>对话章数：' + p.value + ' 章';
        }
      },
      series: [{
        type: 'bar',
        data: entries.map(([, v]) => v).reverse(),
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: App.colors.accent },
              { offset: 1, color: App.colors.gold }
            ]
          },
          borderRadius: [0, 4, 4, 0]
        },
        label: {
          show: true,
          position: 'right',
          color: App.colors.muted,
          fontSize: 11,
          formatter: '{c}次',
          distance: 4
        },
        barWidth: 14
      }]
    });
    chart.resize();
    window.addEventListener('resize', () => chart.resize());
  }

  // ==================================================
  // 功能3：多维筛选面板 v3（单栏 · 筛选器=分布条）
  // - 四个维度全部胶囊化（篇目20/文体7/主题6/人物34 = 67胶囊，穷尽不省略）
  // - 【新逻辑】空选=0章通过；默认全选=486章全显；选中=仅保留
  // - 人物：去掉 4 种角色，默认任意角色命中
  // ==================================================
  App.filterState = {
    books: BOOKS.map(b => b.pinyin),      // 默认全选（20篇全部）
    styles: Object.keys(ENUM.style_type), // 默认全选（7类全部）
    themes: Object.keys(ENUM.themes),     // 默认全选（6类全部）
    persons: D.persons.map(p => p.id),    // 默认全选（34人全部）
    _extra: {}
  };

  function renderFilterPage() {
    // 【新 #4】默认进入筛选 Tab，4 个维度强制全选（486 章全部显示）
    // 但如果是从其他页面跳转过来（带 _skipReset 标志），就保留 payload 配置不重置
    if (!App.filterState._skipReset) {
      App.filterState.books = BOOKS.map(b => b.pinyin);
      App.filterState.styles = Object.keys(ENUM.style_type);
      App.filterState.themes = Object.keys(ENUM.themes);
      App.filterState.persons = D.persons.map(p => p.id);
      App.filterState._extra = {};
    }
    // 清掉标志位（下次进来是普通 Tab 切换就正常重置）
    delete App.filterState._skipReset;

    initFilterUI_V2();       // 生成 67 个胶囊（只执行一次）
    syncFilterUI_V2();       // 同步选中态到 UI
    applyFilter_V2();        // 执行筛选并渲染卡片流
  }

  // 从其他页面跳转筛选面板时，自动配置筛选条件
  // 【新逻辑】未指定的维度默认全选，空选=0通过
  // 【注意】设置完 filterState 后立刻切 Tab 会触发 renderFilterPage，但我们设置了 _skipReset 标志，
  // renderFilterPage 看到这个标志就不强制重置成全选，保留 payload 带来的收窄条件
  function applyFilterFromPayload(payload) {
    App.filterState = {
      books: BOOKS.map(b => b.pinyin),        // 默认全选
      styles: Object.keys(ENUM.style_type),   // 默认全选
      themes: Object.keys(ENUM.themes),       // 默认全选
      persons: D.persons.map(p => p.id),      // 默认全选
      _extra: {},
      _skipReset: true                         // 标志：下一次 renderFilterPage 不要重置
    };

    if (payload.type === 'qa_type') {
      if (payload.personId) App.filterState.persons = [payload.personId];
      App.filterState._extra.qaType = payload.qaKey;
    } else if (payload.type === 'dp_partners') {
      App.filterState.persons = payload.personIds.slice();
      App.filterState._extra.bothPersons = payload.personIds;
    } else if (payload.type === 'person_spoken') {
      App.filterState.persons = [payload.personId];
    } else if (payload.type === 'person_mentioned') {
      App.filterState.persons = [payload.personId];
    }
    // 切到筛选 Tab（renderFilterPage 会读到 _skipReset 不重置）
    switchTab('filter');
  }

  // 初始化：生成所有胶囊，绑定事件（只执行一次）
  function initFilterUI_V2() {
    const panel = $('#filter-panel');
    if (!panel || panel.dataset.inited) return;
    panel.dataset.inited = '1';

    // ---- 预计算：全部用 init() 里算好的 App._stats（真实章数，去重）----
    const styleCounts = App._stats?.styleCounts || {};
    const themeCounts = App._stats?.themeCounts || {};
    const personCounts = App._stats?.personVerseCounts || {};

    // ---- 篇目胶囊（章数：真实统计 D.text 按篇分的实际章数）----
    // （之前用 BOOKS[i].verses 是旧静态值，现在按真实 D.text 统计更准）
    const realBookCounts = {};
    (D.text || []).forEach(ch => {
      realBookCounts[ch.book_pinyin] = (realBookCounts[ch.book_pinyin] || 0) + 1;
    });

    const booksRow = $('#f-pill-books');
    if (booksRow) {
      booksRow.innerHTML = BOOKS.map(b => {
        const cnt = realBookCounts[b.pinyin] || b.verses || 0;
        return `<span class="f-pill f-pill-book f-pill-dist" data-dim="books" data-val="${b.pinyin}" title="《${b.cn}》共 ${cnt} 章">
          <span class="fp-name">《${b.cn}》</span><span class="fp-count">${cnt}</span>
        </span>`;
      }).join('');
    }

    // ---- 文体胶囊（fp-count 用真实统计）----
    const stylesRow = $('#f-pill-styles');
    if (stylesRow) {
      stylesRow.innerHTML = Object.entries(ENUM.style_type).map(([k, v]) =>
        `<span class="f-pill f-pill-style f-pill-dist" data-dim="styles" data-val="${k}">
          <span class="fp-name">${v}</span><span class="fp-count">${styleCounts[k] || 0}</span>
        </span>`
      ).join('');
    }

    // ---- 主题胶囊（fp-count 用真实统计）----
    const themesRow = $('#f-pill-themes');
    if (themesRow) {
      themesRow.innerHTML = Object.entries(ENUM.themes).map(([k, v]) =>
        `<span class="f-pill f-pill-theme f-pill-dist" data-dim="themes" data-val="${k}">
          <span class="fp-name">${v}</span><span class="fp-count">${themeCounts[k] || 0}</span>
        </span>`
      ).join('');
    }

    // ---- 人物胶囊：34人平铺（无分组，按真实出场章数降序）+ fp-count 用去重章数（不是人次）----
    const pBox = $('#f-pill-persons-flat');
    if (pBox) {
      const personsWithCount = D.persons.map(p => {
        const byId = personCounts[p.id] || 0;
        const byName = personCounts[p.name_cn] || 0;
        return { ...p, _cnt: byId + byName };
      }).sort((a, b) => {
        // 孔子永远第一（kongzi）
        const aIsK = (a.id === 'kongzi' || a.id === 'confucius');
        const bIsK = (b.id === 'kongzi' || b.id === 'confucius');
        if (aIsK && !bIsK) return -1;
        if (!aIsK && bIsK) return 1;
        return b._cnt - a._cnt;
      });
      pBox.innerHTML = personsWithCount.map(p => {
        const cat = p.category || '其他';
        return `<span class="f-pill f-pill-person f-pill-dist f-person-${catClass(cat)}" data-dim="persons" data-val="${p.id}" title="${p.name_cn}${p.style ? ' · 字 '+p.style : ''}${cat !== '其他' ? ' · '+cat : ''}${p._cnt ? ' · 出场 '+p._cnt+' 章' : ''}">
          <span class="fp-name">${p.name_cn}</span><span class="fp-count">${p._cnt}</span>
        </span>`;
      }).join('');
    }

    // ---- 胶囊点击事件（事件委托）----
    panel.addEventListener('click', (e) => {
      // 【手风琴：任意维度头】点击 f-dim-accordion-head → 展开/收起
      const dimAcc = e.target.closest('.f-dim-accordion-head');
      if (dimAcc && !e.target.closest('.f-selall') && !e.target.closest('.f-pill')) {
        e.preventDefault();
        const wrap = dimAcc.closest('.f-dim-accordion');
        if (wrap) {
          const cur = wrap.getAttribute('data-expanded') === '1';
          wrap.setAttribute('data-expanded', cur ? '0' : '1');
          return;
        }
      }

      const pill = e.target.closest('.f-pill');
      if (pill) {
        e.preventDefault();
        const dim = pill.dataset.dim;
        const val = pill.dataset.val;
        togglePill(dim, val);
        syncFilterUI_V2();
        applyFilter_V2();
        updateResultActiveFilters();
        return;
      }
      // 【优先级 1】全局按钮：两态切换（4维全选 ↔ 4维清空）
      // 必须在普通 .f-selall 之前判断，因为全局按钮也带 .f-selall 类
      const actGlobalToggle = e.target.closest('[data-action="global-toggle"]');
      if (actGlobalToggle) {
        e.preventDefault();
        const TOTAL = {
          books:   BOOKS.map(b => b.pinyin),
          styles:  Object.keys(ENUM.style_type),
          themes:  Object.keys(ENUM.themes),
          persons: D.persons.map(p => p.id),
        };
        // 判断当前是否"4维全部全选" → 是则清空，否则全选
        const allAll = ['books', 'styles', 'themes', 'persons'].every(dim =>
          App.filterState[dim].length === TOTAL[dim].length
        );
        if (allAll) {
          App.filterState.books = [];
          App.filterState.styles = [];
          App.filterState.themes = [];
          App.filterState.persons = [];
        } else {
          App.filterState.books   = TOTAL.books.slice();
          App.filterState.styles  = TOTAL.styles.slice();
          App.filterState.themes  = TOTAL.themes.slice();
          App.filterState.persons = TOTAL.persons.slice();
        }
        syncFilterUI_V2();
        applyFilter_V2();
        updateResultActiveFilters();
        return;
      }
      // 【优先级 2】每个维度的全选/清空：只处理带 data-dim 的维度按钮，不碰全局
      const selall = e.target.closest('.f-selall[data-dim]');
      if (selall) {
        e.preventDefault();
        const dim = selall.dataset.dim;
        doSelectAll(dim);
        syncFilterUI_V2();
        applyFilter_V2();
        updateResultActiveFilters();
        return;
      }
    });

    // 移动端侧边栏（旧元素已移除，跳过相关逻辑（元素不存在则不执行）
  }

  // 更新移动端按钮上的「已选 N 项」角标
  function updateMobileActiveCount() {
    const el = document.getElementById('mobile-active-count');
    if (!el) return;
    const n =
      App.filterState.books.length +
      App.filterState.styles.length +
      App.filterState.themes.length +
      App.filterState.persons.length;
    if (n === 0) {
      el.innerHTML = '';
      el.style.display = 'none';
    } else {
      el.innerHTML = `已选 ${n} 项`;
      el.style.display = '';
    }
  }

  // 切换单个胶囊选中状态
  function togglePill(dim, val) {
    const arr = App.filterState[dim];
    const idx = arr.indexOf(val);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(val);
  }

  // 全选操作（去掉了分组参数，四个维度统一逻辑：全部选中 <-> 全部清空）
  function doSelectAll(dim) {
    let pool;
    if (dim === 'books') pool = BOOKS.map(b => b.pinyin);
    else if (dim === 'styles') pool = Object.keys(ENUM.style_type);
    else if (dim === 'themes') pool = Object.keys(ENUM.themes);
    else if (dim === 'persons') pool = D.persons.map(p => p.id);

    // 判断当前状态是否"全部选中"——pool 中每一个都在 filterState[dim] 里
    const allSel = pool.every(id => App.filterState[dim].includes(id));
    if (allSel) {
      // 已经全选 → 清空（空选=0章通过）
      App.filterState[dim] = [];
    } else {
      // 没有全选 → 全选
      App.filterState[dim] = pool.slice();
    }
  }

  // 从 filterState 同步到 UI：简单两态
  // 【新逻辑】全选按钮的判断标准只有一个：该维度的值是否"全部显式选中"
  //   - 是（selected === total）→ 视为"全选状态"，藏青蓝靛实底「× 清空」
  //   - 否（包括空选 / 部分选中）→ 视为"未全选"，白底淡边「全选」
  //   （空选不再等于"全选"，因为空选=0章通过）
  function syncFilterUI_V2() {
    const panel = $('#filter-panel');
    if (!panel) return;

    // 1. 普通胶囊的 选中/未选
    ['books', 'styles', 'themes', 'persons'].forEach(dim => {
      panel.querySelectorAll(`.f-pill[data-dim="${dim}"]`).forEach(pill => {
        const val = pill.dataset.val;
        const sel = App.filterState[dim].includes(val);
        pill.classList.toggle('active', sel);
      });
    });

    // 2. 每个维度的全选按钮两态
    panel.querySelectorAll('.f-selall[data-dim]').forEach(btn => {
      const dim = btn.dataset.dim;
      let pool;
      if (dim === 'books') pool = BOOKS.map(b => b.pinyin);
      else if (dim === 'styles') pool = Object.keys(ENUM.style_type);
      else if (dim === 'themes') pool = Object.keys(ENUM.themes);
      else if (dim === 'persons') pool = D.persons.map(p => p.id);

      const selected = App.filterState[dim].length;
      const total = pool.length;
      const isAll = (selected === total);  // 只有"全部显式选中"才算全选状态
      btn.classList.remove('is-on', 'is-off');
      if (isAll) {
        btn.classList.add('is-on');
        btn.innerHTML = '× 清空';
      } else {
        btn.classList.add('is-off');
        btn.innerHTML = '全选';
      }
    });

    // 3. 全局全选/清空按钮两态（4 个维度都全选才显示「× 清空」实底）
    const globalBtn = panel.querySelector('.f-selall-global');
    if (globalBtn) {
      const TOTAL = {
        books:   BOOKS.length,
        styles:  Object.keys(ENUM.style_type).length,
        themes:  Object.keys(ENUM.themes).length,
        persons: D.persons.length,
      };
      const allAll = ['books', 'styles', 'themes', 'persons'].every(dim =>
        App.filterState[dim].length === TOTAL[dim]
      );
      globalBtn.classList.remove('is-on', 'is-off');
      if (allAll) {
        globalBtn.classList.add('is-on');
        globalBtn.innerHTML = '× 全局清空';
      } else {
        globalBtn.classList.add('is-off');
        globalBtn.innerHTML = '全局全选';
      }
    }
  }

  // 执行筛选 v4【修正逻辑】
  // 规则：
  //   ① 四个维度全部空（全局清空态）→ 0章通过（显示空状态）
  //   ② 至少有 1 个维度非空 → 空的维度 = 全部放行（不做限制）
  //   ③ 某维度「选中数 == 该维度总数」→ 视为全选 = 也放行（不过滤，和空的效果相同）
  //      （解决「全选 34 人但有章不在 34 人白名单内 → 反被排除」的悖论）
  //   ④ 部分选中维度：按交集 AND 过滤（必须全部命中，章数会越来越少）
  function applyFilter_V2() {
    const fs = App.filterState;
    const extra = fs._extra || {};

    // 各维度总量（全选时跳过用）
    const TOTAL = {
      books:   BOOKS.length,
      styles:  Object.keys(ENUM.style_type).length,
      themes:  Object.keys(ENUM.themes).length,
      persons: D.persons.length,
    };
    const isAll = (dim) => (fs[dim].length === TOTAL[dim]);  // 全选 = 放行
    const isNone = (dim) => (fs[dim].length === 0);         // 空选 = 放行（但全局全空走 ①）

    // 先判断是否全局全空
    const anyNonEmpty = (
      fs.books.length > 0 ||
      fs.styles.length > 0 ||
      fs.themes.length > 0 ||
      fs.persons.length > 0
    );

    const results = D.text.filter(ch => {
      // ① 全部空 = 什么都不通过（全局清空→0章）
      if (!anyNonEmpty) return false;

      // ② 篇目：非空且不全选 才过滤
      if (!isNone('books') && !isAll('books') && !fs.books.includes(ch.book_pinyin)) return false;

      // ③ 文体：非空且不全选 才过滤
      if (!isNone('styles') && !isAll('styles')) {
        const st = getChapterStyle(ch.id);
        if (!fs.styles.includes(st)) return false;
      }

      // ④ 主题：非空且不全选 才过滤（至少命中一个选中的主题）
      if (!isNone('themes') && !isAll('themes')) {
        const ts = getChapterThemes(ch.id) || [];
        if (!ts.some(t => fs.themes.includes(t))) return false;
      }

      // ⑤ 人物：非空且不全选 才过滤（任意角色命中 speakers/addressees/mentioned/问答 就算过）
      if (!isNone('persons') && !isAll('persons')) {
        const ps = getChapterPersons(ch.id);
        const qa = getChapterQA(ch.id);
        const all = new Set([
          ...(ps?.speakers || []),
          ...(ps?.addressees || []),
          ...(ps?.mentioned || []),
          qa?.questioner,
          qa?.answerer
        ].filter(Boolean));
        const hit = fs.persons.some(pid => all.has(pid));
        if (!hit) return false;
      }

      // Extra: 限定问答类型（qaType）
      if (extra.qaType) {
        const qa = getChapterQA(ch.id);
        if (!(qa?.is_qa && qa.question_type === extra.qaType)) return false;
      }
      // Extra: 两个人物必须同时出现在 all_persons 中（bothPersons 数组）
      if (Array.isArray(extra.bothPersons) && extra.bothPersons.length >= 2) {
        const ps = getChapterPersons(ch.id);
        const qa = getChapterQA(ch.id);
        const allP = new Set([
          ...(ps?.speakers || []),
          ...(ps?.addressees || []),
          ...(ps?.mentioned || []),
          qa?.questioner,
          qa?.answerer
        ].filter(Boolean));
        for (const pid of extra.bothPersons) {
          if (!allP.has(pid)) return false;
        }
      }
      return true;
    });

    renderFilterResults_V2(results);
  }

  // 渲染结果：【新结构】顶部两段（当前筛选条件 + 命中章数）+ 下面卡片流
  // （去掉了重复的四维分布条，因为筛选器本身就是穷尽的67胶囊带章数的分布条）
  function renderFilterResults_V2(results) {
    const total = results.length;

    const statsBox = $('#filter-stats-v2');
    if (statsBox) {
      const { activeHtml, activeCount } = buildActiveFiltersSummary();

      // 空选提示（全局清空态）
      const isEmpty = (
        App.filterState.books.length === 0 &&
        App.filterState.styles.length === 0 &&
        App.filterState.themes.length === 0 &&
        App.filterState.persons.length === 0
      );

      statsBox.innerHTML = `
        <div class="stats-active-row">
          <div class="stats-active-label">当前筛选条件</div>
          <div class="stats-active-pills">
            ${isEmpty
              ? '<span class="stats-active-empty">🧹 全局已清空 · 请先勾选左侧胶囊，或点击右上角「🌐 全局全选」</span>'
              : (activeCount > 0 ? activeHtml : '<span class="stats-active-empty">未设置筛选条件</span>')
            }
          </div>
        </div>
        <div class="stats-count-row">
          <div class="stats-total">📖 <b>${total}</b> / 498 章 &nbsp;
            <span style="font-size:12px;font-weight:400;color:var(--muted);">
              ${total === 0 ? '（请先勾选筛选条件）' : `占全部 ${(total*100/498).toFixed(1)}%`}
            </span>
          </div>
        </div>
      `;

      // 绑定 active filter 胶囊 × 移除
      statsBox.querySelectorAll('[data-remove-filter]').forEach(x => {
        x.addEventListener('click', () => {
          const dim = x.dataset.dim;
          const key = x.dataset.key;
          const arr = App.filterState[dim];
          if (Array.isArray(arr)) {
            const idx = arr.indexOf(key);
            if (idx >= 0) arr.splice(idx, 1);
          }
          syncFilterUI_V2();
          applyFilter_V2();
          updateResultActiveFilters();
        });
      });
    }

    // ---- 卡片流 ----
    const cardsEl = $('#filter-cards');
    if (!cardsEl) return;
    if (!results.length) {
      cardsEl.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div>暂无匹配章节，请调整筛选条件</div>';
      return;
    }
    cardsEl.innerHTML = results.map(ch => {
      const enriched = enrichChapter(ch);
      const tagsHtml = [];
      if (enriched.style_cn) tagsHtml.push(`<span class="tag tag-style">${enriched.style_cn}</span>`);
      (enriched.themes_cn || []).slice(0, 2).forEach(t => tagsHtml.push(`<span class="tag tag-theme">${t}</span>`));
      const sp = enriched.persons?.speakers?.[0];
      if (sp) tagsHtml.push(`<span class="tag tag-person">${getPersonName(sp)}</span>`);
      return `
        <div class="chapter-card" data-chapter-id="${ch.id}">
          <div class="card-title">《${ch.book_cn}》第${toChineseNum(ch.verse_num)}章 · ${ch.id}</div>
          <div class="card-preview">${ch.text.slice(0, 30)}${ch.text.length > 30 ? '……' : ''}</div>
          <div class="card-tags">${tagsHtml.join('')}</div>
        </div>
      `;
    }).join('');

    cardsEl.querySelectorAll('.chapter-card').forEach(card => {
      card.addEventListener('click', () => showCardDetail(card.dataset.chapterId));
    });
  }

  // 构建「当前筛选条件」摘要胶囊（用于右栏顶部显示）
  function buildActiveFiltersSummary() {
    const fs = App.filterState;
    const parts = [];

    // 篇目
    fs.books.forEach(pinyin => {
      const b = BOOKS.find(x => x.pinyin === pinyin);
      if (b) parts.push({ dim: 'books', key: pinyin, label: `《${b.cn}》`, colorClass: 'book' });
    });
    // 文体
    fs.styles.forEach(k => {
      const label = ENUM.style_type[k] || k;
      parts.push({ dim: 'styles', key: k, label, colorClass: 'style' });
    });
    // 主题
    fs.themes.forEach(k => {
      const label = ENUM.themes[k] || k;
      parts.push({ dim: 'themes', key: k, label, colorClass: 'theme' });
    });
    // 人物
    fs.persons.forEach(pid => {
      const label = getPersonName(pid);
      parts.push({ dim: 'persons', key: pid, label, colorClass: 'person' });
    });

    const html = parts.map(p => `
      <span class="active-f active-f-${p.colorClass}">
        <span class="af-label">${p.label}</span>
        <span class="af-close" title="移除此条件" data-remove-filter="1" data-dim="${p.dim}" data-key="${p.key}">×</span>
      </span>
    `).join('');

    return { activeHtml: html, activeCount: parts.length };
  }

  // 在筛选条件变化时，仅更新右栏顶部的 active filter 摘要，不重新渲染整个结果区
  function updateResultActiveFilters() {
    if (!$('#section-filter') || $('#section-filter').style.display === 'none') return;
    const wrap = document.querySelector('.stats-active-pills');
    if (!wrap) return;
    const { activeHtml, activeCount } = buildActiveFiltersSummary();

    const isEmpty = (
      App.filterState.books.length === 0 &&
      App.filterState.styles.length === 0 &&
      App.filterState.themes.length === 0 &&
      App.filterState.persons.length === 0
    );

    if (isEmpty) {
      wrap.innerHTML = '<span class="stats-active-empty">🧹 全局已清空 · 请先勾选上方胶囊，或点击右上角「🌐 全局全选」</span>';
    } else if (activeCount > 0) {
      wrap.innerHTML = activeHtml;
      wrap.querySelectorAll('[data-remove-filter]').forEach(x => {
        x.addEventListener('click', () => {
          const dim = x.dataset.dim;
          const key = x.dataset.key;
          const arr = App.filterState[dim];
          if (Array.isArray(arr)) {
            const idx = arr.indexOf(key);
            if (idx >= 0) arr.splice(idx, 1);
          }
          syncFilterUI_V2();
          applyFilter_V2();
          updateResultActiveFilters();
        });
      });
    } else {
      wrap.innerHTML = '<span class="stats-active-empty">未设置筛选条件</span>';
    }
  }

  // 兼容：老版本函数名（其他模块可能引用）→ 调 v2 版本
  function applyFilter() { applyFilter_V2(); }
  function syncFilterUI() { syncFilterUI_V2(); }

  // 章节研读窗（极简版 · 对齐漫步页设计语言）
  // 不用任何装饰性标题/边框/色块/图标，完全靠排版层级区分内容：
  //   顶部篇名章名 → 原文（大字深色宋体） → 标签（灰胶囊）→ 译文（中号浅灰无衬线 + 细竖条）→ 名家解读（▸ 极简折叠控件）
  // 底部不设导航，只留 × 关闭 / 点遮罩关闭
  function showCardDetail(chapterId) {
    const overlay = $('#card-detail-overlay');
    const ch = enrichChapter(getChapterById(chapterId));
    if (!overlay || !ch) return;
    App.currentChapterId = chapterId;

    // —— 标签（人物/主题/风格）——
    const speakerIds = ch.persons?.speakers || [];
    const speakerNames = speakerIds.map(getPersonName);
    const tagsHtml = [];
    if (ch.style_cn) tagsHtml.push(`<span class="tag tag-style">${ch.style_cn}</span>`);
    ch.themes_cn.forEach(t => tagsHtml.push(`<span class="tag tag-theme">${t}</span>`));
    speakerNames.forEach(n => tagsHtml.push(`<span class="tag tag-person">${n}</span>`));

    // —— 白话译文（杨伯峻风格）：有数据显示真实译文，没数据显示占位 ——
    const trans = D.translations_yangbojun?.chapters?.[ch.id];
    const transText = trans?.translation?.trim();
    const transHtml = transText ? `
      <div class="study-body-trans">
        <span class="study-translator-tag">【杨伯峻 · 论语译注】</span>
        <div>${transText}</div>
      </div>
    ` : `
      <div class="study-body-trans">
        <span class="study-translator-tag">【杨伯峻 · 论语译注】</span>
        <div class="study-trans-empty">译文录入中，敬请期待。</div>
      </div>
    `;

    // —— 名家解读：占位，等资料准确校对后再接入（保留折叠控件框架）————
    // 当前不渲染朱熹/钱穆内容，统一敬请期待
    const commBtnText = `▸ 名家解读 · 校对中`;
    let commCardsHtml = `<div class="comm-empty-hint">历代名家解读（朱熹《论语集注》、钱穆《论语新解》等）校对中，敬请期待。</div>`;
    // 折叠按钮 + 内容（默认 display:none），给 data-comm-block-id 绑定点击
    const commBlockId = 'comm-' + ch.id;
    const commHtml = `
      <div class="study-commentary">
        <button type="button" class="study-comm-toggle" data-action="toggle-comm" data-target="${commBlockId}">
          <span class="study-comm-arrow">▸</span>
          <span>${commBtnText}</span>
        </button>
        <div class="study-comm-body" id="${commBlockId}">
          ${commCardsHtml}
        </div>
      </div>
    `;

    // —— 组合输出：顺序 = 顶部篇名章名 → 原文 → 标签 → 译文 → 名家解读 ——
    overlay.querySelector('.card-detail-content').innerHTML = `
      <div class="study-window">
        <div class="study-window-head">
          <div class="study-title-group">
            <span class="study-book">《${ch.book_cn}》</span>
            <span class="study-chapter">第${toChineseNum(ch.verse_num)}章</span>
            <span class="study-verseid">${ch.id}</span>
          </div>
        </div>

        <div class="study-body-original">${ch.text}</div>

        ${tagsHtml.length ? `<div class="study-body-tags">${tagsHtml.join('')}</div>` : ''}

        ${transHtml}

        ${commHtml}
      </div>
    `;

    overlay.classList.add('show');
    // 手机版：打开模态时锁 body 滚动，避免双滚动条
    if (window.innerWidth <= 900) document.body.style.overflow = 'hidden';
  }


  function closeCardDetail() {
    $('#card-detail-overlay')?.classList.remove('show');
  }

  // 初始化
  // ==================================================
  function init() {
    loadColors();

    // ========== 🩹 数据修正（只执行一次）==========
    // 1. D.text 里有一条 _meta 条目（487条→486章真实章），过滤掉
    if (D.text && D.text.length && D.text[0] && !D.text[0].id) {
      D.text = D.text.filter(ch => ch && typeof ch.id === 'string' && ch.id);
      console.log(`[LunYu] 已过滤 _meta，D.text 实际章数: ${D.text.length}`);
    }

    // 2. 预计算真实分布统计（用于胶囊 fp-count 和人物出场章数）
    //    文体/主题：全集章数
    //    人物："真实多少章出现过"（去重，不是角色人次累加）
    App._stats = (function computeStats() {
      const styleCounts = {};
      const themeCounts = {};
      const personVerseCounts = {}; // personId -> 多少章里出现过（去重）
      const personRoleCounts  = {}; // personId -> 多少个角色位置出现（人次，仅调试）

      (D.text || []).forEach(ch => {
        const cid = ch.id;
        // 文体
        const st = getChapterStyle(cid);
        if (st) styleCounts[st] = (styleCounts[st] || 0) + 1;
        // 主题（一章可多主题，每个主题各加1章数）
        (getChapterThemes(cid) || []).forEach(t => {
          themeCounts[t] = (themeCounts[t] || 0) + 1;
        });
        // 人物：先收集这一章里所有 unique person ids
        const ps = getChapterPersons(cid) || {};
        const qa = getChapterQA(cid) || {};
        const uniqueInChapter = new Set([
          ...(ps.speakers || []),
          ...(ps.addressees || []),
          ...(ps.mentioned || []),
          qa.questioner,
          qa.answerer
        ].filter(Boolean));
        uniqueInChapter.forEach(pid => {
          personVerseCounts[pid] = (personVerseCounts[pid] || 0) + 1;
        });
        // 人次（保留给调试，UI不用）
        [...(ps.speakers||[]), ...(ps.addressees||[]), ...(ps.mentioned||[]), qa.questioner, qa.answerer].filter(Boolean).forEach(pid => {
          personRoleCounts[pid] = (personRoleCounts[pid] || 0) + 1;
        });
      });

      // 回填 persons.json 的 lunyu_appearances_estimate 为真实章数（覆盖旧的错值）
      (D.persons || []).forEach(p => {
        // 优先按 id 查，其次按 name_cn 查（兼容中文写在 speakers 里的情况）
        const byId   = personVerseCounts[p.id] || 0;
        const byName = personVerseCounts[p.name_cn] || 0;
        const real = byId + byName;  // 如果两种写法都有（不应该），就累加
        p.lunyu_appearances_estimate = real;
      });

      return {
        styleCounts,
        themeCounts,
        personVerseCounts,
        personRoleCounts,
        total: D.text ? D.text.length : 0
      };
    })();
    console.log(`[LunYu] 统计: 孔子真实章数=${D.persons[0]?.lunyu_appearances_estimate}, 总章数=${App._stats.total}`);
    // ========================================================

    // 导航Tab点击
    $$('.nav-tab').forEach(el => {
      el.addEventListener('click', () => {
        const tab = el.dataset.tab;
        // 清除可能的 person/chapter/qa 定向
        if (tab === 'random') App.currentChapterId = null;
        if (tab === 'persons') {/* keep */}
        switchTab(tab);
      });
    });

    // 卡片详情关闭
    $('#card-detail-close')?.addEventListener('click', closeCardDetail);
    $('#card-detail-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'card-detail-overlay') closeCardDetail();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeCardDetail();
    });

    // 研读窗名家解读折叠（极简版）
    document.addEventListener('click', e => {
      const btn = e.target.closest('.study-comm-toggle[data-action="toggle-comm"]');
      if (!btn) return;
      const targetId = btn.dataset.target;
      const body = document.getElementById(targetId);
      const arrow = btn.querySelector('.study-comm-arrow');
      if (!body || !arrow) return;
      const isOpen = body.classList.contains('show');
      if (isOpen) {
        body.classList.remove('show');
        arrow.textContent = '▸';
      } else {
        body.classList.add('show');
        arrow.textContent = '▾';
      }
    });

    // 漫步页大卡片点击 → 弹出研读窗（和筛选/人物页行为一致）
    document.addEventListener('click', e => {
      const display = e.target.closest('#random-chapter-display');
      if (!display) return;
      // 防止点到「上一章/下一章/随机」按钮冒泡过来（这些按钮都有 btn 类）
      if (e.target.closest('.btn, .btn-nav, .btn-primary, .btn-random')) return;
      const cid = window.LUNYU_APP?.currentChapterId;
      if (!cid) return;
      showCardDetail(cid);
    });
    // 漫步页卡片添加「可点击」视觉暗示：title 提示 + cursor: pointer 在 CSS 里


    // 检测数据是否加载
    if (!D || !D.text?.length) {
      const notice = $('#usage-notice');
      if (notice) notice.classList.add('show');
      console.error('[LunYu] 数据未加载！请确认 data-bundle.js 已正确引入。');
    } else {
      // 先异步加载解读层（译文 + 名家解读），失败不阻塞，仅空壳显示
      const loadInterpretations = async () => {
        try {
          const [tr, cm] = await Promise.all([
            fetch('assets/translations_yangbojun.json').then(r => r.ok ? r.json() : null).catch(()=>null),
            fetch('assets/commentaries.json').then(r => r.ok ? r.json() : null).catch(()=>null),
          ]);
          if (tr) D.translations_yangbojun = tr;
          if (cm) D.commentaries = cm;
          D.interpretationsLoaded = true;
          // 如果研读 Modal 此刻是打开的，刷新一次
          if ($('#card-detail-overlay')?.classList.contains('show') && App.currentChapterId) {
            showCardDetail(App.currentChapterId);
          }
        } catch(e) { /* 忽略，仅用骨架 */ }
      };
      loadInterpretations();

      // 处理 hash 路由
      handleHash();
    }

    console.log('[LunYu] MVP 初始化完成');

/* ============================================================
   📱 MOBILE v4 专项补丁
   ① --nav-h 固定 120px（不做 getBCR，零回流）
   ② 选人抽屉：lazy mount（首屏不渲染，第一次点击才画）
   ③ 清空原 person-list-panel DOM（不再有 2 份 34 人节点）
   ④ 人物详情：4 胶囊 Tab 懒挂载切换（提问统计/对话互动/说话合集/被提及）
   ⑤ 筛选页：去掉「(X 胶囊)」计数 + 加已选摘要
   ⑥ 去 v2 touchmove preventDefault 重链（CSS touch-action 已覆盖）
   ============================================================ */
(function mobileV4Patch(){
    // v4.1 FIX: lunyu-mvp-mobile-v*.html 是独立移动端，桌面浏览器预览也生效
  var IS_MOBILE = true;
  if (!IS_MOBILE) return;
  if (!IS_MOBILE) return;

  // -------- 1) --nav-h 固定写入（不再 getBCR / 不再 resize 监听） --------
  // CSS 里已经写了 @media (max-width:900px){--nav-h:120px}，这里再加一次兜底
  document.documentElement.style.setProperty('--nav-h', '120px');
  // 移除 v3 注册的 resize/orientationchange 里会反复触发 writeNavHeight 的副作用（通过直接覆盖变量更安全，我们不 removeEventListener 因为不知道 handler 引用）
  // 做法：把 getBoundingClientRect 这个方法在我们自己的 patch 里不再调用就够了，不侵入 v3 其他代码

  // -------- 2) 清空原 person-list-panel DOM（v4.1: 延后到 2s 再清空） --------
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
  }, true);

  // -------- 3) 选人抽屉：lazy mount（第一次点击才构造 DOM） --------
  var drawerMounted = false;
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
  }

  function openDrawer() {
    if (!drawerMounted) {
      mountPersonDrawer();
      setTimeout(function(){ buildDrawerContent(); }, 0);  // 下一帧再塞内容，避免一次回流
    }
    setTimeout(function(){
      document.getElementById('v3-person-drawer-mask').classList.add('open');
      document.getElementById('v3-person-drawer').classList.add('open');
      document.body.style.overflow = 'hidden';
    }, drawerMounted ? 0 : 20);
  }
  function closeDrawer() {
    var m = document.getElementById('v3-person-drawer-mask');
    var d = document.getElementById('v3-person-drawer');
    if (m) m.classList.remove('open');
    if (d) d.classList.remove('open');
    document.body.style.overflow = '';
  }

  // -------- 4) 抽屉内容：从 window.LUNYU_PERSONS 取（或 DOM 兜底），分组 + 默认每组前 5 --------
  var _buildTries = 0;
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
    _buildTries = 0;

    var grpOrder = ['孔门十哲','其他孔门弟子','鲁国国君','其他国君','鲁国大夫','其他大夫','其他人物','其他'];
    var groupsMap = {};
    grpOrder.forEach(function(g){ groupsMap[g] = []; });
    src.forEach(function(p){
      var g = p.group || p.group_name || '其他';
      if (!groupsMap[g]) groupsMap[g] = [];
      groupsMap[g].push(p);
    });
    var groups = [];
    grpOrder.forEach(function(g){
      if (groupsMap[g] && groupsMap[g].length) groups.push({ name: g, list: groupsMap[g] });
    });

    // 渲染：每个分组单独 append，减少一次性 layout 成本
    body.innerHTML = '';
    var frag = document.createDocumentFragment();
    groups.forEach(function(g, gi){
      var total = g.list.length;
      var box = document.createElement('div');
      box.className = 'pd-group' + (total > 5 ? ' collapsed' : '');
      box.setAttribute('data-group-name', g.name);
      // title
      var t = document.createElement('div');
      t.className = 'pd-group-title';
      t.innerHTML = '<span>' + g.name + '</span><span class="count">' + total + ' 人</span>';
      box.appendChild(t);
      // grid
      var grid = document.createElement('div');
      grid.className = 'pd-grid';
      g.list.forEach(function(p){
        var id = p.id || p.person_id || '';
        var name = p.name_cn || p.name || id;
        var av = (p.avatar || name).toString().charAt(0);
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'pd-cell';
        cell.setAttribute('data-person-id', id);
        cell.setAttribute('data-person-name', name);
        cell.setAttribute('data-person-group', g.name);
        cell.innerHTML = '<div class="av">' + av + '</div><div class="nm">' + name + '</div>';
        grid.appendChild(cell);
      });
      box.appendChild(grid);
      if (total > 5) {
        var more = document.createElement('button');
        more.type = 'button';
        more.className = 'pd-expand-btn';
        more.textContent = '展开全部 ' + total + ' 人 ▾';
        more.onclick = function(ev){
          ev.stopPropagation();
          var open = box.classList.toggle('collapsed') === false;
          more.textContent = (open ? '收起 ▴' : '展开全部 ' + total + ' 人 ▾');
        };
        box.appendChild(more);
      }
      frag.appendChild(box);
    });
    body.appendChild(frag);
  }

  // 统一事件委托（只绑一次 document）
  document.addEventListener('click', function(e){
    if (e.target.closest('#v4-open-drawer') || e.target.closest('#v3-open-drawer')) { openDrawer(); return; }
    if (e.target.closest('#v3-drawer-close') || e.target.id === 'v3-person-drawer-mask') { closeDrawer(); return; }
    // 点 cell → 找原渲染逻辑的 .person-list-item（v4 已经清空 innerHTML，所以我们自己实现点击效果）
    var cell = e.target.closest('.person-drawer .pd-cell');
    if (cell) {
      var id = cell.getAttribute('data-person-id');
      var nm = cell.getAttribute('data-person-name');
      var grp = cell.getAttribute('data-person-group');
      closeDrawer();
      setTimeout(function(){
        // 优先调用原应用内部 renderPerson(id)；不存在就退化为触发 DOM click
        if (typeof window.renderPerson === 'function') {
          try { window.renderPerson(id); } catch(e) {}
        } else {
          // 重新放一个临时 .person-list-item 让原逻辑找到并 click（因为我们清空了原 list）
          var fake = document.createElement('div');
          fake.className = 'person-list-item v4-fake';
          fake.style.display = 'none';
          fake.setAttribute('data-person-id', id);
          fake.innerHTML = '<div class="person-avatar"></div><div class="person-meta"><div class="pm-name">' + nm + '</div></div>';
          var parent = document.querySelector('.person-groups-scroll, .person-list, .person-list-panel');
          if (!parent) parent = document.body;
          parent.appendChild(fake);
          fake.click();
        }
        updateSubNav(nm, id, grp);
        highlightDrawerActive(id);
        scrollPersonDetailIntoView();
      }, 280);
      return;
    }
  }, true);

  // -------- 5) 吸顶条文字 & 抽屉 active 高亮 --------
  function updateSubNav(name, id, group) {
    var avEl = document.getElementById('v3-psn-av');
    var nmEl = document.getElementById('v3-psn-name');
    var grpEl = document.getElementById('v3-psn-grp');
    if (!nmEl) return;
    var n = name || '孔子';
    if (nmEl) nmEl.textContent = n;
    if (avEl) avEl.textContent = (n || '?').charAt(0);
    if (grpEl) {
      var g = group || '';
      if (n.indexOf('孔子') !== -1) g = g ? g + ' · 至圣先师' : '至圣先师 · 《论语》核心';
      grpEl.textContent = g;
    }
  }
  function highlightDrawerActive(id) {
    var cells = document.querySelectorAll('.person-drawer .pd-cell');
    for (var i = 0; i < cells.length; i++) {
      cells[i].classList.toggle('active', cells[i].getAttribute('data-person-id') === id);
    }
  }
  function scrollPersonDetailIntoView() {
    var det = document.querySelector('.person-detail-panel');
    if (!det) return;
    var navH = 120;
    var subH = 52;
    var tabsH = 52;
    var y = det.getBoundingClientRect().top + window.pageYOffset - navH - subH - tabsH - 10;
    window.scrollTo({top: Math.max(0, y), behavior: 'smooth'});
  }

  // -------- 6) 默认选中孔子 --------
  function defaultSelectKongzi() {
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
    setTimeout(function(){
      ensurePersonTabsMounted();
      switchPersonTab('stats');
    }, 2500);
    setTimeout(function(){
      ensurePersonTabsMounted();
      switchPersonTab('stats');
    }, 4500);
  }

  // -------- 7) 人物详情：4 胶囊 Tab 懒挂载切换 --------
  // 4 个 section 映射关系（按原来 DOM 里的顺序推断）：
  //   1. 提问统计   → .person-stat-grid 所在 section
  //   2. 对话互动   → 一般叫 person-dialog / person-interactions
  //   3. 说话合集   → person-speeches
  //   4. 被提及合集 → person-mentioned
  // 如果原 DOM 里没有明确 class，就用出现顺序：第 1/2/3/4 个 .person-section
  var TABS = [
    { key: 'stats',     label: '提问统计',  icon: '📊' },
    { key: 'dialog',    label: '对话互动',  icon: '💬' },
    { key: 'speeches',  label: '说话合集',  icon: '🗣' },
    { key: 'mentioned', label: '被提及',    icon: '👤' }
  ];
  var personTabsMounted = false;
  var __tabsRetryCount = 0;
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
    if (sections.length < 2) { if (__tabsRetryCount < 15) { __tabsRetryCount++; setTimeout(ensurePersonTabsMounted, 250 * __tabsRetryCount); } return; }
    __tabsRetryCount = 0;
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
  }

  // 人物详情每次切换人后，重新确保 Tab 栏存在 + 默认开第一个
  var _origRenderPerson = typeof window.renderPerson === 'function' ? window.renderPerson : null;
  var _personDetailMO = null;
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
  setTimeout(_watchPersonDetail, 3000);

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
  }

  // -------- 8) 筛选页：去掉 (X 胶囊) + 移除 fp-summary 摘要行（v4.1） --------
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
  } catch(e) {}

  // -------- 9) 去掉 v2 touchmove preventDefault：CSS touch-action 已覆盖 --------
  // 这里我们不 removeEventListener（不知道 handler 引用），但可以把「横滑判定阈值」设到非常大：
  // 通过在 document 上更早一层拦截 touchstart/touchmove 并标记以让 v2 的监听器里计算结果为 false：
  // 更彻底的做法：直接注入 style touch-action: pan-y 到 body（我们已经在 CSS 里写了），所以这里什么都不用做，轻量通过

  // -------- 10) 初始化：persons Tab → 默认选孔子 + 子吸顶条 class 切换 --------
  function refreshPersonsUI() {
    var active = document.querySelector('.page-section#section-persons.active') ||
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

  // -------- 12) v4.1 终极兜底：4 Tab 内联挂载（不依赖任何外部函数） --------
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

})();


/* ============================================================
   📱 MOBILE v3 专项补丁（只在 app-mobile-v3.js 有）
   ① 双层真·吸顶：写入 --nav-h CSS 变量
   ② 人物页：内容优先 + 「当前选中 + 切换人物」吸顶条 + 底部选人抽屉
   ③ 人物页默认选中「孔子」（用户明确要求）
   ============================================================ */
(function mobileV3Patch(){
    // v4.1 FIX: lunyu-mvp-mobile-v*.html 是独立移动端，桌面浏览器预览也生效
  var IS_MOBILE = true;
  if (!IS_MOBILE) return;
  if (!IS_MOBILE) return;

  // -------- 1) 写入 --nav-h：测量 .top-nav 的实际高度，resize/字体变化后重算 --------
  function writeNavHeight() {
    var el = document.querySelector('.top-nav');
    if (!el) return;
    var h = Math.max(100, el.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--nav-h', h + 'px');
    // 同时把 person-sub-nav 用 transform 挪到顶栏下方
    var psn = document.querySelector('.person-sub-nav');
    if (psn) psn.style.transform = 'translateY(' + h + 'px)';
  }
  writeNavHeight();
  window.addEventListener('load',  function(){ setTimeout(writeNavHeight, 50); });
  window.addEventListener('resize', function(){ writeNavHeight(); });
  // 字体加载完成后再测一次（宋体会改变行高）
  try {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function(){ setTimeout(writeNavHeight, 30); });
    }
  } catch (e) {}

  // -------- 2) 给 body 加 person-sub-nav 显示开关（切 Tab 时切换） --------
  function refreshPersonsSubnav() {
    var active = document.querySelector('.page-section#section-persons.active') ||
                 (location.hash || '').indexOf('persons') !== -1;
    document.body.classList.toggle('v3-persons-active', !!active);
  }
  refreshPersonsSubnav();
  document.addEventListener('click', function(e){
    if (e.target.closest('.nav-tab')) setTimeout(refreshPersonsSubnav, 150);
  }, true);
  window.addEventListener('hashchange', refreshPersonsSubnav);

  // -------- 3) 在 body 里注入 DOM：person-sub-nav 吸顶条 + person-drawer 抽屉 + mask --------
  function ensureV3PersonDom() {
    if (document.getElementById('v3-person-sub-nav')) return true;
    // 3a. 吸顶条
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
        '<button type="button" class="psn-switch-btn" id="v3-open-drawer">📋 切换人物</button>' +
      '</div>';
    document.body.appendChild(sub);

    // 3b. mask + drawer
    var mask = document.createElement('div');
    mask.id = 'v3-person-drawer-mask';
    mask.className = 'person-drawer-mask';
    document.body.appendChild(mask);

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
    return true;
  }
  ensureV3PersonDom();

  // -------- 4) 抽屉开关函数 --------
  function openDrawer() {
    document.getElementById('v3-person-drawer-mask').classList.add('open');
    document.getElementById('v3-person-drawer').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    document.getElementById('v3-person-drawer-mask').classList.remove('open');
    document.getElementById('v3-person-drawer').classList.remove('open');
    document.body.style.overflow = '';
  }
  document.addEventListener('click', function(e){
    if (e.target.closest('#v3-open-drawer')) openDrawer();
    if (e.target.closest('#v3-drawer-close') ||
        e.target.id === 'v3-person-drawer-mask') closeDrawer();
  }, true);
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') closeDrawer();
  });

  // -------- 5) 从全局 LUNYU_PERSONS / LUNYU_PERSON_MAP 取人物数据，构建抽屉分组 --------
  function buildPersonGroups() {
    var body = document.getElementById('v3-pd-body');
    if (!body) return [];
    // 拿到人物数组（优先 LUNYU_PERSONS；没有就遍历 DOM 里的 .person-list-item）
    var src = (typeof window.LUNYU_PERSONS !== 'undefined') ? window.LUNYU_PERSONS : null;
    if (!src && typeof window.LUNYU_PERSON_MAP !== 'undefined') {
      src = Object.keys(window.LUNYU_PERSON_MAP).map(function(k){ return window.LUNYU_PERSON_MAP[k]; });
    }
    var people = [];
    if (src) {
      src.forEach(function(p){ people.push(p); });
    } else {
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
    }

    // 分组定义（和原 LUNYU_PERSONS 里保持一致：先按 group 字段分）
    var grpOrder = ['孔门十哲','其他孔门弟子','鲁国国君','其他国君','鲁国大夫','其他大夫','其他人物'];
    var groupsMap = {};
    grpOrder.forEach(function(g){ groupsMap[g] = []; });
    groupsMap['其他'] = [];
    people.forEach(function(p){
      var g = p.group || p.group_name || '其他';
      if (!groupsMap[g]) groupsMap[g] = [];
      groupsMap[g].push(p);
    });
    // 去掉空组
    var groups = [];
    grpOrder.forEach(function(g){
      if (groupsMap[g] && groupsMap[g].length) groups.push({ name: g, list: groupsMap[g] });
    });
    if (groupsMap['其他'] && groupsMap['其他'].length) {
      groups.push({ name: '其他', list: groupsMap['其他'] });
    }

    // 渲染
    body.innerHTML = '';
    var groupEls = [];
    groups.forEach(function(g, gi){
      var gbox = document.createElement('div');
      gbox.className = 'pd-group collapsed';
      if (g.list.length <= 5) gbox.classList.remove('collapsed');
      gbox.setAttribute('data-group-name', g.name);
      var total = g.list.length;
      var title = document.createElement('div');
      title.className = 'pd-group-title';
      title.innerHTML = '<span>' + g.name + '</span><span class="count">' + total + ' 人</span>';
      gbox.appendChild(title);
      var grid = document.createElement('div');
      grid.className = 'pd-grid';
      g.list.forEach(function(p){
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'pd-cell';
        cell.setAttribute('data-person-id', p.id || p.person_id || '');
        var av = p.avatar || (p.name_cn || p.name || '?').charAt(0);
        cell.innerHTML =
          '<div class="av">' + av + '</div>' +
          '<div class="nm">' + (p.name_cn || p.name || p.id) + '</div>';
        grid.appendChild(cell);
      });
      gbox.appendChild(grid);
      if (total > 5) {
        var more = document.createElement('button');
        more.type = 'button';
        more.className = 'pd-expand-btn';
        more.textContent = '展开全部 ' + total + ' 人 ▾';
        more.onclick = function(ev){
          ev.stopPropagation();
          var opened = gbox.classList.toggle('collapsed') === false;
          more.textContent = opened ? ('收起 ▴') : ('展开全部 ' + total + ' 人 ▾');
        };
        gbox.appendChild(more);
      }
      body.appendChild(gbox);
      groupEls.push(gbox);
    });
    return groups;
  }
  var groups = buildPersonGroups();

  // -------- 6) 默认选中孔子 --------
  function findPersonIdByName(name) {
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
  }

  function defaultSelectKongzi() {
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
  }

  // -------- 7) 人物详情变更时同步吸顶条文字（从 DOM 里扒当前选中的人） --------
  function syncPersonSubNavFromDetail(preferredId, preferredEl) {
    var avEl = document.getElementById('v3-psn-av');
    var nmEl = document.getElementById('v3-psn-name');
    var grpEl = document.getElementById('v3-psn-grp');
    if (!avEl || !nmEl || !grpEl) return;

    var id = preferredId;
    var el = preferredEl || (id ? document.querySelector('.person-list-item[data-person-id="' + id + '"]') : null);
    if (!el) el = document.querySelector('.person-list-item.active, .person-list-item.selected');
    if (!el) {
      // 兜底：从详情页标题里找当前人物名
      var hd = document.querySelector('.person-detail-panel .person-name');
      if (hd) {
        var txt = hd.textContent.trim();
        var all = document.querySelectorAll('.person-list-item');
        for (var i = 0; i < all.length; i++) {
          var nm = (all[i].querySelector('.pm-name') || {}).textContent || '';
          if (nm.indexOf(txt) !== -1 || txt.indexOf(nm) !== -1) { el = all[i]; break; }
        }
      }
    }
    if (!el) return;
    var name = (el.querySelector('.pm-name') || {}).textContent || '孔子';
    var avTxt = (el.querySelector('.person-avatar') || {}).textContent || name.charAt(0);
    var grp = (el.closest('.person-group') || {}).getAttribute('data-group-name') || '';
    // 如果是孔子，额外加上「至圣先师」头衔
    if (name.indexOf('孔子') !== -1 || name.indexOf('孔丘') !== -1) {
      if (!grp) grp = '至圣先师 · 《论语》核心';
      else grp = grp + ' · 至圣先师';
    }
    avEl.textContent = avTxt.trim().charAt(0);
    nmEl.textContent = name.trim();
    grpEl.textContent = grp || '';

    // 同步抽屉里 active 高亮
    document.querySelectorAll('.person-drawer .pd-cell').forEach(function(c){
      c.classList.toggle('active', c.getAttribute('data-person-id') === el.getAttribute('data-person-id'));
    });
  }

  // -------- 8) 抽屉里点某个 cell → 关抽屉 + 渲染详情 + 滚到详情顶 --------
  document.addEventListener('click', function(e){
    var cell = e.target.closest('.person-drawer .pd-cell');
    if (!cell) return;
    var id = cell.getAttribute('data-person-id');
    closeDrawer();
    setTimeout(function(){
      var it = id ? document.querySelector('.person-list-item[data-person-id="' + id + '"]') : null;
      if (it) {
        it.click();
        syncPersonSubNavFromDetail(id, it);
        // 滚到详情顶部
        var det = document.querySelector('.person-detail-panel');
        if (det) {
          var navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 108;
          var subH = 56;
          var y = det.getBoundingClientRect().top + window.pageYOffset - navH - subH - 10;
          window.scrollTo({top: Math.max(0, y), behavior: 'smooth'});
        }
      }
    }, 260); // 等抽屉收起动画
  }, true);

  // -------- 9) 监听 person-list-item 点击同步吸顶条 --------
  document.addEventListener('click', function(e){
    var it = e.target.closest('.person-list-item');
    if (!it) return;
    setTimeout(function(){ syncPersonSubNavFromDetail(null, it); }, 150);
  }, true);

  // -------- 10) 初始化默认选中孔子（进人物页立即执行；首次加载如果 hash 是 persons 也执行） --------
  function initIfPersonsTab() {
    ensureV3PersonDom();
    var active = document.querySelector('.page-section#section-persons.active') ||
                 (location.hash || '').indexOf('persons') !== -1;
    if (active) {
      defaultSelectKongzi();
    }
  }
  // 500ms 后（保证 DOM 渲染完）
  setTimeout(initIfPersonsTab, 500);
  // 切到 persons Tab 时再执行一次
  document.addEventListener('click', function(e){
    if (e.target.closest('.nav-tab[data-tab="persons"]')) setTimeout(initIfPersonsTab, 320);
  }, true);
  window.addEventListener('hashchange', initIfPersonsTab);

  // -------- 11) resize/orientationchange → 重写 nav-h --------
  window.addEventListener('orientationchange', function(){
    setTimeout(writeNavHeight, 250);
  });

})();


/* ============================================================
   📱 MOBILE v2 专项补丁（只在 app-mobile-v2.js 有）
   修复 5 类问题：横滑整页、长章裁切、切章滚动错位、人物列表折叠、筛选器折叠
   ============================================================ */
(function mobileV2Patch(){
  var IS_MOBILE = window.innerWidth <= 900 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (!IS_MOBILE) return;

  // ---------- 1) 切 Tab → 强制滚到页面顶部 ----------
  function resetScrollToTop() {
    window.scrollTo({top: 0, behavior: 'auto'});
    setTimeout(function(){
      var s = document.querySelector('.page-section.active');
      if (s && s.scrollIntoView) {
        var navH = (document.querySelector('.top-nav') || {}).offsetHeight || 100;
        var y = s.getBoundingClientRect().top + window.pageYOffset - navH - 8;
        window.scrollTo({top: Math.max(0, y), behavior: 'auto'});
      }
    }, 80);
  }
  document.addEventListener('click', function(e){
    if (e.target.closest('.nav-tab')) setTimeout(resetScrollToTop, 30);
  }, true);

  // ---------- 2) 漫步页：切章滚到当前卡片顶部 ----------
  function scrollCurrentChapterCardIntoView() {
    try {
      var tab = document.getElementById('tab-random');
      if (!tab) return;
      var card = tab.querySelector('.chapter-card, .card-chapter, [data-chapter-id]');
      if (!card) return;
      var navH = (document.querySelector('.top-nav') || {}).offsetHeight || 110;
      var y = card.getBoundingClientRect().top + window.pageYOffset - navH - 16;
      window.scrollTo({top: Math.max(0, y), behavior: 'smooth'});
    } catch (e) {}
  }
  document.addEventListener('click', function(e){
    if (e.target.closest('#btn-prev-chapter, #btn-next-chapter, #btn-random-chapter, .walk-controls button')) {
      setTimeout(scrollCurrentChapterCardIntoView, 180);
      setTimeout(scrollCurrentChapterCardIntoView, 450);
    }
  }, true);
  window.addEventListener('hashchange', function(){
    if (location.hash.indexOf('chapter:') !== -1) setTimeout(scrollCurrentChapterCardIntoView, 280);
  });

  // ---------- 3) 禁用整页横向橡皮筋（横滑不带动整个页面抖） ----------
  var _tx = null, _ty = null;
  document.addEventListener('touchstart', function(e){
    if (e.touches.length !== 1) { _tx = null; return; }
    _tx = e.touches[0].clientX;
    _ty = e.touches[0].clientY;
  }, {passive: true});
  document.addEventListener('touchmove', function(e){
    if (_tx == null || e.touches.length !== 1) return;
    var dx = e.touches[0].clientX - _tx;
    var dy = e.touches[0].clientY - _ty;
    if (Math.abs(dx) > 10 && Math.abs(dx) > 2 * Math.abs(dy)) {
      var inModal = e.target.closest && e.target.closest('.card-detail-modal');
      if (!inModal && e.cancelable) e.preventDefault();
    }
  }, {passive: false});

  // ---------- 4) 人物页：每组默认折叠(前5人) + "展开全部 X 人"按钮 + 选人后滚详情 ----------
  function initPersonGroups() {
    var panel = document.querySelector('.person-list-panel');
    if (!panel || panel.classList.contains('mv2-inited')) return;
    panel.classList.add('mv2-inited');
    var groups = panel.querySelectorAll('.person-group');
    groups.forEach(function(g){
      var items = g.querySelectorAll(':scope > .person-list-item');
      if (items.length > 5) {
        g.classList.add('collapsed');
        g.setAttribute('data-total', items.length);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'person-group-expand-btn';
        btn.textContent = '展开全部 ' + items.length + ' 人 ▾';
        btn.onclick = function(ev){
          ev.stopPropagation();
          var open = g.classList.toggle('collapsed') === false;
          btn.textContent = (open ? '收起 ▴' : '展开全部 ' + items.length + ' 人 ▾');
        };
        g.appendChild(btn);
      }
    });
    // 选完人自动滚到详情
    panel.addEventListener('click', function(e){
      if (e.target.closest('.person-list-item')) setTimeout(function(){
        var det = document.querySelector('.person-detail-panel');
        if (det) {
          var navH = (document.querySelector('.top-nav') || {}).offsetHeight || 110;
          var y = det.getBoundingClientRect().top + window.pageYOffset - navH - 12;
          window.scrollTo({top: Math.max(0, y), behavior: 'smooth'});
        }
      }, 200);
    }, true);
    // 详情顶部加"👈 切换人物"浮条
    var detPanel = document.querySelector('.person-detail-panel');
    if (detPanel && !detPanel.querySelector('.person-back-btn')) {
      var back = document.createElement('button');
      back.type = 'button';
      back.className = 'person-back-btn';
      back.textContent = '👈 切换人物';
      back.onclick = function(){
        if (panel) {
          var navH = (document.querySelector('.top-nav') || {}).offsetHeight || 110;
          var y = panel.getBoundingClientRect().top + window.pageYOffset - navH - 12;
          window.scrollTo({top: Math.max(0, y), behavior: 'smooth'});
        }
      };
      detPanel.insertBefore(back, detPanel.firstChild);
    }
  }
  function tryInitPersons() { if (document.getElementById('tab-persons')) initPersonGroups(); }
  setTimeout(tryInitPersons, 500);
  document.addEventListener('click', function(e){
    if (e.target.closest('.nav-tab[data-tab="persons"]')) setTimeout(tryInitPersons, 320);
  }, true);

  // ---------- 5) 筛选页：筛选器默认折叠 ----------
  function initFilterCollapse() {
    var panel = document.querySelector('.filter-panel-single');
    if (!panel || panel.classList.contains('mv2-inited')) return;
    panel.classList.add('collapsed', 'mv2-inited');
    var fg = panel.querySelector('.fp-global');
    if (fg && !fg.querySelector('.fp-toggle-btn')) {
      var caps = panel.querySelectorAll('.f-capsule').length;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fp-toggle-btn';
      btn.textContent = '展开筛选器（' + caps + ' 胶囊）▾';
      btn.onclick = function(){
        var open = panel.classList.toggle('collapsed') === false;
        btn.textContent = open ? '收起筛选器 ▴' : '展开筛选器（' + caps + ' 胶囊）▾';
        if (open) setTimeout(function(){
          var navH = (document.querySelector('.top-nav') || {}).offsetHeight || 110;
          var y = panel.getBoundingClientRect().top + window.pageYOffset - navH - 8;
          window.scrollTo({top: Math.max(0, y), behavior: 'smooth'});
        }, 120);
      };
      fg.appendChild(btn);
    }
  }
  setTimeout(initFilterCollapse, 560);
  document.addEventListener('click', function(e){
    if (e.target.closest('.nav-tab[data-tab="filter"]')) setTimeout(initFilterCollapse, 360);
  }, true);

  // ---------- 6) 首次 hash 带 chapter 就滚到对应卡 ----------
  setTimeout(function(){
    if (location.hash.indexOf('chapter:') !== -1) scrollCurrentChapterCardIntoView();
  }, 700);

})();

  }

  // ==================================================
  // DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ============================================================
   v4.2 GLOBAL FALLBACK (独立作用域，不依赖任何 IIFE 内部函数)
   - 每 200ms 检查人物详情 4 个 section 是否就绪 → 自动挂载 4 Tab
   - v4.2 关键修复：
     1) 轮询间隔 400→200ms；启动时机：DOMContentLoaded + load 双保险
     2) 挂载后给每个 Tab button **单独**绑定 click handler（不用 event delegation，
        防止 pdp 引用变化导致的 handler 失效 → 之前所有 4 次点击都落在 stats 就是这个原因）
     3) body 加 v3-persons-active class（让 CSS 的 body.v3-persons-active .v4-p-tabs fixed 生效）
     4) 挂完后给 pdp.children 排序修正，确保 4 section 紧跟 tabsWrap
   ============================================================ */
(function(){
  var T42 = [
    {key:'stats',     label:'提问统计',  icon:'📊'},
    {key:'dialog',    label:'对话互动',  icon:'💬'},
    {key:'speeches',  label:'说话合集',  icon:'🗣'},
    {key:'mentioned', label:'被提及',    icon:'👤'}
  ];
  var poll42 = 0;
  var timer42 = null;
  // 给 4 个 Tab 按钮逐个绑定 click handler（v4.2 关键修复）
  function bindEachTabClick(tabsWrap, pdp) {
    var buttons = tabsWrap.querySelectorAll('.v4-p-tab');
    buttons.forEach(function(btn){
      // 去掉之前可能的 handler（通过克隆节点替换，最干净）
      var key = btn.getAttribute('data-tab-key');
      var newBtn = btn.cloneNode(true);
      newBtn.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        var idx = -1;
        for (var k=0;k<T42.length;k++) if (T42[k].key===key) idx=k;
        var tbs = pdp.querySelectorAll('.v4-p-tab');
        var scs = pdp.querySelectorAll('.person-section');
        tbs.forEach(function(tt){ tt.classList.toggle('active', tt.getAttribute('data-tab-key')===key); });
        scs.forEach(function(s,j){ s.classList.toggle('active', j===idx); });
        // 点击 Tab 后，轻微滚动让内容区顶对齐 Tab 栏下面
        try {
          var tabsRect = tabsWrap.getBoundingClientRect();
          var contentOffset = tabsRect.bottom + 4;
          if (contentOffset > 220) { // 内容被 fixed tab 盖住时才需要滚
            window.scrollBy(0, 2);
          }
        } catch(e){}
        return false;
      }, false);
      btn.parentNode.replaceChild(newBtn, btn);
    });
  }
  function mountOnce42() {
    poll42++;
    var pdp = document.querySelector('.person-detail-panel');
    if (!pdp) return false;
    var qa = pdp.querySelector(':scope > #stat-strip-qa');
    var dp = pdp.querySelector(':scope > #stat-strip-dp');
    var sp = pdp.querySelector(':scope > #block-spoken');
    var me = pdp.querySelector(':scope > #block-mentioned');
    if (!qa || !dp || !sp || !me) return false;
    // v4.2: 确保人物页激活时 body 有 class（让 CSS fixed 生效）
    var personSection = document.getElementById('section-persons');
    var isPersonsActive = personSection ? personSection.classList.contains('active') : false;
    if (isPersonsActive) document.body.classList.add('v3-persons-active');
    else document.body.classList.remove('v3-persons-active');
    // 已挂载 → 校验 4 Tab handler + 修复 section class（之前的 IIFE 可能拼错了 speeches/mentioned 的 key）
    var existing = pdp.querySelector('.v4-p-tabs');
    if (existing) {
      var tbs = pdp.querySelectorAll('.v4-p-tab');
      var scs = pdp.querySelectorAll('.person-section');
      if (tbs.length && !pdp.querySelector('.v4-p-tab.active')) tbs[0].classList.add('active');
      if (scs.length && !pdp.querySelector('.person-section.active')) scs[0].classList.add('active');
      // v4.2: 修复 section 上 data-tab-key 为空/缺值 的问题
      // （按 DOM 里 section 的出现顺序，对照 T42 的顺序校正 class）
      var secsById = [qa, dp, sp, me];
      for (var ri = 0; ri < secsById.length && ri < T42.length; ri++) {
        var sEl = secsById[ri];
        if (!sEl) continue;
        var expectedKey = T42[ri].key;
        var currentKey = sEl.getAttribute('data-tab-key');
        // 移除所有可能残留的 v4-p-xxx 错误 class
        sEl.className = sEl.className.replace(/v4-p-[a-zA-Z0-9_-]*/g, '').trim();
        // 重新加正确的
        sEl.classList.add('person-section', 'v4-p-section', 'v4-p-' + expectedKey);
        sEl.setAttribute('data-tab-key', expectedKey);
      }
      // 重新找 scs（可能 classList 变了）
      scs = pdp.querySelectorAll('.person-section');
      if (scs.length && !pdp.querySelector('.person-section.active')) scs[0].classList.add('active');
      // v4.2: 如果还没绑定过 click handler（无 data-v42-bound），逐个绑定
      if (!existing.getAttribute('data-v42-bound')) {
        bindEachTabClick(existing, pdp);
        existing.setAttribute('data-v42-bound', '1');
      }
      return true;
    }
    // ==== 挂载 4 Tab ====
    var sections = [qa, dp, sp, me];
    for (var i = 0; i < sections.length && i < T42.length; i++) {
      sections[i].classList.add('person-section', 'v4-p-section', 'v4-p-' + T42[i].key);
      sections[i].setAttribute('data-tab-key', T42[i].key);
    }
    var bio = pdp.querySelector(':scope > .person-bio');
    var tabsWrap = document.createElement('div');
    tabsWrap.className = 'v4-p-tabs';
    T42.forEach(function(t){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'v4-p-tab';
      b.setAttribute('data-tab-key', t.key);
      b.innerHTML = '<span class="ic">' + t.icon + '</span><span class="lb">' + t.label + '</span>';
      tabsWrap.appendChild(b);
    });
    // v4.2: 把 tabsWrap 插在 person-bio 后面（紧挨着 bio，fixed 方案下 DOM 顺序不影响视觉位置）
    if (bio && bio.nextSibling) pdp.insertBefore(tabsWrap, bio.nextSibling);
    else if (qa) pdp.insertBefore(tabsWrap, qa);
    else pdp.insertBefore(tabsWrap, pdp.firstChild);
    // v4.2: 逐个绑定 click handler（单独绑定，最可靠）
    bindEachTabClick(tabsWrap, pdp);
    tabsWrap.setAttribute('data-v42-bound', '1');
    // 激活第一个
    var tbs1 = pdp.querySelectorAll('.v4-p-tab');
    var scs1 = pdp.querySelectorAll('.person-section');
    if (tbs1.length > 0) tbs1[0].classList.add('active');
    if (scs1.length > 0) scs1[0].classList.add('active');
    return true;
  }
  function startPoll42() {
    poll42 = 0;
    if (timer42) { clearInterval(timer42); timer42 = null; }
    timer42 = setInterval(function(){
      var done = mountOnce42();
      if (done) { clearInterval(timer42); timer42 = null; return; }
      poll42++;
      if (poll42 > 80) { clearInterval(timer42); timer42 = null; }
    }, 200);
  }
  // DOMContentLoaded + load 双保险启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPoll42, false);
    window.addEventListener('load', function(){ setTimeout(startPoll42, 200); }, false);
  } else {
    startPoll42();
    window.addEventListener('load', function(){ setTimeout(startPoll42, 200); }, false);
  }
  // 人物 Tab 切换时启动
  document.addEventListener('click', function(e){
    if (e.target.closest('.nav-tab[data-tab="persons"]')) {
      document.body.classList.add('v3-persons-active');
      startPoll42();
      // 离开时也要确保 class 正确
    } else if (e.target.closest('.nav-tab')) {
      document.body.classList.remove('v3-persons-active');
    }
  }, true);
  // 切 Tab 后也校正 body 上的 v3-persons-active class
  var _origSwitchTab = null;
  function _fixBodyClassByTab() {
    var personSection = document.getElementById('section-persons');
    if (personSection && personSection.classList.contains('active')) {
      document.body.classList.add('v3-persons-active');
    } else {
      document.body.classList.remove('v3-persons-active');
    }
  }
  document.addEventListener('click', function(e){
    if (e.target.closest('.nav-tab')) setTimeout(_fixBodyClassByTab, 150);
  }, true);
  setInterval(_fixBodyClassByTab, 1000); // 兜底每秒校正
  // 切换人物后重置轮询
  document.addEventListener('click', function(e){
    var it = e.target.closest('.person-list-item');
    var pc = e.target.closest('.person-drawer .pd-cell');
    if (it || pc) setTimeout(startPoll42, 300);
  }, true);
})();
