/* 右下浮动：开关按钮切换整个浮动组显隐；反馈/收藏/设置点击提示 */
(function(){
  var fab = document.querySelector('.hc-float-fab');
  if (!fab) return;
  // 原版实测：点开关 fab 不隐藏（4 图标常驻）；开关本身待接入（登录态功能）
  var sw = fab.querySelector('.hc-fab-switch');
  if (sw) sw.addEventListener('click', function(){ });
  ['hc-fab-feedback','hc-fab-collect','hc-fab-set'].forEach(function(c){
    var el = fab.querySelector('.' + c);
    if (!el) return;
    el.addEventListener('click', function(){
      var t = document.createElement('div');
      t.textContent = '待接入（静态化）';
      t.style.cssText = 'position:fixed;right:60px;top:50%;background:#fff;border:.5px solid #e8e9eb;border-radius:8px;box-shadow:0 10px 20px rgba(169,173,204,.3);padding:8px 12px;font-size:12px;color:#5b6073;z-index:9999;transform:translateY(-50%)';
      document.body.appendChild(t);
      setTimeout(function(){ t.remove(); }, 1500);
    });
  });
})();
