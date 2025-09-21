import os
import piexif
from PIL import Image, ImageDraw, ImageFont
import argparse

def get_exif_date(image_path):
    """Extracts the shooting date from the image's EXIF data."""
    try:
        exif_dict = piexif.load(image_path)
        date_time = exif_dict['Exif'][piexif.ExifIFD.DateTimeOriginal].decode('utf-8')
        return date_time.split(' ')[0].replace(':', '-')
    except (KeyError, ValueError, piexif.InvalidImageDataError):
        return None

def add_watermark(image_path, output_dir, text, font_size_override, color, position):
    """Adds a text watermark to an image."""
    try:
        image = Image.open(image_path).convert("RGBA")
        
        # Dynamically adjust font size if not overridden
        if font_size_override:
            font_size = font_size_override
        else:
            font_size = int(min(image.width, image.height) * 0.05) # 5% of the smaller dimension

        txt_layer = Image.new('RGBA', image.size, (255, 255, 255, 0))
        
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except IOError:
            font = ImageFont.load_default(size=font_size)

        draw = ImageDraw.Draw(txt_layer)
        
        # Get text bounding box
        try:
            # A more robust way to get the bounding box
            bbox = draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
        except TypeError:
            # Fallback for older Pillow versions
            text_width, text_height = draw.textsize(text, font=font)

        x, y = 0, 0
        margin = int(min(image.width, image.height) * 0.02) # 2% margin
        if position == 'center':
            x = (image.width - text_width) / 2
            y = (image.height - text_height) / 2
        elif position == 'top-left':
            x = margin
            y = margin
        elif position == 'top-right':
            x = image.width - text_width - margin
            y = margin
        elif position == 'bottom-left':
            x = margin
            y = image.height - text_height - margin
        elif position == 'bottom-right':
            x = image.width - text_width - margin
            y = image.height - text_height - margin

        draw.text((x, y), text, font=font, fill=color)
        
        watermarked_image = Image.alpha_composite(image, txt_layer)
        watermarked_image = watermarked_image.convert("RGB") # Convert back to RGB for saving as JPEG

        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        base_name = os.path.basename(image_path)
        new_image_path = os.path.join(output_dir, base_name)
        watermarked_image.save(new_image_path)
        print(f"Watermarked image saved to: {new_image_path}")

    except FileNotFoundError:
        print(f"Error: The file '{image_path}' was not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

def main():
    parser = argparse.ArgumentParser(description="Add a date watermark to images.")
    parser.add_argument("path", help="Path to the image file or directory of images.")
    parser.add_argument("--font-size", type=int, default=None, help="Manually set font size. Overrides dynamic sizing.")
    parser.add_argument("--color", default="white", help="Color of the watermark text.")
    parser.add_argument("--position", default="bottom-right", choices=['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'], help="Position of the watermark.")
    
    args = parser.parse_args()

    input_path = args.path
    
    if os.path.isfile(input_path):
        image_paths = [input_path]
        base_dir = os.path.dirname(input_path)
    elif os.path.isdir(input_path):
        image_paths = [os.path.join(input_path, f) for f in os.listdir(input_path) if f.lower().endswith(('png', 'jpg', 'jpeg'))]
        base_dir = input_path
    else:
        print(f"Error: The path '{input_path}' is not a valid file or directory.")
        return

    # Output to a 'watermark' subdirectory of the original folder
    output_dir = os.path.join(base_dir, "watermark")

    for image_path in image_paths:
        date_str = get_exif_date(image_path)
        if date_str:
            add_watermark(image_path, output_dir, date_str, args.font_size, args.color, args.position)
        else:
            print(f"Could not find date information for {os.path.basename(image_path)}. Skipping.")

if __name__ == "__main__":
    main()
