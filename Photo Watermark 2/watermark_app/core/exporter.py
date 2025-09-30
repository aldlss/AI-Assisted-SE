# -*- coding: utf-8 -*-
"""批量导出水印图片。

- 命名规则：原名 / 前缀 / 后缀，冲突自动追加 _1, _2
- 输出格式：PNG / JPEG（可调质量）
- 可选尺寸调整：按宽/高/百分比（保留等比；缺省不缩放）
- 文本水印：使用 Qt 绘制，确保字号一致
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Iterable, Tuple, Optional
import os
from PIL import Image, ImageQt
from PySide6.QtGui import QFont, QFontMetrics, QImage, QPainter, QColor


@dataclass
class ExportSettings:
    output_dir: str
    fmt: str  # 'png' | 'jpeg'
    name_rule: str  # 'keep' | 'prefix' | 'suffix'
    prefix: str = ""
    suffix: str = ""
    jpeg_quality: int = 90  # 0-100
    resize_mode: Optional[str] = None  # None | 'width' | 'height' | 'percent'
    resize_value: Optional[int] = None


def _safe_filename(base_name: str, output_dir: str) -> str:
    name, ext = os.path.splitext(base_name)
    target = os.path.join(output_dir, base_name)
    i = 1
    while os.path.exists(target):
        target = os.path.join(output_dir, f"{name}_{i}{ext}")
        i += 1
    return target


def _apply_naming(path: str, settings: ExportSettings, out_ext: str) -> str:
    base = os.path.basename(path)
    stem, _ = os.path.splitext(base)
    if settings.name_rule == 'prefix' and settings.prefix:
        stem = f"{settings.prefix}{stem}"
    elif settings.name_rule == 'suffix' and settings.suffix:
        stem = f"{stem}{settings.suffix}"
    return f"{stem}.{out_ext}"


def _measure_text_qt(text: str, font_size: int) -> Tuple[int, int, int]:
    qfont = QFont()
    qfont.setPixelSize(int(max(6, min(400, font_size))))
    fm = QFontMetrics(qfont)
    tw = max(1, fm.horizontalAdvance(text))
    th = max(1, fm.height())
    return tw, th, fm.ascent()


def _render_text_image(text: str, font_size: int, color_rgb: Tuple[int, int, int], opacity: float) -> Image.Image:
    tw, th, ascent = _measure_text_qt(text, font_size)
    qimg = QImage(tw, th, QImage.Format.Format_ARGB32_Premultiplied)
    qimg.fill(0)
    painter = QPainter(qimg)
    painter.setRenderHint(QPainter.Antialiasing, True)
    painter.setRenderHint(QPainter.TextAntialiasing, True)
    painter.setPen(QColor(color_rgb[0], color_rgb[1], color_rgb[2], int(255*opacity)))
    qfont = QFont()
    qfont.setPixelSize(int(max(6, min(400, font_size))))
    painter.setFont(qfont)
    painter.drawText(0, ascent, text)
    painter.end()
    return ImageQt.fromqimage(qimg).convert('RGBA')


def _anchor_pos(W: int, H: int, tw: int, th: int, anchor: str) -> Tuple[int, int]:
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
    return mapping.get(anchor, mapping['bottom-right'])


def _maybe_resize(img: Image.Image, settings: ExportSettings) -> Image.Image:
    if not settings.resize_mode or not settings.resize_value:
        return img
    mode = settings.resize_mode
    val = int(settings.resize_value)
    W, H = img.width, img.height
    if mode == 'width' and val > 0:
        ratio = val / W
        return img.resize((val, max(1, int(H*ratio))), Image.LANCZOS)
    if mode == 'height' and val > 0:
        ratio = val / H
        return img.resize((max(1, int(W*ratio)), val), Image.LANCZOS)
    if mode == 'percent' and val > 0:
        ratio = val / 100.0
        return img.resize((max(1, int(W*ratio)), max(1, int(H*ratio))), Image.LANCZOS)
    return img


def export_batch(
    image_paths: Iterable[str],
    *,
    text: str,
    font_size: int,
    color_rgb: Tuple[int, int, int],
    opacity: float,
    anchor: str,
    offset_ratio: Tuple[float, float],  # 相对偏移（基于预览尺寸）
    settings: ExportSettings,
) -> Tuple[int, int]:
    """导出所有图片。

    返回 (success_count, fail_count)
    """
    os.makedirs(settings.output_dir, exist_ok=True)
    ok, fail = 0, 0
    for p in image_paths:
        try:
            # 加载原图
            base = Image.open(p).convert('RGBA')
            W, H = base.width, base.height
            # 渲染文本图
            text_img = _render_text_image(text, font_size, color_rgb, opacity)
            tw, th = text_img.width, text_img.height
            # 计算位置
            ax, ay = _anchor_pos(W, H, tw, th, anchor)
            ox = int(offset_ratio[0] * W)
            oy = int(offset_ratio[1] * H)
            x = ax + ox
            y = ay + oy
            # 合成
            layer = Image.new('RGBA', base.size, (0,0,0,0))
            layer.paste(text_img, (x, y), text_img)
            out = Image.alpha_composite(base, layer)
            # 尺寸调整（如配置）
            out = _maybe_resize(out, settings)
            # 命名与保存
            out_ext = 'png' if settings.fmt.lower() == 'png' else 'jpg'
            named = _apply_naming(p, settings, out_ext)
            target = _safe_filename(named, settings.output_dir)
            if out_ext == 'png':
                out.convert('RGBA').save(target, format='PNG')
            else:
                out.convert('RGB').save(target, format='JPEG', quality=int(settings.jpeg_quality), optimize=True)
            ok += 1
        except Exception:
            fail += 1
    return ok, fail
