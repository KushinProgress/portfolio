import os, time
import numpy as np
from PIL import Image, ImageDraw, ImageFont

frames_dir = "/Users/kush/Documents/Default Project/frames"
font_med50 = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", size=50, index=10)

baselines = {
    16: 345, 17: 345, 18: 345, 19: 345, 20: 345, 21: 345, 22: 345, 23: 345, 24: 345, 25: 345, 26: 345, 27: 345,
    28: 345, 29: 345, 30: 345, 31: 345, 32: 344, 33: 344, 34: 344, 35: 344, 36: 344, 37: 344, 38: 344,
    39: 344, 40: 344, 41: 344, 42: 344, 43: 344, 44: 344, 45: 344, 46: 344, 47: 344, 48: 343, 49: 340,
    50: 334, 51: 325, 52: 311, 53: 291, 54: 263, 55: 225, 56: 179, 57: 131, 58: 84, 59: 42
}

t0 = time.time()
updated_count = 0

for f in range(16, 60):
    fpath = f"{frames_dir}/frame-{f:04d}.webp"
    im = Image.open(fpath)
    arr = np.array(im).copy()
    base_y = baselines[f]
    
    y1 = max(0, base_y - 45)
    y2 = min(719, base_y + 8)
    
    if f == 16:
        x2 = 698
    elif f == 17:
        x2 = 710
    elif f == 18:
        x2 = 724
    else:
        x2 = 740
        
    # Clear line 1 region inside black box
    arr[y1:y2, 550:x2] = [16, 16, 16]
    
    clean_im = Image.fromarray(arr)
    d = ImageDraw.Draw(clean_im)
    
    if f == 16:
        # Render text on transparent canvas, clip to x < 698 to respect reveal wipe
        txt_im = Image.new('RGB', (1280, 720), (0, 0, 0))
        d_txt = ImageDraw.Draw(txt_im)
        d_txt.text((640, base_y), "I'm an", fill=(255, 255, 255), font=font_med50, anchor="ms")
        txt_arr = np.array(txt_im)
        txt_mask = (txt_arr[y1:y2, 550:x2, 0] > 180)
        clean_arr = np.array(clean_im)
        clean_arr[y1:y2, 550:x2][txt_mask] = [255, 255, 255]
        clean_im = Image.fromarray(clean_arr)
    else:
        d.text((640, base_y), "I'm an", fill=(255, 255, 255), font=font_med50, anchor="ms")
    
    clean_im.save(fpath, "WEBP", quality=95, method=6)
    updated_count += 1

t1 = time.time()
print(f"Successfully updated {updated_count} frames (16..59) to 'I\\'m an' in {t1 - t0:.2f}s.")
