# 渐进式重写流水线（Progressive Rewrite）

把原版 React 网页逐步"真删替换"为自己的语义化源码，全程工具驱动、UI 一致性验证。
**核心：工具注重长久可复用性，组件重写 = 同一套工具 + 每组件一份映射配置，不写死代码。**

## 结构

```
translate-workflow/
├─ scripts/           — 工具（每个只干一件事，JSON 配置驱动）
│  ├─ grab-dom.js        抓整页/指定组件 rendered DOM
│  ├─ trigger-extract.js 触发组件 + 提取结构 + 指纹
│  ├─ css-extract.py     本地 CSS 提规则（解跨域）
│  ├─ dom-map.js         结构映射：original.html + map.json → fragment.html
│  ├─ css-map.js         CSS 映射：index.css + map.json → style.css（值全来自原版）
│  ├─ locate.js          定位区块边界 + 结构 + 规则
│  ├─ apply.js           真删替换（自动备份）
│  ├─ pixel-diff.py      视觉验证 diff% + 热力图
│  ├─ multi-zoom-test.js 多缩放门禁（4 档矩阵对比原版/改动版坐标）
│  ├─ region-map.js      视觉块聚类 → 区域树 + SVG wireframe
│  └─ sketch-divs.js     浅层 div 骨架（DOM 真深度分层）
├─ components/        — 映射配置（每组件一份，dom-map/css-map 共用）
│  ├─ nav-map.json       { 原版类: 语义化类, ... }
│  └─ actionbar-map.json
├─ snapshots/         — 原版(9999) + 改动版(9998) 快照
│  ├─ original/
│  └─ modified/
├─ blocks/            — 组件产物（fragment.html + style.css + script.js + measure.json）
├─ demo/              — 独立复刻演示
└─ gohx/              — HTMX + Go 迁移阶段用地
```

## 组件重写流水线（每组件循环）

```bash
# 0. 动态行为侦察（必做）：零交互截图 → 枚举触发器 → MutationObserver → 显隐触发器表
# 1. 触达提取：原版组件结构
node scripts/grab-dom.js "http://localhost:9999/..." ".原版类" blocks/x/original.html
node scripts/trigger-extract.js ...   # 或：触发态提取 + fingerprint.json

# 2. 写映射配置（唯一手写的东西：类名对应关系，值不是！）
#    components/x-map.json: { "原版类A": "hc-x", ... }

# 3. 结构转换（零发明，只换类名）
node scripts/dom-map.js blocks/x/original.html components/x-map.json blocks/x/fragment.html

# 4. CSS 转换（值全来自原版 index.css）
node scripts/css-map.js --css snapshots/original/assets/css/static/cat/css/index.ecc94679.css \
  --map components/x-map.json --out blocks/x/style.css \
  --assets "https://fanyi-cdn.cdn.bcebos.com/static/cat/asset/=../snapshots/original/assets/static/cat/asset/"

# 5. 应用 + 多缩放验证
node scripts/apply.js snapshots/modified/index.html --class .原版类 --block blocks/x
node scripts/multi-zoom-test.js   # 1440@100% / 1280@100% / 1920@100% / 1440@125% 全对齐才 PASS
```

## 门禁（违背 = 重写）

1. **想当然门禁**：动手前必出 ①排布实测表 ②结构树 ③CSS 清单 ④交互地图；每行代码有出处
2. **多缩放门禁**：只过 1440@100% 不算过，4 档矩阵全对齐才 PASS
3. **结构忠实**：坐标对齐 ≠ 结构对齐，必须拉原版/改动版 DOM 并排逐层比
4. **工具算不手算**：坐标/尺寸/间距用 getBoundingClientRect 实测；CSS 值用 css-map 从原版提取

详细流程见 SKILL.md。