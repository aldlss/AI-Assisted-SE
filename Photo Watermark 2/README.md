# Photo Watermark 2

跨平台（Windows / macOS / Linux）本地图像批量加水印工具。

本项目目标：在简洁 GUI 中提供图片批量导入、文本/图片水印、位置与透明度调整、实时预览、模板保存等功能。

## 实施路线（迭代拆解）

### 阶段 0：项目初始化（当前阶段）
- 选型：Python + PySide6 (Qt) 作为跨平台 GUI 框架，Pillow 进行图像处理
- 建立基础目录结构与依赖文件
- 搭建最小可运行 GUI：
  - 主窗口 + 左侧图片列表占位 + 中部预览区 + 右侧水印设置面板（占位）
  - 支持拖拽/文件选择导入图片（文件路径列表显示）
  - 简单文本水印渲染（固定位置/透明度）预览（仅单张）

### 阶段 1：图片导入与管理
- 支持批量导入与文件夹递归扫描（过滤支持格式）
- 生成缩略图（缓存）展示
- 选中切换预览

### 阶段 2：文本水印核心功能
- 文本内容输入、字体、字号、颜色、透明度
- 位置预设（九宫格）+ 拖拽移动
- 即时预览合成

### 阶段 3：图片水印（高级）
- 载入 PNG / 其他格式图片作为水印，支持透明通道
- 自由/等比缩放，透明度调节
- 旋转功能（文本/图片通用）

### 阶段 4：批量导出
- 输出目录选择 + 覆盖保护
- 命名规则（原名 / 前缀 / 后缀）
- 输出格式：JPEG / PNG
- JPEG 质量滑块、尺寸缩放（宽/高/百分比）

### 阶段 5：模板与配置持久化
- 保存/加载/删除模板（JSON）
- 启动时自动加载上次配置

### 阶段 6：打包与发布
- PyInstaller / Briefcase 打包
- 入口脚本 + 图标资源

## 目录结构（规划）
```
Photo Watermark 2/
  README.md
  requirements.txt
  watermark_app/
    __init__.py
    main.py            # 程序入口（GUI 启动）
    ui/
      main_window.py   # 主窗口类
      widgets/         # 自定义控件
    core/
      image_loader.py  # 图片加载与缩略图
      watermark_text.py
      watermark_image.py
      preview_composer.py
      exporter.py
      templates.py
      settings.py
    assets/
      fonts/ (可选)
      icons/
    data/
      templates/       # 用户模板 JSON
      cache/           # 缩略图缓存
```

## 依赖（初版）
- PySide6：GUI
- Pillow：图像处理

后续可能增加：
- numpy（加速矩阵操作，可选）
- typing-extensions（兼容性）

## 开发约定
- 代码与注释使用中文
- 模块内部提供最小职责 + 清晰 docstring
- GUI 与业务逻辑分层：UI 层不直接做图像像素操作，交由 core/* 处理

## 运行方式（当前阶段）
```
python -m pip install -r requirements.txt
python -m watermark_app.main
```

## 许可证
（根据需要选择，可后续添加）
