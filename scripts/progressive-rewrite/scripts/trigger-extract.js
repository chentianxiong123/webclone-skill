// trigger-extract.js — 组件化单元·步骤1：触发组件并提取完整结构 + 组件指纹
// 用法: node trigger-extract.js <url> <组件类名> <输出目录>
//   e.g. node trigger-extract.js "http://localhost:9999/mtpe-individual/transText#/" IcHmn0gj lang-panel
// 输出:
//   <输出目录>/original.html      — 组件完整 outerHTML（精确 div 边界）
//   <输出目录>/fingerprint.json   — 组件指纹（节点/深度/类名/标签分布等精确数字）
// 触发策略: 先尝试 hover（用户环境），headless 失败自动回退 click
const { chromium } = require('/tmp/webclone-skill/node_modules/playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const url = process.argv[2];
  const cls = process.argv[3];
  const outDir = process.argv[4];
  if (!url || !cls || !outDir) {
    console.log('用法: node trigger-extract.js <url> <组件类名> <输出目录>');
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });

  const b = await chromium.launch({ headless: true, executablePath: '/opt/google/chrome/chrome' });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(5000); // 等 React 渲染

  // 0. 面板可能已存在（先查）
  let found = await p.evaluate((c) => !!document.querySelector('.' + c), cls);
  if (!found) {
    // 1. hover 触发（让用户环境正常、headless 可能不响应）
    const trigger = await p.evaluate((c) => {
      const el = document.querySelector('.' + c);
      if (el) return null; // 已存在就不需要触发
      // 找页面上可能触发该面板的控件：文本 "自动检测"/"中文(简体)" 或 .pQHR0aqn
      const cands = [
        ...document.querySelectorAll('.pQHR0aqn span, .pQHR0aqn, .pLdMpdki, span, div')
      ];
      const target = cands.find(el => {
        const t = (el.innerText || '').trim();
        return (t === '自动检测' || t === '中文(简体)');
      });
      if (!target) return null;
      const r = target.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, cls);
    if (trigger) {
      await p.mouse.move(trigger.x, trigger.y);
      await p.waitForTimeout(2500);
      console.log('已尝试 hover 触发');
    }
    found = await p.evaluate((c) => !!document.querySelector('.' + c), cls);

    // 2. hover 失败 → click 回退
    if (!found && trigger) {
      await p.mouse.click(trigger.x, trigger.y);
      await p.waitForTimeout(2000);
      console.log('hover 未触发，已回退 click');
      found = await p.evaluate((c) => !!document.querySelector('.' + c), cls);
    }
  }

  if (!found) {
    console.log('❌ 组件 .' + cls + ' 未触发/未找到。请检查触发方式（可能需登录或特定交互）。');
    await b.close();
    process.exit(1);
  }

  // 3. 提取完整 outerHTML（精确 div 边界，括号计数）
  const html = await p.evaluate((c) => {
    const el = document.querySelector('.' + c);
    return { innerHTML: el.outerHTML, rect: el.getBoundingClientRect() };
  }, cls);
  fs.writeFileSync(path.join(outDir, 'original.html'), html.innerHTML);
  console.log(`✅ 完整结构已存: ${outDir}/original.html (${html.innerHTML.length} bytes, ${Math.round(html.rect.w)}×${Math.round(html.rect.h)}px)`);

  // 4. 组件指纹
  const fp = await p.evaluate((c) => {
    const el = document.querySelector('.' + c);
    const tags = {};
    const classes = new Set();
    let maxDepth = 0, elemCount = 0, textCount = 0, attrCount = 0, inlineStyled = 0;
    const walk = (node, depth) => {
      if (depth > maxDepth) maxDepth = depth;
      if (node.nodeType === 1) {
        elemCount++;
        const t = node.tagName.toLowerCase();
        tags[t] = (tags[t] || 0) + 1;
        if (node.className && typeof node.className === 'string') node.className.split(/\s+/).forEach(x => x && classes.add(x));
        attrCount += node.attributes.length;
        if (node.style && node.style.cssText) inlineStyled++;
        Array.from(node.childNodes).forEach(n => walk(n, depth + 1));
      } else if (node.nodeType === 3 && node.textContent.trim()) textCount++;
    };
    walk(el, 0);
    return { elemCount, textCount, attrCount, maxDepth, tagDist: tags, uniqueClasses: classes.size, inlineStyled };
  }, cls);
  fs.writeFileSync(path.join(outDir, 'fingerprint.json'), JSON.stringify({
    cls, capturedAt: new Date().toISOString(), ...fp
  }, null, 2));
  console.log('✅ 组件指纹:');
  console.log(JSON.stringify(fp, null, 2));

  await b.close();
}

main().catch(e => { console.error('错误:', e.message); process.exit(1); });