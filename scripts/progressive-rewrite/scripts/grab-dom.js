// grab-dom.js — 抓取 rendered DOM（工作流阶段0）
// 用法: node grab-dom.js <url> [选择器] [输出文件]
//   例: node grab-dom.js http://localhost:9999/ ".JjBtRHIL" blocks/actionbar/original.html
//       不带选择器 = 抓整页 outerHTML
// 说明: 等 React 渲染完成再抓；浏览器路径可用 env CHROME 覆盖
const { chromium } = require('/tmp/webclone-skill/node_modules/playwright');
const fs = require('fs');

(async () => {
  const url = process.argv[2] || 'http://localhost:9999/mtpe-individual/transText#/';
  const selector = process.argv[3] || null;
  const out = process.argv[4] || (selector ? 'component.html' : 'rendered.html');
  const chromePath = process.env.CHROME || '/usr/bin/google-chrome';

  const b = await chromium.launch({ headless: true, executablePath: chromePath });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(6500); // 等 React 渲染完成

  const html = selector
    ? await p.evaluate((s) => {
        const el = document.querySelector(s);
        return el ? el.outerHTML : `<!-- 未找到 ${s} -->`;
      }, selector)
    : await p.evaluate(() => document.documentElement.outerHTML);

  fs.writeFileSync(out, html);
  console.log(`已保存: ${out} (${html.length} bytes)${selector ? ' [选择器: ' + selector + ']' : ' [整页]'}`);
  await b.close();
})();
