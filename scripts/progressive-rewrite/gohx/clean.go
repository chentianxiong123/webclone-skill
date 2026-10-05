// 原版快照服务器：纯静态，零注入
package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	dir := os.Args[1]
	if dir == "" {
		dir = "."
	}
	http.Handle("/", http.FileServer(http.Dir(dir)))
	log.Println("原版快照: http://localhost:9999/")
	log.Fatal(http.ListenAndServe(":9999", nil))
}
