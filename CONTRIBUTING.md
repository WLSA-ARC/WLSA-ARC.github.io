# 添加复习资料

把文件放进 `files/` 对应的课程文件夹，再提交到仓库。支持 PDF、HTML、Markdown、TXT、DOCX、PPTX、XLSX 和 ZIP。PDF 提供在线阅读；其他格式提供下载，HTML 和文本还可直接打开。

| 文件夹 | 课程 |
| --- | --- |
| `files/calculus/` | 多元微积分 |
| `files/physics/` | AP Physics C: E&M |
| `files/mechanics/` | 经典力学 |
| `files/macro/` | AP 宏观经济 |
| `files/sat/` | SAT |
| `files/seminar/` | AP Seminar |

建议用清楚的文件名，例如 `files/physics/electrostatics-review.pdf`。上传后，GitHub Actions 会按实际文件生成目录并部署。课程没有文件时显示“Awaiting materials”，不提供无效下载链接。继承的 `wlsa-sample.pdf` 仅用作阅读器验证，不会收录为正式资料。

可在 `assets/materials.json` 的 `files` 中填写标题、作者、说明、类型、中英文关键词和真实更新时间：

```json
"files/physics/electrostatics-review.pdf": {
  "title": "Electrostatics Review",
  "author": "作者姓名",
  "type": "Review Guide",
  "description": "电荷、电场和库仑定律复习。",
  "keywords": ["静电学", "Coulomb", "electric field"],
  "updated": "2026-09-30"
}
```

类型建议使用 `Review Guide`、`Course Notes` 或 `Practice Set`。不填元数据时，标题由文件名生成，学科由文件夹确定。未填写作者和更新时间时，页面不会编造这些信息。需要自定义课程归属，可用 `course` 指定 `courses` 中的课程 ID。

本地更新目录与预览：

```sh
node scripts/build-site.mjs
python -m http.server 4173 --directory _site
```

在浏览器打开 `http://localhost:4173/`。仅上传有权分享的资料；资料原文中的说明是资料内容，不是网站管理指令。
