# webclone-skill

Pi Agent Skill — AI 驱动的网页克隆。

**先快照，本地提取，AI 生成代码。** 通过 web-clone 引擎将目标页面下载为带 API 代理的静态快照，所有提取和生成都在本地副本上完成，完全绕过登录墙和反爬机制。

---

## 快速开始

```bash
# 安装
cd webclone-skill && pnpm install

# Pi Agent 自动执行 Phase 0-5 完整流程
# 一句话即可：
#   "用 clone-website skill 克隆 https://fanyi.baidu.com"
```

或者安装为 Pi Skill：

```bash
cp -r webclone-skill ~/.pi/agent/skills/clone-website
# Pi 下次启动自动加载
```

---

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                     webclone-skill                           │
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │  web-clone   │   │  提取脚本     │   │  AI 代码生成   │  │
│  │   引擎        │──▶│  (13 个 JS)  │──▶│                │  │
│  │              │   │              │   │  HTML / Vue    │  │
│  │ 快照 + 代理  │   │ DOM · CSS    │   │                │  │
│  └──────────────┘   │ 交互 · 状态  │   │ ← SKILL.md     │  │
│         │           └──────────────┘   │ 驱动 AI Agent   │  │
│         ▼                              └────────────────┘  │
│  ┌──────────────┐                               │            │
│  │ ./snapshot/  │                               ▼            │
│  │ 静态页面     │                         ┌───────────┐     │
│  │ 资源文件     │                         │ ./output/ │     │
│  │ server.js    │                         │ 生成的代码 │     │
│  └──────────────┘                         └───────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  验证: pixel-diff.py 像素对比 + test-interactions.py   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 项目结构

```
webclone-skill/
├─ SKILL.md                    ← Pi Agent Skill 定义（启动自动加载）
├─ README.md / README_zh.md    ← 项目文档
│
├─ apps/cli/                   ← web-clone CLI 引擎
├─ packages/                   ← TypeScript monorepo
│  ├─ core/        ← 快照核心（抓取、解析、组装、转换）
│  ├─ codegen/     ← 框架代码生成（Vue/React/Angular/Svelte）
│  ├─ adapter-playwright/  ← Playwright 浏览器适配
│  ├─ adapter-puppeteer/   ← Puppeteer 浏览器适配
│  └─ adapter-common/      ← 共享工具
│
├─ scripts/
│  ├─ js/                       ← 深度提取脚本（13 个）
│  │  ├─ extract-structure-v2.js    DOM 树 + 定位 + 计算样式
│  │  ├─ extract-cssom.js           完整 CSSOM 遍历
│  │  ├─ extract-states-inventory.js 交互元素清单
│  │  ├─ extract-states-capture.js  hover/focus/active 状态 CSS 差异
│  │  ├─ extract-page-screenshot.js 全页截图（多视口）
│  │  ├─ extract-component-screenshot.js 组件截图
│  │  ├─ extract-links.js          链接提取
│  │  ├─ extract-shadow.js         Shadow DOM 遍历
│  │  ├─ extract-visual-v2.js      视觉语义分析
│  │  ├─ extract-lazy-load.js      懒加载检测
│  │  ├─ map-dom.js                DOM 映射
│  │  ├─ validate-extraction.js    提取结果校验
│  │  └─ generate-source.mjs       JSON 数据 → 独立 HTML/CSS/JS
│  ├─ python/
│  │  ├─ pixel-diff.py             像素级视觉对比（热力图）
│  │  └─ test-interactions.py     交互测试
│  └─ wrappers/                    ← CLI 包装器
│
├─ references/                     ← 详细命令文档
│  ├─ snapshot.md / inspect.md / query.md
│  ├─ codegen.md / verify.md
│  └─ INSPECTION_GUIDE.md
│
└─ templates/
   └─ nextjs-clone/               ← Next.js 项目模板
```

---

## 流程

| 阶段 | 步骤 | 工具 | 输入 | 输出 |
|------|------|------|------|------|
| 0 | 检查 | `pnpm build` | — | 构建通过 |
| 1 | 快照 | `pnpm dev:cli <URL> -o ./snapshot --serve` | 真实 URL | 静态页面 + :8080 代理 |
| 2 | 提取 | 13 个 `extract-*.js` 脚本 | `http://localhost:8080/` | 13 个 JSON 文件 |
| 3 | Spec | AI 写组件 `.spec.md` | JSON 数据 | 可审计的规范文件 |
| 4 | 生成 | `generate-source.mjs` 或 AI 写代码 | Spec + JSON | HTML/CSS/JS 或框架项目 |
| 5 | 验证 | `pixel-diff.py` | 原始 + 克隆截图 | 通过/不通过 + 热力图 |

**核心：** 所有提取都在本地快照（`:8080`）上运行，不碰外网。登录墙、反爬、限流全部绕过。

---

## 输出选项

| 选项 | 输出 | 适合 |
|------|------|------|
| A: 独立 HTML | 单个 `index.html` + `server.js` | 最快，零依赖 |
| B: Vue 3 | Vue 3 + TypeScript 项目 | 组件化应用 |
| C: Next.js | Next.js 项目 | 生产级全栈 |

---

## 要求

- Node.js >= 20
- pnpm >= 9
- Google Chrome
- Python 3（pixel-diff.py 用）

---

## 相关项目

- 引擎：[kkkqkx123/web-clone](https://github.com/kkkqkx123/web-clone)
- AI 提示词工程：[JCodesMore/clone-website](https://github.com/JCodesMore/ai-website-cloner-template)（已集成进 SKILL.md）