import os, time
import numpy as np
from PIL import Image, ImageDraw, ImageFont

frames_dir = "/Users/kush/Documents/Default Project/frames"
backup_dir = "/Users/kush/Documents/Default Project/frames_backup"

font_bold20 = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", size=20, index=1)
font_bold29 = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", size=29, index=1)

# Pristine envelope icon from backup frame 470
icon = Image.open(f"{backup_dir}/frame-0470.webp").crop((435, 445, 482, 480))

def process_loc1(im, frame_num):
    arr = np.array(im).copy()
    is_inverted = frame_num in [59, 61] or (120 <= frame_num <= 130)
    
    x_start = 512
    x_end = 768
    top_y = 682
    bot_y = 705 if frame_num == 60 else 707
    
    if is_inverted:
        for x in range(x_start, x_end):
            c_top = arr[top_y, x].astype(float)
            c_bot = arr[bot_y, x].astype(float)
            for y in range(top_y + 1, bot_y):
                t = (y - top_y) / (bot_y - top_y)
                bg = (1 - t) * c_top + t * c_bot
                if arr[y, x, 0] > 60:
                    arr[y, x] = np.clip(bg, 0, 255).astype(np.uint8)
        clean_im = Image.fromarray(arr)
        d = ImageDraw.Draw(clean_im)
        d.text((640, 704), "kush321a@gmail.com", fill=(255, 255, 255), font=font_bold20, anchor="ms")
        return clean_im

    # Standard white background frames:
    # New text bounding box is x: 538..742.
    # Any pixel in x: 512..536 or x: 744..768 is outside new text and should be clean background.
    for x in range(x_start, x_end):
        ty = top_y
        if arr[ty, x, 0] < 180 and frame_num > 15:
            for cand_y in range(top_y - 1, top_y - 10, -1):
                if arr[cand_y, x, 0] >= 180:
                    ty = cand_y
                    break
        by = bot_y
        if arr[by, x, 0] < 180 and frame_num != 60 and frame_num > 15:
            for cand_y in range(bot_y + 1, bot_y + 10):
                if arr[cand_y, x, 0] >= 180:
                    by = cand_y
                    break
                    
        c_top = arr[ty, x].astype(float)
        c_bot = arr[by, x].astype(float)
        for y in range(top_y + 1, bot_y):
            t = (y - top_y) / (bot_y - top_y)
            bg = (1 - t) * c_top + t * c_bot
            if x < 536 or x > 744:
                arr[y, x] = np.clip(bg, 0, 255).astype(np.uint8)
            else:
                if arr[y, x, 0] < bg[0] - 5:
                    arr[y, x] = np.clip(bg, 0, 255).astype(np.uint8)
                
    clean_im = Image.fromarray(arr)
    d = ImageDraw.Draw(clean_im)
    
    if 136 <= frame_num <= 141:
        fade_map = {136: 28, 137: 58, 138: 97, 139: 140, 140: 169, 141: 211}
        color_val = fade_map.get(frame_num, 0)
        text_color = (color_val, color_val, color_val)
    else:
        text_color = (0, 0, 0)
        
    d.text((640, 704), "kush321a@gmail.com", fill=text_color, font=font_bold20, anchor="ms")
    return clean_im

def process_loc2(im, frame_num):
    arr = np.array(im).copy()
    top_y = 441
    bot_y = 484
    x_start = 430
    x_end = 842
    
    for x in range(x_start, x_end):
        ty = top_y
        if arr[ty, x, 0] < 180:
            for cand_y in range(top_y - 1, 430, -1):
                if arr[cand_y, x, 0] >= 180:
                    ty = cand_y
                    break
        c_top = arr[ty, x].astype(float)
        c_bot = arr[bot_y, x].astype(float)
        for y in range(top_y + 1, bot_y):
            t = (y - top_y) / (bot_y - top_y)
            bg = (1 - t) * c_top + t * c_bot
            # New text + icon is at x: 460..820
            if x < 460 or x > 820:
                arr[y, x] = np.clip(bg, 0, 255).astype(np.uint8)
            else:
                if arr[y, x, 0] < bg[0] - 5:
                    arr[y, x] = np.clip(bg, 0, 255).astype(np.uint8)
                
    clean_im = Image.fromarray(arr)
    
    if frame_num < 448:
        return clean_im
    elif frame_num == 448:
        text_color = (157, 157, 157)
        alpha = 0.38
    elif frame_num == 449:
        text_color = (120, 120, 120)
        alpha = 0.53
    elif frame_num == 450:
        text_color = (90, 90, 90)
        alpha = 0.65
    elif frame_num == 451:
        text_color = (50, 50, 50)
        alpha = 0.80
    elif 452 <= frame_num <= 484:
        text_color = (0, 0, 0)
        alpha = 1.0
    elif frame_num == 485:
        text_color = (15, 15, 15)
        alpha = 0.95
    elif frame_num == 486:
        text_color = (31, 31, 31)
        alpha = 0.88
    elif frame_num == 487:
        text_color = (79, 79, 79)
        alpha = 0.69
    elif frame_num == 488:
        text_color = (116, 116, 116)
        alpha = 0.54
    elif frame_num == 489:
        text_color = (151, 151, 151)
        alpha = 0.40
    elif frame_num >= 490:
        text_color = (204, 204, 204)
        alpha = 0.20
        
    if alpha < 0.99:
        icon_arr = np.array(icon).copy()
        icon_faded = (icon_arr.astype(float) * alpha + 255.0 * (1.0 - alpha)).astype(np.uint8)
        clean_im.paste(Image.fromarray(icon_faded), (460, 445))
    else:
        clean_im.paste(icon, (460, 445))
        
    d = ImageDraw.Draw(clean_im)
    d.text((521, 476), "kush321a@gmail.com", fill=text_color, font=font_bold29, anchor="ls")
    return clean_im

t0 = time.time()
count1 = 0
count2 = 0

print("Processing Location 1 (frames 1..141)...")
for f in range(1, 142):
    fpath = f"{frames_dir}/frame-{f:04d}.webp"
    im = Image.open(fpath)
    res = process_loc1(im, f)
    res.save(fpath, "WEBP", quality=95, method=6)
    count1 += 1

print(f"Location 1 complete: {count1} frames updated.")

print("Processing Location 2 (frames 447..490)...")
for f in range(447, 491):
    fpath = f"{frames_dir}/frame-{f:04d}.webp"
    im = Image.open(fpath)
    res = process_loc2(im, f)
    res.save(fpath, "WEBP", quality=95, method=6)
    count2 += 1

t1 = time.time()
print(f"Location 2 complete: {count2} frames updated.")
print(f"All {count1 + count2} frames updated successfully in {t1 - t0:.2f}s.")
