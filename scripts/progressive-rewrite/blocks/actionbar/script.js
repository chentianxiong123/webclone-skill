/* 功能按钮行交互：深度思考切换激活态；参考知识 hover 提示（原 React 行为 → 自实现） */
(function(){
  // 深度思考：点击切换渐变激活态
  var t = document.querySelector('.hc-pill-toggleable');
  if (t) t.addEventListener('click', function(){ t.classList.toggle('is-on'); });

  // 参考知识：hover 显示浮层（原 ant-dropdown；静态化后无远端数据，先做空浮层提示）
  var dz = document.querySelector('[data-hc-dropdown="knowledge"]');
  if (dz) {
    var tip = document.createElement('div');
    tip.style.cssText = 'position:absolute;top:calc(100% + 4px);left:0;background:#fff;border:.5px solid #e8e9eb;border-radius:8px;box-shadow:0 6px 20px rgba(98,107,181,.15);padding:8px 12px;font-size:12px;color:#5b6073;display:none;z-index:50;white-space:nowrap';
    tip.textContent = '参考知识（已停用，等待接入）';
    dz.style.position = 'relative';
    dz.appendChild(tip);
    dz.addEventListener('mouseenter', function(){ tip.style.display = 'block'; });
    dz.addEventListener('mouseleave', function(){ tip.style.display = 'none'; });
  }
})();
