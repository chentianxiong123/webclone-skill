# Skill: 渐进式重写（Progressive Rewrite）

把原版 React 网页逐步"真删替换"为自己的语义化组件，全程保持 UI 一致性。
**核心节奏：一次只组件化一个区块，交替推进，绝不一口气全换。**

## 核心原则

1. **组件化是主线**：一个区块 = 一个组件 = 一个完整单元循环；每完成一个，合入、验证、记录，再开下一个
2. **原版不动**：原版（9999）恒为基准，改动版（9998）是产物
3. **先解剖后动手**：每个组件必须完整触达原版（结构树全量 + CSS 全规则 + 交互触发机制），一个细节都不省——**简化就是糊弄**
4. **数据说话**：组件指纹（精确数字）+ pixel-diff <10%，不靠感觉
5. **工具只干一件事**：触发/提取/定位/替换/验证各自独立

> **🔒 多缩放验证门槛（Multi-zoom Gate）——验收必须项**
> 任何组件/区块验收，不能只在 1440x900@100% 通过。必须**切换多个缩放/分辨率**分别对比原版与改动版，**全部对齐才算通过**：
> - **缩放矩阵（最少 4 个）**：1440x900@100% / 1280x800@100% / 1920x1080@100% / 1440x900@zoom125%（&html 切换 zoom 或 deviceScaleFactor）
> - 每档验证：关键元素坐标（getBoundingClientRect 对比原版）、pixel-diff、交互可触发
> - 单档通过 ≠ 通过；任一档不通过 = 返回修，修到全档一致
> - 响应式断点变化处（如 1280 触发侧栏收起）要特别记录“该档行为差异”，不能忽略

## 组件化单元（每个组件的完整循环）

> **🔒 想当然门禁（No-Guessing Gate）——最高优先级，违背算重大失误**
> **永远不准凭印象自己写**。目标组件/区块动手前，必须先产出以下实测数据，缺任何一项就停，不准进入编写：
> 1. **排布实测表**：区块内每个子元素的真实坐标/尺寸/间距（Playwright `getBoundingClientRect` 逐一采集，如 tab y=72 h=34、fab y=702 间距 44）
> 2. **结构树**：原版 original.html 的压缩结构树（重复项折叠 ×N，含每层类名）
> 3. **CSS 清单**：区块内全部规则的分类清单（壳/布局/状态/元素，含 hover/激活/禁用态）
> 4. **交互地图**：实测触发器→效果（动态行为侦察产出）
> 写 fragment/style/script 的每一行，都必须能在上述数据里找到出处；找不到出处 = 想当然 = 重写。
> **验证反馈循环**：写完必先与实测表逐项核对（坐标/尺寸/状态），再进 9998，不核对不替换。

> **测量基准（A+B 约定，必须遵守）**
> - **A 固定基准**：所有测量/截图/pixel-diff 统一用 **1440×900 CSS 像素 @ 100% 缩放**（无头 Chrome，DPR=1.0）。
>   无头浏览器 viewport 永远设 `{width:1440, height:900}`，不得改用其他分辨率，否则数据不可比。
> - **B 相对坐标**：区域地图/组件位置同时输出相对百分比（相对视口），wireframe 用 SVG viewBox 自适应，
>   任何窗口打开按比例拉伸。绝对像素用于基准验证，相对百分比用于描述。

> **坑（AI 助手面板教训）**：静态 DOM 只代表「抓取那一瞬的状态」，不代表默认状态。
> 组件化前必须做**动态行为侦察**（步骤 0），否则会把「点击后才展开的面板」做成「永远显示」。

### 步骤 0：动态行为侦察（必做，先于提取）
1. 打开页面**零交互**截图 → 记录默认态（哪些面板/模块可见）
2. 枚举触发器：遍历页面 tab/按钮/可点元素，逐个点击
3. 用 `MutationObserver` 监听，记录每个触发器的结果：哪个节点出现/消失/切换
4. 产出「显隐触发器表」：默认态 + 触发元素 + 结果状态（写进组件文档）
5. 悬停/输入等行为同理：实测触发后才能确定成品交互，不能只凭结构猜

### 步骤 1：触达提取（提取组件结构 + 指纹）

```
步骤1 触达+提取     trigger-extract.js <URL> <类名> <输出目录>
      ├─ 自动触发（hover→click 回退）→ 完整 outerHTML（精确 div 边界）
      └─ 组件指纹（元素/文本/属性/深度/标签分布/唯一类名/内联样式）→ fingerprint.json

步骤2 CSS 提取      css-extract.py <index.css> <类名,.列表>
      └─ 相关规则全量（含祖先链/伪类/兄弟选择器）→ 组件化映射依据

步骤3 解剖对照       看 original.html 结构树 + rules.css + 交互触发机制
      └─ 记下：结构层级、aria/属性、hover/click 状态类、懒渲染部分

步骤4 语义化重写（工具化映射，不手写）  每组件一份 map.json（原版类 → hc-* 语义类）
      ├─ 结构：dom-map.js <original.html> <map.json> → fragment.html（零发明，只换类名）
      ├─ CSS：css-map.js --css <index.css> --map <map.json> → style.css（值全来自原版）
      │     └─ 映射后手动补充：script.js 钩子类（is-open/hc-is-on）、本地化资源、交互需要的补充规则
      └─ 对照组：工具版 vs 手写版规则 diff，手写漏掉的规则必须补（actionbar 例：缺 5 个类的规则）

步骤5 独立复刻验证   在 demo/ 页先复原该组件
      └─ 对照原版：结构检出（dem 元素在）+ 交互实测 + 指纹接近

步骤6 真删替换       apply.js <index.html> --class <类名> --block <组件目录> [--extend <类名2>]
      └─ 自动备份 .bak，定位 div 边界，真删，插入片段，注入 css/js

步骤7 验证合入       pixel-diff（<10%）+ 交互实测 + 指纹对比
      └─ 通过 → 更新改动版 + 记录（README 组件表 + 桌面文档）
```

