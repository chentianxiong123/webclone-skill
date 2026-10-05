// Go 版快照服务器（复刻 webclone server.js，更稳）：
// 本地命中 → 返回快照；未命中 → 反代到 fanyi.baidu.com
// 用法: hxserve <快照目录> [-inject] [-port 9999]
package main

import (
	"flag"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path"
	"strings"
	"time"
)

// 导航替换脚本：等 React 渲染出 .GXuSnnox 后，整块换成"我的片段"（语义化 hc-nav）
const navReplace = `<style>
.hc-nav{align-items:center;display:flex;height:60px;justify-content:space-between;min-width:1316px;padding:0 20px;position:relative;width:100%;z-index:100;background:#fff;box-sizing:border-box}
.hc-nav-inner{align-items:center;display:flex;flex:1 1;position:relative}
.hc-logo{display:flex;margin-right:32px}.hc-logo img{height:28px;display:block}
.hc-menu{align-items:center;display:flex;height:100%}
.hc-menu-item{color:#0b0d29;cursor:pointer;display:flex;font-size:13px;margin-right:20px;position:relative;align-items:center;height:100%;white-space:nowrap}
.hc-menu-item:hover>.hc-link{color:#6585fa}
.hc-link{color:#0b0d29;font-size:13px;display:inline-flex;align-items:center;height:100%}
.hc-link.is-active{color:#6585fa}
.hc-has-arrow::after{content:\"\";width:12px;height:12px;margin-left:3px;background:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' fill='none' stroke='%230b0d29' stroke-width='1.5'/%3E%3C/svg%3E\") no-repeat 50%;background-size:contain;transition:all .3s}
.hc-menu-item:hover>.hc-link.hc-has-arrow::after{transform:rotate(180deg)}
.hc-dropdown{align-items:center;background:#fff;border:.5px solid #e8e9eb;border-radius:8px;box-shadow:0 10px 20px rgba(169,173,204,.3);display:none;flex-direction:column;left:-8px;max-width:145px;min-width:107px;padding:6px;position:absolute;top:50px;z-index:11}
.hc-menu-item:hover .hc-dropdown{display:flex}
.hc-dropdown-item{display:block;width:100%;padding:6px 10px;border-radius:6px;font-size:13px;color:#0b0d29;cursor:pointer;white-space:nowrap}
.hc-dropdown-item:hover{background:#f2f5ff;color:#6585fa}
.hc-sep{width:1px;height:12px;background:rgba(56,59,89,.06);margin-right:20px}
.hc-badge{align-items:center;background:linear-gradient(55deg,rgba(74,228,255,.12) -14.12%,rgba(66,130,255,.12) 47.61%,rgba(215,104,255,.12) 105.84%);border:.5px solid #3db0ff;border-radius:31px;display:inline-flex;flex-shrink:0;height:13px;justify-content:center;margin-left:4px;position:relative;top:-1px;width:39px;font-size:10px;font-style:normal;font-weight:400;color:#0062ff}
.hc-menu-item.hc-has-mega{position:relative}
.hc-mega{display:none;position:absolute;right:0;top:36px;width:500px;height:451px;z-index:200;background:#fff;border:.5px solid #e8e9eb;border-radius:10px;box-shadow:0 3px 15px 0 rgba(182,187,221,.25)}
.hc-menu-item.hc-has-mega:hover .hc-mega{display:block}
.hc-mega-cols{display:flex;justify-content:space-between;padding:24px 28px;height:100%;box-sizing:border-box}
.hc-mega-col{flex:1}
.hc-mega-group{margin-bottom:20px}
.hc-mega-group strong{display:block;font-size:13px;color:#0b0d29;margin-bottom:6px}
.hc-mega-group .hc-dropdown-item{padding:4px 6px;color:#5b6073}
.hc-mega-group .hc-dropdown-item:hover{color:#6585fa;background:transparent}
.hc-user{align-items:center;display:flex;gap:8px;margin-left:auto}
.hc-vip{color:#ff8b3d;font-size:13px;cursor:pointer}
.hc-ent{color:#0b0d29;font-size:13px;cursor:pointer}
.hc-login{margin-left:12px}
.hc-login-link{display:inline-flex;align-items:center;justify-content:center;border-radius:18px;padding:5px 18px;font-size:13px;color:#fff;background:linear-gradient(90deg,#4e7cf8,#7a5cf8);cursor:pointer}
.hc-login-link:hover{filter:brightness(1.05)}
</style>
<script>
(function(){
  var navHTML = '<header class=\"hc-nav\"><div class=\"hc-nav-inner\"><a class=\"hc-logo\" href=\"/mtpe-individual/transText\"><img src=\"/assets/img/static/cat/asset/logo.b10defd4.png\" alt=\"\"></a><nav class=\"hc-menu\"><div class=\"hc-menu-item\"><span class=\"hc-link is-active\" data-url=\"/mtpe-individual/transText\">在线翻译</span></div><div class=\"hc-menu-item\"><span class=\"hc-link\" data-url=\"/my-files\">我的文件</span></div><div class=\"hc-menu-item hc-has-dropdown\"><span class=\"hc-link hc-has-arrow\" data-url=\"/my-knowledge\">我的知识</span><div class=\"hc-dropdown\"><span class=\"hc-dropdown-item\" data-url=\"/terms\">术语库</span><span class=\"hc-dropdown-item\" data-url=\"/memory\">记忆库</span><span class=\"hc-dropdown-item\" data-url=\"/kb\">知识库</span></div></div><div class=\"hc-menu-item hc-has-dropdown\"><span class=\"hc-link hc-has-arrow\" data-url=\"/doc-tools\">文档工具</span><div class=\"hc-dropdown\"><span class=\"hc-dropdown-item\" data-url=\"/pdf2word\">PDF转Word</span><span class=\"hc-dropdown-item\" data-url=\"/pdf2ppt\">PDF转PPT</span><span class=\"hc-dropdown-item\" data-url=\"/pdf-split\">PDF拆分</span><span class=\"hc-dropdown-item\" data-url=\"/term-extract\">术语提取</span></div></div><div class=\"hc-menu-item\"><span class=\"hc-link\" data-url=\"/ai-human\">AI+人工翻译</span></div><span class=\"hc-sep\"></span><div class=\"hc-menu-item hc-has-dropdown\"><span class=\"hc-link\">桌面端<span class=\"hc-badge\">AI同传</span></span><div class=\"hc-dropdown\"><span class=\"hc-dropdown-item\" data-url=\"/realtime\">AI同传</span></div></div><span class=\"hc-sep\"></span><div class=\"hc-menu-item\"><span class=\"hc-link\" data-url=\"/api\">翻译API</span></div><span class=\"hc-sep\"></span><div class=\"hc-menu-item hc-has-mega\"><span class=\"hc-link\">全部产品</span><div class=\"hc-mega\"><div class=\"hc-mega-cols\"><div class=\"hc-mega-col\"><div class=\"hc-mega-group\"><strong>在线翻译</strong><span class=\"hc-dropdown-item\" data-url=\"/pc-web\">百度翻译PC网页版</span><span class=\"hc-dropdown-item\" data-url=\"/desktop\">百度翻译桌面端</span><span class=\"hc-dropdown-item\" data-url=\"/app\">百度翻译APP</span></div><div class=\"hc-mega-group\"><strong>智能翻译</strong><span class=\"hc-dropdown-item\" data-url=\"/enterprise\">企业版</span><span class=\"hc-dropdown-item\" data-url=\"/smart-intro\">智能翻译产品介绍</span></div><div class=\"hc-mega-group\"><strong>私有化</strong><span class=\"hc-dropdown-item\" data-url=\"/private\">智能翻译平台</span></div></div><div class=\"hc-mega-col\"><div class=\"hc-mega-group\"><strong>翻译API</strong><span class=\"hc-dropdown-item\" data-url=\"/openapi\">百度翻译开放平台</span></div><div class=\"hc-mega-group\"><strong>人工翻译</strong><span class=\"hc-dropdown-item\" data-url=\"/human-ai\">AI+人工翻译</span><span class=\"hc-dropdown-item\" data-url=\"/quick\">日常快译</span><span class=\"hc-dropdown-item\" data-url=\"/pro\">专业翻译</span><span class=\"hc-dropdown-item\" data-url=\"/polish\">英文母语润色</span></div></div></div></div></div></nav><div class=\"hc-user\"><span class=\"hc-vip\" data-url=\"/vip\">开通会员</span><span class=\"hc-ent\" data-url=\"/enterprise\">企业版</span><div class=\"hc-login\"><span class=\"hc-login-link\" data-url=\"/login\">登录</span></div></div></div></header>';
  function replaceNav(){
    var orig = document.querySelector('.GXuSnnox');
    if(!orig || document.querySelector('.hc-nav')) return;
    var tpl = document.createElement('template');
    tpl.innerHTML = navHTML.trim();
    orig.replaceWith(tpl.content.firstChild);
  }
  function waitNav(){
    if(document.querySelector('.GXuSnnox')){ replaceNav(); return; }
    setTimeout(waitNav, 300);
  }
  document.addEventListener('DOMContentLoaded', waitNav);
  if(document.readyState !== 'loading') waitNav();
  // 跳转处理：data-url 点击跳转
  document.addEventListener('click', function(e){
    var el = e.target.closest('[data-url]');
    if(el){ e.preventDefault(); var u = el.getAttribute('data-url'); if(u.charAt(0)==='/') location.href = u; else window.open(u,'_blank'); }
  });
})();
</script>`

