# -*- coding: utf-8 -*-
"""程序入口模块。"""
import os
import sys
try:
    # 优先绝对导入，适配打包后的运行环境
    from watermark_app.ui.main_window import launch  # type: ignore
except ImportError as e:
    # 仅在包名不可用时回退相对导入；否则抛出原始错误，避免掩盖真正问题
    if getattr(e, "name", None) in (
        "watermark_app",
        "watermark_app.ui",
        "watermark_app.ui.main_window",
    ):
        from .ui.main_window import launch  # type: ignore
    else:
        raise

if __name__ == "__main__":
    # 将工作目录切换到可执行文件/模块所在目录，便于使用相对路径访问 data/
    try:
        if getattr(sys, "frozen", False):
            base_dir = os.path.dirname(sys.executable)
        else:
            base_dir = os.path.dirname(os.path.abspath(__file__))
        if base_dir:
            os.chdir(base_dir)
    except Exception:
        pass
    launch()
