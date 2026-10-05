#!/usr/bin/env node
// css-map.js — 原版 CSS → 语义化 CSS 通用映射工具（与 dom-map.js 配套）
// 用法: node css-map.js --css <原版css路径> --map <映射json> --out <输出css> [--assets <前缀A>=<前缀B>]
// 原理: 扫描原版 css 全部规则，保留"选择器含任一映射原类"的规则，
//       类 token 精确替换（最长优先、边界匹配），伪类/组合器/属性原样保留。
//       零手写值：所有 CSS 值都来自原版文件。
// 映射 JSON 与 dom-map.js 共用同一份组件配置: { "原版类": "语义化类", ... }
const fs = require('fs');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}
function flag(name) {
  return process.argv.indexOf(name) >= 0;
}

const cssPath = arg('--css');
const mapPath = arg('--map');
const outPath = arg('--out');
if (!cssPath || !mapPath || !outPath) {
  console.error('用法: node css-map.js --css <原版css路径> --map <映射json> --out <输出css> [--assets 旧前缀=新前缀]');
  process.exit(1);
}

const css = fs.readFileSync(cssPath, 'utf8');
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

// 资源前缀重写（如 CDN → 本地）
let assets = [];
if (flag('--assets')) {
  assets = arg('--assets').split(',').map(p => p.split('='));
}

const origKeys = Object.keys(map).sort((a, b) => b.length - a.length);

function translateSelector(sel) {
  let out = sel;
  for (const o of origKeys) {
    out = out.replace(new RegExp(`(?<![\\w-])${o}(?![\\w-])`, 'g'), map[o]);
  }
  // 翻译后可能碰撞出重复选择器/重复类（如 .GXuSnnox 和 .rislZZt6 同映射），去重
  const parts = out.split(',').map(p => p.trim()).filter(Boolean);
  const uniq = parts.filter((p, i) => {
    // 选择器整体去重：类 token 集合相同的视为重复
    return !parts.slice(0, i).some(q => q.split('.').filter(Boolean).join() === p.split('.').filter(Boolean).join());
  });
  return uniq.join(',');
}

function rewriteUrl(body) {
  let b = body;
  for (const [from, to] of assets) {
    b = b.split(from).join(to);
  }
  return b.replace(/\s+/g, ' ');
}

// 扫描全部规则（selector { body }）
const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
let m, seen = new Set(), lines = [];
while ((m = ruleRe.exec(css))) {
  const sel = m[1].trim();
  if (!sel || sel.startsWith('@')) continue;
  // 只处理含映射原类的规则
  const classesInSel = new Set(sel.match(/\.[A-Za-z_][\w-]*/g) || []);
  const hits = classesInSel.values().map(c => c.slice(1));
  if (![...hits].some(h => map[h])) continue;
  const newSel = translateSelector(sel);
  if (seen.has(newSel)) continue;
  seen.add(newSel);
  lines.push(`${newSel} { ${rewriteUrl(m[2].trim())} }`);
}

const header = [
  `/* ${outPath.split('/').pop()} — 由 ${cssPath.split('/').pop()} 规则映射生成（css-map.js） */`,
  `/* 映射: ${mapPath} · 共 ${lines.length} 条规则 · 零手写值 */`,
].join('\n');

fs.writeFileSync(outPath, header + '\n' + lines.join('\n') + '\n');
console.log(`完成: ${cssPath} → ${outPath} (${lines.length} 条规则)`);
