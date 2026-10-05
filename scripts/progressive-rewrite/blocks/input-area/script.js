/* 输入区交互：点击上传区打开文件选择器；编辑器可输入 */
(function(){
  var drag = document.querySelector('.hc-upload-drag');
  var fileInput = drag && drag.querySelector('input[type=file]');
  var list = document.querySelector('.hc-upload-list');
  if (drag && fileInput) {
    drag.addEventListener('click', function(){ fileInput.click(); });
    fileInput.addEventListener('change', function(){
      if (list && this.files && this.files.length) {
        list.innerHTML = '<div style="font-size:12px;color:rgba(0,0,0,.4);padding-top:4px">' +
          Array.from(this.files).map(f => f.name).join('、') + '</div>';
      }
    });
  }
  // 编辑器自动聚焦（原 React 默认）
  var rich = document.querySelector('.hc-input-rich');
  if (rich) rich.focus();
})();
(function(){
  var rich = document.querySelector('.hc-input-rich');
  var ph = rich && rich.querySelector('[data-slate-placeholder]');
  function sync(){ if (rich && ph) ph.style.display = rich.innerText.replace(/\uFEFF/g,'').trim() ? 'none' : ''; }
  if (rich) { rich.addEventListener('input', sync); rich.addEventListener('keyup', sync); sync(); }
})();
