/* Tab 切换：点击切 active + 更新 URL hash（原版 React 状态 → 自己实现） */
(function(){
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.hc-tab'));
  var ink = document.querySelector('.hc-tab-ink');
  function moveInk(tab){
    if(!ink || !tab) return;
    ink.style.left = tab.offsetLeft + 'px';
    ink.style.width = tab.offsetWidth + 'px';
  }
  function select(tab){
    tabs.forEach(function(t){ t.classList.remove('is-active'); });
    tab.classList.add('is-active');
    moveInk(tab);
    var key = tab.getAttribute('data-hc-tab');
    if(key) location.hash = '#' + key; // 后续接路由
  }
  tabs.forEach(function(tab){
    tab.addEventListener('click', function(){ select(tab); });
  });
  // 初始定位 ink
  var active = document.querySelector('.hc-tab.is-active');
  if(active) setTimeout(function(){ moveInk(active); }, 100);
})();
