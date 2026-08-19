#!/usr/bin/env node
/**
 * generate-source.mjs — 从采集数据生成干净 HTML/CSS/JS 源码
 *
 * 工作流程:
 *   1. 读 DOM 结构，识别页面区块（横幅/导航/编辑器/侧边栏）
 *   2. 读 CSS 规则，提取有效样式
 *   3. 读交互元素，生成 JS 事件绑定
 *   4. 输出可读的 index.html
 *
 * 用法: node generate-source.mjs /tmp/baidu-data/ /tmp/baidu-generated/
 */

import fs from 'node:fs';

const dataDir = process.argv[2] || '/tmp/baidu-data';
const outDir = process.argv[3] || '/tmp/baidu-generated';
fs.mkdirSync(outDir, { recursive: true });

// ── 读数据 ──
const dom = JSON.parse(fs.readFileSync(`${dataDir}/01-dom.json`, 'utf8'));
const css = JSON.parse(fs.readFileSync(`${dataDir}/02-css.json`, 'utf8'));
const interactive = JSON.parse(fs.readFileSync(`${dataDir}/03-interactive.json`, 'utf8'));

// ── Step 1: 识别页面区块 ──
// 从 DOM 树中找出有意义的区块
function findBlock(el, name) {
  if (!el) return null;
  const cls = el.cls || '';
  const rect = el.rect;
  if (!rect) return null;

  // 横幅: 顶部，高度 40-80px，宽度 = 1316
  if (name === 'banner' && rect.h >= 30 && rect.h <= 80 && rect.w >= 1300 && rect.y < 100) {
    return { name, rect, tag: el.tag, cls };
  }
  // 导航: 紧跟横幅下方
  if (name === 'navbar' && rect.h >= 40 && rect.h <= 80 && rect.w >= 1300 && rect.y >= 30 && rect.y < 120) {
    return { name, rect, tag: el.tag, cls };
  }
  // 标签页: 导航下方
  if (name === 'tabs' && rect.h >= 30 && rect.h <= 60 && rect.w >= 300 && rect.y >= 80 && rect.y < 150) {
    return { name, rect, tag: el.tag, cls };
  }
  // 编辑器: 大区域
  if (name === 'editor' && rect.h >= 400 && rect.w >= 1000) {
    return { name, rect, tag: el.tag, cls };
  }

  // 递归查找
  for (const child of (el.children || [])) {
    const found = findBlock(child, name);
    if (found) return found;
  }
  return null;
}

const blocks = {
  banner: findBlock(dom, 'banner'),
  navbar: findBlock(dom, 'navbar'),
  tabs: findBlock(dom, 'tabs'),
  editor: findBlock(dom, 'editor'),
};

console.log('Detected blocks:', Object.entries(blocks).map(([k,v]) => v ? `${k} [${v.rect.w}x${v.rect.h}]` : `${k}: NOT FOUND`).join(', '));

// ── Step 2: 生成 HTML ──
const pageWidth = blocks.banner ? blocks.banner.rect.w : 1316;

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>百度翻译 - 在线翻译工具</title>
<style>
/* ============ 基础重置 ============ */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #f4f6ff; }

