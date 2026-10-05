// 快照服务器（复刻 webclone server.js）：
// 本地文件命中 → 返回快照；未命中 → 反向代理到真实站点
// -inject 时对 index.html 注入 HTMX + 魔改
package main

import (
	"flag"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path"
	"strings"
)

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
	injectFlag := flag.Bool("inject", false, "注入 HTMX + 魔改")
	flag.Parse()

	dir := os.Args[1]
	if dir == "" {
		dir = "."
	}
	origin := "https://fanyi.baidu.com"
	target, err := url.Parse(origin)
	if err != nil {
		log.Fatal(err)
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.ModifyResponse = func(resp *http.Response) error {
		resp.Header.Set("Access-Control-Allow-Origin", "*")
		return nil
	}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/" {
			p = "/index.html"
		}
		fp := path.Join(dir, p)
		if info, err := os.Stat(fp); err == nil && !info.IsDir() {
			if *injectFlag && strings.HasSuffix(p, ".html") {
				if b, err := os.ReadFile(fp); err == nil {
					s := string(b)
					if !strings.Contains(s, "assets/js/htmx.min.js") {
						s = strings.Replace(s, "</head>", inject+"</head>", 1)
					}
					w.Header().Set("Content-Type", "text/html; charset=utf-8")
					w.Write([]byte(s))
					return
				}
			}
			http.ServeFile(w, r, fp)
			return
		}
		// 本地没有 → 反向代理到真实站点
		proxy.ServeHTTP(w, r)
	})

	log.Println("快照+反代: http://localhost:9999/ → " + origin)
	log.Fatal(http.ListenAndServe(":9999", nil))
}
