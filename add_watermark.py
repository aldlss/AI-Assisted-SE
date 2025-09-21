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

def add_watermark(image_path, output_dir, text, font_size, color, position):
    """Adds a text watermark to an image."""
    try:
        image = Image.open(image_path).convert("RGBA")
        txt_layer = Image.new('RGBA', image.size, (255, 255, 255, 0))
        
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except IOError:
            font = ImageFont.load_default()

        draw = ImageDraw.Draw(txt_layer)
        
        text_width, text_height = draw.textbbox((0, 0), text, font=font)[2:]

        x, y = 0, 0
        if position == 'center':
            x = (image.width - text_width) / 2
            y = (image.height - text_height) / 2
        elif position == 'top-left':
            x = 10
            y = 10
        elif position == 'top-right':
            x = image.width - text_width - 10
            y = 10
        elif position == 'bottom-left':
            x = 10
            y = image.height - text_height - 10
        elif position == 'bottom-right':
            x = image.width - text_width - 10
            y = image.height - text_height - 10

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
    parser.add_argument("--font-size", type=int, default=50, help="Font size of the watermark text.")
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

    output_dir = f"{base_dir}_watermark"

    for image_path in image_paths:
        date_str = get_exif_date(image_path)
        if date_str:
            add_watermark(image_path, output_dir, date_str, args.font_size, args.color, args.position)
        else:
            print(f"Could not find date information for {os.path.basename(image_path)}. Skipping.")

if __name__ == "__main__":
    main()
