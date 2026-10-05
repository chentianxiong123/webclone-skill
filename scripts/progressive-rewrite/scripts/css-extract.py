#!/usr/bin/env python3
# css-extract.py — 组件化单元·步骤2：从本地 CSS 提取组件相关规则
# 用法: python3 css-extract.py <index.css> <类名1,类名2,...>
#   e.g. python3 css-extract.py index.css "IcHmn0gj,VAZLwMV3,sFeoU0sy"
# 说明: 浏览器跨域读不到 cssRules，直接解析本地抓取的 CSS 文件。
#       输出规则同时给出"包含该类的规则"和"祖先链前缀"，供组件化映射参考。
import sys
import re

def extract(css_path, classes):
    css = open(css_path).read()
    # 提取所有规则（selector{declaration}）
    rules = []
    for m in re.finditer(r'([^{}]+)\{([^}]*)\}', css):
        selector = m.group(1).strip().replace('\n', ' ')
        decl = m.group(2).strip()
        rules.append((selector, decl))

    out = []
    for cls in classes:
        lines = []
        exact = [r for r in rules if re.search(r'\.' + re.escape(cls) + r'(?![-\w])', r[0])]
        for sel, decl in exact[:8]:
            lines.append(f'{sel} {{ {decl[:220]} }}')
        out.append((cls, lines))

    for cls, lines in out:
        print(f'--- .{cls} ({len(lines)} 条规则) ---')
        for l in lines:
            print('  ' + l)
        print()

    # 汇总
    total = sum(len(l) for _, l in out)
    print(f'共提取 {len(classes)} 个类名, {total} 条相关规则')

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('用法: css-extract.py <index.css> <类名,类名,...>')
        sys.exit(1)
    classes = [c.strip() for c in sys.argv[2].split(',') if c.strip()]
    extract(sys.argv[1], classes)