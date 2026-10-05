// dom-map.js — 原版 DOM → 语义化 fragment 工具
// 用法: node dom-map.js <输入.html> <映射json> <输出.html>
// 原理: 原样保留标签/层级/文本/SVG/属性，仅按映射表批量替换类名（含多类名 class="a b"）
// 零手工计算：结构完全来自原版 outerHTML，AI 不发明任何结构
const fs = require('fs');

const input = process.argv[2];
const mapJson = process.argv[3];
const output = process.argv[4];

let html = fs.readFileSync(input, 'utf8');
const map = JSON.parse(fs.readFileSync(mapJson, 'utf8'));

// 按出现次数排序：先替换长的/多的类名（避免部分前缀碰撞）
const keys = Object.keys(map).sort((a, b) => b.length - a.length);

let replaced = {};
keys.forEach(oldCls => {
  const newCls = map[oldCls];
  // 只在 class="..." 属性的类名单词内精确替换
  html = html.replace(new RegExp(`(class="[^"]*\\b)${escapeRegex(oldCls)}(\\b[^"]*")`, 'g'), (m, pre, post) => {
    replaced[oldCls] = (replaced[oldCls] || 0) + 1;
    return pre + newCls + post;
  });
});

fs.writeFileSync(output, html);
console.log(`完成: ${input} → ${output} (${html.length} bytes)`);
console.log('替换统计:', JSON.stringify(replaced, null, 2));

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }