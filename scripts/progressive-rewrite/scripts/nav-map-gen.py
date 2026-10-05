#!/usr/bin/env python3
# nav-map-gen.py — 把原版导航 CSS 规则按类名映射表翻译成语义化 hc-* CSS（工具生成，零手写值）
# 用法: python3 nav-map-gen.py > nav-tool.css
import re, sys

CSS = '/mnt/shared/translate-workflow/snapshots/original/assets/css/static/cat/css/index.ecc94679.css'
css = open(CSS).read()

# 类名映射表（原版 → 语义化）
MAP = {
    'GXuSnnox': 'hc-nav',
    'vuaaLCO7': 'hc-nav-inner',
    'C4MLwUQU': 'hc-logo',
    'e4XiihS8': 'hc-menu',
    'rInWakhG': 'hc-menu-item',
    'RuuMNfiQ': 'hc-menu-link',
    'UyJBlRJg': 'hc-badge',
    'nxg2lGDt': 'hc-desk-preview',
    'iOwTyYI4': 'hc-sep',
    'FYlzswNM': 'hc-dropdown',
    'n2olzUvj': 'hc-dropdown-trigger',
    'zcJcUwgF': 'hc-mega-trigger',
    'KCLOAObW': 'hc-mega-flag',
    'ycpbKRSB': 'hc-mega-caption',
    'EePc0gS6': 'hc-mega',
    'jHxWYvNj': 'hc-mega',
    'MxwtB1FY': 'hc-mega-inner',
    'b8vhYpLY': 'hc-mega-col',
    's7vEniAs': 'hc-mega-group',
    'k8JxRxhv': 'hc-mega-go',
    'm6780Xf4': 'hc-mega-go-icon',
    'GvLY4Z0i': 'hc-vip',
    'C2rushz9': 'hc-ent',
    'MlZ3VoUL': 'hc-login',
    '_r0rya3O': 'hc-login-link',
    'Jr6kYBGZ': 'hc-is-on',
}

def translate_selector(sel):
    """把选择器中的原版类 token 替换为 hc-*。组合器/伪类原样保留。"""
    # 按最长 token 优先替换，避免部分匹配
    out = sel
    for orig in sorted(MAP, key=len, reverse=True):
        # 边界匹配：类名以 . 开头，后跟非字母数字
        out = re.sub(r'(?<![\w-])' + re.escape(orig) + r'(?![\w-])', MAP[orig], out)
    return out

rules = re.findall(r'([^{}]+)\{([^{}]*)\}', css)
seen = set()
out_lines = []
for sel, body in rules:
    sel = sel.strip()
    if sel.startswith('@'): continue
    # 只处理包含映射类的规则
    tokens = set(re.findall(r'\.([A-Za-z_][\w-]*)', sel))
    if not tokens & set(MAP): continue
    new_sel = translate_selector(sel)
    if new_sel in seen: continue
    seen.add(new_sel)
    b = re.sub(r'\s+', ' ', body.strip())
    # 远程资源改为本地快照相对路径（gohx 单二进制时代替 CDN）
    b = b.replace('https://fanyi-cdn.cdn.bcebos.com/static/cat/asset/', '../snapshots/original/assets/static/cat/asset/')
    out_lines.append(f'{new_sel} {{ {b} }}')

print('/* nav-tool.css — 由原版 index.css 规则映射生成（nav-map-gen.py），零手写值 */')
print('\n'.join(sorted(out_lines)))
