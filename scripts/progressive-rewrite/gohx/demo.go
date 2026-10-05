package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

const snapshotDir = "/tmp/webclone-skill/apps/cli/snapshot-baidu"
const port = "8888"

var mimeMap = map[string]string{
	".html": "text/html; charset=utf-8", ".js": "application/javascript",
	".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml",
}

// The magic: inject HTMX + a simple client-side router
// that intercepts React's hash navigation and redirects through HTMX
const injectCode = `<script src="https://unpkg.com/htmx.org@1.9.12"></script>
<script>
// Intercept hash changes and route through HTMX
(function(){
  const origHashChange = window.onhashchange;
  
  // When React changes the hash, intercept it
  const origPushState = history.pushState.bind(history);
  history.pushState = function(state, title, url) {
    if (url && url.includes('#')) {
      // Extract the hash route
      const hash = url.split('#')[1];
      if (hash && hash !== '/' && hash !== '') {
        // Try HTMX navigation
        const target = '/' + hash;
        console.log('[HTMX] Intercepting hash nav:', target);
        htmx.ajax('GET', target, {target:'#root', swap:'innerHTML'});
        return;
      }
    }
    return origPushState(state, title, url);
  };
  
  // Also handle hashchange
  window.addEventListener('hashchange', function(e) {
    const hash = location.hash;
    if (hash && hash !== '#' && hash !== '#/') {
      const target = '/' + hash.slice(1);
      console.log('[HTMX] hashchange:', target);
      htmx.ajax('GET', target, {target:'#root', swap:'innerHTML'});
    }
  });
  
  console.log('[HTMX] Hash router intercept installed');
})();
</script>`

func main() {
	http.HandleFunc("/", h)
	fmt.Println("=== Go HTMX Demo ===")
	fmt.Println("http://localhost:" + port)
	fmt.Println("Snapshot:", snapshotDir)
	fmt.Println()
	fmt.Println("Features:")
	fmt.Println("  1. Serves static snapshot with HTMX injected")
	fmt.Println("  2. Intercepts React hash navigation → HTMX requests")
	fmt.Println("  3. Proxy unknown routes to origin (with CORS)")
	http.ListenAndServe(":"+port, nil)
}

func h(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Path
	if i := strings.Index(p, "?"); i >= 0 { p = p[:i] }
	fp := filepath.Join(snapshotDir, p)
	if p == "/" || p == "" { fp = filepath.Join(snapshotDir, "index.html") }
	ext := filepath.Ext(fp)
	ct := mimeMap[ext]
	if ct == "" { ct = "application/octet-stream" }
	data, err := os.ReadFile(fp)
	if err == nil && len(data) > 0 {
		w.Header().Set("Content-Type", ct)
		if ext == ".html" && !strings.Contains(string(data), "htmx") {
			data = []byte(strings.Replace(string(data), "</head>", injectCode+"</head>", 1))
		}
		w.Write(data)
		return
	}
	// Not in snapshot - proxy to origin
	proxy(w, r)
}

func proxy(w http.ResponseWriter, r *http.Request) {
	t := "https://fanyi.baidu.com" + r.URL.RequestURI()
	pr, _ := http.NewRequest(r.Method, t, r.Body)
	for _, hh := range []string{"Accept","Accept-Language","User-Agent","Referer","Content-Type","Cookie"} {
		if v := r.Header.Get(hh); v != "" { pr.Header.Set(hh, v) }
	}
	pr.Header.Set("Host", "fanyi.baidu.com")
	resp, err := http.DefaultClient.Do(pr)
	if err != nil { http.Error(w, "err", 502); return }
	defer resp.Body.Close()
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}
