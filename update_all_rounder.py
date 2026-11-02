import os, time
import numpy as np
from PIL import Image, ImageDraw, ImageFont

frames_dir = "/Users/kush/Documents/Default Project/frames"
font_bold50 = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", size=50, index=1)

# Baseline positions for frames 50..61
baseline_map = {
    50: 405, 51: 396, 52: 382, 53: 362, 54: 333,
    55: 296, 56: 250, 57: 201, 58: 155, 59: 113,
    60: 77, 61: 45
}

# Scramble words for frames 19..27
scramble_map = {
    19: "ALL FOUNTAN",
    20: "ALL ROUNTAN",
    21: "ALL ROUNDAN",
    22: "ALL ROUNDON",
    23: "ALL ROUNDOV",
    24: "ALL ROUNDON",
    25: "ALL ROUNDO",
    26: "ALL ROUNDER",
    27: "ALL ROUNDEF",
}

t0 = time.time()
updated_count = 0

for f in range(19, 62):
    fpath = f"{frames_dir}/frame-{f:04d}.webp"
    im = Image.open(fpath)
    arr = np.array(im).copy()
    
    # Determine text and baseline for this frame
    if 19 <= f <= 27:
        text = scramble_map[f]
        base_y = 414
    elif 28 <= f <= 49:
        text = "ALL ROUNDER"
        base_y = 414
    else: # 50..61
        text = "ALL ROUNDER"
        base_y = baseline_map[f]
        
    # Clear line 2 inside the black box with exact box color (16, 16, 16)
    y1 = max(0, base_y - 45)
    y2 = min(719, base_y + 8)
    arr[y1:y2, 435:846] = [16, 16, 16]
    
    clean_im = Image.fromarray(arr)
    d = ImageDraw.Draw(clean_im)
    d.text((640, base_y), text, fill=(255, 255, 255), font=font_bold50, anchor="ms")
    
    clean_im.save(fpath, "WEBP", quality=95, method=6)
    updated_count += 1

t1 = time.time()
print(f"Updated {updated_count} frames for ALL ROUNDER in {t1 - t0:.2f}s.")
