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
from PySide6.QtCore import Qt, QSize, QPoint, QTimer
from PySide6.QtGui import QAction, QPixmap, QIcon, QDragEnterEvent, QDropEvent, QPainter, QColor, QFont, QFontMetrics, QImage
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QListWidget, QListWidgetItem, QFileDialog,
    QVBoxLayout, QHBoxLayout, QLabel, QPushButton, QTextEdit, QSlider, QSplitter, QMessageBox, QSizePolicy, QGroupBox, QApplication,
    QComboBox, QColorDialog, QSpinBox, QLineEdit
)
from PIL import Image, ImageQt, ImageDraw, ImageFont
from ..core.image_loader import ImageLoader
from ..core.preview_composer import compose_text_watermark
from ..core.exporter import export_batch, ExportSettings

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
        text = self.watermark_text or ""
        if text:
            # 使用 Qt 字体绘制，跨平台确保字号生效
            qfont = QFont()
            qfont.setPixelSize(int(max(6, min(400, self.font_size))))
            fm = QFontMetrics(qfont)
            tw = max(1, fm.horizontalAdvance(text))
            th = max(1, fm.height())
            # 计算九宫格锚点位置
            ax, ay = self._anchor_pos(img.width, img.height, tw, th, self.anchor)
            x = int(ax + self.offset.x())
            y = int(ay + self.offset.y())
            # 生成文本 QImage
            qimg = QImage(tw, th, QImage.Format.Format_ARGB32_Premultiplied)
            qimg.fill(0)
            painter = QPainter(qimg)
            painter.setRenderHint(QPainter.Antialiasing, True)
            painter.setRenderHint(QPainter.TextAntialiasing, True)
            painter.setPen(QColor(self.color_rgb[0], self.color_rgb[1], self.color_rgb[2], int(255 * self.opacity)))
            painter.setFont(qfont)
            # 在基线处绘制，以获得完整高度
            painter.drawText(0, fm.ascent(), text)
            painter.end()
            # 转为 PIL 并合成
            text_pil = ImageQt.fromqimage(qimg).convert("RGBA")
            layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
            layer.paste(text_pil, (x, y), text_pil)
            img = Image.alpha_composite(img, layer)
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
        # 移除/清空
        rm_row = QHBoxLayout()
        btn_remove = QPushButton("移除所选")
        btn_remove.clicked.connect(self.remove_selected_images)
        btn_clear = QPushButton("清空列表")
        btn_clear.clicked.connect(self.clear_all_images)
        rm_row.addWidget(btn_remove)
        rm_row.addWidget(btn_clear)
        left_layout.addLayout(rm_row)
        # 列表多选与快捷删除
        self.list_widget.setSelectionMode(QListWidget.SelectionMode.ExtendedSelection)
        del_act = QAction("移除所选", self.list_widget)
        del_act.setShortcut(Qt.Key.Key_Delete)
        del_act.setShortcutContext(Qt.ShortcutContext.WidgetWithChildrenShortcut)
        del_act.triggered.connect(self.remove_selected_images)
        self.list_widget.addAction(del_act)
        self.list_widget.setContextMenuPolicy(Qt.ContextMenuPolicy.ActionsContextMenu)
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
        # 导出面板
        exp = QGroupBox("导出")
        exp_l = QVBoxLayout(exp)
        # 输出目录
        out_row = QHBoxLayout()
        self.out_dir_edit = QLineEdit()
        self.out_dir_btn = QPushButton("选择输出目录…")
        self.out_dir_btn.clicked.connect(self.on_pick_out_dir)
        out_row.addWidget(self.out_dir_edit)
        out_row.addWidget(self.out_dir_btn)
        # 命名规则
        name_row = QHBoxLayout()
        self.name_rule = QComboBox(); self.name_rule.addItems(["keep","prefix","suffix"])
        self.prefix_edit = QLineEdit(); self.prefix_edit.setPlaceholderText("前缀，如 wm_")
        self.suffix_edit = QLineEdit(); self.suffix_edit.setPlaceholderText("后缀，如 _watermarked")
        name_row.addWidget(QLabel("命名："))
        name_row.addWidget(self.name_rule)
        name_row.addWidget(self.prefix_edit)
        name_row.addWidget(self.suffix_edit)
        # 格式和质量
        fmt_row = QHBoxLayout()
        self.fmt_combo = QComboBox(); self.fmt_combo.addItems(["png","jpeg"]) ; self.fmt_combo.setCurrentText("png")
        self.quality = QSpinBox(); self.quality.setRange(1,100); self.quality.setValue(90)
        fmt_row.addWidget(QLabel("格式：")); fmt_row.addWidget(self.fmt_combo)
        fmt_row.addWidget(QLabel("JPEG质量：")); fmt_row.addWidget(self.quality)
        # 尺寸调整
        resize_row = QHBoxLayout()
        self.resize_mode = QComboBox(); self.resize_mode.addItems(["none","width","height","percent"]) ; self.resize_mode.setCurrentText("none")
        self.resize_value = QSpinBox(); self.resize_value.setRange(1, 10000); self.resize_value.setValue(100)
        resize_row.addWidget(QLabel("缩放：")); resize_row.addWidget(self.resize_mode); resize_row.addWidget(self.resize_value)
        # 导出按钮
        self.btn_export = QPushButton("批量导出…")
        self.btn_export.clicked.connect(self.on_export)
        exp_l.addLayout(out_row)
        exp_l.addLayout(name_row)
        exp_l.addLayout(fmt_row)
        exp_l.addLayout(resize_row)
        exp_l.addWidget(self.btn_export)
        right_layout.addWidget(exp)
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
        # 快捷导出
        act_export = QAction("批量导出…", self)
        act_export.triggered.connect(self.on_export)
        file_menu.addAction(act_export)

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
        self._update_export_enabled()

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
        # 切换预设位置时，重置手动偏移，避免叠加
        self.preview.offset = QPoint(-16, -16)
        # 立即收起下拉，避免用户感知为“卡住”
        try:
            self.anchor_combo.hidePopup()
        except Exception:
            pass
        text = self.text_edit.toPlainText().strip()
        # 将重绘延迟到下一帧，让下拉先关闭
        val = self.opacity_slider.value()/100.0
        QTimer.singleShot(0, lambda a=anchor, t=text, v=val: self.preview.set_watermark(t, v, anchor=a))

    def on_pick_out_dir(self):
        d = QFileDialog.getExistingDirectory(self, "选择输出目录", os.getcwd())
        if d:
            self.out_dir_edit.setText(d)

    def _offset_ratio(self) -> tuple[float,float]:
        # 将当前预览 offset 映射为相对原图的比例（基于当前预览图尺寸与原图尺寸不一致情况，采用相对百分比更稳）
        # 这里预览层内没有原图尺寸，先用相对于预览图的百分比；导出时按原图宽高乘算
        if not hasattr(self.preview, '_pil_base'):
            return (0.0, 0.0)
        img = self.preview._pil_base
        # 计算当前文本宽高估算（用 Qt 与当前字号，保持一致）
        qfont = QFont(); qfont.setPointSize(int(max(6, min(400, self.preview.font_size))))
        fm = QFontMetrics(qfont)
        tw = max(1, fm.horizontalAdvance(self.preview.watermark_text or ""))
        th = max(1, fm.height())
        ax, ay = self.preview._anchor_pos(img.width, img.height, tw, th, self.preview.anchor)
        x = ax + self.preview.offset.x()
        y = ay + self.preview.offset.y()
        # 将与锚点的偏移换算成相对比例
        rx = (x - ax) / max(1, img.width)
        ry = (y - ay) / max(1, img.height)
        return (float(rx), float(ry))

    def on_export(self):
        if not self.images:
            QMessageBox.information(self, "提示", "请先导入图片")
            return
        out_dir = self.out_dir_edit.text().strip()
        if not out_dir:
            QMessageBox.warning(self, "输出目录", "请选择输出目录")
            return
        # 防止导出到原文件夹（默认禁止）
        first_dir = os.path.dirname(self.images[0])
        if os.path.abspath(out_dir) == os.path.abspath(first_dir):
            QMessageBox.warning(self, "输出目录", "为防止覆盖原图，禁止导出到原图所在目录，请选择其他位置")
            return
        fmt = self.fmt_combo.currentText().lower()
        name_rule = self.name_rule.currentText()
        prefix = self.prefix_edit.text().strip()
        suffix = self.suffix_edit.text().strip()
        jpeg_quality = self.quality.value()
        rmode = self.resize_mode.currentText()
        resize_mode = None if rmode == 'none' else rmode
        resize_value = self.resize_value.value() if resize_mode else None
        settings = ExportSettings(
            output_dir=out_dir,
            fmt=fmt,
            name_rule=name_rule,
            prefix=prefix,
            suffix=suffix,
            jpeg_quality=jpeg_quality,
            resize_mode=resize_mode,
            resize_value=resize_value,
        )
        text = self.text_edit.toPlainText().strip()
        if not text:
            QMessageBox.warning(self, "水印内容", "请输入文本水印内容")
            return
        offset_ratio = self._offset_ratio()
        ok, fail = export_batch(
            self.images,
            text=text,
            font_size=self.preview.font_size,
            color_rgb=self.preview.color_rgb,
            opacity=self.preview.opacity,
            anchor=self.preview.anchor,
            offset_ratio=offset_ratio,
            settings=settings,
        )
        QMessageBox.information(self, "导出完成", f"成功 {ok} 张，失败 {fail} 张。文件保存在：\n{out_dir}")
        # 导出后保持列表不变；如需清空可在此添加操作

    # ---------- 列表管理 ----------
    def remove_selected_images(self):
        items = self.list_widget.selectedItems()
        if not items:
            QMessageBox.information(self, "提示", "请选择要移除的图片")
            return
        remove_paths = {it.data(Qt.ItemDataRole.UserRole) for it in items}
        # 从模型中移除
        self.images = [p for p in self.images if p not in remove_paths]
        # 从视图中移除
        for it in items:
            row = self.list_widget.row(it)
            self.list_widget.takeItem(row)
        # 更新预览
        if self.list_widget.count() > 0:
            self.list_widget.setCurrentRow(0)
        else:
            if hasattr(self.preview, '_pil_base'):
                try:
                    delattr(self.preview, '_pil_base')
                except Exception:
                    pass
            self.preview.update_composite()
        self._update_export_enabled()

    def clear_all_images(self):
        if not self.images:
            return
        self.images.clear()
        self.list_widget.clear()
        if hasattr(self.preview, '_pil_base'):
            try:
                delattr(self.preview, '_pil_base')
            except Exception:
                pass
        self.preview.update_composite()
        self._update_export_enabled()

    def _update_export_enabled(self):
        # 没有图片时禁用导出按钮
        try:
            self.btn_export.setEnabled(bool(self.images))
        except Exception:
            pass

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
