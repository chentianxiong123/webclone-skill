/* 导航交互 v3 —— 全部按原版实测行为实现
 * 原版行为（工具提取自 index.css + 实测）：
 *   - 下拉（我的知识/文档工具）：React mouseenter 展开 —— hover + click 兜底
 *   - 桌面端：hover → 弹出介绍图（.nxg2lGDt 356px）
 *   - 全部产品：**click** 展开 mega（.Jr6kYBGZ 激活态 → hc-is-on：文字白/箭头转180/面板显）—— 非 hover
 *   - 点外部收起全部面板
 * 注：head 注入，必须包 DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', function () {
  // 1. 跳转（data-url 无 href，原版 React onClick）
  function go(el) {
    var url = el.getAttribute('data-url');
    if (!url) return;
    if (url.charAt(0) === '/') location.href = url;
    else window.open(url, '_blank');
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-url]');
    if (el) { e.preventDefault(); go(el); }
  });

  // 2. 下拉面板（我的知识/文档工具）：mouseenter/mouseleave + click 兜底
  document.querySelectorAll('.hc-menu-item.hc-has-dropdown').forEach(function (item) {
    var panel = item.querySelector('.hc-dropdown');
    if (!panel) return;
    var open = function () { panel.classList.add('is-open'); panel.style.display = 'block'; };
    var close = function () { panel.classList.remove('is-open'); panel.style.display = 'none'; };
    item.addEventListener('mouseenter', open);
    item.addEventListener('mouseleave', close);
    item.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.style.display === 'block' ? close() : open();
    });
  });

  // 3. 全部产品：click 切换 mega（原版 .Jr6kYBGZ → hc-is-on）
  var megaItem = document.querySelector('.hc-menu-item .hc-mega-trigger.hc-mega-flag');
  if (megaItem) {
    megaItem.addEventListener('click', function (e) {
      e.stopPropagation();
      megaItem.classList.toggle('hc-is-on');
    });
  }

  // 4. 点外部收起全部
  document.addEventListener('click', function () {
    if (event.target.closest('.hc-mega-trigger.hc-mega-flag')) return;
    document.querySelectorAll('.hc-dropdown').forEach(function (p) { p.style.display = 'none'; p.classList.remove('is-open'); });
    document.querySelectorAll('.hc-mega-trigger.hc-mega-flag.hc-is-on').forEach(function (m) { m.classList.remove('hc-is-on'); });
  });
});
