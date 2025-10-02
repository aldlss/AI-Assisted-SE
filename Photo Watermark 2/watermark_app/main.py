# -*- coding: utf-8 -*-
"""程序入口模块。"""
import os
import sys
from .ui.main_window import launch

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