/* ============ 横幅 ============ */
.banner { width: ${pageWidth}px; height: ${blocks.banner ? blocks.banner.rect.h : 46}px; margin: 0 auto; background: #fe7f72; overflow: hidden; }
.banner img { width: 100%; height: 100%; object-fit: cover; }

/* ============ 导航栏 ============ */
.navbar { width: ${pageWidth}px; height: ${blocks.navbar ? blocks.navbar.rect.h : 60}px; margin: 0 auto; background: #fff; display: flex; align-items: center; padding: 0 20px; gap: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.navbar .logo { font-size: 18px; font-weight: bold; color: #2b7cff; margin-right: 12px; }
.nav-item { padding: 8px 14px; cursor: pointer; font-size: 13px; color: #333; border-radius: 4px; }
.nav-item:hover { background: #f0f5ff; }
.nav-right { margin-left: auto; display: flex; gap: 12px; }
.nav-btn { padding: 6px 14px; border-radius: 4px; font-size: 13px; cursor: pointer; border: 1px solid #e5e5e5; background: #fff; }
.nav-btn.primary { background: #2b7cff; color: #fff; border-color: #2b7cff; }

/* ============ 标签页 ============ */
.tabs { display: flex; border-bottom: 1px solid #e5e5e5; margin-bottom: 12px; }
.tab { padding: 10px 18px; font-size: 14px; color: #666; cursor: pointer; border-bottom: 2px solid transparent; }
.tab.active { color: #2b7cff; border-bottom-color: #2b7cff; font-weight: 500; }
.tab:hover { color: #2b7cff; }

/* ============ 编辑器 ============ */
.page-content { width: ${pageWidth}px; margin: 0 auto; padding: 20px; }
.editor { display: flex; flex-direction: column; min-height: ${blocks.editor ? blocks.editor.rect.h - 80 : 464}px; background: #fff; border-radius: 8px; border: 1px solid #e5e5e5; overflow: hidden; }
.lang-bar { display: flex; align-items: center; padding: 10px 16px; border-bottom: 1px solid #f0f0f0; gap: 8px; }
.lang-select { display: flex; align-items: center; gap: 4px; padding: 4px 10px; cursor: pointer; font-size: 13px; border-radius: 4px; }
.lang-select:hover { background: #f5f5f5; }
.swap-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: 1px solid #e5e5e5; border-radius: 50%; cursor: pointer; background: #fff; margin: 0 8px; }
.lang-spacer { flex: 1; }
.translate-area { display: flex; flex: 1; min-height: 380px; }
.translate-panel { flex: 1; padding: 16px 20px; display: flex; flex-direction: column; position: relative; }
.translate-panel.left { border-right: 1px solid #f0f0f0; }
.translate-textarea { width: 100%; height: 100%; border: none; outline: none; font-size: 16px; line-height: 1.6; resize: none; color: #333; }
.translate-result { width: 100%; height: 100%; font-size: 16px; line-height: 1.6; color: #333; overflow-y: auto; white-space: pre-wrap; }
.panel-toolbar { display: flex; align-items: center; padding: 8px 0; border-top: 1px solid #f0f0f0; margin-top: 8px; gap: 12px; }
.tool-btn { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border: none; background: none; cursor: pointer; font-size: 12px; color: #999; border-radius: 3px; }
.tool-btn:hover { color: #2b7cff; background: #f5f8ff; }
.translate-btn { position: absolute; right: 20px; bottom: 60px; padding: 8px 24px; background: #2b7cff; color: #fff; border: none; border-radius: 4px; font-size: 14px; cursor: pointer; font-weight: 500; }
.translate-btn:hover { background: #1d6ae8; }

/* ============ 侧边栏 ============ */
.sidebar { width: 220px; margin-left: 12px; display: flex; flex-direction: column; gap: 12px; }
.sidebar-card { background: #fff; border-radius: 8px; border: 1px solid #e5e5e5; padding: 14px; }
.sidebar-card h4 { font-size: 12px; color: #999; margin-bottom: 8px; }
.history-list { list-style: none; }
.history-list li { padding: 8px 0; border-bottom: 1px solid #f5f5f5; font-size: 12px; color: #666; cursor: pointer; }
.history-list li:hover { color: #2b7cff; }

/* ============ 交互状态 (从数据采集生成) ============ */
${interactive.filter(e => e.hasHoverDiff).map(e => {
  return `.${e.cls.split(' ').join('.')}:hover { background: ${e.hover.bg}; color: ${e.hover.color}; }`;
}).join('\n')}

.toast { position: fixed; top: 60px; left: 50%; transform: translateX(-50%); padding: 10px 24px; background: rgba(0,0,0,0.8); color: #fff; border-radius: 6px; font-size: 13px; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
.toast.show { opacity: 1; }

.loading-dots span { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #2b7cff; animation: dot 1.2s infinite; margin: 0 2px; }
.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes dot { 0%,80%,100% { opacity: 0.3; } 40% { opacity: 1; } }
</style>
</head>
<body>

<div class="banner"><img src="assets/img/cms/image/2bd41ee20857ba13d21dbded0b3acd62.png.jpg" alt=""></div>

<div class="navbar">
  <div class="logo">百度翻译</div>
  <div class="nav-item">在线翻译</div>
  <div class="nav-item">我的文件</div>
  <div class="nav-item">我的知识</div>
  <div class="nav-item">文档工具</div>
  <div class="nav-right">
    <div class="nav-btn primary">开通会员</div>
    <div class="nav-btn">企业版</div>
    <div class="nav-btn">登录</div>
  </div>
</div>

<div class="page-content">
  <div class="tabs">
    <div class="tab active" data-tab="text">文本翻译</div>
    <div class="tab" data-tab="doc-pro">文档翻译Pro</div>
    <div class="tab" data-tab="doc">文档翻译</div>
    <div class="tab" data-tab="img">图片翻译</div>
    <div class="tab" data-tab="audio">AI音视频翻译</div>
  </div>

  <div style="display:flex">
    <div class="editor">
      <div class="lang-bar">
        <div class="lang-select" id="langFrom"><span id="langFromText">自动检测</span></div>
        <div class="swap-btn" id="swapBtn">⇄</div>
        <div class="lang-select" id="langTo"><span id="langToText">中文</span></div>
        <div class="lang-spacer"></div>
      </div>
      <div class="translate-area">
        <div class="translate-panel left">
          <textarea class="translate-textarea" id="sourceText" placeholder="请输入要翻译的文本..."></textarea>
          <button class="translate-btn" id="translateBtn">翻 译</button>
          <div class="panel-toolbar">
            <button class="tool-btn" id="clearBtn">✕ 清空</button>
            <button class="tool-btn" id="pasteBtn">📋 粘贴</button>
          </div>
        </div>
        <div class="translate-panel right">
          <div class="translate-result" id="resultText">翻译结果将显示在这里</div>
          <div class="panel-toolbar">
            <button class="tool-btn" id="copyBtn">📋 复制</button>
            <button class="tool-btn" id="speakBtn">🔊 朗读</button>
          </div>
        </div>
      </div>
    </div>
    <div class="sidebar">
      <div class="sidebar-card">
        <h4>翻译历史</h4>
        <ul class="history-list"><li>— 暂无记录 —</li></ul>
      </div>
      <div class="sidebar-card">
        <h4>快捷键</h4>
        <div style="font-size:12px;color:#666">Ctrl+Enter → 翻译<br>Esc → 清空</div>
      </div>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
// 翻译 API
async function translate() {
  const text = document.getElementById('sourceText').value.trim();
  if (!text) return showToast('请输入文本');
  document.getElementById('resultText').innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span> 翻译中...';
  try {
    const r = await fetch('/translate', {
      method: 'POST',
      headers: {'Content-Type':'application/x-www-form-urlencoded'},
      body: 'q=' + encodeURIComponent(text)
    });
    const d = await r.json();
    document.getElementById('resultText').textContent = d.responseData?.translatedText || JSON.stringify(d);
  } catch(e) { document.getElementById('resultText').textContent = '翻译失败: ' + e.message; }
}

// 事件绑定
document.getElementById('translateBtn').addEventListener('click', translate);
document.getElementById('sourceText').addEventListener('keydown', e => { if(e.ctrlKey && e.key==='Enter'){e.preventDefault();translate();} });
document.getElementById('clearBtn').addEventListener('click', () => { document.getElementById('sourceText').value=''; document.getElementById('resultText').textContent='翻译结果将显示在这里'; });
document.getElementById('copyBtn').addEventListener('click', () => { navigator.clipboard.writeText(document.getElementById('resultText').textContent); showToast('已复制'); });
document.getElementById('pasteBtn').addEventListener('click', async () => { try { document.getElementById('sourceText').value = await navigator.clipboard.readText(); } catch(e){} });
document.getElementById('swapBtn').addEventListener('click', () => { const t=document.getElementById('langFromText'); const v=t.textContent; t.textContent=document.getElementById('langToText').textContent; document.getElementById('langToText').textContent=v; });

document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => { document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); }));

function showToast(msg) { const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2000); }

console.log('✅ 百度翻译 clone 已加载');
</script>
</body>
</html>`;

fs.writeFileSync(`${outDir}/index.html`, html);
console.log(`\nGenerated: ${outDir}/index.html (${html.length} bytes)`);

// ── Step 3: 生成 server.js ──
const server = `const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = 9093;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript' };

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/translate') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const params = new URLSearchParams(body);
      const q = params.get('q') || '';
      const proxy = https.request('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(q) + '&langpair=en|zh', (pr) => {
        res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        pr.pipe(res);
      });
      proxy.on('error', e => { res.writeHead(502); res.end(JSON.stringify({error:e.message})); });
      proxy.end();
    });
    return;
  }
  if (req.method === 'OPTIONS') { res.writeHead(200, {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}); res.end(); return; }
  let fp = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  fs.readFile(fp, (err, data) => { err ? (res.writeHead(404), res.end('Not found')) : (res.writeHead(200, {'Content-Type': MIME[path.extname(fp)] || 'text/plain'}), res.end(data)); });
}).listen(PORT, () => console.log('Server on ' + PORT));
`;

fs.writeFileSync(`${outDir}/server.js`, server);
console.log(`Generated: ${outDir}/server.js (${server.length} bytes)`);

console.log('\n✅ 生成完成 → ' + outDir);
console.log('  启动: node ' + outDir + '/server.js');