const inject = `<script src="assets/js/htmx.min.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('button, .ant-btn').forEach(function(btn) {
    btn.style.border = '2px dashed #ff006e';
    btn.style.borderRadius = '50%';
  });
  var ph = document.querySelector('[data-slate-placeholder]');
  if (ph) ph.textContent = '\u{1F921} \u5728\u8FD9\u91CC\u8F93\u5165 \u{1F921}';
});
document.addEventListener('click', function(e) {
  var emojis = ['\u{1F389}','\u2728','\u{1F525}','\u{1F4A5}','\u{1F38A}'];
  var el = document.createElement('div');
  el.textContent = emojis[Math.floor(Math.random()*emojis.length)];
  el.style.cssText = 'position:fixed;pointer-events:none;font-size:32px;z-index:9999;animation:burst 0.6s forwards;';
  el.style.left = e.clientX + 'px';
  el.style.top = e.clientY + 'px';
  document.body.appendChild(el);
  setTimeout(function(){ el.remove(); }, 600);
});
</script>
<style>
@keyframes burst {
  0% { opacity:1; transform:scale(1) rotate(0deg); }
  100% { opacity:0; transform:scale(2.5) rotate(180deg) translateY(-60px); }
}
body { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%) !important; }
#root, #root * { color: #fff !important; }
</style>`

