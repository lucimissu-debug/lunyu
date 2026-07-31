#!/usr/bin/env node
// v6-fix 离线验证：模拟浏览器环境加载 data-bundle.js，
// 验证 498 章翻译是否真的同步挂载（完全不使用 fetch）
const fs = require('fs');
const path = require('path');
const BASE = '/Users/zhongjiangzhang/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a6b760c59af87f56c47b958';
process.chdir(BASE);

// 模拟 window / console
global.window = {};
global.console = console;

// 执行 data-bundle.js（同步加载）
const bundleCode = fs.readFileSync('assets/data-bundle.js', 'utf8');
eval(bundleCode);

const D = global.window.LUNYU_DATA;
console.log('========== 离线内联验证 ==========');
console.log('LUNYU_DATA 是否存在：', !!D);
console.log('lunyu 章数：', D.text.length);
console.log('persons 人数：', D.persons.length);
console.log('translations_yangbojun 是否内联：', !!D.translations_yangbojun);
console.log('commentaries 是否内联：', !!D.commentaries);

const T = D.translations_yangbojun || {};
const C = D.commentaries || {};
const tc = T.chapters || {};
const cc = C.chapters || {};
console.log('译文总章数（chapters 下的 key）：', Object.keys(tc).length);
console.log('名家解读总章数：', Object.keys(cc).length);
console.log('译文 filled_count：', T.meta?.filled_count);
console.log('译文 status：', T.meta?.status);

// 2. 10 个随机 key 验证（无 placeholder，且内容不是空字符串）
const SAMPLE = [
  'xueer-01',            // 学而时习之
  'xueer-02',            // 其为人也孝弟
  'xiangdang-15',        // 问人于他邦+康子馈药
  'xiangdang-16',        // 厩焚
  'xiangdang-17',        // 君赐食超长段
  'xianjin-25',          // 子路曾皙冉有公西华侍坐（超长）
  'weizheng-12',         // 君子不器
  'bayi-10',             // 禘自既灌
  'shuer-04',            // 子之燕居
  'zilu-30',             // 侍于君子有三愆
];
let placeholderCount = 0;
let emptyCount = 0;
for (const id of SAMPLE) {
  const entry = tc[id];
  const txt = (entry && (entry.yangbojun || entry.text || entry.baihua || entry['白话文译文'] || '')) + '';
  const isPh = /(敬请期待|资料整理|translation unavailable|待补充)/i.test(txt);
  const isEmpty = txt.trim().length < 4;
  if (isPh) placeholderCount++;
  if (isEmpty) emptyCount++;
  console.log(`  [${isPh?'❌':'✅'} ${isEmpty?'空':'ok'}] ${id} 译文长度=${txt.length} 开头=${JSON.stringify(txt.slice(0,24))}`);
}
console.log('----');
console.log(`10 章 placeholder 数：${placeholderCount} / 空翻译数：${emptyCount}`);

// 3. 全量扫：498 章全部不是 placeholder
const LUNYU_IDS = D.text.map(c => c.id);
console.log('lunyu 章节 id 数：', LUNYU_IDS.length);
let globalPh = 0, globalEmpty = 0, globalMissing = 0;
for (const id of LUNYU_IDS) {
  const entry = tc[id];
  if (!entry) { globalMissing++; continue; }
  const txt = (entry.yangbojun || entry.text || entry.baihua || entry['白话文译文'] || '') + '';
  if (/(敬请期待|资料整理|translation unavailable|待补充)/i.test(txt)) globalPh++;
  if (txt.trim().length < 4) globalEmpty++;
}
console.log('全量 498 章：missing=' + globalMissing + ' placeholder=' + globalPh + ' 空翻译=' + globalEmpty);
console.log((globalMissing === 0 && globalPh === 0 && globalEmpty === 0) ? '✅✅✅ 100% 离线可用，0 placeholder，0 empty' : '❌ 还有问题');
