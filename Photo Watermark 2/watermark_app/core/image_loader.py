# -*- coding: utf-8 -*-
"""图片加载与缩略图生成。

职责：
- 支持从文件/文件夹批量收集图片路径（按支持格式过滤）
- 生成并缓存缩略图到内存（后续可扩展文件缓存）
"""
from __future__ import annotations
import os
from dataclasses import dataclass
from typing import Iterable, List, Dict
from PIL import Image

SUPPORTED_EXT = {'.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff'}

@dataclass
class ImageItem:
    path: str

class ImageLoader:
    def __init__(self, thumb_size=(128, 128)):
        self.thumb_size = thumb_size
        self._thumb_cache: Dict[str, Image.Image] = {}

    def collect(self, inputs: Iterable[str]) -> List[ImageItem]:
        results: List[ImageItem] = []
        for p in inputs:
            if os.path.isdir(p):
                for root, _, files in os.walk(p):
                    for fn in files:
                        fp = os.path.join(root, fn)
                        if self._is_supported(fp):
                            results.append(ImageItem(fp))
            else:
                if self._is_supported(p):
                    results.append(ImageItem(p))
        # 去重且保持顺序
        seen = set()
        uniq: List[ImageItem] = []
        for it in results:
            if it.path not in seen:
                uniq.append(it)
                seen.add(it.path)
        return uniq

    def _is_supported(self, path: str) -> bool:
        ext = os.path.splitext(path)[1].lower()
        return os.path.isfile(path) and ext in SUPPORTED_EXT

    def get_thumbnail(self, path: str) -> Image.Image:
        if path in self._thumb_cache:
            return self._thumb_cache[path]
        img = Image.open(path)
        img.thumbnail(self.thumb_size, Image.LANCZOS)
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        self._thumb_cache[path] = img
        return img