func main() {
	port := flag.String("port", "9999", "监听端口")
	injectFlag := flag.Bool("inject", false, "注入 HTMX + 魔改")
	navFlag := flag.Bool("replace-nav", false, "替换导航为语义化片段")
	flag.Parse()
	dir := "."
	if flag.NArg() > 0 {
		dir = flag.Arg(0)
	}

	origin := "https://fanyi.baidu.com"
	target, err := url.Parse(origin)
	if err != nil {
		log.Fatal(err)
	}

	proxy := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.Host = target.Host // 关键：Host 必须指向目标，否则百度 302 踢人
			if req.Header.Get("User-Agent") == "" {
				req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36")
			}
		},
		Transport: &http.Transport{
			DialContext:           (&net.Dialer{Timeout: 10 * time.Second}).DialContext,
			ResponseHeaderTimeout: 30 * time.Second,
		},
		ModifyResponse: func(resp *http.Response) error {
			resp.Header.Set("Access-Control-Allow-Origin", "*")
			return nil
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			// 反代出错只报 502，不崩进程（node 版就是在这里崩的）
			w.WriteHeader(http.StatusBadGateway)
			io.WriteString(w, "proxy error: "+err.Error())
		},
	}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// CORS 预检
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "*")
			w.Header().Set("Access-Control-Max-Age", "86400")
			w.WriteHeader(http.StatusNoContent)
			return
		}

		w.Header().Set("Access-Control-Allow-Origin", "*")
		p := r.URL.Path
		if p == "/" {
			p = "/index.html"
		}
		fp := path.Join(dir, p)
		if info, err := os.Stat(fp); err == nil && !info.IsDir() {
			if strings.HasSuffix(p, ".html") {
				w.Header().Set("Cache-Control", "no-cache")
				var inj string
				if *injectFlag {
					inj += inject
				}
				if *navFlag {
					inj += navReplace
				}
				if inj != "" {
					if b, err := os.ReadFile(fp); err == nil {
						s := string(b)
						if !strings.Contains(s, "hc-nav") || !strings.Contains(s, "htmx.min.js") {
							s = strings.Replace(s, "</head>", inj+"</head>", 1)
						}
						w.Header().Set("Content-Type", "text/html; charset=utf-8")
						w.Write([]byte(s))
						return
					}
				}
			} else {
				w.Header().Set("Cache-Control", "public, max-age=3600")
			}
			http.ServeFile(w, r, fp)
			return
		}
		// 本地没有 → 反代百度
		proxy.ServeHTTP(w, r)
	})

	log.Printf("Go 快照+反代: http://localhost:%s/  →  %s  (dir=%s)", *port, origin, dir)
	log.Fatal(http.ListenAndServe(":"+*port, nil))
}
