# 上传资料与 PDF 元数据

所有正式资料统一上传到根目录的 `uploads/`。学科、课程、资料类型不靠子文件夹或文件名推断，而是读取 PDF 内部的标注。提交到 `main` 后，GitHub Actions 自动扫描并部署。扫描仅做读取，线上下载文件与上传文件保持一致。

需要保留未经改写的原始 PDF 时，也可以在 `site/config/catalog.json` 的 `files` 映射中补充课程、标题和关键词。含有稳定 ID 的完整 ARC 内嵌记录优先；未标注 PDF 使用映射中的明确字段，并继续从 PDF 读取页数和预览能力。这样导入后的下载文件与原文件字节一致。

## View Now 的 Markdown 正文

每份资料的 **View Now** 会打开独立 Markdown 阅读页。没有正文时显示 `Content coming soon.`，不会自动改写或识别原 PDF / Word。

在 `uploads/` 放入与原文件同名的 `.md`，提交后会自动关联。例如 `g10-calculus-bc-midterm-notes.pdf` 对应 `g10-calculus-bc-midterm-notes.md`。配套 Markdown 不会被重复列成另一份资料；原文件的阅读和下载入口保留。独立上传的 `.md` 也可直接作为资料展示。

正文支持标题、列表、表格、引用、代码块、链接和图片。图片等相对路径以 `.md` 所在目录为准。无属性的 `<br>`、`<sub>`、`<sup>`、`<u>` 可用于换行、上下标和下划线；其余 HTML 标签作为文字展示，不执行脚本。

公式使用 `$...$`（行内）或 `$$...$$`（独立公式），由本地 KaTeX 显示；化学式支持 `\ce{H2O}` 等 mhchem 记号。转写应逐页核对原件，保留原有署名、完整例题、表格和必要插图；无法辨认的部分要明确标记，不能凭常识补写。

## 给 PDF 标注

在仓库根目录先安装依赖：

```sh
python -m pip install -r site/requirements.txt
```

下面的命令保留原文件，并生成可上传的标注版。输出文件必须使用一个尚不存在的路径。

```sh
python site/scripts/pdf_metadata.py write "原始复习指南.pdf" --output "uploads/electrostatics-review.pdf" --title "静电学复习指南" --course physics-em --type review-guide --author "联合复习公社" --keywords "静电学" "Coulomb" "electric field" --grade G12 --exam-board AP --languages zh-CN en --updated 2026-10-13
```

`--course` 自动确定所属学科。没有对应课程时，直接指定学科，例如 `--subject chemistry`。未填标题时使用原 PDF 标题或文件名；未填类型时标注工具默认 `review-guide`。作者、年级、考试体系、语言、关键词、更新时间都是可选的，未填写的实际信息不会编造。首次标注自动生成稳定 ID；再次标注会保留 ID，所以文件改名后资料身份不变。同一 ID 不能同时用于上传目录里的两个文件。

读取标注：

```sh
python site/scripts/pdf_metadata.py read "uploads/electrostatics-review.pdf"
```

整批检查：

```sh
python site/scripts/pdf_metadata.py scan uploads
```

## 编码表

| 学科编码 | 页面显示 |
| --- | --- |
| `mathematics` | Mathematics |
| `physics` | Physics |
| `chemistry` | Chemistry |
| `biology` | Biology |
| `economics` | Economics |
| `computer-science` | Computer Science |
| `chinese` | Chinese |
| `english` | English |
| `history` | History |
| `psychology` | Psychology |
| `humanities` | Humanities |
| `test-preparation` | Test Preparation |
| `research-skills` | Research Skills |
| `general` | Unclassified |

| 课程编码 | 课程 | 学科 |
| --- | --- | --- |
| `g11-chinese-literature` | G11 Chinese | `chinese` |
| `g10-chinese-literature` | G10 Chinese | `chinese` |
| `ap-calculus-bc` | Calculus BC | `mathematics` |
| `ap-chemistry` | Chemistry | `chemistry` |
| `ap-pre-calculus` | Precalculus | `mathematics` |
| `ap-english-literature` | English language+Literature | `english` |
| `ap-psychology` | Psychology | `psychology` |
| `ap-physics-1` | Physics 1 | `physics` |
| `ap-microeconomics` | Microeconomics | `economics` |
| `ap-macro` | Macroeconomics | `economics` |
| `ap-computer-science-principles` | Computer Science Principles | `computer-science` |
| `ap-biology` | Biology | `biology` |
| `ap-computer-science-a` | Computer Science A (CSA) | `computer-science` |
| `ap-physics-c-m` | G11 AP Physics C: Mechanics | `physics` |
| `physics-em` | G11 AP Physics C: E&M | `physics` |
| `ap-statistics` | G11 Statistics | `mathematics` |
| `g11-anatomy` | G11 Anatomy | `biology` |

