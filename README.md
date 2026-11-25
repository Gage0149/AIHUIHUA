# 绘影 AIHUIHUA｜网站使用与内容维护手册

> **适用版本：2026-11-25 · GitHub Pages 静态部署版**
> 本手册根据当前仓库的真实文件、字段和页面行为编写，面向以后长期维护分类、AI 绘画提示词、画廊、作品及外链图片的站长。

**常用入口：** [正式网站](https://gage0149.github.io/AIHUIHUA/) · [内容管理页面](https://gage0149.github.io/AIHUIHUA/manage.html) · [GitHub 仓库](https://github.com/Gage0149/AIHUIHUA) · [详细维护说明](CONTENT_GUIDE.md)

本项目基于开源 [PoseWear](https://github.com/atuizz/posewear) 改造。网页为纯静态 HTML/CSS/JavaScript；图片通过外部 HTTPS 链接加载，分类和提示词主要保存在 JSON 文件中。**不需要单独的服务器、数据库、Node.js 构建流程或后端部署。**

## 目录

- [1. 先看这几条：最重要的规则](#1-先看这几条最重要的规则)
- [2. 网站有什么页面、数据怎么流转](#2-网站有什么页面数据怎么流转)
- [3. 仓库文件结构与作用](#3-仓库文件结构与作用)
- [4. 需求速查：改哪个文件](#4-需求速查改哪个文件)
- [5. 推荐方式：用管理页面编辑并发布](#5-推荐方式用管理页面编辑并发布)
- [6. 给「画廊」增加图片、提示词和 TAG](#6-给画廊增加图片提示词和-tag)
- [7. 给「作品」增加图片及新的二级筛选](#7-给作品增加图片及新的二级筛选)
- [8. 给「提示词」新增独立一级菜单和二级图库](#8-给提示词新增独立一级菜单和二级图库)
- [9. 在「环境与物件」下增加自定义图库](#9-在环境与物件下增加自定义图库)
- [10. 修改原有 12 个提示词图库](#10-修改原有-12-个提示词图库)
- [11. 使用自己的 K-Vault / R2 图床与批量迁移](#11-使用自己的-k-vault--r2-图床与批量迁移)
- [12. R18 开关：新内容如何标记](#12-r18-开关新内容如何标记)
- [13. JSON 编写规则：尤其是长提示词](#13-json-编写规则尤其是长提示词)
- [14. 页面文字、菜单和视觉样式在哪里改](#14-页面文字菜单和视觉样式在哪里改)
- [15. GitHub Pages 发布与更新检查](#15-github-pages-发布与更新检查)
- [16. 常见故障与解决方法](#16-常见故障与解决方法)
- [17. 备份、回退与安全注意事项](#17-备份回退与安全注意事项)
- [18. 每次发布前的检查清单](#18-每次发布前的检查清单)

---

## 1. 先看这几条：最重要的规则

1. **只增加画廊或作品的图片**：优先打开[内容管理页面](https://gage0149.github.io/AIHUIHUA/manage.html)，编辑后导出 JSON；无需修改 `app.js` 或 `index.html`。
2. **画廊、作品新增二级筛选按钮**：在图片数据里写新的 `subcategory`，系统会自动发现。若要单独设置分类标题的 R18 可见性，再编辑 `gallery/categories.json` 的 `collectionFilters`。
3. **提示词页面新增一级菜单/子图库**：使用管理页面「分类配置」，或者同时修改 `gallery/categories.json`、新建对应的 `gallery/xxx.json`。
4. **内容管理页面不等于在线数据库**：点击「保存当前条目」只保存到当前浏览器编辑会话；**必须下载 ZIP、解压、把 JSON 上传到 GitHub 并提交**，正式网站才会更新。
5. **图片文件不必放进 GitHub**：先上传到 K-Vault、Cloudflare R2 等图床，在 JSON 中填写可公开访问的 HTTPS 图片直链。
6. **手工修改长提示词时必须注意 JSON 换行格式**：JSON 字符串中不能直接输入裸换行，应该写 `\n`；使用管理页面普通文本框则可以直接回车换行。
7. **R18 不是权限保护**：关闭开关只是网页隐藏对应记录，公开 JSON 和公开图片直链仍能被访问。

## 2. 网站有什么页面、数据怎么流转

| 页面 | 网页入口 | 主要功能 | 数据来源 |
| --- | --- | --- | --- |
| 首页 | `/#home` | 全屏背景图、网站标题、「探索 AI」跳转 | `index.html`、`style.css` |
| 提示词 | `/#pose` 等 | 姿势、服装、人物造型、环境与物件、自定义图库 | 仓库根目录的原始 JSON；`gallery/categories.json` 与自定义 JSON |
| 画廊 | `/#gallery` | 收藏的 AI 绘画图像与提示词，瀑布流展示 | `gallery/gallery.json` |
| 作品 | `/#works` | 自己生成的 AI 绘画作品，瀑布流展示 | `gallery/works.json` |
| 内容管理 | `/manage.html` | 编辑分类、图片地址、提示词、R18，批量换图床、导出 | 读取以上 JSON；编辑不会自动回写 GitHub |

实际发布流程：

```text
K-Vault / R2 上传图片 → 得到 HTTPS 直链
                         ↓
             内容管理页面填写图片与提示词
                         ↓
                 保存 → 下载 ZIP
                         ↓
             解压并上传 JSON 到 GitHub
                         ↓
             提交 main → GitHub Pages 发布
                         ↓
              正式网页读取新的 JSON 内容
```

两个网页都部署在同一套 GitHub Pages 文件中；`manage.html` **不需要单独部署**。当前没有自动发布接口，也不要把 GitHub Token 写在公开网页中。

## 3. 仓库文件结构与作用

下面只列出日常维护中最重要的文件；实际仓库还有图标、PWA 和工作台相关文件。

```text
AIHUIHUA/                       ← GitHub 仓库根目录
├── README.md                   ← 本使用手册（GitHub 首页显示）
├── CONTENT_GUIDE.md            ← 辅助维护说明
├── index.html                  ← 首页、主导航、画廊/作品详情弹窗
├── style.css                   ← 前台排版、主题与弹窗样式
├── site-shell.js               ← 首页/画廊/作品路由、瀑布流和弹窗逻辑
├── app.js                      ← 提示词图库加载、筛选、动态分类菜单
├── manage.html                 ← 内容管理页面结构
├── manage.css                  ← 内容管理页面样式
├── manage.js                   ← 分类/图片编辑、图床替换、JSON 导出
├── zip.js                      ← ZIP 下载功能
├── sw.js                       ← 网站离线缓存与更新
├── poses.json                  ← 原有「姿势」数据
├── depths.json                 ← 原有「深度姿势」数据
├── costumes.json               ← 原有「服装」数据
├── anime.json                  ← 原有「动画服装」数据
├── portraits.json              ← 原有「人像」数据
├── expressions.json            ← 原有「表情」数据
├── hair.json                   ← 原有「发型」数据
├── dynasties.json              ← 原有「历代服饰」数据
├── scenes.json                 ← 原有「场景」数据
├── lights.json                 ← 原有「光影」数据
├── props.json                  ← 原有「道具」数据
├── furniture.json              ← 原有「家具」数据
└── gallery/
    ├── categories.json         ← 提示词菜单 + 画廊/作品分类 R18 规则
    ├── gallery.json            ← 独立「画廊」页面的图片数据
    ├── works.json              ← 独立「作品」页面的图片数据
    ├── inspiration.json        ← 已有「场景灵感·示例」子图库
    ├── furniture.json          ← 已有「家具参考·示例」子图库
    └── composition.json        ← 示例：以后新增的「摄影构图」数据文件
```

> 上面 `gallery/composition.json` **仅为示例位置**，不是当前仓库已经存在的文件；只有实际新增该分类时才需要创建。根目录 `furniture.json` 与 `gallery/furniture.json` 是两个不同用途的文件，不要混淆。

### 各类代码什么时候需要动？

- **只新增图片和提示词**：改 JSON 即可，通常不用改网页代码。
- **只新增提示词一级/二级图库**：配置 JSON + 新图库 JSON，通常不用改 HTML/CSS/JS。
- **调整首页标题/背景、顶栏主导航**：改 `index.html`，必要时配合 `site-shell.js` / `style.css`。
- **改变画廊的瀑布流布局或弹窗**：涉及 `style.css`、`site-shell.js`，弹窗结构在 `index.html`。
- **改变原提示词库的数据规则或筛选逻辑**：可能涉及 `app.js`，不建议在日常加图时修改。

## 4. 需求速查：改哪个文件

| 想实现的操作 | 最主要的修改位置 | 是否需要修改前台代码 |
| --- | --- | --- |
| 画廊增加一张图片 | `gallery/gallery.json` | 否 |
| 作品增加一张图片 | `gallery/works.json` | 否 |
| 画廊增加「艺术」「人物写真」筛选 | 图片记录的 `subcategory` | 否 |
| 作品增加「电影感」筛选 | 图片记录的 `subcategory` | 否 |
| 画廊/作品增加 TAG | 图片记录的 `tags` 数组 | 否 |
| 单独控制画廊/作品二级分类标题的 R18 | `gallery/categories.json` 的 `collectionFilters` | 否 |
| 增加中文或英文提示词 | `prompt_zh` / `prompt_en` | 否 |
| 增加独立的提示词一级菜单 | `gallery/categories.json` 的 `groups` | 否 |
| 在一级菜单下增加二级图库 | `gallery/categories.json` 的 `categories` + 新 JSON | 否 |
| 在「环境与物件」下增加子图库 | `gallery/categories.json` 中不填 `group` + 新 JSON | 否 |
| 给新增素材设置 R18 | 新图库记录的 `adult` 或原图库记录的 `a` | 否 |
| 替换图片图床链接 | 图片 JSON 的图片字段，或管理页面「图床迁移」 | 否 |
| 修改首页背景图/主文案 | `index.html` | 是 |
| 修改画廊/作品卡片列数 | `site-shell.js` + `style.css` | 是 |
| 修改详情弹窗折叠高度/视觉 | `style.css`、必要时 `site-shell.js` | 是 |
| **增加与首页/提示词/画廊/作品平级的主导航** | `index.html` + `site-shell.js` + `style.css` | **是，属于功能开发** |

## 5. 推荐方式：用管理页面编辑并发布

打开：[**AIHUIHUA 内容管理中心**](https://gage0149.github.io/AIHUIHUA/manage.html)。

### 5.1 四个管理标签的用途

| 管理标签 | 主要操作 |
| --- | --- |
| **01 分类配置** | 新建/重命名/调整自定义提示词菜单；另可单独设置画廊/作品二级分类标题的 R18 |
| **02 图片与提示词** | 选择图库、搜索、编辑图片直链和文字；为画廊/作品/自定义图库新增、复制、删除条目 |
| **03 图床迁移** | 预览或批量替换旧域名/路径，也可用旧 URL → 新 URL 精确映射 |
| **04 导出与部署** | 下载本次修改 ZIP，或下载当前图库 JSON，并查看需要上传的文件列表 |

注意几个界面规则：

1. 每编辑完一张图片，要点 **「保存当前条目」**；否则不能直接导出尚未保存的表单。
2. 左上角「**N 个文件待导出**」是本次修改的文件数量，不代表已经发布。
3. 导出完成以后仍然要在 GitHub 提交。**未导出前不要刷新/关闭管理页面**，否则可能丢失本次浏览器中的修改。
4. 管理页面允许编辑原有 12 个提示词图库中的现有记录，但为了不破坏原仓库的数据结构，**不允许直接在这些原图库中新建或删除记录**；如要新增内容，请建自定义图库。
5. 在「高级：直接编辑该条目的 JSON」中，需要粘贴**单个对象** `{ ... }`；在 `gallery/gallery.json` 这样的**完整文件**中，外层通常是数组 `[ { ... }, ... ]`。

### 5.2 一次完整发布的具体步骤

1. 在管理页面完成分类、图片或提示词编辑，逐条点击保存。
2. 打开「04 导出与部署」，核对「本次待发布的文件」。
3. 点击 **「下载本次修改 ZIP」**，将下载到的文件先保存为本地备份。
4. **解压 ZIP**，注意保留文件夹结构。ZIP 里的 `更新说明.txt` 只是说明，不需要上传为数据文件。
5. 打开 [GitHub 仓库](https://github.com/Gage0149/AIHUIHUA)，确保当前分支是 `main`。
6. **严格按 ZIP 中的相对路径上传或覆盖 JSON**。例如 `gallery/gallery.json` 上传至仓库 `gallery/` 文件夹；`poses.json` 上传至仓库根目录。
7. 点击 `Commit changes` 提交（例如提交说明填写「新增摄影构图图片」）。
8. 等待 GitHub Pages 重新发布，打开[正式网站](https://gage0149.github.io/AIHUIHUA/)确认分类、图片、提示词、R18 是否正确。

**绝对不要只把 ZIP 压缩包上传到仓库！** GitHub Pages 不会替你把 ZIP 解压成网站需要的 JSON 文件。

### 5.3 上传目录的对应关系

| ZIP 解压后的相对路径 | 应放到 GitHub 哪儿 |
| --- | --- |
| `gallery/categories.json` | 仓库的 `gallery/` 文件夹 |
| `gallery/gallery.json` | 仓库的 `gallery/` 文件夹 |
| `gallery/works.json` | 仓库的 `gallery/` 文件夹 |
| `gallery/composition.json` | 仓库 `gallery/` 下新建/更新 `composition.json` |
| `poses.json`、`costumes.json` 等 | **仓库根目录**，不在 `gallery/` 内 |

GitHub 网页端通常可以在目标目录点击 `Add file → Upload files` 上传；遇到同名文件冲突时，打开原文件用编辑按钮修改，或者使用 GitHub Desktop 等方式提交。不要把 `gallery/gallery.json` 错传成 `gallery/gallery/gallery.json`。

## 6. 给「画廊」增加图片、提示词和 TAG

**推荐：** 管理页面 →「02 图片与提示词」→「画廊」→「新增图片」。先从你的 K-Vault/R2 复制图片直链，在普通文本框中录入多行中文/英文提示词、分类和 TAG，保存后导出。

如果选择手动修改文件，打开：[**gallery/gallery.json**](gallery/gallery.json)。当前主画廊中的每张图片是一个 JSON 对象，整个文件是对象数组。

### 6.1 可以复制的单张图片模板

以下是一份**完整单条记录的示例**（地址需要换成你自己的真实图片直链）：

```json
{
  "id": "gallery-0002",
  "title": "午后庭院人像",
  "subcategory": "艺术",
  "image": "https://img.example.com/gallery/0002.webp",
  "description": "温暖阳光下的东方庭院人像参考",
  "prompt_zh": "主体：\n一位成年东方女性，站在阳光明媚的庭院中。\n\n构图：\n竖版 3:4，全身摄影。",
  "prompt_en": "An adult woman in a sunlit courtyard, full-body portrait, vertical 3:4 composition.",
  "adult": false,
  "tags": ["人像", "艺术", "庭院", "自然光"]
}
```

添加到现有数组时，需要用英文逗号分隔对象，例如：

```json
[
  {"id": "gallery-0001", "title": "第一张", "subcategory": "人像", "image": "https://img.example.com/1.webp", "prompt_zh": "示例", "adult": false, "tags": []},
  {"id": "gallery-0002", "title": "第二张", "subcategory": "艺术", "image": "https://img.example.com/2.webp", "prompt_zh": "示例", "adult": false, "tags": ["艺术"]}
]
```

第二段仅为**说明数组语法的示例**，不能覆盖你已经收集的数据。新增时应在原来的数组中追加一项，并保留旧内容。

### 6.2 常用字段解释

| 字段 | 用途 | 建议/规则 |
| --- | --- | --- |
| `id` | 图片唯一编号 | 同一文件中不能重复，例 `gallery-0002` |
| `title` | 瀑布流卡片及弹窗标题 | 建议简洁、可搜索 |
| `subcategory` | 画廊的二级筛选分类 | 例「艺术」「人物写真」「风景摄影」 |
| `image` | **画廊卡片和详情弹窗实际显示的主图地址** | 填可访问的 HTTPS 图片直链 |
| `thumbnail` | `image` 缺失时的备用主图地址 | 可不填 |
| `description` | 可选的图片介绍 | 不需要时可用空字符串或省略 |
| `prompt_zh` | 中文完整提示词 | 支持长文本；手写 JSON 时用 `\n` 换行 |
| `prompt_en` | 英文完整提示词 | 可为 `""`，空时不显示英文区块 |
| `adult` | R18 标记 | `true` 表示关闭 R18 时隐藏，`false` 表示正常显示 |
| `tags` | 弹窗下方 TAG 标签及搜索关键词 | 必须是数组，如 `["人像", "胶片"]` |
| `demo` | 示例素材提示 | `true` 时卡片显示「示例 · 可替换」，正式素材可省略 |

> 注意：目前画廊/作品的弹窗使用 `image`（若缺失则使用 `thumbnail`）作为显示图片和「查看原图」链接。即使数据中另有 `preview`、`original`，**主画廊详情弹窗暂不会自动改用它们**。更换主图时请优先改 `image`。

### 6.3 长中文/英文提示词如何显示？

- 画廊、作品卡片里只显示简短摘要。
- 点击图片进入详情弹窗，中文和英文提示词分别有边框和高度限制；长内容默认约显示前 5 行。
- 点击「展开全文」后，在该提示词框内滚动阅读；点击「收起内容」恢复预览。
- TAG 和底部操作按钮不会因为某段提示词非常长而无限向下移动。
- 当前「复制提示词」按钮复制**完整中文提示词**；没有中文时复制完整英文提示词。不会复制图片 URL，也不会只复制折叠后可见的文字。

### 6.4 画廊新增二级分类，只改 `subcategory`

例如想出现「东方美学」，把某张记录的 `subcategory` 字段设为：

```text
"subcategory": "东方美学"
```

网页会根据**全部图片**（包括暂时被 R18 隐藏的图片）的 `subcategory` 自动发现分类。普通分类即使目前只有一种、即使该分类里的图片全部被 R18 隐藏，筛选按钮也会正常显示。要让某个分类标题**只在 R18 开启时显示**，请在管理页面「01 分类配置 → 画廊 / 作品 · 二级分类可见性」单独标记该分类。

**`subcategory` 和 `tags` 不相同：** `subcategory` 决定顶部二级筛选按钮，`tags` 是图片详情弹窗中的多个标签和搜索关键词。两张图片拥有相同 TAG，并不等于它们必然属于同一个 `subcategory`。

## 7. 给「作品」增加图片及新的二级筛选

数据文件：[**gallery/works.json**](gallery/works.json)。编辑方式和画廊一致，但建议只存放**你自己使用 AI 生成的作品**。

示例：

```json
[
  {
    "id": "work-0001",
    "title": "夜色旅人",
    "subcategory": "电影感",
    "image": "https://img.example.com/works/night-traveler.webp",
    "description": "AI 生成的电影感夜景作品",
    "prompt_zh": "雨后的城市夜景，一位成年旅人站在霓虹灯下，电影摄影质感。",
    "prompt_en": "A traveler under neon lights after the rain, cinematic photography.",
    "adult": false,
    "tags": ["电影感", "夜景", "人物"]
  }
]
```

如果 `works.json` 目前是 `[]`，可以把**整个数组示例**当作起点，再替换图片地址和内容；如果已有作品，应追加对象、保留旧数据。

要增加「国风」「插画」「写实」等分类，在不同记录的 `subcategory` 中直接填写即可。作品的 TAG 同样显示在详情弹窗中。

## 8. 给「提示词」新增独立一级菜单和二级图库

**重要区分：** 此处是**提示词页面内部**的一级下拉菜单和二级图库，不会把新菜单加到顶栏的「首页｜提示词｜画廊｜作品」旁边。

### 8.1 推荐：使用管理页面（无需写代码）

假设希望新增「摄影技巧 → 摄影构图」：

1. 管理页面 →「01 分类配置」。
2. 在「新增一级菜单」填写名称 **摄影技巧**、英文 ID **`photography`**，点击「保存一级菜单」。
3. 在「二级图库」填写名称 **摄影构图**、ID **`composition`**、所属一级菜单 **摄影技巧**、文件位置 **`/gallery/composition.json`**。
4. 点击「保存二级图库」。
5. 进入「02 图片与提示词」，选择新建的 **摄影构图**，点击「新增图片」并逐张保存。
6. 进入「04 导出与部署」下载 ZIP。确保解压后包含 `gallery/categories.json` **和** `gallery/composition.json`。
7. 将两个文件上传到 GitHub 对应位置并提交。刷新网站，在「提示词」区域查看新菜单。

只有一级菜单、没有任何二级图库时，该一级菜单不会在正式网站显示。

### 8.2 手动编辑 JSON 的方法

打开：[**gallery/categories.json**](gallery/categories.json)。格式如下：

```json
{
  "groups": [
    {"id": "photography", "name": "摄影技巧"}
  ],
  "categories": [
    {
      "id": "composition",
      "name": "摄影构图",
      "group": "photography",
      "file": "/gallery/composition.json",
      "count": 1,
      "suggestions": ["三分法", "对称构图"]
    }
  ]
}
```

**这只是结构示例，不要整段覆盖当前的 `categories.json`！** 正式修改时应保留文件中现有的 `categories`，只向 `groups` 和 `categories` 数组追加新对象。

字段解释：

| 配置字段 | 含义 |
| --- | --- |
| `groups[].id` | 一级菜单内部 ID，小写英文、数字、`-`，不能重复 |
| `groups[].name` | 一级菜单显示名称 |
| `categories[].id` | 二级图库内部 ID，不能与其他子图库重复 |
| `categories[].name` | 二级图库显示名称 |
| `categories[].group` | 所属一级菜单 ID；不写则归入默认的「环境与物件 → 自定义图库」 |
| `categories[].file` | 对应的 JSON 数据路径，必须在 `gallery/` 下，以 `.json` 结尾 |
| `categories[].count` | 菜单里显示的参考数量，建议与实际记录数一致；管理页面保存自定义图库内容时会更新 |
| `categories[].suggestions` | 搜索建议数组，可为空数组 |

然后在仓库的 [`gallery/`](gallery/) 目录中**新建** `composition.json`（完整路径为 `gallery/composition.json`），内容例如：

```json
[
  {
    "id": "composition-001",
    "title": "三分法构图",
    "subcategory": "人物构图",
    "image": "https://img.example.com/composition/001.webp",
    "prompt_zh": "人物位于画面右侧三分线，自然光，浅景深。",
    "prompt_en": "Rule of thirds, subject on the right third, natural light, shallow depth of field.",
    "adult": false,
    "tags": ["构图", "三分法"]
  }
]
```

路径必须严格一致：配置写 `/gallery/composition.json`，仓库里就必须真的有 `gallery/composition.json`。只添加配置不添加数据文件，会造成加载失败。

**不要删除当前 `categories.json` 里已有的 `id: "gallery"` 配置**；它是保留的兼容条目，并不表示画廊页面的 `subcategory` 筛选也要在这里维护。

### 8.3 重命名、排序、删除自定义分类

- **改显示名称**：在管理页面点击对应项目再编辑名称，或手动修改 `name`；一般无需更改 ID/文件名。
- **调整顺序**：使用管理页面的上/下箭头，最后导出 `categories.json`。
- **删除一级菜单**：管理页面会把原来属于它的二级图库移回默认「环境与物件」，**不会删除图片**。
- **从菜单移除二级图库**：只移除 `categories` 配置；已上传到 GitHub 的 JSON 文件**不会自动删除**。
- **不要轻易改 ID 和文件路径**：可能影响收藏、链接和其他数据引用；建议新建分类并逐步迁移，而不是直接改已投入使用的 ID。

## 9. 在「环境与物件」下增加自定义图库

如果不需要新一级菜单，只想沿用「提示词 → 环境与物件 → 自定义图库」，可以：

1. 管理页面 →「01 分类配置」→「二级图库 → 新建」。
2. 「所属一级菜单」选 **环境与物件（默认）**。
3. 填写图库名称、英文 ID、`/gallery/你的文件名.json`。
4. 在「02 图片与提示词」里为该图库新增图片。
5. 导出两个 JSON 文件并提交 GitHub。

手动写配置时，**不需要 `group` 字段**：

```json
{
  "id": "lighting-reference",
  "name": "布光参考",
  "file": "/gallery/lighting-reference.json",
  "count": 1,
  "suggestions": ["逆光", "侧光"]
}
```

把这个对象追加到 `gallery/categories.json` 的 `categories` 数组中，并创建对应的 `gallery/lighting-reference.json`。注意这里的「布光参考」属于**新自定义图库**；并不是在原来的 `lights.json` 中增加数据。

## 10. 修改原有 12 个提示词图库

它们是原始 PoseWear 风格的固定图库，与新建的 `gallery/*.json` **数据格式可能不同**。建议只用管理页面编辑现有记录，避免破坏原有筛选、视角、关联内容。

| 提示词菜单 | 子项 | 原始 JSON 路径 |
| --- | --- | --- |
| 姿势 | 姿势 | [`poses.json`](poses.json) |
| 姿势 | 深度姿势 | [`depths.json`](depths.json) |
| 服装 | 服装 | [`costumes.json`](costumes.json) |
| 服装 | 动画服装 | [`anime.json`](anime.json) |
| 服装 | 历代服饰 | [`dynasties.json`](dynasties.json) |
| 人物造型 | 人像 | [`portraits.json`](portraits.json) |
| 人物造型 | 表情 | [`expressions.json`](expressions.json) |
| 人物造型 | 发型 | [`hair.json`](hair.json) |
| 环境与物件 | 场景 | [`scenes.json`](scenes.json) |
| 环境与物件 | 光影 | [`lights.json`](lights.json) |
| 环境与物件 | 道具 | [`props.json`](props.json) |
| 环境与物件 | 家具 | [`furniture.json`](furniture.json) |

### 10.1 原图库常见字段

| 字段 | 一般用途 |
| --- | --- |
| `id`、`no` | 素材唯一 ID、显示编号 |
| `ti` | 标题（部分图库使用） |
| `zh`、`en` | 中文、英文提示词/描述 |
| `cat`、`sec` 等 | 原始分类字段（不同图库不同） |
| `t` | 缩略图 URL |
| `m` | 中图/预览图 URL |
| `i` | 高清图 URL |
| `o` | 原图 URL |
| `angles` | 多视角数组，数组内也可能包含 `t` / `i` / `o` |
| `a` | 成人向标记，`true` 时受 R18 开关过滤 |

例如有些「姿势」「表情」记录不是一张图，而是：

```json
{
  "id": "pose-demo",
  "cat": "坐姿",
  "zh": "坐姿参考",
  "en": "sitting pose reference",
  "a": false,
  "angles": [
    {"zh": "正面", "t": "https://img.example.com/p/front-thumb.webp", "i": "https://img.example.com/p/front.webp", "o": "https://img.example.com/p/front.png"},
    {"zh": "侧面", "t": "https://img.example.com/p/side-thumb.webp", "i": "https://img.example.com/p/side.webp", "o": "https://img.example.com/p/side.png"}
  ]
}
```

这里只是字段示意，不是要求你覆盖原始数据。特别地，`depths.json` 是包含 `pack` 等元信息及 `items` 数组的对象，不要误改成普通数组；管理页面会保留它的原始外层结构。

### 10.2 最安全的修改方法

1. 打开管理页面 →「02 图片与提示词」。
2. 在「选择图库」里选择「原图库 · 姿势」等。
3. 使用搜索框按编号或标题定位条目。
4. 修改对应缩略图、高清图、原图或各个视角的图片地址；需要时编辑中文、英文描述及 R18。
5. 点击「保存当前条目」，导出 JSON，并上传到仓库**根目录**。

在原始图库中擅自增加或重命名 `id`、删除 `angles`、删掉外层元信息，可能造成关联、收藏或多视角显示异常。

## 11. 使用自己的 K-Vault / R2 图床与批量迁移

### 11.1 图片应该存放在哪里？

推荐将**实际图片文件**上传到你已经搭建的 K-Vault / Cloudflare R2；网页仓库只保存链接和文字。

建议自己在图床中按类型组织：

```text
gallery/          ← 收藏的画廊参考图
works/            ← 自己生成的作品
composition/      ← 摄影构图图库
poses/            ← 逐步迁移的姿势参考
costumes/         ← 逐步迁移的服装参考
```

这些只是**建议的图床路径**，不代表需要在 GitHub 仓库中创建同名图片文件夹。

### 11.2 复制什么链接？

- 使用打开后**直接显示图片**的完整 HTTPS 直链，而不是 K-Vault 后台管理页 URL。
- 在无痕浏览器中测试链接，确认不依赖登录状态。
- 确认链接没有短时间到期的限制；带签名的图片地址需要核实是否长期有效。
- 对大陆用户还应检查实际访问速度及可达性；HTTPS 和正确的域名不能保证所有网络都能正常加载。
- 如果有独立缩略图和原图，优先给原提示词库的 `t`、`m`、`i`、`o` 等字段填对应分辨率的 URL。

### 11.3 少量图片：逐条修改

管理页面 →「02 图片与提示词」→ 选择图库 → 搜索条目 → 修改图片地址 → 保存 → 导出。

### 11.4 大量图片：图床迁移

管理页面 →「03 图床迁移」，选中目标图库后可以：

**方式一：替换 URL 前缀**

```text
旧地址前缀：https://old.example.com/poses/
新地址前缀：https://img.example.com/poses/
```

先点击「预览可替换数量」，确认每张对应的图片确实上传到新图床后，再点击「应用前缀替换」。

**方式二：精确映射（图片重命名、目录不同）**

```json
{
  "https://old.example.com/a001.webp": "https://img.example.com/poses/001.webp",
  "https://old.example.com/a002.webp": "https://img.example.com/poses/002.webp"
}
```

批量迁移只检查图片字段：`image`、`thumbnail`、`preview`、`original`、`t`、`m`、`i`、`o`，包括 `angles` 等嵌套对象里的对应字段。**不会自动下载、搬运图片，不会修改提示词正文中的网址，也不会主动删除旧图片**。

### 11.5 怎样让网站彻底不再读取旧图床？

1. 先把有权使用的旧素材真实上传到自己的图床。
2. 对所有相关图库逐个替换图片字段，并导出对应 JSON。
3. 提交到 GitHub，部署后打开页面检查。
4. 在浏览器开发者工具 `F12 → Network → Img` 查看是否仍请求旧域名。
5. 不要因为一份 JSON 已改好就直接删除旧素材：先确认首页背景、其他图库、角度图和缩略图都不再引用它。

老仓库中可能仍有外部图源。即使你替换了画廊图片，也不会自动替换原 `poses.json`、`costumes.json` 等文件中的第三方链接。

## 12. R18 开关：新内容如何标记

顶部 R18 开关在首页、提示词、画廊、作品之间共用同一状态，默认关闭；当前浏览器会记住你的开关选择。

### 12.1 图片 R18：单张图片自己控制

| 内容位置 | 成人向字段 | 示例 | 关闭 R18 后 |
| --- | --- | --- | --- |
| 画廊 `gallery/gallery.json` | `adult` | `"adult": true` | 该图片隐藏 |
| 作品 `gallery/works.json` | `adult` | `"adult": true` | 该图片隐藏 |
| 新建自定义提示词图库 | `adult` | `"adult": true` | 该素材隐藏 |
| 原有 12 个提示词图库 | `a` | `"a": true` | 该素材隐藏 |

管理页面统一提供「R18 成人向」复选框，会按图库类型写成正确字段。自定义提示词图库的前台还兼容 `a`、`r18`、`nsfw` 等标记；画廊/作品前台兼容 `adult`、`r18`、`nsfw`。

### 12.2 画廊/作品二级分类标题 R18：与图片完全分开

进入管理页面 **「01 分类配置 → 画廊 / 作品 · 二级分类可见性」**：

1. 选择管理「画廊」还是「作品」。
2. 点击已有分类（例如「艺术」「性感」），或新建一个分类名称。
3. 勾选「仅在开启 R18 时显示这个分类按钮」，即可设置分类自身的 NSFW 状态；不勾选即为普通分类。
4. 点击「保存分类规则」，到「04 导出与部署」下载 `gallery/categories.json` 并提交 GitHub。

对应的数据保存在 **`gallery/categories.json` 的 `collectionFilters`**，例如：

```json
{
  "collectionFilters": {
    "gallery": [
      {"name": "艺术", "adult": false},
      {"name": "性感", "adult": true}
    ],
    "works": [
      {"name": "成人写真", "adult": true}
    ]
  }
}
```

**以上只展示 `collectionFilters` 的结构：手动修改时必须把它合并到现有 `categories.json`，保留原来的 `groups` 和 `categories`；不能直接整段覆盖整个文件。**

两套开关分别决定：

| 分类自身 `adult` | 图片自身 `adult` | R18 关闭时 | R18 开启时 |
| --- | --- | --- | --- |
| `false` | `false` | 分类按钮和图片都显示 | 都显示 |
| `false` | `true` | **分类按钮仍显示**，该图片隐藏 | 都显示 |
| `true` | `false` | **分类按钮隐藏**，但这张非成人图片仍可在「全部」中看到 | 都显示 |
| `true` | `true` | 分类按钮和图片都隐藏 | 都显示 |

**分类配置不会自动修改图片的 R18 标记；图片的 R18 标记也不会自动决定分类按钮是否显示。** 未配置的分类默认始终显示；当一个分类没有当前可见的图片时，点击它会显示空状态，而不是偷偷隐藏分类按钮。

这个 `collectionFilters` 只用于独立的「画廊」「作品」页面筛选按钮；提示词页面的独立一级/二级菜单仍由 `groups` / `categories` 控制，不会因为在这里写 `adult` 就自动变成受限菜单。

R18 不提供私密访问保护；不应把需要真正保密的图片/提示词放在公开的 GitHub Pages JSON 或公开图床中。

## 13. JSON 编写规则：尤其是长提示词

这是目前最容易导致「画廊内容读取失败」的问题。

### 13.1 直接换行会让 JSON 无效

**错误：**

```text
"prompt_zh": "主体：
一位成年女性……

构图：
竖版人像……"
```

上面的示例刻意展示错误格式：**双引号之间有实际换行**，JSON 解析会失败。

**正确：**

```json
{
  "prompt_zh": "主体：\n一位成年女性……\n\n构图：\n竖版人像……"
}
```

管理页面的普通「中文提示词」文本框可以直接按 Enter 换行；导出时由 `JSON.stringify` 自动处理，不必手动添加反斜杠。

### 13.2 其他常见语法问题

- JSON 对象的字段之间要有英文逗号 `,`，**最后一个字段后面不要多加逗号**。
- 字符串要使用英文双引号 `"`，不是中文引号 `“”` 或单引号。
- 提示词中若确实出现英文双引号，手写 JSON 时要使用 `\"` 转义。
- `adult` 是布尔值 `true` / `false`，**不是** `"true"` / `"false"` 字符串。
- `tags` 必须是数组：`["人像", "艺术"]`，不能随便写成无引号的文字。
- `id` 不能在同一个图库文件里重复。
- `gallery/gallery.json`、`gallery/works.json` 等完整文件应保持合法数组 `[]`；原 `depths.json` 属于含有 `items` 的对象结构，不能一概套用。
- 在 GitHub 编辑已有文件时，**不要误将原来的多条记录全部覆盖为一条**。

如果电脑安装了 Node.js，可在仓库根目录执行以下只读语法检查（把文件名换成你正在修改的 JSON）：

```bash
node -e "JSON.parse(require('fs').readFileSync('gallery/gallery.json','utf8')); console.log('JSON 格式正确')"
```

如果没有 Node.js，也可以直接使用管理页面的普通表单编辑，尽量减少手写 JSON 的需求。

## 14. 页面文字、菜单和视觉样式在哪里改

一般内容更新不用动这些文件；以下只适合需要修改页面布局、文案时使用。

### 14.1 首页背景、标题、按钮

文件：[`index.html`](index.html)。搜索这些内容：

```html
<img class="home-photo" src="https://你的背景图直链" ...>
<h1 id="homeTitle">探索 AI 摄影与视觉叙事的边界</h1>
<a class="home-cta" href="#pose">探索 AI</a>
```

上面省略号 `...` 是**定位说明**，不是可以直接复制覆盖的完整 HTML。实际修改时只改对应 `src` 或文字，保留其他属性即可。首页推荐使用宽幅、高分辨率背景图。首页布局的 CSS 在 `style.css` 中搜索 `.page-home`、`.home-photo`、`.home-content`、`.home-cta`。

### 14.2 主导航「首页 / 提示词 / 画廊 / 作品」

文件 `index.html` 中搜索 `.site-main-nav` 和 `data-view-link`。当前路由由 `site-shell.js` 的 `viewForHash()` / `sync()` 管理，同时 `style.css` 根据 `body[data-view=...]` 控制显示哪个板块。

**如果只是想为「提示词」增加「摄影技巧」「画风」等一级分类，不要改这里！** 应按[第 8 节](#8-给提示词新增独立一级菜单和二级图库)配置 `groups`。只有确实要新增**与「画廊」平级的全新主页面**时，才需要同时开发 HTML 页面节点、路由、可见性样式与数据加载逻辑；单独在主导航插入一个 `<a>` 不足以完成新页面。

### 14.3 画廊/作品瀑布流列数

- `site-shell.js` 的 `render()` 和窗口 `resize` 处理根据宽度决定列数：当前宽区域最多 **6 列**，较窄屏幕自动减为 5/4/3/2 列。
- `style.css` 中搜索 `.masonry`、`.masonry-column`、`.masonry-card` 调整卡片间距、文字与图像表现。
- 对于不足以容纳 6 列的手机/平板，自动减少列数是正常的响应式行为。

### 14.4 长提示词弹窗与 TAG

- `index.html`：搜索 `id="collectionDialog"`，里面有中文提示词、英文提示词、TAG、复制提示词和查看原图控件。
- `site-shell.js`：`openCard()` 填充弹窗；`resetPromptPanel()`、`updatePromptOverflow()` 控制展开/折叠。
- `style.css`：`.collection-prompt-box` 默认最大高度约 `158px`；`.collection-prompt-box.expanded` 是展开后的内部滚动高度上限；`.collection-dialog-tags` 控制 TAG 排列。
- 提示词很长时系统自动检测溢出才显示「展开全文」；**不需要给 JSON 增加 `collapsed` 或其他特殊字段**。

### 14.5 修改了 CSS/JS，但浏览器仍显示旧样式

`index.html` 通过 `style.css?v=...`、`site-shell.js?v=...`、`app.js?v=...` 这类带版本号的引用帮助浏览器更新缓存。修改代码行为时可以同步更新相应查询版本号；修改缓存策略时还可能需要调整 `sw.js` 的 `VERSION`。不要为了纯 JSON 录入而随意更改 JS 版本或 Service Worker。

## 15. GitHub Pages 发布与更新检查

### 15.1 GitHub Pages 应怎样设置？

进入仓库 [Settings → Pages](https://github.com/Gage0149/AIHUIHUA/settings/pages)，检查：

| 选项 | 设置 |
| --- | --- |
| `Source` | `Deploy from a branch` |
| `Branch` | `main` |
| `Folder` | `/(root)` |

本站直接部署静态文件，不需要设置构建命令或输出目录，也不需要另外部署管理后台。

### 15.2 检查是否真的发布成功

1. 在 GitHub 检查文件是否进入 `main` 的正确路径。
2. 查看 [Actions](https://github.com/Gage0149/AIHUIHUA/actions) 或 Pages 发布状态是否完成。
3. **先打开线上 JSON 验证**：
   - [画廊数据](https://gage0149.github.io/AIHUIHUA/gallery/gallery.json)
   - [作品数据](https://gage0149.github.io/AIHUIHUA/gallery/works.json)
   - [分类配置](https://gage0149.github.io/AIHUIHUA/gallery/categories.json)
4. 如果线上 JSON 已更新，但前台没变化，用 `Ctrl + Shift + R` 强制刷新。
5. 仍不行时，检查网站的 Service Worker 缓存及开发者工具中的错误信息。

### 15.3 GitHub Pages 路径注意事项

网站真实路径带有项目名前缀：

```text
https://gage0149.github.io/AIHUIHUA/
```

不要把子图库当成域名根目录的 `/gallery/foo.json` 去手工构造浏览器地址；前端已有项目路径处理逻辑。配置文件的 `file` 使用 `/gallery/xxx.json` 是**本项目约定**，前端会转换到正确的项目路径。

## 16. 常见故障与解决方法

| 问题 | 可能原因 | 首先检查 |
| --- | --- | --- |
| 画廊提示「内容读取失败」 | JSON 语法错误，尤其长提示词包含裸换行 | 在线打开 `gallery/gallery.json`，检查 `\n`、逗号、双引号 |
| 上传后仍显示旧图片 | 旧 JSON/浏览器缓存，或改错文件 | GitHub 文件内容、线上 JSON、`Ctrl + Shift + R` |
| 新一级菜单不出现 | `groups` 只有菜单，没有关联的有效二级图库 | `categories[].group`、对应 JSON 文件 |
| 二级分类显示但加载失败 | `categories[].file` 路径写错，或忘记上传新 JSON | GitHub 的 `gallery/` 目录及文件名 |
| 画廊/作品没有某个分类筛选按钮 | 分类在 `collectionFilters` 中标记为成人向，或 JSON 尚未更新 | 查看独立分类规则；普通分类即使只有一种也应显示 |
| 图片不显示但文字正常 | 图床 403/404、签名失效、地址不是直链 | 无痕模式单独访问图片 URL，F12 Network → Img |
| 关闭 R18 后内容消失 | 该记录标记了 `adult:true` 或 `a:true` | 正确的 R18 字段及顶部开关 |
| 新增图片后 TAG 没显示 | `tags` 为空、不是数组或没提交修改 | `"tags": ["人像", "艺术"]` |
| 英文提示词区域没出现 | `prompt_en` 为空 | 检查是否填写英文提示词 |
| 弹窗提示词太长 | 旧代码或浏览器缓存 | 当前已支持「展开全文」；刷新检查新版本 |
| 管理页面编辑后网站没变 | 管理页面不会自动写入 GitHub | 「导出 ZIP → 解压 → 上传 JSON → Commit」 |
| 导出按钮不可用 | 没有待导出文件，或当前条目还没保存 | 顶部状态/「保存当前条目」 |
| 切换图库报 404 | 非自定义图库文件缺失，或路径不对 | 检查实际文件；新图库需在配置和 JSON 中配套存在 |
| 原始姿势数据加载异常 | 原文件结构被误改，或 `angles` / `items` 丢失 | 对比 GitHub 历史版本，恢复原结构 |
| 上传后出现多套相同目录 | 解压后上传错了文件夹层级 | 确保 `gallery/xxx.json` 而非 `gallery/gallery/xxx.json` |

### 检查图片失败的具体状态码

- **404**：图片路径不存在，或已从图床删除。
- **403**：图床拒绝访问，可能涉及权限、签名、访问策略或防盗链。
- **网络错误/超时**：可能是网络、域名、证书或地区可达性问题。
- **图片 URL 能打开但网页不显示**：检查浏览器控制台错误、HTTPS 混合内容、缓存及实际 JSON 是否引用正确 URL。

## 17. 备份、回退与安全注意事项

### 17.1 推荐备份策略

- 每次大批量修改前，先在 GitHub 查看当前文件，必要时下载原始 JSON 留底。
- 管理页面每次导出的 ZIP 建议按日期存档，例如 `2026-11-25-gallery-update.zip`。
- 批量替换图床时，保留一份旧 URL → 新 URL 的映射文件，方便检查遗漏。
- 长提示词优先用普通编辑框输入，降低 JSON 格式错误概率。

### 17.2 修改错误怎么恢复？

GitHub 会保存提交历史。打开对应 JSON 文件的历史记录，找到上一个正常版本，检查内容后重新提交恢复即可。避免为了修一个文件而回滚整个仓库，导致其他新提交丢失。

### 17.3 公开网站的安全和素材授权

- `manage.html` 是公开可打开的静态编辑器；**任何访客都可以在自己浏览器里编辑和导出数据，但网页本身没有直接修改 GitHub 的权限**。
- 不要将 GitHub Token、Cloudflare API Token、R2 Secret Key、私密密码写入 JSON、HTML 或前端 JS。
- R18 不是身份验证，不应存储真正需要保密的素材。
- 原 PoseWear 和第三方素材可能有不同来源与授权；迁移到自己的图床前，请核实使用及转载权限。
- 图片直链是否稳定依赖具体图床和服务策略，建议定期检查失效链接。

## 18. 每次发布前的检查清单

**制作内容：**

- [ ] 图片已真实上传至自己的 K-Vault / R2，HTTPS 直链可以独立打开。
- [ ] 新图片 `id` 不重复；标题、`subcategory`、提示词和 TAG 都已填写。
- [ ] 需要成人向过滤的图片已勾选 R18。
- [ ] 需要隐藏的 NSFW **分类标题**已在「分类配置」中单独标记；普通分类保持公开。
- [ ] 新自定义一级/二级菜单已经关联正确的图库 JSON。
- [ ] 多视角图片的缩略图、预览图、原图地址完整且对应正确。

**导出并上传：**

- [ ] 管理页面的每个修改条目都已「保存当前条目」。
- [ ] 已下载本次修改 ZIP，并保留备份。
- [ ] ZIP 已解压，不是直接上传压缩包。
- [ ] 所有 JSON 按原相对路径上传（特别注意根目录 vs `gallery/`）。
- [ ] 已在 GitHub `main` 分支提交变更。

**发布后检查：**

- [ ] GitHub Pages 部署完成；线上 JSON 内容确实是新版本。
- [ ] 首页、提示词、画廊、作品能正常切换。
- [ ] 新分类/筛选按钮正常出现，图片可加载。
- [ ] 长提示词弹窗的中/英文折叠、TAG、复制提示词正常。
- [ ] R18 关闭/开启后内容显示符合预期。
- [ ] 电脑端及手机端布局没有明显溢出。

---

### 最后记住一句话

**图床保存图片；JSON 保存图片链接、分类与提示词；管理页面生成修改；GitHub 保存和发布修改；GitHub Pages 展示最终网站。**

日常维护请从[**内容管理页面**](https://gage0149.github.io/AIHUIHUA/manage.html)开始。只有当你准备改变页面结构、导航交互或布局样式时，才需要修改 `index.html`、`site-shell.js`、`app.js`、`style.css` 等前台代码。
