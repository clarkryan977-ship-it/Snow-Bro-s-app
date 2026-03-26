from PIL import Image, ImageDraw
import os

logo_path = '/home/ubuntu/lawncare-app/client/public/logo.jpg'
icons_dir = '/home/ubuntu/lawncare-app/client/public/icons'
os.makedirs(icons_dir, exist_ok=True)

# Open the original logo
logo = Image.open(logo_path).convert('RGBA')

def make_icon(size, output_path, padding_ratio=0.05):
    """Create a square icon with the logo centered, with slight padding."""
    # Create a light blue background matching the logo's background color
    bg_color = (173, 210, 235, 255)  # light blue matching logo bg
    icon = Image.new('RGBA', (size, size), bg_color)
    
    # Calculate padding
    pad = int(size * padding_ratio)
    inner_size = size - 2 * pad
    
    # Resize logo to fit inner area while maintaining aspect ratio
    logo_copy = logo.copy()
    logo_copy.thumbnail((inner_size, inner_size), Image.LANCZOS)
    
    # Center the logo
    x = (size - logo_copy.width) // 2
    y = (size - logo_copy.height) // 2
    
    icon.paste(logo_copy, (x, y), logo_copy)
    
    # Convert to RGB for JPEG/PNG saving
    icon_rgb = Image.new('RGB', (size, size), (173, 210, 235))
    icon_rgb.paste(icon, mask=icon.split()[3])
    icon_rgb.save(output_path, 'PNG', optimize=True)
    print(f"Generated: {output_path} ({size}x{size})")

# Generate all required sizes
sizes = [
    (16, 'icon-16.png'),
    (32, 'icon-32.png'),
    (72, 'icon-72.png'),
    (96, 'icon-96.png'),
    (128, 'icon-128.png'),
    (144, 'icon-144.png'),
    (152, 'icon-152.png'),
    (180, 'icon-180.png'),
    (192, 'icon-192.png'),
    (384, 'icon-384.png'),
    (512, 'icon-512.png'),
]

for size, name in sizes:
    make_icon(size, os.path.join(icons_dir, name))

# Also create apple-touch-icon (180x180)
make_icon(180, '/home/ubuntu/lawncare-app/client/public/apple-touch-icon.png')

# Create favicon.ico from 32x32
from PIL import Image as PILImage
favicon = PILImage.open(logo_path).convert('RGBA')
favicon.thumbnail((32, 32), PILImage.LANCZOS)
bg = PILImage.new('RGBA', (32, 32), (173, 210, 235, 255))
x = (32 - favicon.width) // 2
y = (32 - favicon.height) // 2
bg.paste(favicon, (x, y), favicon)
bg_rgb = PILImage.new('RGB', (32, 32), (173, 210, 235))
bg_rgb.paste(bg, mask=bg.split()[3])
bg_rgb.save('/home/ubuntu/lawncare-app/client/public/favicon.ico', 'ICO', sizes=[(16, 16), (32, 32)])
print("Generated favicon.ico")

print("\nAll icons generated successfully!")