| 类型编码 | 页面显示 |
| --- | --- |
| `review-guide` | Review Guide |
| `course-notes` | Course Notes |
| `practice-set` | Practice Set |
| `reference` | Reference |
| `resource` | Study Material |

新增课程或学科只需编辑 `site/config/catalog.json` 的注册表。不要修改既有编码的含义；显示名称可以调整。

课程名称和顺序以 `ARC_2027S1_Mid_已完善(2).xlsx` 的 `2027 S1 Mid!B4:B20` 为准。`courseImport` 记录来源和校验值。旧年级/AP 编码通过 `courseAliases` 指向当前课程，旧链接和 PDF 内部编码继续可用；不会因此重写原文件或改动资料原有年级。新增资料请使用上表中的当前编码。

## 文件内部存储方式

完整记录写入 PDF Info 字典的 `/WLSAARC`，同时同步到 XMP 的 `arc:record`。自定义命名空间是 `https://wlsa-arc.github.io/ns/material/1.0/`。记录是 Unicode JSON：XMP 使用 UTF-8，Info 使用 PDF 的字符串编码。它支持中文、数组和引号，版本由 `schemaVersion` 标识。输入示例：

```json
{
  "schemaVersion": 1,
  "title": "静电学复习指南",
  "author": "联合复习公社",
  "subject": "physics",
  "course": "physics-em",
  "type": "review-guide",
  "description": "电场、库仑定律与高斯定律。",
  "keywords": ["静电学", "Coulomb", "Gauss"],
  "grade": "G12",
  "examBoard": "AP",
  "languages": ["zh-CN", "en"],
  "updated": "2026-10-13"
}
```

PDF 普通属性中的 Title、Author、Subject、Keywords 也会同步写入，方便常规编辑器查看。需要一次填写很多字段时，可把上面的 JSON 存成临时文件，再使用 `--metadata "标注.json"`；标注后只需上传 PDF，不需要把 JSON 一起上传。新资料省略 `id`，工具会生成并写入 `arc-...` 唯一标识；不要把一个已有 ID 复制给不同资料。

读取优先级为完整 ARC 记录（Info / XMP）→ 普通 PDF 属性中的明确编码 → 未分类。Info 与 XMP 的 ARC 记录不一致、未知编码或学科与课程冲突会报错，避免发布错误分类。请用标注工具修改完整记录；仅修改普通标题不会覆盖已经存在的 ARC 记录。

没有完整 ARC 记录的旧 PDF，也可以通过普通属性分类：Subject 填 `physics` 或 `Physics`，Keywords 填 `电场; arc.course=physics-em; arc.type=course-notes`。这些字段只有明确写出编码时才被识别，正文不会被扫描或当作执行指令。没有日期标注时不使用文件修改时间冒充资料更新时间。

标注工具将结果保存为新 PDF，保留页面、字体、正文、表单和原有其他元数据；并重新打开检查正文流与页面尺寸一致。加密 PDF 需要先解锁再标注；有签名字段的 PDF 需要使用未签名原件。上传的加密 PDF 可以下载，但不会生成无法打开的在线预览入口。

## 非 PDF 与本地预览

HTML、Markdown、TXT、DOCX、PPTX、XLSX、ZIP 同样可以放在 `uploads/`。它们可选地使用 `site/config/catalog.json` 的 `files` 映射填写同样的编码与字段；没有标注时归入未分类。

```json
"uploads/mechanics-notes.md": {
  "title": "力学课堂笔记",
  "subject": "physics",
  "course": "ap-physics-c-m",
  "type": "course-notes"
}
```

在 `site/` 中运行：

```sh
npm ci
python -m pip install -r requirements.txt
npm run build
python -m http.server 4173 --directory _site
```

打开 `http://localhost:4173/`。浏览器验证使用 `npx playwright install chromium` 和 `npm test`，涵盖元数据双写读取、改名后的 ID、分类验证、正文逐页渲染一致性，以及搜索、下载、阅读器和手机布局。测试资料会自动清除，不作为正式复习资料收录。
