/* 模型选择器：点击弹出模型菜单（原 ant-select 下拉） */
(function(){
  var box = document.querySelector('.hc-model-box');
  if (!box) return;
  var menu = document.createElement('div');
  menu.style.cssText = 'position:absolute;top:100%;left:20px;background:#fff;border:.5px solid #e8e9eb;border-radius:8px;box-shadow:0 10px 20px rgba(169,173,204,.3);padding:6px;z-index:99;display:none;min-width:140px;font-size:13px';
  menu.innerHTML = '<div style="padding:6px 10px;cursor:pointer;color:#0b0d29" data-m="AI大模型翻译">AI大模型翻译</div>' +
                   '<div style="padding:6px 10px;cursor:pointer;color:#0b0d29" data-m="通用翻译">通用翻译</div>' +
                   '<div style="padding:6px 10px;cursor:pointer;color:#0b0d29" data-m="神经网络翻译">神经网络翻译</div>';
  box.parentElement.style.position = 'relative';
  box.parentElement.appendChild(menu);
  box.addEventListener('click', function(e){
    e.stopPropagation();
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  });
  menu.querySelectorAll('[data-m]').forEach(function(m){
    m.addEventListener('click', function(){
      box.querySelector('.hc-model-item').textContent = m.getAttribute('data-m');
      menu.style.display = 'none';
    });
  });
  document.addEventListener('click', function(){ menu.style.display = 'none'; });
})();
