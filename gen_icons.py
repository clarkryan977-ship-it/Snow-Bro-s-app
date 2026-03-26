from PIL import Image, ImageDraw, ImageFont
import os, shutil

OUTPUT_DIR = '/home/ubuntu/lawncare-app/client/public/icons'
os.makedirs(OUTPUT_DIR, exist_ok=True)

def make_icon(size, filename):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Outer navy circle
    draw.ellipse([0, 0, size - 1, size - 1], fill='#1e3a5f')

    # Inner blue circle (slight inset for depth)
    pad = int(size * 0.06)
    draw.ellipse([pad, pad, size - pad - 1, size - pad - 1], fill='#2563eb')

    # "SB" large letters in center
    try:
        big_size = int(size * 0.50)
        big_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', big_size)
    except:
        big_font = ImageFont.load_default()

    label = 'SB'
    bbox = draw.textbbox((0, 0), label, font=big_font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) // 2 - bbox[0]
    ty = (size - th) // 2 - bbox[1] - int(size * 0.06)
    draw.text((tx, ty), label, fill='#ffffff', font=big_font)

    # Tagline below
    try:
        tag_size = int(size * 0.12)
        tag_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', tag_size)
    except:
        tag_font = ImageFont.load_default()

    tag = "SNOW BRO'S"
    tbbox = draw.textbbox((0, 0), tag, font=tag_font)
    tw2 = tbbox[2] - tbbox[0]
    draw.text(((size - tw2) // 2 - tbbox[0], ty + th + int(size * 0.03)), tag, fill='#93c5fd', font=tag_font)

    img.save(os.path.join(OUTPUT_DIR, filename), 'PNG')
    print(f'Generated {filename} ({size}x{size})')

make_icon(192, 'icon-192.png')
make_icon(512, 'icon-512.png')
make_icon(180, 'icon-180.png')
make_icon(32,  'favicon-32.png')

# favicon.ico
img32 = Image.open(os.path.join(OUTPUT_DIR, 'favicon-32.png'))
img32.save('/home/ubuntu/lawncare-app/client/public/favicon.ico', format='ICO', sizes=[(32, 32), (16, 16)])
print('Generated favicon.ico')

# Screenshot (wide)
sw, sh = 1280, 720
ss = Image.new('RGB', (sw, sh), '#1e3a5f')
sdraw = ImageDraw.Draw(ss)
try:
    big_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 90)
    sub_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 38)
except:
    big_font = sub_font = ImageFont.load_default()

title = "Snow Bro's Lawn Care"
tbbox = sdraw.textbbox((0, 0), title, font=big_font)
sdraw.text(((sw - (tbbox[2]-tbbox[0])) // 2, 270), title, fill='#ffffff', font=big_font)
sub = "Professional Residential Lawn Care Services"
sbbox = sdraw.textbbox((0, 0), sub, font=sub_font)
sdraw.text(((sw - (sbbox[2]-sbbox[0])) // 2, 390), sub, fill='#93c5fd', font=sub_font)
ss.save(os.path.join(OUTPUT_DIR, 'screenshot-wide.png'), 'PNG')
print('Generated screenshot-wide.png')

# Apple touch icon
shutil.copy(os.path.join(OUTPUT_DIR, 'icon-180.png'),
            '/home/ubuntu/lawncare-app/client/public/apple-touch-icon.png')
print('Generated apple-touch-icon.png')
print('All icons done!')
