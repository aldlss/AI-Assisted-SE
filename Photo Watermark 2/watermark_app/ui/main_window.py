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
import json
from datetime import datetime
from PySide6.QtCore import Qt, QSize, QPoint, QTimer, Signal, QStandardPaths, QUrl
from PySide6.QtGui import (
    QAction,
    QPixmap,
    QIcon,
    QDragEnterEvent,
    QDropEvent,
    QPainter,
    QColor,
    QFont,
    QFontMetrics,
    QImage,
    QDesktopServices,
)
from PySide6.QtWidgets import (
    QMainWindow,
    QWidget,
    QListWidget,
    QListWidgetItem,
    QFileDialog,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QTextEdit,
    QSlider,
    QSplitter,
    QMessageBox,
    QSizePolicy,
    QGroupBox,
    QApplication,
    QComboBox,
    QColorDialog,
    QSpinBox,
    QLineEdit,
    QInputDialog,
    QDialog,
    QPushButton,
)
from PIL import Image, ImageQt, ImageDraw, ImageFont
from ..core.image_loader import ImageLoader
from ..core.preview_composer import compose_text_watermark
from ..core.exporter import export_batch, ExportSettings

SUPPORTED_EXT = {'.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff'}

class PreviewLabel(QLabel):
    """用于显示预览图的标签，支持文本/图片水印与拖拽定位。"""
    # 预览内调整缩放时对外通知（用于同步右侧 SpinBox）
    scaleChanged = Signal(int)
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setStyleSheet("background:#222; border:1px solid #444;")
        self._base_qpix: Optional[QPixmap] = None
        self._composed_qpix: Optional[QPixmap] = None
        # 文本水印参数
        self.watermark_text = "示例水印"
        self.opacity = 0.5
        self.font_size = 32
        self.color_rgb = (255, 255, 255)
        self.anchor = "bottom-right"
        self.offset = QPoint(-16, -16)
        self._dragging = False
        self._drag_start = QPoint(0, 0)
        # 字体缓存
        self._font_cache = {}
        self._font_path = None
        # 图片水印参数
        self.wm_mode = 'text'  # 'text' | 'image'
        self.wm_image_pil = None
        self.wm_scale = 20
        # 通用旋转角度（度数，-180~180，文本/图片通用）
        self.rotation = 0

    def load_image(self, path: str):
        if not os.path.isfile(path):
            return
        try:
            img = Image.open(path)
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

    def set_watermark_mode(self, mode: str):
        if mode in ('text', 'image'):
            self.wm_mode = mode
            self.update_composite()

    def set_image_watermark(self, path: Optional[str] = None, scale: Optional[int] = None):
        if path:
            try:
                img = Image.open(path).convert('RGBA')
                self.wm_image_pil = img
            except Exception:
                self.wm_image_pil = None
        if scale is not None:
            self.wm_scale = max(1, min(400, int(scale)))
        self.update_composite()

    def set_rotation(self, angle: int):
        # 统一限制范围，方便 UI 与滚轮等输入
        ang = int(angle)
        if ang < -180:
            ang = -180
        elif ang > 180:
            ang = 180
        if ang != self.rotation:
            self.rotation = ang
            self.update_composite()

    def update_composite(self):
        if not hasattr(self, '_pil_base'):
            self.clear()
            self.setText("未选择图片")
            return
        img = self._pil_base.copy()
        if self.wm_mode == 'image' and self.wm_image_pil is not None:
            wm = self.wm_image_pil.copy()
            target_w = max(1, int(img.width * self.wm_scale / 100.0))
            ratio = target_w / wm.width
            wm = wm.resize((target_w, max(1, int(wm.height * ratio))), Image.LANCZOS)
            if self.opacity < 1.0:
                if wm.mode != 'RGBA':
                    wm = wm.convert('RGBA')
                r, g, b, a = wm.split()
                a = a.point(lambda v: int(v * self.opacity))
                wm = Image.merge('RGBA', (r, g, b, a))
            if self.rotation:
                wm = wm.rotate(self.rotation, expand=True, resample=Image.BICUBIC)
            tw, th = wm.width, wm.height
            ax, ay = self._anchor_pos(img.width, img.height, tw, th, self.anchor)
            x = int(ax + self.offset.x())
            y = int(ay + self.offset.y())
            layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
            layer.paste(wm, (x, y), wm)
            img = Image.alpha_composite(img, layer)
        else:
            text = self.watermark_text or ""
            if text:
                eff_px = int(max(6, min(400, self.font_size)))
                qfont = QFont(); qfont.setPixelSize(eff_px)
                fm = QFontMetrics(qfont)
                tw = max(1, fm.horizontalAdvance(text))
                th = max(1, fm.height())
                ax, ay = self._anchor_pos(img.width, img.height, tw, th, self.anchor)
                x = int(ax + self.offset.x())
                y = int(ay + self.offset.y())
                qimg = QImage(tw, th, QImage.Format.Format_ARGB32_Premultiplied)
                qimg.fill(0)
                painter = QPainter(qimg)
                painter.setRenderHint(QPainter.Antialiasing, True)
                painter.setRenderHint(QPainter.TextAntialiasing, True)
                painter.setPen(QColor(self.color_rgb[0], self.color_rgb[1], self.color_rgb[2], int(255 * self.opacity)))
                painter.setFont(qfont)
                painter.drawText(0, fm.ascent(), text)
                painter.end()
                text_pil = ImageQt.fromqimage(qimg).convert("RGBA")
                if self.rotation:
                    text_pil = text_pil.rotate(
                        self.rotation, expand=True, resample=Image.BICUBIC
                    )
                layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
                layer.paste(text_pil, (x, y), text_pil)
                img = Image.alpha_composite(img, layer)
        qimg = ImageQt.ImageQt(img)
        self._composed_qpix = QPixmap.fromImage(qimg)
        self.setPixmap(self._composed_qpix)

    def wheelEvent(self, e):
        # 在图片水印模式下，滚轮直接调整缩放百分比；Ctrl=精细(1%)，Shift=粗调(10%)，默认5%
        if self.wm_mode == 'image' and self.wm_image_pil is not None:
            delta = e.angleDelta().y()
            if delta == 0:
                return
            mods = e.modifiers()
            step = 5
            if mods & Qt.KeyboardModifier.ControlModifier:
                step = 1
            elif mods & Qt.KeyboardModifier.ShiftModifier:
                step = 10
            change = step if delta > 0 else -step
            new_scale = max(1, min(400, int(self.wm_scale + change)))
            if new_scale != self.wm_scale:
                self.wm_scale = new_scale
                self.update_composite()
                try:
                    self.scaleChanged.emit(int(self.wm_scale))
                except Exception:
                    pass
            e.accept()
        else:
            super().wheelEvent(e)

    def _get_font(self, size: int):
        key = (self._font_path, int(size))
        if key in self._font_cache:
            return self._font_cache[key]
        if self._font_path is None:
            candidates = [
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/usr/share/fonts/dejavu/DejaVuSans.ttf",
                "/Library/Fonts/Arial.ttf",
                "/System/Library/Fonts/Supplemental/Arial.ttf",
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
                try:
                    f = ImageFont.truetype("DejaVuSans.ttf", max(6, int(size)))
                except Exception:
                    f = ImageFont.truetype("arial.ttf", max(6, int(size)))
        except Exception:
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
        # 启动时自动加载上次设置或默认模板
        try:
            self._autoload_last_or_default()
        except Exception:
            pass

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
        add_row = QHBoxLayout()
        btn_add_files = QPushButton("导入文件…")
        btn_add_files.clicked.connect(self.import_files_dialog)
        btn_add_dir = QPushButton("导入文件夹…")
        btn_add_dir.clicked.connect(self.import_folder_dialog)
        add_row.addWidget(btn_add_files)
        add_row.addWidget(btn_add_dir)
        left_layout.addLayout(add_row)
        # 移除/清空
        rm_row = QHBoxLayout()
        btn_remove = QPushButton("移除所选"); btn_remove.clicked.connect(self.remove_selected_images)
        btn_clear = QPushButton("清空列表"); btn_clear.clicked.connect(self.clear_all_images)
        rm_row.addWidget(btn_remove); rm_row.addWidget(btn_clear)
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
        group = QGroupBox("水印设置")
        g_layout = QVBoxLayout(group)
        # 水印类型
        type_row = QHBoxLayout()
        self.wm_type_combo = QComboBox(); self.wm_type_combo.addItems(["文本", "图片"])
        self.wm_type_combo.currentTextChanged.connect(self.on_wm_type_change)
        type_row.addWidget(QLabel("水印类型：")); type_row.addWidget(self.wm_type_combo)
        g_layout.addLayout(type_row)
        # 文本水印控件
        self.text_edit = QTextEdit(); self.text_edit.setPlaceholderText("输入水印文本…")
        self.text_edit.textChanged.connect(self.on_text_change)
        self.opacity_slider = QSlider(Qt.Orientation.Horizontal); self.opacity_slider.setRange(0, 100); self.opacity_slider.setValue(50)
        self.opacity_slider.valueChanged.connect(self.on_opacity_change)
        self.font_size_spin = QSpinBox(); self.font_size_spin.setRange(6, 400); self.font_size_spin.setValue(32)
        self.font_size_spin.valueChanged.connect(self.on_font_size_change)
        color_row = QHBoxLayout()
        self.btn_color = QPushButton("选择颜色…"); self.btn_color.clicked.connect(self.on_pick_color)
        self.lbl_color = QLabel("#FFFFFF"); color_row.addWidget(self.btn_color); color_row.addWidget(self.lbl_color)
        self.anchor_combo = QComboBox()
        self.anchor_combo.addItems(["top-left","top-center","top-right","middle-left","center","middle-right","bottom-left","bottom-center","bottom-right"])
        self.anchor_combo.setCurrentText("bottom-right"); self.anchor_combo.currentTextChanged.connect(self.on_anchor_change)
        # 图片水印控件
        img_row1 = QHBoxLayout()
        self.wm_img_path = QLineEdit(); self.wm_img_path.setPlaceholderText("选择 PNG/JPG 作为水印…")
        self.wm_img_btn = QPushButton("选择水印图片…"); self.wm_img_btn.clicked.connect(self.on_pick_wm_image)
        img_row1.addWidget(self.wm_img_path); img_row1.addWidget(self.wm_img_btn)
        img_row2 = QHBoxLayout()
        self.wm_scale_spin = QSpinBox(); self.wm_scale_spin.setRange(1, 400); self.wm_scale_spin.setValue(20)
        self.wm_scale_spin.valueChanged.connect(self.on_wm_scale_change)
        img_row2.addWidget(QLabel("水印缩放（% 宽）：")); img_row2.addWidget(self.wm_scale_spin)
        # 旋转角度控件（文本/图片通用）
        rot_row = QHBoxLayout()
        self.rot_spin = QSpinBox()
        self.rot_spin.setRange(-180, 180)
        self.rot_spin.setValue(0)
        self.rot_spin.valueChanged.connect(self.on_rotation_change)
        rot_row.addWidget(QLabel("旋转角度（°）："))
        rot_row.addWidget(self.rot_spin)
        # 装配
        g_layout.addWidget(QLabel("水印文本：")); g_layout.addWidget(self.text_edit)
        g_layout.addWidget(QLabel("透明度：")); g_layout.addWidget(self.opacity_slider)
        g_layout.addWidget(QLabel("字号：")); g_layout.addWidget(self.font_size_spin)
        g_layout.addWidget(QLabel("颜色：")); g_layout.addLayout(color_row)
        g_layout.addWidget(QLabel("位置预设：")); g_layout.addWidget(self.anchor_combo)
        g_layout.addLayout(img_row1)
        g_layout.addLayout(img_row2)
        g_layout.addLayout(rot_row)
        right_layout.addWidget(group)
        # 根据当前模式初始化控件启用状态
        self._toggle_watermark_controls()
        # 同步：预览滚轮缩放 -> SpinBox
        try:
            self.preview.scaleChanged.connect(self.wm_scale_spin.setValue)
        except Exception:
            pass

        # 导出面板
        exp = QGroupBox("导出")
        exp_l = QVBoxLayout(exp)
        out_row = QHBoxLayout()
        self.out_dir_edit = QLineEdit(); self.out_dir_btn = QPushButton("选择输出目录…"); self.out_dir_btn.clicked.connect(self.on_pick_out_dir)
        out_row.addWidget(self.out_dir_edit); out_row.addWidget(self.out_dir_btn)
        name_row = QHBoxLayout()
        self.name_rule = QComboBox(); self.name_rule.addItems(["keep","prefix","suffix"]) ; self.prefix_edit = QLineEdit(); self.prefix_edit.setPlaceholderText("前缀，如 wm_")
        self.suffix_edit = QLineEdit(); self.suffix_edit.setPlaceholderText("后缀，如 _watermarked")
        name_row.addWidget(QLabel("命名：")); name_row.addWidget(self.name_rule); name_row.addWidget(self.prefix_edit); name_row.addWidget(self.suffix_edit)
        fmt_row = QHBoxLayout()
        self.fmt_combo = QComboBox(); self.fmt_combo.addItems(["png","jpeg"]) ; self.fmt_combo.setCurrentText("png")
        self.quality = QSpinBox(); self.quality.setRange(1,100); self.quality.setValue(90)
        fmt_row.addWidget(QLabel("格式：")); fmt_row.addWidget(self.fmt_combo); fmt_row.addWidget(QLabel("JPEG质量：")); fmt_row.addWidget(self.quality)
        resize_row = QHBoxLayout()
        self.resize_mode = QComboBox(); self.resize_mode.addItems(["none","width","height","percent"]) ; self.resize_mode.setCurrentText("none")
        self.resize_value = QSpinBox(); self.resize_value.setRange(1, 10000); self.resize_value.setValue(100)
        resize_row.addWidget(QLabel("缩放：")); resize_row.addWidget(self.resize_mode); resize_row.addWidget(self.resize_value)
        self.btn_export = QPushButton("导出选中…")
        self.btn_export.clicked.connect(self.on_export)
        exp_l.addLayout(out_row); exp_l.addLayout(name_row); exp_l.addLayout(fmt_row); exp_l.addLayout(resize_row); exp_l.addWidget(self.btn_export)
        right_layout.addWidget(exp); right_layout.addStretch(1)

        splitter.addWidget(left_widget)
        splitter.addWidget(self.preview)
        splitter.addWidget(right_widget)
        splitter.setSizes([260, 800, 300])

        # 菜单占位
        file_menu = self.menuBar().addMenu("文件")
        act_import_files = QAction("导入文件…", self); act_import_files.triggered.connect(self.import_files_dialog); file_menu.addAction(act_import_files)
        act_import_dir = QAction("导入文件夹…", self); act_import_dir.triggered.connect(self.import_folder_dialog); file_menu.addAction(act_import_dir)
        act_export = QAction("导出选中…", self); act_export.triggered.connect(self.on_export); file_menu.addAction(act_export)
        # 模板菜单
        tpl_menu = self.menuBar().addMenu("模板")
        act_save_tpl = QAction("保存为模板…", self)
        act_save_tpl.triggered.connect(self.save_template_dialog)
        tpl_menu.addAction(act_save_tpl)
        act_load_tpl = QAction("应用模板…", self)
        act_load_tpl.triggered.connect(self.load_template_dialog)
        tpl_menu.addAction(act_load_tpl)
        act_manage_tpl = QAction("管理模板…", self)
        act_manage_tpl.triggered.connect(self.manage_templates_dialog)
        tpl_menu.addAction(act_manage_tpl)
        tpl_menu.addSeparator()
        act_open_dir = QAction("打开模板文件夹", self)
        act_open_dir.triggered.connect(self.open_template_dir)
        tpl_menu.addAction(act_open_dir)
        act_show_path = QAction("显示模板路径…", self)
        act_show_path.triggered.connect(self.show_template_path)
        tpl_menu.addAction(act_show_path)

    # ---------- 功能：导入 ----------
    def import_images_dialog(self):
        """兼容旧菜单：等价于导入文件…"""
        self.import_files_dialog()

    def import_files_dialog(self):
        paths, _ = QFileDialog.getOpenFileNames(
            self,
            "选择图片文件",
            os.getcwd(),
            "Images (*.jpg *.jpeg *.png *.bmp *.tif *.tiff)"
        )
        if not paths:
            return
        self.add_images(paths)

    def import_folder_dialog(self):
        d = QFileDialog.getExistingDirectory(self, "选择图片文件夹", os.getcwd())
        if not d:
            return
        paths: List[str] = []
        for root, _, files in os.walk(d):
            for fn in files:
                fp = os.path.join(root, fn)
                ext = os.path.splitext(fp)[1].lower()
                if ext in SUPPORTED_EXT:
                    paths.append(fp)
        if paths:
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

    def on_wm_type_change(self, t: str):
        mode = 'text' if t == '文本' else 'image'
        self.preview.set_watermark_mode(mode)
        self._toggle_watermark_controls()

    def on_pick_wm_image(self):
        path, _ = QFileDialog.getOpenFileName(self, "选择水印图片", os.getcwd(), "Images (*.png *.jpg *.jpeg *.bmp *.tif *.tiff)")
        if not path:
            return
        self.wm_img_path.setText(path)
        self.preview.set_image_watermark(path=path)

    def on_wm_scale_change(self, v: int):
        self.preview.set_image_watermark(scale=v)

    def on_rotation_change(self, v: int):
        # 文本/图片通用旋转角度
        try:
            self.preview.set_rotation(int(v))
        except Exception:
            pass

    # （已移除“字号百分比模式”，保留纯像素字号）

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
        # 校验所需字段
        if getattr(self.preview, 'wm_mode', 'text') == 'text':
            if not text:
                QMessageBox.warning(self, "水印内容", "请输入文本水印内容")
                return
        else:
            if not self.preview.wm_image_pil:
                QMessageBox.warning(self, "水印图片", "请选择水印图片文件")
                return
        offset_ratio = self._offset_ratio()
        # 改为仅导出“所选”图片；未选择时给出提示。
        selected_items = self.list_widget.selectedItems()
        if not selected_items:
            QMessageBox.information(self, "导出", "请在左侧列表选择要导出的图片（支持多选）")
            return
        target_paths = [it.data(Qt.ItemDataRole.UserRole) for it in selected_items]
        ok, fail = self._export_preview_like_batch(target_paths, text, settings)
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

    # ========== 模板：存取与应用 ==========
    def _appdata_dir(self) -> str:
        """项目本地存储目录：项目根目录下 data/，失败则回退到当前工作目录 data/。"""
        try:
            # main_window.py 位于 project_root/watermark_app/ui/main_window.py
            project_root = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "..")
            )
            d = os.path.join(project_root, "data")
            os.makedirs(d, exist_ok=True)
            return d
        except Exception:
            # 退回到当前工作目录
            d = os.path.abspath(os.path.join(os.getcwd(), "data"))
            try:
                os.makedirs(d, exist_ok=True)
            except Exception:
                pass
            return d

    def _templates_file(self) -> str:
        return os.path.join(self._appdata_dir(), "templates.json")

    def _last_file(self) -> str:
        return os.path.join(self._appdata_dir(), "last.json")

    def _read_json(self, path: str, default):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return default

    def _write_json(self, path: str, data) -> None:
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def _collect_current_settings(self) -> dict:
        # 采集当前所有水印相关参数
        mode = "text" if self.wm_type_combo.currentText() == "文本" else "image"
        text = self.text_edit.toPlainText()
        settings = {
            "mode": mode,
            "text": text,
            "opacity": float(self.opacity_slider.value()) / 100.0,
            "font_size": int(self.font_size_spin.value()),
            "color_rgb": list(getattr(self.preview, "color_rgb", (255, 255, 255))),
            "anchor": self.anchor_combo.currentText(),
            "offset": [int(self.preview.offset.x()), int(self.preview.offset.y())],
            "rotation": int(getattr(self.preview, "rotation", 0)),
            "wm_image_path": self.wm_img_path.text().strip(),
            "wm_scale": int(self.wm_scale_spin.value()),
        }
        return settings

    def _apply_settings(self, s: dict):
        try:
            mode = s.get("mode", "text")
            # 切换模式
            self.wm_type_combo.setCurrentText("文本" if mode == "text" else "图片")
            self._toggle_watermark_controls()

            # 通用
            self.text_edit.blockSignals(True)
            self.text_edit.setPlainText(s.get("text", ""))
            self.text_edit.blockSignals(False)
            self.opacity_slider.blockSignals(True)
            self.opacity_slider.setValue(
                int(max(0, min(100, round(float(s.get("opacity", 0.5)) * 100))))
            )
            self.opacity_slider.blockSignals(False)
            self.font_size_spin.blockSignals(True)
            self.font_size_spin.setValue(int(s.get("font_size", 32)))
            self.font_size_spin.blockSignals(False)
            col = tuple(s.get("color_rgb", [255, 255, 255]))
            self.lbl_color.setText(f"#{col[0]:02X}{col[1]:02X}{col[2]:02X}")
            self.anchor_combo.blockSignals(True)
            self.anchor_combo.setCurrentText(s.get("anchor", "bottom-right"))
            self.anchor_combo.blockSignals(False)
            off = s.get("offset", [-16, -16])
            self.preview.offset = QPoint(int(off[0]), int(off[1]))
            self.rot_spin.blockSignals(True)
            self.rot_spin.setValue(int(s.get("rotation", 0)))
            self.rot_spin.blockSignals(False)

            # 应用到底层预览
            self.preview.set_watermark(
                self.text_edit.toPlainText().strip(),
                float(self.opacity_slider.value()) / 100.0,
                font_size=int(self.font_size_spin.value()),
                color_rgb=col,
                anchor=self.anchor_combo.currentText(),
            )

            # 图片水印
            wm_path = s.get("wm_image_path", "").strip()
            if wm_path:
                self.wm_img_path.setText(wm_path)
                self.preview.set_image_watermark(path=wm_path)
            self.wm_scale_spin.blockSignals(True)
            self.wm_scale_spin.setValue(int(s.get("wm_scale", 20)))
            self.wm_scale_spin.blockSignals(False)
            if mode == "image":
                self.preview.set_image_watermark(scale=int(self.wm_scale_spin.value()))

            # 旋转
            try:
                self.preview.set_rotation(int(self.rot_spin.value()))
            except Exception:
                pass

            self.preview.update_composite()
        except Exception:
            pass

    def _autoload_last_or_default(self):
        # 优先 last.json；如不存在，则若有 templates.json 且包含“默认”则加载；否则创建默认并保存。
        last_path = self._last_file()
        last = self._read_json(last_path, None)
        if isinstance(last, dict) and last.get("settings"):
            self._apply_settings(last["settings"])
            return
        # 尝试默认模板
        tpls = self._read_json(self._templates_file(), {})
        default_tpl = tpls.get("默认")
        if isinstance(default_tpl, dict) and default_tpl.get("settings"):
            self._apply_settings(default_tpl["settings"])
            return
        # 构造并保存默认
        default = {
            "name": "默认",
            "created_at": datetime.now().isoformat(),
            "settings": self._collect_current_settings(),
        }
        tpls["默认"] = default
        self._write_json(self._templates_file(), tpls)
        self._write_json(last_path, {"settings": default["settings"]})

    def _save_last_settings(self):
        data = {
            "settings": self._collect_current_settings(),
            "saved_at": datetime.now().isoformat(),
        }
        self._write_json(self._last_file(), data)

    def closeEvent(self, event):
        try:
            self._save_last_settings()
        finally:
            super().closeEvent(event)

    # ----- 模板：交互 -----
    def save_template_dialog(self):
        name, ok = QInputDialog.getText(self, "保存模板", "模板名称：")
        if not ok or not name.strip():
            return
        name = name.strip()
        tpls = self._read_json(self._templates_file(), {})
        tpls[name] = {
            "name": name,
            "created_at": datetime.now().isoformat(),
            "settings": self._collect_current_settings(),
        }
        self._write_json(self._templates_file(), tpls)
        QMessageBox.information(self, "模板", f"已保存模板：{name}")

    def load_template_dialog(self):
        tpls = self._read_json(self._templates_file(), {})
        names = sorted(tpls.keys())
        if not names:
            QMessageBox.information(self, "模板", "暂无模板，请先保存模板。")
            return
        name, ok = QInputDialog.getItem(self, "应用模板", "选择模板：", names, 0, False)
        if not ok:
            return
        tpl = tpls.get(name)
        if tpl and tpl.get("settings"):
            self._apply_settings(tpl["settings"])
            # 同时保存为 last
            self._write_json(
                self._last_file(),
                {
                    "settings": tpl["settings"],
                    "from": name,
                    "saved_at": datetime.now().isoformat(),
                },
            )

    def manage_templates_dialog(self):
        tpls = self._read_json(self._templates_file(), {})
        if not tpls:
            QMessageBox.information(self, "模板", "暂无模板。")
            return
        dlg = QDialog(self)
        dlg.setWindowTitle("管理模板")
        v = QVBoxLayout(dlg)
        lst = QListWidget(dlg)
        for n in sorted(tpls.keys()):
            lst.addItem(n)
        v.addWidget(lst)
        btn_row = QHBoxLayout()
        btn_del = QPushButton("删除所选", dlg)
        btn_close = QPushButton("关闭", dlg)
        btn_row.addWidget(btn_del)
        btn_row.addStretch(1)
        btn_row.addWidget(btn_close)
        v.addLayout(btn_row)

        def on_del():
            it = lst.currentItem()
            if not it:
                return
            name = it.text()
            if name in tpls:
                ret = QMessageBox.question(dlg, "删除模板", f"确认删除模板：{name}？")
                if ret == QMessageBox.StandardButton.Yes:
                    tpls.pop(name, None)
                    self._write_json(self._templates_file(), tpls)
                    row = lst.row(it)
                    lst.takeItem(row)

        btn_del.clicked.connect(on_del)
        btn_close.clicked.connect(dlg.accept)
        dlg.exec()

    def open_template_dir(self):
        try:
            d = self._appdata_dir()
            QDesktopServices.openUrl(QUrl.fromLocalFile(d))
        except Exception:
            QMessageBox.information(self, "模板", f"模板目录：\n{self._appdata_dir()}")

    def show_template_path(self):
        msg = f"模板库: {self._templates_file()}\n上次设置: {self._last_file()}"
        QMessageBox.information(self, "模板路径", msg)

    # ---------- 预览等效渲染与导出 ----------
    def _export_preview_like_batch(
        self, paths: List[str], text: str, settings: ExportSettings
    ) -> tuple[int, int]:
        ok = fail = 0
        for p in paths:
            try:
                img = self._compose_preview_like(p, text)
                # 可选尺寸调整（在预览图基础上）
                if settings.resize_mode and settings.resize_value:
                    mode = settings.resize_mode
                    val = int(settings.resize_value)
                    if mode == "width":
                        ratio = val / img.width
                        new_size = (val, max(1, int(img.height * ratio)))
                        img = img.resize(new_size, Image.LANCZOS)
                    elif mode == "height":
                        ratio = val / img.height
                        new_size = (max(1, int(img.width * ratio)), val)
                        img = img.resize(new_size, Image.LANCZOS)
                    elif mode == "percent":
                        ratio = max(1, val) / 100.0
                        new_size = (
                            max(1, int(img.width * ratio)),
                            max(1, int(img.height * ratio)),
                        )
                        img = img.resize(new_size, Image.LANCZOS)
                # 保存
                out_path = self._build_output_path(p, settings)
                self._ensure_parent_dir(out_path)
                fmt = settings.fmt.lower()
                if fmt == "jpeg" or fmt == "jpg":
                    img_rgb = img.convert("RGB")
                    save_kwargs = {"quality": int(settings.jpeg_quality)}
                    img_rgb.save(out_path, format="JPEG", **save_kwargs)
                else:
                    img.save(out_path, format="PNG")
                ok += 1
            except Exception:
                fail += 1
        return ok, fail

    def _compose_preview_like(self, path: str, text: str) -> Image.Image:
        """按与预览一致的规则渲染水印，返回合成后的 PIL Image（RGBA）。"""
        # 载入与预览相同的缩放策略
        img = Image.open(path)
        max_w, max_h = 900, 700
        ratio = min(max_w / img.width, max_h / img.height, 1.0)
        if ratio < 1:
            img = img.resize(
                (int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS
            )
        img = img.convert("RGBA")
        if getattr(self.preview, 'wm_mode', 'text') == 'image' and self.preview.wm_image_pil is not None:
            wm = self.preview.wm_image_pil.copy()
            target_w = max(1, int(img.width * getattr(self.preview, 'wm_scale', 20) / 100.0))
            ratio = target_w / wm.width
            wm = wm.resize((target_w, max(1, int(wm.height * ratio))), Image.LANCZOS)
            if getattr(self.preview, 'opacity', 0.5) < 1.0:
                if wm.mode != 'RGBA':
                    wm = wm.convert('RGBA')
                r, g, b, a = wm.split()
                a = a.point(lambda v: int(v * getattr(self.preview, 'opacity', 0.5)))
                wm = Image.merge('RGBA', (r, g, b, a))
            rot = getattr(self.preview, "rotation", 0)
            if rot:
                wm = wm.rotate(int(rot), expand=True, resample=Image.BICUBIC)
            tw, th = wm.width, wm.height
            ax, ay = self.preview._anchor_pos(img.width, img.height, tw, th, getattr(self.preview, 'anchor', 'bottom-right'))
            x = int(ax + self.preview.offset.x())
            y = int(ay + self.preview.offset.y())
            layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
            layer.paste(wm, (x, y), wm)
            return Image.alpha_composite(img, layer)
        else:
            eff_px = int(max(6, min(400, getattr(self.preview, 'font_size', 32))))
            qfont = QFont(); qfont.setPixelSize(eff_px)
            fm = QFontMetrics(qfont)
            tw = max(1, fm.horizontalAdvance(text or ""))
            th = max(1, fm.height())
            ax, ay = self.preview._anchor_pos(img.width, img.height, tw, th, getattr(self.preview, 'anchor', 'bottom-right'))
            x = int(ax + self.preview.offset.x())
            y = int(ay + self.preview.offset.y())
            qimg = QImage(tw, th, QImage.Format.Format_ARGB32_Premultiplied)
            qimg.fill(0)
            painter = QPainter(qimg)
            painter.setRenderHint(QPainter.Antialiasing, True)
            painter.setRenderHint(QPainter.TextAntialiasing, True)
            r, g, b = getattr(self.preview, 'color_rgb', (255, 255, 255))
            alpha = int(255 * getattr(self.preview, 'opacity', 0.5))
            painter.setPen(QColor(r, g, b, alpha))
            painter.setFont(qfont)
            painter.drawText(0, fm.ascent(), text or "")
            painter.end()
            text_pil = ImageQt.fromqimage(qimg).convert('RGBA')
            rot = getattr(self.preview, "rotation", 0)
            if rot:
                text_pil = text_pil.rotate(
                    int(rot), expand=True, resample=Image.BICUBIC
                )
            layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
            layer.paste(text_pil, (x, y), text_pil)
            return Image.alpha_composite(img, layer)

    def _toggle_watermark_controls(self):
        # 根据水印类型启用/禁用控件
        is_text = (self.wm_type_combo.currentText() == '文本')
        # 文本相关
        self.text_edit.setEnabled(is_text)
        self.font_size_spin.setEnabled(is_text)
        self.btn_color.setEnabled(is_text)
        # 图片相关
        self.wm_img_path.setEnabled(not is_text)
        self.wm_img_btn.setEnabled(not is_text)
        self.wm_scale_spin.setEnabled(not is_text)

    def _build_output_path(self, src_path: str, settings: ExportSettings) -> str:
        base = os.path.basename(src_path)
        stem, _ = os.path.splitext(base)
        rule = settings.name_rule
        if rule == "prefix":
            stem = f"{settings.prefix or ''}{stem}"
        elif rule == "suffix":
            stem = f"{stem}{settings.suffix or ''}"
        ext = ".jpg" if settings.fmt.lower() in ("jpeg", "jpg") else ".png"
        out_dir = settings.output_dir
        # 避免重名覆盖
        candidate = os.path.join(out_dir, stem + ext)
        if not os.path.exists(candidate):
            return candidate
        i = 1
        while True:
            c = os.path.join(out_dir, f"{stem}({i}){ext}")
            if not os.path.exists(c):
                return c
            i += 1

    def _ensure_parent_dir(self, path: str):
        d = os.path.dirname(path)
        if d and not os.path.isdir(d):
            os.makedirs(d, exist_ok=True)

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
