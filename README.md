# Just Todo 待办事项

> 🔀 **本仓库是 Fork**：在 `feature/tags` 分支为原版新增了「标签系统」。改动清单、实现目标与本机验证结果见 [关于本 Fork](#fork-notes)。

Just Todo 是一个轻量级、现代化的 uTools 待办事项插件。它提供了简洁的界面和丰富的功能，帮助你高效管理日常任务和工作计划。

## ✨ 主要功能

- **任务管理**：快速创建、编辑、删除和完成任务。
- **分类清单**：支持自定义清单分类（如工作、生活、学习等），并提供"我的一天"、"计划内"等智能视图。
- **任务详情**：支持为任务添加截止日期、优先级（高/中/低）和备注信息。
- **重复任务**：支持设置每天、每周、每月、每年等重复规则，自动生成后续任务。
- **视图切换**：
  - **列表视图**：经典的清单展示，支持拖拽排序。
  - **日历视图**：直观查看每月的任务分布情况。
- **排序与筛选**：支持按创建时间、截止时间、优先级等多种方式排序。
- **数据导出**：支持将待办事项导出为 Markdown 格式。
- **现代化 UI**：清爽的卡片式设计，支持暗色模式（跟随 uTools 主题）。
- **快捷操作**：支持右键菜单进行快速操作（删除、移动、复制内容等）。

> 以上为上游原版功能。本 Fork 新增的标签系统见下方「关于本 Fork」。

## 🛠️ 技术栈

- **前端框架**：[Vue 3](https://vuejs.org/)
- **构建工具**：[Vite](https://vitejs.dev/)
- **样式预处理**：Less
- **图标库**：[Remix Icon](https://remixicon.com/)
- **时间处理**：[Day.js](https://day.js.org/)
- **拖拽库**：[Vue.Draggable](https://github.com/SortableJS/vue.draggable.next)

## 💻 开发指南

### 环境要求

- Node.js (推荐 v16+)
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

启动本地开发服务器：

```bash
npm run dev
```

在 uTools 开发者工具中，将插件入口配置为 `http://localhost:5174` (或其他 Vite 分配的端口) 即可实时预览。

### 构建发布

构建生产环境代码：

```bash
npm run build
```

构建完成后，会在 `dist` 目录下生成插件文件。将 `dist` 目录下的内容（包含 `plugin.json`）打包成 `.upx` 文件即可发布。

> 注意：`plugin.json` 和 `preload/services.js` 等 uTools 配置文件放置在 `public/` 目录下，Vite 构建时会自动复制到 `dist` 目录。

## 📝 目录结构

```
Just Todo待办/
├── public/              # 静态资源 (logo, preload, plugin.json)
├── src/
│   ├── components/      # Vue 组件 (TodoList, CalendarView, TagInput 等)
│   ├── utils/           # 工具函数 (db.js 等)
│   ├── App.vue          # 主应用组件
│   ├── main.js          # 入口文件
│   └── main.css         # 全局样式
├── index.html           # HTML 模板
├── vite.config.js       # Vite 配置
└── package.json         # 项目依赖配置
```

<a id="fork-notes"></a>

## 🔀 关于本 Fork

### 来源与动机

| 项目 | 说明 |
|------|------|
| 上游 | uTools 插件中心「Just Todo待办」，开发者 GOLU，v1.0.5（已停止维护） |
| 本仓库 `master` | 保留上游原版代码（commit `a5a8e5b`） |
| 本仓库 `feature/tags` | 本 Fork 的改动分支（commit `0c143e2`） |

原版只有「清单 / 分类」这一个组织维度，一条待办只能归属一个清单。实际使用中经常需要**按项目、客户、状态等横向维度**给同一批待办打标、跨清单筛选或批量处理，单维度的清单无法表达。因此本 Fork 新增了与清单正交的**标签（Tag）**维度，没有改动原有的清单、日历、提醒、导出等功能。

### 改动清单

`master` → `feature/tags`：**8 个文件，+702 / -24 行**。

| 文件 | 改动 |
|------|------|
| `src/components/TagInput.vue` | **新增**：标签输入组件。chips 展示、输入建议下拉、Enter/逗号确认、Backspace 删除、按标签名 hash 分配颜色 |
| `src/App.vue` | 新增 `searchQuery` / `activeTag` / `multiSelectMode` / `multiSelectedIds` 状态与 `allTags` 计算属性；过滤管道同时支持标签与搜索；新增 `toggleMultiSelect` / `batchAddTags` / `batchRemoveTags`；右键菜单加入「管理标签」 |
| `src/components/Sidebar.vue` | 新增底部搜索框（匹配内容 / 描述 / 标签）与标签云区域（带计数、点击筛选、激活态） |
| `src/components/TaskModal.vue` | 集成 TagInput，`tags` 字段读写，新增 `allTags` prop |
| `src/components/TaskDrawer.vue` | 同上 |
| `src/components/TodoList.vue` | 待办项显示标签 chips（最多 3 个 + `+N`）；多选模式高亮与点击切换 |
| `src/utils/db.js` | 数据兼容：`getTodos` 为旧数据自动补 `tags: []`；`saveTodos` 统一去重、trim、过滤空字符串 |
| `package-lock.json` | `npm install` 产物 |

### 实现的功能

- 单条待办添加 / 编辑标签（新建弹窗与详情抽屉均支持）
- 输入时从已有标签中自动提示，避免同义标签散乱
- 侧边栏标签云按数量展示，点击筛选、再点取消
- 全局搜索：同时匹配任务内容、描述与标签
- 多选模式 + 批量添加 / 删除标签
- 右键菜单「管理标签」直达编辑
- 旧数据无缝兼容：升级后历史待办自动获得空标签数组，不丢数据

### 本机验证结果

验证时间 2026-11-17 ~ 11-18；环境 Windows / uTools **8.0.2.0** / Node.js 22 + Vite；插件版本标记为 **1.1.0**。

| 验证项 | 结果 |
|--------|------|
| `npm run build` | ✅ 通过 |
| 打包 `npx asar pack dist/` | ✅ 生成 6,125,181 字节 asar（MD5 `42a91da2ac92a8f9518fcef221c64934`），`plugin.json` version 1.1.0 |
| 安装到 uTools 8.0.2 | ✅ 插件容器 12 项齐全，`version = 1.1.0`，asar 被正常加载 |
| 界面渲染 | ✅ 侧栏「今日待办 / 计划 / 全部 / 优先级 / 已完成 / 我的列表 / 添加分类」正常；构建产物含「标签 / 筛选 / 输入标签 / 批量添加标签 / 管理标签」等新增文案（原版无） |
| 历史数据 | ✅ 原有 **28 条待办**、**12 个自定义清单**及设置全部保留；UI 显示「今日待办 3 / 全部 17 / 已完成 11」 |

**安装时的一个环境注意点**：uTools 8.x 用加密的 `installs` 注册表记录每个插件 asar 的 **MD5 指纹**，直接替换已安装插件的 asar 会因指纹不符被判定为非法插件、从插件列表消失。本机安装时通过 uTools 自身的插件管理接口同步了新指纹。因此建议通过插件开发者模式或插件市场安装，且在操作前备份 `%APPDATA%\uTools`。

### 复现

```bash
git checkout feature/tags
npm install
npm run build
npx asar pack dist/ Just-Todo-tags.asar
```

### 已知边界

- 标签系统目前仅在 **Windows + uTools 8.0.2** 完成构建、安装与数据验证；未在 macOS / Linux 或其他 uTools 版本测试。
- 上游已停止维护，故未提交 PR 回上游。

## 🤝 贡献

欢迎提交 Issue 或 Pull Request 来改进这个项目。

## 📄 许可证

MIT License
