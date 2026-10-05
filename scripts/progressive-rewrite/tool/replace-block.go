// replace-block：渐进式重写流水线工具
// 一条命令真删一个区块并换上自己的片段，UI 一致性由外部 pixel-diff 验证
//
// 用法:
//   replace-block <index.html> --anchor-class <类名> --block <片段目录> [--extend-to-class <类名2>]
//
// 片段目录约定:
//   fragment.html  — 主片段（插入到原区块位置）
//   style.css      — 可选，注入 <style> 到 head
//   script.js      — 可选，注入 <script> 到 head（自动包 DOMContentLoaded）
//
// 示例:
//   replace-block snapshot/index.html --anchor-class GXuSnnox  --block blocks/nav/
//   replace-block snapshot/index.html --anchor-class pLdMpdki  --block blocks/langbar/ --extend-to-class pLdMpdki
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// divEnd 从 start 起用括号计数找闭合 </div>，返回 end 索引（不含）
func divEnd(s string, start int) (int, error) {
	i, depth := start, 0
	for i < len(s) {
		if strings.HasPrefix(s[i:], "<div") {
			j := strings.Index(s[i:], ">")
			if j < 0 {
				return 0, fmt.Errorf("未找到 div 的 >")
			}
			if !strings.HasPrefix(s[i+j-1:], "/") {
				depth++
			}
			i += j + 1
			continue
		}
		if strings.HasPrefix(s[i:], "</div>") {
			depth--
			if depth == 0 {
				return i, nil
			}
			i += 6
			continue
		}
		i++
	}
	return 0, fmt.Errorf("div 未闭合")
}

// findClassDivStart 找 class="XXX" 所在 div 的起点
func findClassDivStart(s, cls string) (int, error) {
	idx := strings.Index(s, `class="`+cls+`"`)
	if idx < 0 {
		return 0, fmt.Errorf("未找到 class=%q", cls)
	}
	start := strings.LastIndex(s[:idx], "<div")
	if start < 0 {
		return 0, fmt.Errorf("class=%q 前未找到 <div", cls)
	}
	return start, nil
}

func main() {
	anchorCls := flag.String("anchor-class", "", "目标区块的类名（必填）")
	extendCls := flag.String("extend-to-class", "", "延伸到第二个同类 div 的闭合（如语言选择器：源语言+交换+目标语言整行）")
	blockDir := flag.String("block", "", "片段目录（fragment.html / style.css / script.js）")
	flag.Parse()
	args := flag.Args()
	if len(args) < 1 || *anchorCls == "" || *blockDir == "" {
		fmt.Println("用法: replace-block <index.html> --anchor-class <类名> --block <片段目录> [--extend-to-class <类名2>]")
		os.Exit(1)
	}
	indexPath := args[0]

	// 1. 读 index.html
	src, err := os.ReadFile(indexPath)
	if err != nil {
		fmt.Println("读取失败:", err)
		os.Exit(1)
	}
	html := string(src)

	// 2. 定位第一个 anchor div 起点
	start1, err := findClassDivStart(html, *anchorCls)
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	// 3. 计算删除终点
	end1, err := divEnd(html, start1)
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	if *extendCls != "" {
		// 找第二个同类 class 的位置，再定位它的 div 起点
		first := strings.Index(html, `class="`+*extendCls+`"`)
		rel := strings.Index(html[first+1:], `class="`+*extendCls+`"`)
		if rel < 0 {
			fmt.Println("未找到第二个 extend class")
			os.Exit(1)
		}
		secondAbs := first + 1 + rel
		div2 := strings.LastIndex(html[:secondAbs], "<div")
		end1, err = divEnd(html, div2)
		if err != nil {
			fmt.Println(err)
			os.Exit(1)
		}
	}

	removed := html[start1:end1]
	fmt.Printf("删除区块: %d bytes (%s..)\n", len(removed), removed[:60])

	// 4. 读片段目录
	frag, err := os.ReadFile(filepath.Join(*blockDir, "fragment.html"))
	if err != nil {
		fmt.Println("缺少 fragment.html:", err)
		os.Exit(1)
	}
	css, _ := os.ReadFile(filepath.Join(*blockDir, "style.css"))
	js, _ := os.ReadFile(filepath.Join(*blockDir, "script.js"))

	// 5. 替换
	html = html[:start1] + string(frag) + html[end1:]

	// 6. 注入 css / js 到 head
	headIdx := strings.Index(html, "</head>")
	if headIdx < 0 {
		fmt.Println("未找到 </head>")
		os.Exit(1)
	}
	var inject strings.Builder
	if len(css) > 0 {
		inject.WriteString("<style>\n" + string(css) + "\n</style>\n")
	}
	if len(js) > 0 {
		// 自动包 DOMContentLoaded（脚本里若已包则不重复）
		jsContent := string(js)
		if !strings.Contains(jsContent, "DOMContentLoaded") {
			jsContent = `document.addEventListener("DOMContentLoaded", function(){` + "\n" + jsContent + "\n});"
		}
		inject.WriteString("<script>\n" + jsContent + "\n</script>\n")
	}
	if inject.Len() > 0 {
		html = html[:headIdx] + inject.String() + html[headIdx:]
	}

	// 7. 写回
	if err := os.WriteFile(indexPath, []byte(html), 0644); err != nil {
		fmt.Println("写回失败:", err)
		os.Exit(1)
	}
	fmt.Printf("完成: %s (%d bytes)\n", indexPath, len(html))
}
