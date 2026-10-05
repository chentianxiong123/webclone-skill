// 魔改版服务器：静态服务百度翻译快照，对 index.html 注入 HTMX + 魔改脚本
package main

import (
	"log"
	"net/http"
	"os"
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
  console.log('[魔改版] OK');
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
	dir := os.Args[1]
	if dir == "" {
		dir = "."
	}
	fs := http.FileServer(http.Dir(dir))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/" {
			p = "/index.html"
		}
		if strings.HasSuffix(p, ".html") {
			// 尝试读文件并注入
			fp := dir + p
			b, err := os.ReadFile(fp)
			if err != nil {
				http.NotFound(w, r)
				return
			}
			s := string(b)
			if !strings.Contains(s, "assets/js/htmx.min.js") {
				s = strings.Replace(s, "</head>", inject+"</head>", 1)
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write([]byte(s))
			return
		}
		fs.ServeHTTP(w, r)
	})
	log.Println("魔改版服务器: http://localhost:9999/")
	log.Fatal(http.ListenAndServe(":9999", nil))
}
