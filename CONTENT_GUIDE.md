# 绘影 AIHUIHUA — 页面与素材维护说明

这是 GitHub Pages 直接部署的静态网站，代码托管在 Gage0149/AIHUIHUA，**不需要服务器、数据库或 Node 构建**。

## 网站导航

- **首页**：全屏主视觉，点击「探索 AI」进入提示词。
- **提示词**：原姿势、深度姿势、服装、动画服装、人物造型、环境与物件等图库，原筛选与复制提示词功能保留。
- **画廊**：读取 `gallery/gallery.json`，展示收集的 AI 绘画提示词及参考图。带「示例 · 可替换」的为演示用占位图片，并非 AI 生成成品。
- **作品**：读取 `gallery/works.json`，展示自己创作的 AI 绘画成品。初始为空，请放入自己的作品。

画廊和作品都采用自适应瀑布流，支持按二级分类筛选、顶部搜索，以及点击图片打开提示词详情。GitHub Pages 地址前缀为 `/AIHUIHUA/`，代码会自动处理该路径。

## 加图片／新增二级分类

1. 把图片上传至你的 K-Vault / Cloudflare R2 图床。
2. 从图床复制可直接在浏览器打开的 **HTTPS 图片直链**，最好以 `.webp`、`.jpg` 或 `.png` 结尾（带签名参数也可）。
3. 打开 GitHub 仓库中的 `gallery/gallery.json` 或 `gallery/works.json`，点击右上角编辑按钮，新增一个对象，注意对象之间加英文逗号。
4. 填写 `subcategory` 字段即可自动产生新的分类筛选按钮，无须改 JavaScript。
5. 点击 **Commit changes** 保存。稍等 GitHub Pages 自动部署，再刷新网页。

### 作品数据格式

```json
[
  {
    "id": "work-001",
    "title": "夜色中的旅人",
    "subcategory": "电影感",
    "image": "https://你的真实图床域名/作品001.webp",
    "description": "使用 AI 绘制的电影风格概念作品",
    "prompt_zh": "夜色街道，孤独旅人，电影级灯光，真实摄影质感",
    "prompt_en": "A lone traveler in a city at night, cinematic light, realistic photography",
    "tags": ["夜景", "电影感", "人物"]
  }
]
```

### 画廊数据格式

字段与作品一致，直接在 `gallery/gallery.json` 内增加内容即可。若是你自己收集的真实内容，可以删除记录里的 `"demo": true`。此标记只用于提醒用户当前显示的是演示图片。

## 更换首页背景

修改 `index.html` 中 `class="home-photo"` 的 `src` 地址，替换成你图床上公开可访问的横幅图（推荐 16:9 或更宽，至少 1920px 宽）。

## 图片打不开的排查顺序

1. **先检查图片直链**：单独把 `image` 地址粘贴到浏览器新标签页。如果它打不开，网页也无法显示。
2. **检查旧素材来源**：仓库原始的姿势、服装等大多数图片直接引用 `pwimg.0vo.pro` 等第三方域名，不在 GitHub 仓库中。原站外链如果失效、限流、被网络屏蔽，改页面布局也无法让这些文件重新出现。
3. **检查浏览器控制台**：按 F12 → Network → Img，可看到是 404、403、网络错误还是被浏览器安全策略阻止。
4. **建议迁移到自己的 K-Vault/R2**：把有权使用的原素材上传到自己的图床，再批量替换原数据文件（`poses.json`、`costumes.json` 等）中的图片 URL。这是完全掌握图片可用性的可靠方案。
5. **强制刷新旧缓存**：按 Ctrl+Shift+R；页面还不更新时在浏览器设置中清除本站缓存或注销旧的 Service Worker。

## 静态部署

GitHub Settings → Pages → Build and deployment：
- Source: Deploy from a branch
- Branch: main
- Folder: /(root)

保存即可。当前页面无需构建命令。
