// region-map.js — 程序化区域划分（无视觉模型的"看"）
// 用法: node region-map.js <url> <输出目录>
// 原理: 收集可见布局元素的矩形 → 包含树聚类 → 区域带 → 输出描述 + wireframe HTML
const { chromium } = require('/tmp/webclone-skill/node_modules/playwright');
const fs = require('fs');
const LAYOUT = ['div','section','nav','header','footer','main','aside','ul','ol','li','article','button','form'];

(async () => {
  const url = process.argv[2];
  const outDir = process.argv[3] || '.';
  const b = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome' });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(8000);

  const data = await p.evaluate((LAYOUT) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const boxes = [];
    document.querySelectorAll('body *').forEach(el => {
      if (el.id === 'root') return;
      if (!LAYOUT.includes(el.tagName.toLowerCase())) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();
      if (r.width < 25 || r.height < 25) return;
      if (r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh) return;
      const area = r.width * r.height;
      if (area < 600) return;
      const cls = (el.className && typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 3).join(' ') : '');
      boxes.push({
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        area: Math.round(area),
        tag: el.tagName.toLowerCase(),
        cls: cls.slice(0, 60),
        fixed: cs.position === 'fixed', sticky: cs.position === 'sticky', abs: cs.position === 'absolute',
        txt: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60)
      });
    });
    return { vw, vh, boxes };
  }, LAYOUT);

  const boxes = data.boxes;
  boxes.sort((a, b) => b.area - a.area);
  const nodes = boxes.map((b, i) => ({ ...b, i, kids: [], parent: -1, depth: 0 }));

  // 每个盒子找"最小包含它的更大盒子"作父（面积差 <0.99 防误判）
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    let best = -1, bestArea = Infinity;
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const b = nodes[j];
      const contains = b.x <= a.x + 2 && b.y <= a.y + 2 && b.x + b.w >= a.x + a.w - 2 && b.y + b.h >= a.y + a.h - 2;
      if (contains && b.area > a.area && b.area < bestArea && (b.area - a.area) / b.area < 0.99) {
        best = j; bestArea = b.area;
      }
    }
    if (best >= 0) { nodes[i].parent = best; nodes[best].kids.push(i); }
  }

  const depthOf = (i) => {
    let d = 0, cur = i;
    while (nodes[cur].parent >= 0 && d < 8) { d++; cur = nodes[cur].parent; }
    return d;
  };
  nodes.forEach(n => n.depth = depthOf(n.i));

  // 顶层区域：depth<=1、面积>1.5万、面积<97%视口（过滤整页滚动容器）
  let roots = nodes.filter(n => n.depth <= 1 && n.area > 15000 && n.area < data.vw * data.vh * 0.97);
  // 去重：完全重叠的 rect 只保留一个（page-content/OP1PAOjk 这类容器壳）
  const seenRect = new Set();
  roots = roots.filter(r => {
    const key = r.x + ',' + r.y + ',' + r.w + ',' + r.h;
    if (seenRect.has(key)) return false;
    seenRect.add(key);
    return true;
  });
  roots.sort((a, b) => a.y - b.y || a.x - b.x);

  const kidsOf = (ri, depthLeft = 2) => {
    // 从 root 壳层逐层下钻：层内出现"多个并列大块"（非包含）→ 返回该层全部并列块
    let layer = [nodes[ri]];
    for (let guard = 0; guard < 20; guard++) {
      const allKids = layer.flatMap(k => (k.kids || []).map(idx => nodes[idx]).filter(x => x && x.area > 3000));
      if (!allKids.length) return [];
      const big = allKids.sort((a, b) => b.area - a.area);
      // 并列判定：层内 ≥2 个块且互不包含（各自不覆盖另一块的 85% 面积）
      const parallel = big.length >= 2 && !big.some((a, i) =>
        big.some((b, j) => j > i && b.area / a.area > 0.8 && b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h));
      if (parallel) return big.sort((a, b) => a.y - b.y || a.x - b.x).map(k => ({ ...k, kids: depthLeft > 0 ? kidsOf(k.i, depthLeft - 1) : [] }));
      const layerA = Math.max(...layer.map(x => x.area));
      if (big[0].area > layerA * 0.85) { layer = allKids; continue; }  // 仍是容器壳，下钻
      return big.slice(0, 8).map(k => ({ ...k, kids: depthLeft > 0 ? kidsOf(k.i, depthLeft - 1) : [] }));  // 面积突变，取当前层
    }
    return [];
  };

  const rel = (v, total) => Math.round(v / total * 1000) / 10;
  const regions = roots.map((r, ri) => ({
    name: 'R' + (ri + 1),
    x: r.x, y: r.y, w: r.w, h: r.h,
    rx: rel(r.x, data.vw), ry: rel(r.y, data.vh), rw: rel(r.w, data.vw), rh: rel(r.h, data.vh),
    cls: r.cls, tag: r.tag,
    pos: r.fixed ? 'fixed' : r.sticky ? 'sticky' : r.abs ? 'abs' : '',
    txt: r.txt,
    subs: kidsOf(r.i).map(k => ({
      x: k.x - r.x, y: k.y - r.y, w: k.w, h: k.h,
      rx: rel(k.x, data.vw), ry: rel(k.y, data.vh), rw: rel(k.w, data.vw), rh: rel(k.h, data.vh),
      cls: k.cls, tag: k.tag, pos: k.fixed ? 'fixed' : k.sticky ? 'sticky' : '',
      txt: k.txt, children: (k.kids || []).map(c => ({ x: c.x - k.x, y: c.y - k.y, w: c.w, h: c.h, rx: rel(c.x, data.vw), ry: rel(c.y, data.vh), rw: rel(c.w, data.vw), rh: rel(c.h, data.vh), cls: c.cls, txt: c.txt })).slice(0, 6)
    })).slice(0, 16)
  }));

  // ---- 文本描述 ----
  console.log('===== 页面区域地图（' + data.vw + 'x' + data.vh + '）=====');
  regions.forEach((rg, i) => {
    console.log(`[R${i+1}] (${rg.x},${rg.y}) ${rg.w}x${rg.h} ${rg.pos} ${rg.tag} .${rg.cls.split(' ')[0]}`);
    console.log(`  内容: ${rg.txt || '(空)'}`);
    rg.subs.forEach(s => {
      console.log(`  ├─ 子 (${s.x},${s.y}) ${s.w}x${s.h} ${s.pos} ${s.tag} .${s.cls.split(' ')[0]} | ${s.txt ? s.txt.slice(0,22) : '(空)'}`);
      (s.children || []).forEach(c => {
        console.log(`  │  └─ (${c.x},${c.y}) ${c.w}x${c.h} .${c.cls.split(' ')[0]} | ${c.txt ? c.txt.slice(0,24) : '(空)'}`);
      });
    });
  });

  // ---- wireframe HTML ----
  const colors = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#748ffc', '#f783ac', '#9775fa', '#20c997', '#fcc419'];
  // wireframe 用 SVG viewBox=基准(1440x900)，浏览器窗口任意缩放按比例自适应
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>区域划分草图（基准 1440x900@100% 缩放自适应）</title>
<style>body{margin:0;background:#222;font-family:monospace;padding:10px}
.bar{color:#9ad;font-size:12px;padding:6px 2px;letter-spacing:.5px}
svg{width:100%;max-width:1440px;height:auto;background:#f6f7fb;display:block;margin:0 auto;border:1px solid #444}
.rtxt{font-size:11px;fill:#fff;font-weight:bold}
.subtxt{font-size:8.5px;fill:#444}
</style></head><body><div class="bar">区域划分草图 · 基准 ${data.vw}x${data.vh}@100%缩放 · 窗口任意拉伸自适应（SVG viewBox）</div>
<svg viewBox="0 0 ${data.vw} ${data.vh}" preserveAspectRatio="xMidYMid meet">`;
  regions.forEach((rg, i) => {
    const c = colors[i % colors.length];
    html += `<rect x="${rg.x}" y="${rg.y}" width="${rg.w}" height="${rg.h}" fill="${c}22" stroke="${c}" stroke-width="2" stroke-dasharray="8 4"/>
      <text x="${rg.x+4}" y="${rg.y+16}" class="rtxt" fill="${c}">R${i+1} ${rg.txt.slice(0,16)}</text>
      <text x="${rg.x+4}" y="${rg.y+28}" class="subtxt">${rg.w}x${rg.h} ${rg.pos} 相对:${rg.rw}%x${rg.rh}%</text>`;
    rg.subs.forEach(s => {
      const ssx = rg.x + s.x, ssy = rg.y + s.y;
      html += `<rect x="${ssx}" y="${ssy}" width="${s.w}" height="${s.h}" fill="rgba(255,255,255,.30)" stroke="rgba(0,0,0,.35)" stroke-width="1"/>
        <text x="${ssx+3}" y="${ssy+12}" class="subtxt" font-weight="bold">${(s.txt||s.cls).slice(0,22)}</text>`;
      (s.children || []).forEach(ch => {
        const cxx = ssx + ch.x, cyy = ssy + ch.y;
        html += `<rect x="${cxx}" y="${cyy}" width="${ch.w}" height="${ch.h}" fill="rgba(255,255,255,.5)" stroke="rgba(0,0,0,.18)" stroke-width=".8"/>
          <text x="${cxx+2}" y="${cyy+10}" class="subtxt">${(ch.txt||ch.cls).slice(0,16)}</text>`;
      });
    });
  });
  html += `</svg></body></html>`;
  fs.writeFileSync(outDir + '/region-map.html', html);
  fs.writeFileSync(outDir + '/region-map.json', JSON.stringify(regions, null, 2));
  console.log('\nwireframe: ' + outDir + '/region-map.html');
  await b.close();
})();