# -*- coding: utf-8 -*-
"""主窗口实现（阶段0：最小可运行原型）

本阶段提供：
- 菜单/工具栏占位
- 左侧图片列表（文件路径文本）
- 中央预览（当前选中图片 + 简单文本水印绘制）
- 右侧水印文本设置（文本内容 + 透明度滑块）
- 支持拖拽/按钮导入图片

后续阶段逐步增强：缩略图、九宫格定位、拖拽定位、模板等。
"""
from __future__ import annotations
import os
from typing import List, Optional
from PySide6.QtCore import Qt, QSize, QPoint
from PySide6.QtGui import QAction, QPixmap, QIcon, QDragEnterEvent, QDropEvent, QPainter, QColor
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QListWidget, QListWidgetItem, QFileDialog,
    QVBoxLayout, QHBoxLayout, QLabel, QPushButton, QTextEdit, QSlider, QSplitter, QMessageBox, QSizePolicy, QGroupBox, QApplication,
    QComboBox, QColorDialog, QSpinBox
)
from PIL import Image, ImageQt, ImageDraw, ImageFont
from ..core.image_loader import ImageLoader
from ..core.preview_composer import compose_text_watermark

SUPPORTED_EXT = {'.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff'}

class PreviewLabel(QLabel):
    """用于显示预览图的标签。后续可扩展鼠标事件实现拖拽水印。"""
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setStyleSheet("background:#222; border:1px solid #444;")
        self._base_qpix: Optional[QPixmap] = None
        self._composed_qpix: Optional[QPixmap] = None
        # 文本水印参数（去除方法内类型批注，避免解析器告警）
        self.watermark_text = "示例水印"
        self.opacity = 0.5  # 0~1
        self.font_size = 32
        self.color_rgb = (255, 255, 255)
        self.anchor = "bottom-right"  # 九宫格锚点
        self.offset = QPoint(-16, -16)  # 相对锚点偏移
        self._dragging = False
        self._drag_start = QPoint(0, 0)
        # 字体解析缓存
        self._font_cache = {}
        self._font_path = None  # 解析到的可用 TTF 路径

    def load_image(self, path: str):
        if not os.path.isfile(path):
            return
        try:
            img = Image.open(path)
            # 适度缩放到预览大小
            max_w, max_h = 900, 700
            ratio = min(max_w / img.width, max_h / img.height, 1.0)
            if ratio < 1:
                img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS)
            self._pil_base = img.convert("RGBA")
            self._base_qpix = QPixmap.fromImage(ImageQt.ImageQt(self._pil_base))
            self.update_composite()
        except Exception as e:
            QMessageBox.warning(self, "加载失败", f"无法加载图片: {e}")

    def set_watermark(self, text: str, opacity: float, *, font_size: Optional[int] = None, color_rgb: Optional[tuple[int,int,int]] = None, anchor: Optional[str] = None):
        self.watermark_text = text
        self.opacity = max(0.0, min(1.0, opacity))
        if font_size is not None:
            self.font_size = max(6, min(400, int(font_size)))
        if color_rgb is not None:
            self.color_rgb = tuple(color_rgb)
        if anchor is not None:
            self.anchor = anchor
        self.update_composite()

    def update_composite(self):
        if not hasattr(self, '_pil_base'):
            self.clear()
            self.setText("未选择图片")
            return
        img = self._pil_base.copy()
        draw = ImageDraw.Draw(img)
        # 字体（尽量使用 TrueType，以便字号生效；找不到则退回位图字体）
        font = self._get_font(self.font_size)
        text = self.watermark_text or ""
        if text:
            # 放右下角简单实现；后续加入九宫格/拖拽
            # Pillow 10 起移除了 textsize，优先使用 textbbox
            def _measure_text(draw_obj, text_str, fnt):
                try:
                    bbox = draw_obj.textbbox((0, 0), text_str, font=fnt)
                    return bbox[2] - bbox[0], bbox[3] - bbox[1]
                except Exception:
                    try:
                        # 某些版本可用 font.getbbox
                        bbox = fnt.getbbox(text_str)
                        return bbox[2] - bbox[0], bbox[3] - bbox[1]
                    except Exception:
                        try:
                            # 兜底方案：使用掩码尺寸
                            return fnt.getmask(text_str).size
                        except Exception:
                            return 0, 0

            tw, th = _measure_text(draw, text, font)
            # 计算九宫格锚点位置
            ax, ay = self._anchor_pos(img.width, img.height, tw, th, self.anchor)
            x = int(ax + self.offset.x())
            y = int(ay + self.offset.y())
            rgba = (*self.color_rgb, int(255 * self.opacity))
            img = compose_text_watermark(img, text=text, font=font, color_rgba=rgba, pos_xy=(x, y))
        qimg = ImageQt.ImageQt(img)
        self._composed_qpix = QPixmap.fromImage(qimg)
        self.setPixmap(self._composed_qpix)

    def _get_font(self, size: int):
        key = (self._font_path, int(size))
        if key in self._font_cache:
            return self._font_cache[key]
        # 若尚未解析到字体路径，尝试常见系统路径
        if self._font_path is None:
            candidates = [
                # Linux 常见路径（DejaVu）
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/usr/share/fonts/dejavu/DejaVuSans.ttf",
                # macOS 常见路径（Arial/Helvetica 替代）
                "/Library/Fonts/Arial.ttf",
                "/System/Library/Fonts/Supplemental/Arial.ttf",
                # Windows 常见路径
                "C:/Windows/Fonts/arial.ttf",
            ]
            for p in candidates:
                try:
                    _ = ImageFont.truetype(p, max(6, int(size)))
                    self._font_path = p
                    break
                except Exception:
                    continue
        try:
            if self._font_path:
                f = ImageFont.truetype(self._font_path, max(6, int(size)))
            else:
                # 直接尝试通用字体名（部分环境可解析）
                try:
                    f = ImageFont.truetype("DejaVuSans.ttf", max(6, int(size)))
                except Exception:
                    f = ImageFont.truetype("arial.ttf", max(6, int(size)))
        except Exception:
            # 最后退回位图字体（不支持变更字号）
            f = ImageFont.load_default()
        self._font_cache[key] = f
        return f

    def _anchor_pos(self, W: int, H: int, tw: int, th: int, anchor: str) -> tuple[int, int]:
        margin = 16
        mapping = {
            "top-left": (margin, margin),
            "top-center": ((W - tw)//2, margin),
            "top-right": (W - tw - margin, margin),
            "middle-left": (margin, (H - th)//2),
            "center": ((W - tw)//2, (H - th)//2),
            "middle-right": (W - tw - margin, (H - th)//2),
            "bottom-left": (margin, H - th - margin),
            "bottom-center": ((W - tw)//2, H - th - margin),
            "bottom-right": (W - tw - margin, H - th - margin),
        }
        return mapping.get(anchor, mapping["bottom-right"])  # 默认右下

    # 鼠标拖拽更新 offset
    def mousePressEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton and hasattr(self, '_pil_base'):
            self._dragging = True
            self._drag_start = e.pos()
            e.accept()
        else:
            super().mousePressEvent(e)

    def mouseMoveEvent(self, e):
        if self._dragging:
            delta = e.pos() - self._drag_start
            self._drag_start = e.pos()
            self.offset += delta
            self.update_composite()
            e.accept()
        else:
            super().mouseMoveEvent(e)

    def mouseReleaseEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton and self._dragging:
            self._dragging = False
            e.accept()
        else:
            super().mouseReleaseEvent(e)

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Photo Watermark 2 - 原型")
        self.resize(1400, 900)
        self.images: List[str] = []
        self.loader = ImageLoader(thumb_size=(96, 96))
        self._build_ui()
        self.setAcceptDrops(True)

    # ---------- UI 构建 ----------
    def _build_ui(self):
        splitter = QSplitter()
        self.setCentralWidget(splitter)

        # 左：图片列表
        left_widget = QWidget()
        left_layout = QVBoxLayout(left_widget)
        self.list_widget = QListWidget()
        self.list_widget.setIconSize(QSize(96, 96))
        self.list_widget.itemSelectionChanged.connect(self.on_selection_change)
        btn_add = QPushButton("导入图片/文件夹")
        btn_add.clicked.connect(self.import_images_dialog)
        left_layout.addWidget(btn_add)
        left_layout.addWidget(self.list_widget, 1)

        # 中：预览
        self.preview = PreviewLabel()

        # 右：水印设置面板
        right_widget = QWidget()
        right_layout = QVBoxLayout(right_widget)
        group = QGroupBox("文本水印设置（基础）")
        g_layout = QVBoxLayout(group)
        self.text_edit = QTextEdit()
        self.text_edit.setPlaceholderText("输入水印文本…")
        self.text_edit.textChanged.connect(self.on_text_change)
        self.opacity_slider = QSlider(Qt.Orientation.Horizontal)
        self.opacity_slider.setRange(0, 100)
        self.opacity_slider.setValue(50)
        self.opacity_slider.valueChanged.connect(self.on_opacity_change)
        # 字号
        self.font_size_spin = QSpinBox()
        self.font_size_spin.setRange(6, 400)
        self.font_size_spin.setValue(32)
        self.font_size_spin.valueChanged.connect(self.on_font_size_change)
        # 颜色
        color_row = QHBoxLayout()
        self.btn_color = QPushButton("选择颜色…")
        self.btn_color.clicked.connect(self.on_pick_color)
        self.lbl_color = QLabel("#FFFFFF")
        color_row.addWidget(self.btn_color)
        color_row.addWidget(self.lbl_color)
        # 九宫格预设
        self.anchor_combo = QComboBox()
        self.anchor_combo.addItems([
            "top-left","top-center","top-right",
            "middle-left","center","middle-right",
            "bottom-left","bottom-center","bottom-right"
        ])
        self.anchor_combo.setCurrentText("bottom-right")
        self.anchor_combo.currentTextChanged.connect(self.on_anchor_change)
        g_layout.addWidget(QLabel("水印文本："))
        g_layout.addWidget(self.text_edit)
        g_layout.addWidget(QLabel("透明度："))
        g_layout.addWidget(self.opacity_slider)
        g_layout.addWidget(QLabel("字号："))
        g_layout.addWidget(self.font_size_spin)
        g_layout.addWidget(QLabel("颜色："))
        g_layout.addLayout(color_row)
        g_layout.addWidget(QLabel("位置预设："))
        g_layout.addWidget(self.anchor_combo)
        right_layout.addWidget(group)
        right_layout.addStretch(1)

        splitter.addWidget(left_widget)
        splitter.addWidget(self.preview)
        splitter.addWidget(right_widget)
        splitter.setSizes([260, 800, 300])

        # 菜单占位
        file_menu = self.menuBar().addMenu("文件")
        act_import = QAction("导入…", self)
        act_import.triggered.connect(self.import_images_dialog)
        file_menu.addAction(act_import)

    # ---------- 功能：导入 ----------
    def import_images_dialog(self):
        paths, _ = QFileDialog.getOpenFileNames(self, "选择图片", os.getcwd(), "Images (*.jpg *.jpeg *.png *.bmp *.tif *.tiff)")
        if not paths:
            return
        self.add_images(paths)

    def add_images(self, paths: List[str]):
        new_files = []
        for p in paths:
            ext = os.path.splitext(p)[1].lower()
            if ext in SUPPORTED_EXT and os.path.isfile(p):
                if p not in self.images:
                    self.images.append(p)
                    new_files.append(p)
        for f in new_files:
            # 生成缩略图并设置为图标
            try:
                thumb = self.loader.get_thumbnail(f)
                qimg = ImageQt.ImageQt(thumb)
                pix = QPixmap.fromImage(qimg)
                item = QListWidgetItem()
                item.setText(os.path.basename(f))
                item.setIcon(QIcon(pix))
            except Exception:
                # 缩略图失败，使用纯文本
                item = QListWidgetItem(os.path.basename(f))
            item.setData(Qt.ItemDataRole.UserRole, f)
            self.list_widget.addItem(item)
        if new_files and not self.preview.pixmap():
            self.list_widget.setCurrentRow(0)

    # ---------- 选择变化 ----------
    def on_selection_change(self):
        items = self.list_widget.selectedItems()
        if not items:
            return
        path = items[0].data(Qt.ItemDataRole.UserRole)
        self.preview.load_image(path)

    # ---------- 水印事件 ----------
    def on_text_change(self):
        text = self.text_edit.toPlainText().strip()
        self.preview.set_watermark(text, self.opacity_slider.value()/100.0)

    def on_opacity_change(self, v: int):
        text = self.text_edit.toPlainText().strip()
        self.preview.set_watermark(text, v/100.0)

    def on_font_size_change(self, v: int):
        text = self.text_edit.toPlainText().strip()
        self.preview.set_watermark(text, self.opacity_slider.value()/100.0, font_size=v)

    def on_pick_color(self):
        col = QColorDialog.getColor(QColor(255,255,255), self, "选择文本颜色")
        if col.isValid():
            rgb = (col.red(), col.green(), col.blue())
            self.lbl_color.setText(f"#{col.red():02X}{col.green():02X}{col.blue():02X}")
            text = self.text_edit.toPlainText().strip()
            self.preview.set_watermark(text, self.opacity_slider.value()/100.0, color_rgb=rgb)

    def on_anchor_change(self, anchor: str):
        text = self.text_edit.toPlainText().strip()
        self.preview.set_watermark(text, self.opacity_slider.value()/100.0, anchor=anchor)

    # ---------- 拖拽支持 ----------
    def dragEnterEvent(self, event: QDragEnterEvent):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()

    def dropEvent(self, event: QDropEvent):
        paths = []
        for url in event.mimeData().urls():
            local_path = url.toLocalFile()
            if os.path.isdir(local_path):
                for root, _, files in os.walk(local_path):
                    for fn in files:
                        fp = os.path.join(root, fn)
                        ext = os.path.splitext(fp)[1].lower()
                        if ext in SUPPORTED_EXT:
                            paths.append(fp)
            else:
                ext = os.path.splitext(local_path)[1].lower()
                if ext in SUPPORTED_EXT:
                    paths.append(local_path)
        if paths:
            self.add_images(paths)


def launch():
    app = QApplication.instance() or QApplication([])
    win = MainWindow()
    win.show()
    return app.exec()
