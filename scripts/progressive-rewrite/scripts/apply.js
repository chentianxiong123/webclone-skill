// apply.js — 真删 + 替换一个组件（工作流阶段3）
// 用法: node apply.js <index.html> --class <锚点类名> --block <组件目录> [--extend <类名2>]
// 组件目录: fragment.html（主片段）+ style.css（可选）+ script.js（可选，自动包 DOMContentLoaded）
// 安全: 每步自动备份 work/index.html.bak
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const idx = args.findIndex(a => !a.startsWith('--'));
const indexPath = args[idx];
const getArg = (name) => {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : null;
};
const anchorCls = getArg('--class');
const blockDir = getArg('--block');
const extendCls = getArg('--extend');

if (!indexPath || !anchorCls || !blockDir) {
  console.log('用法: node apply.js <index.html> --class <锚点类名> --block <组件目录> [--extend <类名2>]');
  process.exit(1);
}

// 备份
fs.copyFileSync(indexPath, indexPath + '.bak');
console.log(`已备份: ${indexPath}.bak`);

let html = fs.readFileSync(indexPath, 'utf8');

// 1. 定位第一个锚点 div 起点
const findDivStart = (s, cls, from) => {
  // 支持多类名锚点：class="DWOp2n2u scroll-y" 也能匹配
  const re = new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"`, 'g');
  re.lastIndex = from;
  const m = re.exec(s);
  if (!m) return -1;
  return s.lastIndexOf('<div', m.index);
};
// 2. div 闭合
const divEnd = (s, start) => {
  let i = start, depth = 0;
  while (i < s.length) {
    if (s.startsWith('<div', i)) {
      const j = s.indexOf('>', i);
      if (s[j - 1] !== '/') depth++;
      i = j + 1; continue;
    }
    if (s.startsWith('</div>', i)) {
      depth--;
      if (depth === 0) return i + 6;
      i += 6; continue;
    }
    i++;
  }
  return -1;
};

let start1 = findDivStart(html, anchorCls, 0);
if (start1 < 0) { console.log('未找到锚点类名:', anchorCls); process.exit(1); }
let end1 = divEnd(html, start1);
let removed = html.slice(start1, end1);

if (extendCls) {
  // 延伸到第二个同类 div 的闭合
  const reX = new RegExp(`class="[^"]*\\b${extendCls}\\b[^"]*"`, 'g');
  const mX = reX.exec(html);
  const mY = reX.exec(html);
  const first = mX ? mX.index : -1;
  const rel = mY ? mY.index : -1;
  if (rel < 0) { console.log('未找到第二个 extend 类:', extendCls); process.exit(1); }
  const div2 = html.lastIndexOf('<div', rel);
  end1 = divEnd(html, div2);
  removed = html.slice(start1, end1);
}
console.log(`删除区块: ${removed.length} bytes (${removed.slice(0, 60)}...)`);

// 3. 读组件目录
const frag = fs.readFileSync(path.join(blockDir, 'fragment.html'), 'utf8');
let css = '', js = '';
try { css = fs.readFileSync(path.join(blockDir, 'style.css'), 'utf8'); } catch {}
try { js = fs.readFileSync(path.join(blockDir, 'script.js'), 'utf8'); } catch {}

// 4. 替换
html = html.slice(0, start1) + frag + html.slice(end1);

// 5. 注入 css/js 到 head
const headIdx = html.indexOf('</head>');
let inject = '';
if (css) inject += '<style>\n' + css + '\n</style>\n';
if (js) {
  if (!js.includes('DOMContentLoaded')) js = `document.addEventListener("DOMContentLoaded", function(){\n${js}\n});`;
  inject += '<script>\n' + js + '\n</script>\n';
}
if (inject) html = html.slice(0, headIdx) + inject + html.slice(headIdx);

fs.writeFileSync(indexPath, html);
console.log(`完成: ${indexPath} (${html.length} bytes)`);
console.log(`验证: 原类名 ${anchorCls} 残留 = ${html.includes(`class="${anchorCls}"`)}`);
