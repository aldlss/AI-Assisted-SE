# -*- coding: utf-8 -*-
"""预览合成器：负责将文本水印绘制到图像上。

当前实现聚焦文本水印，后续可扩展图片水印与旋转。
"""
from __future__ import annotations
from typing import Tuple, Optional
from PIL import Image, ImageDraw, ImageFont


def compose_text_watermark(
    base_rgba: Image.Image,
    *,
    text: str,
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
    color_rgba: Tuple[int, int, int, int],
    pos_xy: Tuple[int, int],
) -> Image.Image:
    """在 base_rgba 上绘制文本，返回新图。

    参数：
    - base_rgba: RGBA 模式图像
    - text: 文本内容
    - font: 已创建好的字体对象
    - color_rgba: (r,g,b,a)
    - pos_xy: 左上角位置 (x, y)
    """
    if base_rgba.mode != "RGBA":
        img = base_rgba.convert("RGBA")
    else:
        img = base_rgba.copy()
    if not text:
        return img

    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.text(pos_xy, text, font=font, fill=color_rgba)
    return Image.alpha_composite(img, layer)
