// locate.js — 定位组件区块（工作流阶段1）
// 用法: node locate.js <rendered.html> <锚点文本|类名> [--css <index.css路径>]
// 输出: 区块 div 边界位置 + 结构树 + 相关 CSS 规则
const fs = require('fs');

const file = process.argv[2];
const anchor = process.argv[3];
const cssArgIdx = process.argv.indexOf('--css');
const cssPath = cssArgIdx > -1 ? process.argv[cssArgIdx + 1] : null;

const html = fs.readFileSync(file, 'utf8');

// 1. 找锚点（文本或类名）
let anchorIdx = html.indexOf(`class="${anchor}"`);
let anchorType = '类名';
if (anchorIdx < 0) {
  anchorIdx = html.indexOf(anchor);
  anchorType = '文本';
}
if (anchorIdx < 0) { console.log('未找到锚点:', anchor); process.exit(1); }
console.log(`锚点 "${anchor}" (${anchorType}) 位置: ${anchorIdx}`);

// 2. 定位所在 div 边界
const divStart = html.lastIndexOf('<div', anchorIdx);
let i = divStart, depth = 0, end = -1;
while (i < html.length) {
  if (html.startsWith('<div', i)) {
    const j = html.indexOf('>', i);
    if (html[j - 1] !== '/') depth++;
    i = j + 1; continue;
  }
  if (html.startsWith('</div>', i)) {
    depth--;
    if (depth === 0) { end = i + 6; break; }
    i += 6; continue;
  }
  i++;
}
console.log(`区块 div: [${divStart}..${end}] ${end - divStart} bytes`);

// 3. 结构树（该区块前 1500 字符）
const block = html.slice(divStart, end);
console.log('\n=== 区块结构（前 1200 字符）===');
console.log(block.slice(0, 1200));

// 4. 相关 CSS 规则
if (cssPath) {
  const css = fs.readFileSync(cssPath, 'utf8');
  const classes = new Set();
  // 提取区块里的类名
  [...block.matchAll(/class="([^"]+)"/g)].forEach(m => m[1].split(/\s+/).forEach(c => classes.add(c)));
  console.log(`\n=== 区块内类名 (${classes.size})，相关 CSS 规则 ===`);
  classes.forEach(c => {
    const re = new RegExp(`[^{}]*\\.${c}[^{}]*\\{[^}]*\\}`, 'g');
    const rules = css.match(re);
    if (rules) rules.slice(0, 3).forEach(r => console.log(r.slice(0, 220)));
  });
}
