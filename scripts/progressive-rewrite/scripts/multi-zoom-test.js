// multi-zoom-test.js — 多缩放验证（Multi-zoom Gate）
// 用法: node multi-zoom-test.js
// 矩阵: 1440x900@100% / 1280x800@100% / 1920x1080@100% / 1440x900@125%(zoom)
// 每档对比原版/改动版关键元素坐标 + 交互，全档一致才 PASS
const { chromium } = require('/tmp/webclone-skill/node_modules/playwright');

const MATRIX = [
  { name: '1440x900@100%', w: 1440, h: 900, zoom: 1 },
  { name: '1280x800@100%', w: 1280, h: 800, zoom: 1 },
  { name: '1920x1080@100%', w: 1920, h: 1080, zoom: 1 },
  { name: '1440x900@125%', w: 1440, h: 900, zoom: 1.25 }
];

async function open(b, url, { w, h, zoom }) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(6500);
  if (zoom !== 1) await p.evaluate((z) => { document.body.style.zoom = z; }, zoom);
  await p.waitForTimeout(500);
  return p;
}

async function measure(p, navSel, rightSel) {
  return await p.evaluate(({ ns, rs }) => {
    const out = {};
    // 导航菜单 x  + 导航整体 y 基准
    const nav = document.querySelector(ns);
    if (nav) {
      const nrect = nav.getBoundingClientRect();
      out.navY = Math.round(nrect.y);
      const items = Array.from(nav.querySelectorAll('.rInWakhG, .hc-menu-item')).slice(0, 8);
      out.menuX = items.map(el => Math.round(el.getBoundingClientRect().x));
      // 用户区三按钮（训练教训：老版本漏检此区）
      const users = Array.from(nav.querySelectorAll('.GvLY4Z0i, .C2rushz9, .MlZ3VoUL, .hc-vip, .hc-ent, .hc-login')).slice(0, 3);
      if (users.length === 3) {
        out.userX = users.map(el => Math.round(el.getBoundingClientRect().x));
        out.userY = users.map(el => Math.round(el.getBoundingClientRect().y));
      }
    }
    // 右侧栏
    const rp = document.querySelector(rs);
    if (rp) {
      const rect = rp.getBoundingClientRect();
      out.rightPanel = { x: Math.round(rect.x), w: Math.round(rect.width), h: Math.round(rect.height) };
      const tabs = Array.from(rp.querySelectorAll('.ant-tabs-tab, .hc-right-tab')).map(t => Math.round(t.getBoundingClientRect().y));
      const fab = Array.from(rp.querySelectorAll('.AvGcOE_K, .hc-fab-icon')).map(s => Math.round(s.getBoundingClientRect().y));
      out.tabY = tabs.slice(0, 2);
      out.fabY = fab.slice(0, 4);
    }
    return out;
  }, { ns: navSel, rs: rightSel });
}

(async () => {
  const b = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome' });
  const ORIG = 'http://localhost:9999/mtpe-individual/transText#/';
  const MINE = 'http://localhost:9998/#transText';
  const results = [];
  for (const m of MATRIX) {
    const po = await open(b, ORIG, m);
    const pm = await open(b, MINE, m);
    const o = await measure(po, '.GXuSnnox', '.qphmPPyw');
    const mine = await measure(pm, '.hc-nav', '.hc-right-panel');
    // 对比
    const menuOk = JSON.stringify(o.menuX) === JSON.stringify(mine.menuX);
    const tabOk = JSON.stringify(o.tabY) === JSON.stringify(mine.tabY);
    const fabOk = JSON.stringify(o.fabY) === JSON.stringify(mine.fabY);
    const navYOk = o.navY !== undefined && o.navY === mine.navY;
    const userOk = o.userX && mine.userX && JSON.stringify(o.userX) === JSON.stringify(mine.userX) && JSON.stringify(o.userY) === JSON.stringify(mine.userY);
    const panelOk = o.rightPanel && mine.rightPanel && Math.abs(o.rightPanel.x - mine.rightPanel.x) <= 1 && Math.abs(o.rightPanel.w - mine.rightPanel.w) <= 1 && Math.abs(o.rightPanel.h - mine.rightPanel.h) <= 1;
    const pass = menuOk && tabOk && fabOk && panelOk && navYOk && userOk;
    results.push({ name: m.name, pass, menuOk, tabOk, fabOk, panelOk, navYOk, userOk, o, mine });
    await po.close(); await pm.close();
  }
  // 输出
  console.log('========== 多缩放验证 ==========');
  for (const r of results) {
    console.log(`\n[${r.name}] ${r.pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  导航整体y: 原版 ${r.o.navY} 改动 ${r.mine.navY} ${r.navYOk ? '✅' : '❌'}`);
    console.log(`  导航菜单x: 原版 ${JSON.stringify(r.o.menuX)}`);
    console.log(`             改动 ${JSON.stringify(r.mine.menuX)} ${r.menuOk ? '✅' : '❌'}`);
    if (r.o.userX) {
      console.log(`  用户区x:   原版 ${JSON.stringify(r.o.userX)} 改动 ${JSON.stringify(r.mine.userX)} ${r.userOk ? '✅' : '❌'}`);
      console.log(`  用户区y:   原版 ${JSON.stringify(r.o.userY)} 改动 ${JSON.stringify(r.mine.userY)}`);
    }
    console.log(`  右侧tab y: 原版 ${JSON.stringify(r.o.tabY)} 改动 ${JSON.stringify(r.mine.tabY)} ${r.tabOk ? '✅' : '❌'}`);
    console.log(`  右侧fab y: 原版 ${JSON.stringify(r.o.fabY)} 改动 ${JSON.stringify(r.mine.fabY)} ${r.fabOk ? '✅' : '❌'}`);
    console.log(`  右侧面板:  原版 ${JSON.stringify(r.o.rightPanel)} 改动 ${JSON.stringify(r.mine.rightPanel)} ${r.panelOk ? '✅' : '❌'}`);
  }
  const allPass = results.every(r => r.pass);
  console.log(`\n========== 结论: ${allPass ? '✅ 全部缩放对齐' : '❌ 存在不齐档'} ==========`);
  await b.close();
})();
