/* 语言选择器完整面板逻辑（原 React 行为自实现） */
(function(){
  var PANEL = document.getElementById('hc-lang-panel');
  var GROUPS = [["A",[["阿拉伯语", true], ["爱沙尼亚语", true], ["阿塞拜疆语", false], ["阿尔巴尼亚语", false], ["爱尔兰语", false], ["阿姆哈拉语", false], ["阿萨姆语", false], ["奥里亚语", false], ["阿尔及利亚阿拉伯语", false], ["阿肯语", false], ["阿拉贡语", false], ["阿斯图里亚斯语", false], ["艾马拉语", false], ["奥杰布瓦语", false], ["奥克语", true], ["奥罗莫语", false], ["奥塞梯语", false]]],["B",[["波兰语", true], ["保加利亚语", true], ["波斯语", false], ["白俄罗斯语", false], ["波斯尼亚语", true], ["巴斯克语", false], ["冰岛语", true], ["北索托语", false], ["比斯拉马语", false], ["巴什基尔语", false], ["巴西葡萄牙语", true], ["柏柏尔语", false], ["邦板牙语", false], ["北方萨米语", false], ["本巴语", false], ["比林语", false], ["俾路支语", false], ["博杰普尔语", false], ["布列塔尼语", false]]],["C",[["聪加语", false], ["楚瓦什语", false]]],["D",[["德语", true], ["丹麦语", true], ["迪维希语", false], ["德顿语", false], ["鞑靼语", false], ["低地德语", true]]],["E",[["俄语", true]]],["F",[["法语", true], ["芬兰语", true], ["菲律宾语", true], ["富拉尼语", false], ["法罗语", false], ["梵语", false], ["弗留利语", false]]],["G",[["高棉语", true], ["格鲁吉亚语", false], ["古吉拉特语", false], ["刚果语", false], ["瓜拉尼语", false], ["格陵兰语", false], ["盖尔语", false], ["高地索布语", false], ["古希腊语", false], ["古英语", false]]],["H",[["韩语", true], ["荷兰语", true], ["黑山语", false], ["豪萨语", false], ["海地语", false], ["哈卡钦语", false], ["胡帕语", false]]],["J",[["捷克语", true], ["加泰罗尼亚语", true], ["加利西亚语", true], ["吉尔吉斯语", false], ["加拿大法语", false]]],["K",[["克罗地亚语", true], ["卡纳达语", false], ["科萨语", false], ["科西嘉语", false], ["库尔德语", false], ["孔卡尼语", false], ["克什米尔语", false], ["卡拜尔语", false], ["卡努里语", false], ["卡舒比语", false], ["康瓦尔语", false], ["克里克语", false], ["克里米亚鞑靼语", false], ["克林贡语", false], ["克丘亚语", false]]],["L",[["罗马尼亚语", true], ["老挝语", false], ["拉丁语", false], ["立陶宛语", true], ["拉脱维亚语", true], ["卢森堡语", false], ["林加拉语", false], ["罗曼什语", false], ["拉特加莱语", false], ["林堡语", false], ["卢干达语", false], ["卢森尼亚语", false], ["卢旺达语", false], ["罗姆语", false], ["逻辑语", false]]],["M",[["缅甸语", false], ["马来语", true], ["苗语", false], ["孟加拉语", true], ["马其顿语", false], ["马拉地语", false], ["马拉雅拉姆语", false], ["马耳他语", false], ["毛利语", false], ["马拉加斯语", false], ["迈蒂利语", false], ["马绍尔语", false], ["曼克斯语", false], ["毛里求斯克里奥尔语", false]]],["N",[["挪威语", true], ["尼泊尔语", true], ["南非荷兰语", true], ["南索托语", false], ["南恩德贝莱语", false], ["那不勒斯语", false]]],["P",[["葡萄牙语", true], ["普什图语", false], ["旁遮普语", false], ["帕皮阿门托语", false]]],["Q",[["齐切瓦语", false], ["契维语", false], ["切罗基语", false]]],["R",[["日语", true], ["瑞典语", true]]],["S",[["斯洛文尼亚语", true], ["斯洛伐克语", true], ["塞尔维亚语(拉丁文)", true], ["塞尔维亚语(西里尔文)", false], ["斯瓦希里语", true], ["索马里语", false], ["萨摩亚语", false], ["世界语", true], ["苏格兰语", false], ["萨丁尼亚语", false], ["掸语", false], ["桑海语", false], ["书面挪威语", false], ["宿务语", false]]],["T",[["泰语", true], ["土耳其语", true], ["泰米尔语", false], ["土库曼语", false], ["塔吉克语", false], ["泰卢固语", false], ["他加禄语", false], ["提格利尼亚语", false], ["突尼斯阿拉伯语", false]]],["W",[["乌克兰语", true], ["乌尔都语", false], ["威尔士语", true], ["沃洛夫语", false], ["文达语", false], ["瓦隆语", false]]],["X",[["西班牙语", true], ["匈牙利语", true], ["希腊语", true], ["希伯来语", false], ["信德语", false], ["修纳语", false], ["夏威夷语", false], ["叙利亚语", false], ["巽他语", false], ["西非书面语", false], ["西弗里斯语", false], ["西里西亚语", false], ["希利盖农语", false], ["下索布语", false], ["新挪威语", false]]],["Y",[["英语", true], ["越南语", true], ["意大利语", true], ["印尼语", true], ["印地语", true], ["亚美尼亚语", true], ["约鲁巴语", false], ["伊博语", false], ["意第绪语", false], ["亚齐语", false], ["伊多语", false], ["伊努克提图特语", false], ["因特语", false], ["印古什语", false]]],["Z",[["中文(简体)", true], ["中文(繁体)", true], ["中文(粤语)", true], ["中文(文言文)", false], ["祖鲁语", false], ["爪哇语", false], ["扎扎其语", false], ["中古法语", false]]]]; // [字母, [[语言名,热门],...]]

  function renderGroups(){
    var c = document.getElementById('hc-lang-groups');
    GROUPS.forEach(function(g){
      var gp = document.createElement('div');
      gp.className = 'hc-lang-group';
      var lt = document.createElement('p');
      lt.className = 'hc-lang-letter';
      lt.textContent = g[0];
      gp.appendChild(lt);
      g[1].forEach(function(l){
        var it = document.createElement('span');
        it.className = 'hc-lang-item';
        it.setAttribute('data-name', l[0]);
        it.textContent = l[0];
        if (l[1]) { var h = document.createElement('i'); h.className='hc-lang-hot'; h.textContent='AI'; it.appendChild(h); }
        gp.appendChild(it);
      });
      c.appendChild(gp);
    });
  }

  function openPanel(anchor){ PANEL.classList.add('is-open'); }
  function closePanel(){ PANEL.classList.remove('is-open'); }

  // 触发：hover + click（源/目标语言按钮）
  ['hc-src-lang','hc-dst-lang'].forEach(function(id){
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('mouseenter', openPanel);
    btn.addEventListener('click', function(e){ e.stopPropagation(); PANEL.classList.toggle('is-open'); });
  });
  PANEL.addEventListener('mouseenter', openPanel);
  PANEL.addEventListener('mouseleave', closePanel);
  document.addEventListener('click', closePanel);

  // 快捷语言
  document.querySelectorAll('.hc-lang-quick-item').forEach(function(li){
    li.addEventListener('click', function(){
      var name = li.getAttribute('data-quick');
      if (!name) return;
      var active = document.querySelector('.hc-lang-btn.is-sel') || document.getElementById('hc-dst-lang');
      active.querySelector('span').textContent = name;
      document.querySelectorAll('.hc-lang-quick-item').forEach(function(x){ x.classList.remove('is-sel'); });
      li.classList.add('is-sel');
      closePanel();
    });
  });

  // 语言项选择
  var groupsEl = document.getElementById('hc-lang-groups');
  groupsEl.addEventListener('click', function(e){
    var it = e.target.closest('.hc-lang-item');
    if (!it) return;
    var active = document.getElementById('hc-dst-lang');
    active.querySelector('span').textContent = it.getAttribute('data-name');
    document.querySelectorAll('.hc-lang-item').forEach(function(x){ x.classList.remove('is-sel'); });
    it.classList.add('is-sel');
    closePanel();
  });

  // 搜索过滤
  document.getElementById('hc-lang-search').addEventListener('input', function(){
    var q = this.value.trim();
    document.querySelectorAll('#hc-lang-groups .hc-lang-item').forEach(function(it){
      it.classList.toggle('is-hide', q !== '' && it.getAttribute('data-name').indexOf(q) === -1);
    });
    document.querySelectorAll('#hc-lang-groups .hc-lang-group').forEach(function(gp){
      var vis = Array.from(gp.querySelectorAll('.hc-lang-item')).some(function(x){ return !x.classList.contains('is-hide'); });
      gp.style.display = vis ? '' : 'none';
    });
  });

  // 交换
  document.getElementById('hc-lang-swap').addEventListener('click', function(){
    var a = document.getElementById('hc-src-lang'), b = document.getElementById('hc-dst-lang');
    var ta = a.querySelector('span').textContent, tb = b.querySelector('span').textContent;
    a.querySelector('span').textContent = tb;
    b.querySelector('span').textContent = ta;
  });

  renderGroups();
})();
