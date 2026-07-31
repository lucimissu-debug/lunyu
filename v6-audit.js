/* v6 翻译核对：导出 data-bundle.js 的 lunyuText 数组 + 全量检测翻译缺失/错位 */
const fs = require('fs');
const path = require('path');

const BASE = '/Users/zhongjiangzhang/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a6b760c59af87f56c47b958';

// 1. 伪造一个空 window（模拟浏览器全局）
global.window = {};
global.document = { currentScript: null };

// 2. 载入 data-bundle.js
const bundleSrc = fs.readFileSync(path.join(BASE, 'assets', 'data-bundle.js'), 'utf-8');
eval(bundleSrc);

const D = global.window.LUNYU_DATA;
const text = D.text;

// 3. 载入翻译和注释
const trans = JSON.parse(fs.readFileSync(path.join(BASE, 'assets', 'translations_yangbojun.json'), 'utf-8'));
const comms = JSON.parse(fs.readFileSync(path.join(BASE, 'assets', 'commentaries.json'), 'utf-8'));

console.log('[INFO] lunyuText:', text.length, ' | translations:', Object.keys(trans.chapters||{}).length, '(filled:', trans._meta?.filled_count, ') | commentaries:', Object.keys(comms.chapters||{}).length, '(filled:', comms._meta?.filled_count, ')');

// ========= 核对 1：缺失/占位翻译 =========
const EMPTY_MARKERS = ['译文录入中','翻译资料，敬请期待','敬请期待','暂无翻译','待补充','（待补）','校对中','待定'];
function isBad(t) {
  if (!t) return true;
  const s = (t||'').trim();
  if (!s || s.length < 5) return true;
  for (const m of EMPTY_MARKERS) if (s.includes(m)) return true;
  return false;
}

const missing = [];
for (const c of text) {
  const t = trans.chapters?.[c.id]?.translation;
  if (isBad(t)) missing.push({ id: c.id, title: c.title, original: c.original.substring(0, 60), translation: (t||'').substring(0, 80) });
}
console.log('\n=== 核对 1：缺失/占位翻译 ===');
console.log('缺失/占位:', missing.length, '/', text.length);
if (missing.length) for (const m of missing) console.log(`  - ${m.id} 「${m.title}」 translation=「${(m.translation||'').trim()}」`);
else console.log('  ✓ 498 章 translation 字段都有实际内容。');

// ========= 核对 2：乡党篇 15/16/17 对应性 =========
console.log('\n=== 核对 2：乡党篇（xiangdang）15/16/17 ===');
for (const n of ['15','16','17']) {
  const id = `xiangdang-${n}`;
  const ch = text.find(c => c.id === id);
  const tr = trans.chapters?.[id]?.translation;
  if (ch) {
    console.log(`\n【xiangdang-${n}】${ch.title}`);
    console.log('  原文:', ch.original);
    console.log('  译文:', (tr||'').trim());
  } else {
    console.log(`【xiangdang-${n}】 不存在！`);
  }
}

// ========= 核对 3：翻译错位检测 =========
const CLASSICAL_MARKERS = ['子曰','子谓','对曰','问曰','孔子曰','子贡曰','子路曰','曾子曰','有子曰','子夏曰','子张曰','冉有曰','仲弓问','樊迟问','宪问','诗云','书云'];
function similarity(a, b) {
  const sa = new Set([...a]); const sb = new Set([...b]);
  let inter = 0; for (const c of sa) if (sb.has(c)) inter++;
  return inter / Math.max(1, Math.max(a.length, b.length));
}
const mis = [];
for (const c of text) {
  const tr = (trans.chapters?.[c.id]?.translation || '').trim();
  if (!tr) continue;
  for (const mk of CLASSICAL_MARKERS) {
    if (tr.includes(mk)) { mis.push({kind:'A', id:c.id, marker:mk, title:c.title, te:tr.substring(0,80)}); break; }
  }
  const sim = similarity(c.original, tr);
  if (sim > 0.72 && c.original.length > 12) {
    mis.push({kind:'B', id:c.id, sim:sim.toFixed(2), title:c.title, te:tr.substring(0,80), oe:c.original.substring(0,80)});
  }
}
console.log('\n=== 核对 3：翻译错位检测（文言词/高相似度） ===');
console.log('可疑:', mis.length);
if (mis.length) for (const m of mis) {
  if (m.kind==='A') console.log(`  [A] ${m.id} 「${m.title}」 译文中有「${m.marker}」 → ${m.te}`);
  else console.log(`  [B] ${m.id} 「${m.title}」 sim=${m.sim} | 原:${m.oe} | 译:${m.te}`);
} else console.log('  ✓ 未检测到明显错位。');

// ========= 核对 4：commentaries 缺失 =========
console.log('\n=== 核对 4：commentaries 缺失 ===');
const cmiss = [];
for (const c of text) {
  const cm = comms.chapters?.[c.id];
  const anyReal = cm?.commentaries?.some(x => x.content && x.content.trim() && x.status !== 'todo');
  if (!anyReal) cmiss.push(c.id + ' ' + c.title);
}
console.log('名家解读缺失:', cmiss.length);
for (const m of cmiss) console.log('  -', m);

// ========= 写报告 =========
const reportPath = path.join(BASE, 'assets', 'v6_data_audit_report.json');
const report = {
  summary: { lunyuText: text.length, translations: Object.keys(trans.chapters||{}).length, trans_filled: trans._meta?.filled_count, commentaries: Object.keys(comms.chapters||{}).length, comm_filled: comms._meta?.filled_count, missing_trans: missing.length, misaligned: mis.length, comm_missing: cmiss.length },
  missing_translations: missing, misaligned: mis, comm_missing: cmiss,
  xiangdang_15_17: ['15','16','17'].map(n => {
    const id = `xiangdang-${n}`, ch = text.find(c=>c.id===id);
    return ch ? {id, title: ch.title, original: ch.original, translation: trans.chapters?.[id]?.translation} : {id, notFound: true};
  })
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log('\n报告:', reportPath);
console.log('DONE');