**每组件循环结束 = 一个"交替步"**：合入、验证、记录，然后停下看效果/确认，再开下一个组件。不进鸭子快跑。

## 工具清单（scripts/，每个只干一件事）

| 脚本 | 职责 | 输入 → 输出 |
|---|---|---|
| `grab-dom.js` | 抓整页/指定组件 rendered DOM（等 React 渲染完） | URL(+选择器) → rendered.html / component.html |
| `trigger-extract.js` | 触发组件+提取结构+指纹 | URL+类名 → original.html + fingerprint.json |
| `css-extract.py` | 本地 CSS 提规则（解跨域） | index.css+类名 → 规则清单 |
| `dom-map.js` | **结构映射**（类名替换，零发明） | original.html + map.json → fragment.html |
| `css-map.js` | **CSS 映射**（规则提取+类 token 替换，值全来自原版） | index.css + map.json → style.css |
| `locate.js` | 定位区块边界+结构+规则 | rendered.html+锚点 → 边界/树/CSS |
| `apply.js` | 真删+替换（自动备份） | index.html+组件 → 更新 |
| `pixel-diff.py` | 视觉验证 | 两截图 → diff%+热力图 |
| `multi-zoom-test.js` | 多缩放门禁（4 档矩阵对比原版/改动版坐标） | 两 URL → 各档 PASS/FAIL |
| `region-map.js` | 视觉块聚类→区域树+SVG wireframe | rendered.html → region-map.json/.html |
| `sketch-divs.js` | 浅层 div 骨架（DOM 真深度分层） | rendered.html → 骨架 JSON |

**映射配置约定**：每个组件在 `components/<组件>-map.json` 一份映射（如 nav-map.json / actionbar-map.json），
dom-map.js 与 css-map.js 共用；CSS 资源 URL 用 `--assets 旧前缀=新前缀` 批量本地化。

## 已组件化区块

| 区块 | 原类名 | 语义化 | 状态 |
|---|---|---|---|
| 导航 | `.GXuSnnox` | `.hc-nav` | ✅ 工具化重构：dom-map+css-map 生成，多缩放验证中 |
| 语言选择器 | `.pLdMpdki`×2 | `.hc-langbar` | ✅ |
| Tab 导航 | `.ant-tabs-nav` | `.hc-tabs` | ✅ pixel-diff 2.09% |
| 完整语言面板 | `.IcHmn0gj` | `hc-lang-panel`（demo 复原） | ✅ demo 验证，待合入 |
| 功能按钮行 | `.JjBtRHIL` | `.hc-actionbar`（参考知识/个性指令/深度思考/AI翻译） | ✅ pixel-diff 1.49% |
| 输入区 | `.DWOp2n2u` | `.hc-input-area`（Slate 编辑器 + 上传区 7 图标） | ✅ pixel-diff 0.15% |
| 划译浮窗 | `.FfEykO6W` | `.hc-result-popup`（划词选中弹出） | ✅ |
| AI大模型选择器 | `.b15UFYYv` | `.hc-model-selector`（渐变文字+下拉菜单） | ✅ |
| 侧栏广告 | `.Hu5qsRSB` | `.hc-side-ads`（4 广告卡） | ✅ |
| 右侧栏 | `.qphmPPyw` | `.hc-right-panel`（历史/智能参考/CoPilot） | ✅ 排布对齐：tab y72/122 h34，fab y702/746/790/834，栏 51x820 |
| 右侧竖排 Tab | `.ant-tabs-right` | 并入 `.hc-right-panel`（hc-right-tabs） | ✅ |
| 右下浮动 | `.QsZTmd8Y` | 并入 `.hc-right-panel`（hc-float-fab） | ✅ |

**整体验收：全页 pixel-diff 1.75% PASS**（9999 vs 9998）

## 待组件化清单

| # | 组件 | 说明 |
|---|---|---|
| 13 | 用户区 | 原版未登录不渲染独立组件；登录入口在 hc-nav 内 |
| — | 骨架容器 | multiContainer/machineRes 等布局链（19 个哈希类）留给 HTMX 迁移时语义化 |

## 判据与失败预案

| 检查 | 通过 | 失败处理 |
|---|---|---|
| 指纹接近 | 元素/深度/类名数 ±10% | 结构还原不完整，回步骤3 |
| pixel-diff | <10% | 检查 CSS 映射/边界，可回退 .bak |
| 交互保留 | hover/click/选择实测通过 | script.js 补交互 |
| 原类名消失 | class="原类名" 不存在 | 重新定位边界（extend） |

## 记录规范

每组件化一块：
1. 更新本文件"已组件化/待组件化"表
2. 桌面文档 `2026-10-05-百度翻译快照魔改与Go反代服务器记录.md` 追加该组件的结构/指纹/教训
3. pixel-diff 数值存档