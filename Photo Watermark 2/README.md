# Photo Watermark 2

跨平台（Windows / macOS / Linux）的本地批量图片加水印工具，提供所见即所得的预览与模板管理能力。

## 功能一览
- 导入
  - 从菜单或左侧按钮导入：
    - 导入文件…（可多选）
    - 导入文件夹…（递归扫描支持格式）
  - 支持将文件/文件夹直接拖拽到窗口
  - 支持格式：.jpg .jpeg .png .bmp .tif .tiff
- 预览与编辑
  - 左侧列表选择图片，中央实时预览
  - 位置预设（九宫格）+ 预览中直接拖拽微调位置
  - 旋转（文本/图片通用）
- 文本水印
  - 文本内容、透明度、字号、颜色
  - 位置预设 + 拖拽 + 旋转
- 图片水印
  - 选择 PNG/JPG 作为水印（支持透明通道）
  - 透明度、旋转、位置预设 + 拖拽
  - 缩放：按“水印自身原始宽度”的百分比（与背景图大小无关，更稳定一致）
  - 鼠标滚轮在预览上可调整图片水印缩放（Ctrl=1% 精调，默认 5%，Shift=10%）
- 导出
  - 导出选中…（仅导出左侧当前选择的图片；若未选择则提示）
  - 输出目录、命名规则（原名/前缀/后缀）
  - 格式：PNG / JPEG（可调质量）
  - 可选尺寸缩放：宽/高/百分比
  - 覆盖保护：默认不允许导出到原图所在目录
- 模板
  - 保存为模板… / 应用模板… / 管理模板…（删除）
  - 打开模板文件夹 / 显示模板路径
  - 启动时自动加载上次关闭时的设置（last.json）

数据与隐私
- 模板与上次设置存放于项目目录的 `data/` 下：
  - `data/templates.json`：保存的模板集合
  - `data/last.json`：上次退出时的设置
- 以上文件仅用于本地，不纳入 Git 版本管理（已在 `.gitignore` 忽略）。

## 安装与运行
推荐在子目录中运行（以避免路径空格造成的导入问题）。

1) 进入项目子目录并安装依赖
```bash
cd "Photo Watermark 2"
python -m pip install -r requirements.txt
```

2) 启动应用
```bash
python -m watermark_app.main
```

如需从仓库根目录运行，可临时指定 PYTHONPATH：
```bash
PYTHONPATH="Photo Watermark 2" python -m watermark_app.main
```

## 本地打包（Windows 可执行文件）
不引入任何工作流，仅在本机打包为 Windows 可执行文件（.exe）。

- 方案 A：在 Windows 上打包（最稳妥）
  1) 安装依赖与 PyInstaller：
     ```powershell
     cd "Photo Watermark 2"
     python -m pip install -r requirements.txt pyinstaller
     ```
  2) 打包：
     ```powershell
     pyinstaller -F -w -n PhotoWatermark2 -p watermark_app watermark_app/main.py
     ```
     - 生成的 exe 位于 `dist/PhotoWatermark2.exe`

- 方案 B：在 Linux 上打包 Windows 版本（需要 Wine 环境）
  - 安装 Wine 与对应的 Python + PyInstaller 运行时较为繁琐，建议直接在 Windows 打包；
  - 如必须在 Linux 打包，请使用现有的 Wine + PyInstaller 指南配置好环境后执行与方案 A 相同的命令。

注意事项
- 本项目启动时会将工作目录切换到可执行文件所在目录，以便使用相对路径访问 `data/`；
- `data/templates.json` 与 `data/last.json` 仅用于本地，不应随发行包预置个人数据，打包前可清空该目录。

## 使用指南
1) 导入图片
   - 左侧“导入文件…”或“导入文件夹…”，或直接拖拽到窗口
   - 列表支持多选；Delete 键可移除所选；“清空列表”可一键清空
2) 设置水印
   - 在右侧面板选择“文本/图片”水印类型
   - 文本水印：编辑文本、透明度、字号、颜色，选择位置预设后可在预览中拖动微调；可设置旋转
   - 图片水印：选择水印图片，调整透明度、宽度（按水印自身宽度的百分比）、旋转；同样支持位置预设与拖拽
3) 导出选中
   - 在左侧列表选中要导出的图片
   - 选择输出目录、命名规则、输出格式与质量，可选尺寸缩放
   - 点击“导出选中…”开始导出
4) 模板
   - 菜单“模板”里可以保存当前设置为模板、应用已有模板、管理（删除）模板
   - 支持打开模板文件夹与查看模板路径
   - 关闭应用前会自动保存最后一次设置，启动时自动加载

## 键鼠小贴士
- 预览区域：
  - 鼠标左键拖拽水印进行微调
  - 滚轮（仅图片水印）：调整缩放；Ctrl=1%，默认=5%，Shift=10%
- 列表：Delete 快速移除所选

## 常见问题（FAQ）
- 无法启动/缺少依赖？
  - 请先执行：`python -m pip install -r requirements.txt`
- 字体显示与中文支持？
  - 程序默认使用系统常见字体（如 DejaVuSans/Arial），不同系统可能略有差异
- 为什么导出尺寸和原图不一致？
  - 当前导出采用“与预览一致”的尺寸逻辑；如需原始像素导出可在后续版本提供切换选项

## 许可证
（根据需要补充）
