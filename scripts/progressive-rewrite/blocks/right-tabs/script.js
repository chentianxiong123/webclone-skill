/* 右侧竖排 tab（原版实测：面板默认收起，点 tab 展开对应面板；AIAide 默认高亮但不展开） */
(function(){
  var tabs = document.querySelectorAll('.hc-right-tab');
  var ink = document.querySelector('.hc-right-tabs-ink');
  var panelWrap = document.querySelector('.hc-panel'); // 面板收起容器（原 .typUaL0G display:none）
  var panes = document.querySelectorAll('[data-hc-panel]');
  function showPanel(key){
    if (panelWrap) panelWrap.style.display = 'block';   // 展开容器
    panes.forEach(function(p){ p.style.display = p.getAttribute('data-hc-panel') === key ? 'block' : 'none'; });
  }
  function setActive(key){
    tabs.forEach(function(t){
      var on = t.getAttribute('data-node-key') === key;
      t.classList.toggle('hc-right-tab-active', on);
      if (on && ink) ink.style.top = t.offsetTop + 'px';
    });
  }
  tabs.forEach(function(t){
    t.addEventListener('click', function(){
      var key = t.getAttribute('data-node-key');
      showPanel(key);
      setActive(key);
    });
  });
  // 默认：AIAide 高亮（原版），但面板保持收起
  var active = document.querySelector('.hc-right-tab[data-node-key="AIAide"]');
  if (active) setActive('AIAide');
})();
