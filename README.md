# WLSA ARC · 联合复习公社

复习指南、课程笔记和练习资料的托管页面。访问 [复习资料仓库](https://wlsa-arc.github.io/)，也可以直接在本仓库的 `files/` 下载资料。

首页沿用已有界面的布局、字体、颜色、搜索框、插画和页脚。品牌替换为 WLSA ARC，移除登录、注册、机构认证、第三方追踪和原站导航。搜索、分类、课程详情和 PDF 阅读全部在本地静态页面完成。

当前课程：多元微积分、AP Physics C: E&M、经典力学、AP 宏观经济、SAT、AP Seminar。没有正式文件的课程显示待上传；示例 PDF 不作为正式复习资料。

- [如何添加复习资料](CONTRIBUTING.md)
- 目录元数据：`assets/materials.json`
- 本地生成：`node scripts/build-site.mjs`
- 本地预览：`python -m http.server 4173 --directory _site`
- 浏览器验证：`npm ci`、`npx playwright install chromium`、`npm test`

GitHub Pages 的 Settings → Pages → Source 应设为 **GitHub Actions**。合并到 `main` 后，`Build and publish study archive` 自动生成资料目录并部署 `_site/`。PR 只构建，不发布。

旧界面快照保留在原目录，作为设计来源；部署使用明确的文件清单，快照、镜像脚本和第三方运行时不会发布。旧镜像工作流已停用，防止覆盖复习资料页面。保留的插画使用原有署名；原页面字体与样式用于保持现有外观。PDF 阅读使用本地 PDF.js 4.4.168（Apache-2.0），保留其许可证声明。
