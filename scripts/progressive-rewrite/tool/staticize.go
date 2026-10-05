// staticize：渐进式重写流水线第一步
// 移除 React 入口 JS 与统计/风控脚本，把 rendered DOM 静态化（文件成为自己的）
//
// 用法: staticize <index.html> [--keep <逗号分隔的script关键字>]
package main

import (
	"flag"
	"fmt"
	"os"
	"regexp"
	"strings"
)

// 默认移除的脚本（React 入口 + 百度统计/风控/登录）
var defaultRemoves = []string{
	"runtime.98c76df9.js",
	"vendors.400b819a.js",
	"index.a5023d3d.js",
	"mttj.v1.latest.js",
	"abclite-2060-s.js",
	"acs-2060.js",
	"uni_login_wrapper.js",
}

func main() {
	keep := flag.String("keep", "", "保留的脚本关键字（逗号分隔）")
	flag.Parse()
	args := flag.Args()
	if len(args) < 1 {
		fmt.Println("用法: staticize <index.html> [--keep <关键字列表>]")
		os.Exit(1)
	}
	path := args[0]
	keepList := strings.Split(*keep, ",")

	src, err := os.ReadFile(path)
	if err != nil {
		fmt.Println("读取失败:", err)
		os.Exit(1)
	}
	html := string(src)

	removed := 0
	for _, key := range defaultRemoves {
		skip := false
		for _, k := range keepList {
			if k == key {
				skip = true
				break
			}
		}
		if skip {
			continue
		}
		// 匹配 <script ... src="...key..."></script>
		re := regexp.MustCompile(`(?s)<script[^>]*src="[^"]*` + regexp.QuoteMeta(key) + `"[^>]*></script>\s*`)
		n := len(re.FindAllString(html, -1))
		html = re.ReplaceAllString(html, "")
		removed += n
	}

	if err := os.WriteFile(path, []byte(html), 0644); err != nil {
		fmt.Println("写回失败:", err)
		os.Exit(1)
	}
	fmt.Printf("完成: 移除 %d 个脚本引用 (%s)\n", removed, path)
}
