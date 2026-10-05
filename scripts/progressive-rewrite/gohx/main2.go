package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

const snapshotDir = "/tmp/webclone-skill/apps/cli/snapshot-baidu"
const proxyOrigin = "https://fanyi.baidu.com"
const port = "8889"

var mimeMap = map[string]string{
	".html": "text/html; charset=utf-8", ".js": "application/javascript",
	".css":  "text/css", ".png": "image/png", ".svg": "image/svg+xml",
}

const htmxInject = `<script src="https://unpkg.com/htmx.org@1.9.12"></script>
<script>document.addEventListener('DOMContentLoaded',function(){
document.querySelectorAll('nav a[href^="/"],[role="navigation"] a[href^="/"]').forEach(function(a){
if(!a.getAttribute("hx-get")){a.setAttribute("hx-get",a.href);
a.setAttribute("hx-target","#root");a.setAttribute("hx-swap","innerHTML");
a.setAttribute("hx-push-url","true");}});
console.log("[HTMX] injected");});</script>`

func main() {
	http.HandleFunc("/", h)
	fmt.Println("Go HTMX Proxy v2: http://localhost:" + port)
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
			data = []byte(strings.Replace(string(data), "</head>", htmxInject+"</head>", 1))
		}
		w.Write(data)
		return
	}
	proxy(w, r)
}

func proxy(w http.ResponseWriter, r *http.Request) {
	t := proxyOrigin + r.URL.RequestURI()
	pr, _ := http.NewRequest(r.Method, t, r.Body)
	for _, hh := range []string{"Accept","Accept-Language","User-Agent","Referer","Content-Type","Cookie"} {
		if v := r.Header.Get(hh); v != "" { pr.Header.Set(hh, v) }
	}
	pr.Header.Set("Host", "fanyi.baidu.com")
	resp, err := http.DefaultClient.Do(pr)
	if err != nil { http.Error(w, "err", 502); return }
	defer resp.Body.Close()
	
	// Read response body
	bodyBytes, _ := io.ReadAll(resp.Body)
	resp.Body = io.NopCloser(bytes.NewReader(bodyBytes))
	
	// If it's a translation API response, inject a marker
	if strings.Contains(r.URL.Path, "translate") && strings.Contains(string(bodyBytes), "transResult") {
		bodyBytes = bytes.Replace(bodyBytes, []byte(`"transResult"`), 
			[]byte(`"transResult","_cloned":"true"`), 1)
	}
	
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	w.WriteHeader(resp.StatusCode)
	w.Write(bodyBytes)
}
