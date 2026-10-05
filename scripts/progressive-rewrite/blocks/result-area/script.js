/* 划译浮窗：选中文本后显示（模拟原版划词翻译入口） */
(function(){
  var pop = document.querySelector('.hc-result-popup');
  if (!pop) return;
  var show = function(x, y){
    pop.classList.remove('hc-result-hidden');
    var w = pop.offsetWidth || 300;
    var nx = Math.min(x, window.innerWidth - w - 8);
    var ny = Math.min(y, window.innerHeight - 60);
    pop.style.left = nx + 'px';
    pop.style.top = ny + 'px';
  };
  var hide = function(){ pop.classList.add('hc-result-hidden'); };
  document.addEventListener('mouseup', function(){
    var sel = window.getSelection().toString().trim();
    if (sel) show(window.innerWidth - 320, window.innerHeight - 80);
    else setTimeout(hide, 200);
  });
  pop.addEventListener('click', hide);
})();
