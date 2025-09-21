# 图片水印添加工具

这是一个命令行工具，用于为图片添加基于其 EXIF 拍摄日期的水印。

## 功能

-   从图片的 EXIF 信息中自动提取拍摄日期（年-月-日）作为水印文本。
-   支持处理单个图片文件或整个目录中的所有图片。
-   允许用户自定义水印的字体大小、颜色和位置。
-   将处理后的图片保存在一个新的子目录中，以 `_watermark` 结尾，保持原图片不变。

## 安装与环境设置

1.  **克隆仓库**
    ```bash
    git clone <your-repository-url>
    cd <repository-name>
    ```

2.  **创建并激活 Python 虚拟环境**
    ```bash
    python3 -m venv .venv
    source .venv/bin/activate
    ```

3.  **安装依赖**
    ```bash
    pip install -r requirements.txt
    ```
    *(注意: 我们将把依赖项写入 `requirements.txt` 文件)*

## 使用方法

1.  将需要添加水印的图片放入 `images` 文件夹。

2.  运行 `add_watermark.py` 脚本，并指定图片文件或目录的路径。

    **基本用法 (处理整个目录):**
    ```bash
    python add_watermark.py images
    ```
    这会为 `images` 目录下的所有图片添加默认样式的水印，并保存在 `images_watermark` 目录中。

    **处理单个文件:**
    ```bash
    python add_watermark.py images/your_photo.jpg
    ```

### 自定义选项

您可以通过命令行参数来调整水印的外观和位置：

-   `--font-size <size>`: 设置字体大小 (例如: `80`)。
-   `--color <color>`: 设置字体颜色 (例如: `red`, `black`, `"#FF0000"`)。
-   `--position <position>`: 设置水印位置。可用选项:
    -   `top-left` (左上)
    -   `top-right` (右上)
    -   `bottom-left` (左下)
    -   `bottom-right` (右下，默认)
    -   `center` (居中)

**示例:**

为 `images` 目录中的所有图片添加一个居中的、红色的、字体大小为 100px 的水印：
```bash
python add_watermark.py images --position center --color red --font-size 100
```

## 注意事项

-   如果图片没有 EXIF 拍摄时间信息，程序将跳过该图片。
-   默认字体为 `arial.ttf`。如果系统中没有该字体，将使用 PIL 的默认字体。
