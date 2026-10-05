// sketch-divs.js — div 骨架草图 v2（零猜测版）
// 用法: node sketch-divs.js <url> <输出目录>
// 深度 = parentElement 链长度（DOM 真值，非矩形猜测）
// SVG 每层独立分组 + 按钮切换显隐（不混在一起）
const { chromium } = require('/tmp/webclone-skill/node_modules/playwright');
const fs = require('fs');

(async () => {
  const url = process.argv[2];
  const outDir = process.argv[3] || '.';
  const b = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome' });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(8000);

  const data = await p.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const out = [];
    // DOM 真深度：从 html 数祖先链。html=1, body=2, 以此类推
    const depthOf = (el) => { let d = 0, n = el; while (n) { d++; n = n.parentElement; } return d; };
    document.querySelectorAll('body *').forEach(el => {
      const tag = el.tagName.toLowerCase();
      if (!['div', 'section', 'nav', 'header', 'footer', 'main', 'aside', 'ul', 'ol'].includes(tag)) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      if (r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh) return;
      const cls = (el.className && typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 2).join(' ') : '');
      out.push({
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        depth: depthOf(el),
        tag,
        cls: cls.slice(0, 40),
        txt: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 24)
      });
    });
    return { vw, vh, boxes: out };
  });

  const boxes = data.boxes;
  // 过滤超深（组件内部 slate 等 18 层噪音，只保留结构层）
  const MAXD = 10;
  const kept = boxes.filter(b => b.depth <= MAXD);
  const byDepth = {};
  kept.forEach(b => { (byDepth[b.depth] = byDepth[b.depth] || []).push(b); });

  console.log('===== div 骨架（' + data.vw + 'x' + data.vh + '，DOM 真深度 ≤' + MAXD + '，共 ' + kept.length + ' 个）=====');
  for (let d = 2; d <= MAXD; d++) {
    const layer = (byDepth[d] || []).sort((a, b) => a.y - b.y || a.x - b.x);
    if (!layer.length) continue;
    console.log(`--- DOM深度 ${d}（${layer.length} 个）---`);
    layer.slice(0, 25).forEach(n => {
      console.log(`  (${n.x},${n.y}) ${n.w}x${n.h} <${n.tag}> .${n.cls.slice(0, 26)} | ${n.txt || '(空)'}`);
    });
    if (layer.length > 25) console.log(`  ... 还有 ${layer.length - 25} 个`);
  }

  // SVG：分层分组 + 按钮切换
  const depthColor = ['#888', '#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#9b59b6', '#00b8a9', '#e84393', '#6c5ce7', '#0984e3'];
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>div 骨架草图（分层可切换）</title>
<style>body{margin:0;background:#222;font-family:monospace;padding:12px}
.bar{color:#9ad;font-size:12px;letter-spacing:.5px;margin-bottom:8px}
.btns{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.btns button{background:#333;color:#ddd;border:1px solid #555;border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer;font-family:inherit}
.btns button.on{background:#0a4;border-color:#0a4;color:#fff}
svg{width:100%;max-width:1440px;height:auto;background:#fafbfe;display:block;margin:0 auto;border:1px solid #444}
.legend{color:#ccc;font-size:11px;margin:8px 0}
</style></head><body>
<div class="bar">div 骨架草图 · 基准 ${data.vw}x${data.vh}@100%缩放 · DOM 真深度分层 · 点按钮切换层</div>
<div class="btns"></div>
<div class="legend">颜色 = 深度（红=根 橙=顶层 绿=区域 蓝=组件 紫/青=内层）· 框上标: 标签.类名 宽x高</div>
<svg id="sketch" viewBox="0 0 ${data.vw} ${data.vh}" preserveAspectRatio="xMidYMid meet">`;
  // 背景基准
  html += `<rect x="0" y="0" width="${data.vw}" height="${data.vh}" fill="none" stroke="#bbb" stroke-width="1"/>`;
  // 每层一个 g 组（先全部生成，JS 控制显隐）
  const layerKeys = Object.keys(byDepth).map(Number).sort((a, b) => a - b);
  layerKeys.forEach(d => {
    const c = depthColor[Math.min(d, depthColor.length - 1)];
    html += `<g class="layer" data-depth="${d}">`;
    const items = byDepth[d].sort((a, b) => b.w * b.h - a.w * a.h);
    items.forEach(n => {
      const sw = d <= 3 ? 1.6 : 1;
      html += `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" fill="rgba(255,255,255,.04)" stroke="${c}" stroke-width="${sw}" stroke-opacity="${d <= 4 ? 0.95 : 0.55}"/>`;
      if (d <= 3) {
        html += `<text x="${n.x + 3}" y="${n.y + 13}" font-size="${d === 2 ? 11 : 10}" font-weight="bold" fill="${c}">${n.tag}.${n.cls.split(' ')[0]} ${n.w}x${n.h}</text>`;
        if (n.txt) html += `<text x="${n.x + 3}" y="${n.y + 24}" font-size="9" fill="#555">${n.txt.slice(0, 30)}</text>`;
      } else if (n.w > 150 && n.h > 25) {
        html += `<text x="${n.x + 2}" y="${n.y + 10}" font-size="8" fill="#888">${n.cls.split(' ')[0]}</text>`;
      }
    });
    html += `</g>`;
  });
  html += `</svg>
<script>
(function(){
  var layers = Array.from(document.querySelectorAll('g.layer'));
  var btnsBox = document.querySelector('.btns');
  var depthMax = Math.max.apply(null, layers.map(g => +g.getAttribute('data-depth')));
  var state = {};  // 默认显示 0-3
  layers.forEach(function(g){ var d = +g.getAttribute('data-depth'); state[d] = d <= 3; });
  function render(){
    layers.forEach(function(g){
      var d = +g.getAttribute('data-depth');
      g.style.display = state[d] ? '' : 'none';
    });
  }
  // 按钮
  for (var d = 0; d <= depthMax; d++) {
    (function(d){
      var b = document.createElement('button');
      b.textContent = '深度' + d;
      b.className = state[d] ? 'on' : '';
      b.onclick = function(){
        state[d] = !state[d];
        b.className = state[d] ? 'on' : '';
        render();
      };
      btnsBox.appendChild(b);
    })(d);
  }
  // 全部/无
  var all = document.createElement('button'); all.textContent = '全开'; all.onclick = function(){ for (var k in state) state[k] = true; render(); document.querySelectorAll('.btns button').forEach(function(x){x.className='on';}); };
  var none = document.createElement('button'); none.textContent = '全关'; none.onclick = function(){ for (var k in state) state[k] = false; render(); document.querySelectorAll('.btns button').forEach(function(x){x.className='';}); };
  btnsBox.insertBefore(none, btnsBox.firstChild);
  btnsBox.insertBefore(all, btnsBox.firstChild);
  render();
})();
</script>
</body></html>`;
  fs.writeFileSync(outDir + '/div-sketch.html', html);
  fs.writeFileSync(outDir + '/div-sketch.json', JSON.stringify({ vw: data.vw, vh: data.vh, byDepth: Object.fromEntries(Object.entries(byDepth).map(([k, v]) => [k, v.length])) }, null, 2));
  console.log('\nsvg: ' + outDir + '/div-sketch.html （按钮可切换深度层）');
  await b.close();
})();
