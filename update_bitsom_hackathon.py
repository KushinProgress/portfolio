import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FRAMES_DIR = "/Users/kush/Documents/Default Project/frames"
BACKUP_DIR = "/Users/kush/Documents/Default Project/frames_backup"

# 1. Load background grid template
bg_grid = Image.open(f"{BACKUP_DIR}/frame-0143.webp").convert("RGBA")

# 2. Extract and pre-crop all 639 video frames from WhatsApp Video
video_path = "/Users/kush/Downloads/WhatsApp Video 2026-11-02 at 1.41.59 AM.mp4"
cap = cv2.VideoCapture(video_path)
total_v_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
print(f"Loading {total_v_frames} frames from {video_path}...")

v_frames = []
for i in range(total_v_frames):
    ret, frame = cap.read()
    if not ret:
        break
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    im = Image.fromarray(frame_rgb)
    # Crop (22, 0, 659, 478) - centered around the 4 speaking people (4:3 aspect ratio)
    crop = im.crop((22, 0, 659, 478)).resize((720, 540), Image.Resampling.LANCZOS).convert("RGBA")
    v_frames.append(crop)
cap.release()
print(f"Extracted {len(v_frames)} cropped frames.")

# Create inner mask (720 x 540, radius=21)
inner_mask = Image.new("L", (720, 540), 0)
d_m = ImageDraw.Draw(inner_mask)
d_m.rounded_rectangle([0, 0, 719, 539], radius=21, fill=255)

def make_center_frame(v_crop):
    elem = Image.new("RGBA", (726, 545), (0, 0, 0, 0))
    elem.paste(v_crop, (3, 3), inner_mask)
    d = ImageDraw.Draw(elem)
    d.rounded_rectangle([0, 0, 725, 544], radius=24, outline=(0, 0, 0, 255), width=3)
    return elem

# Pre-render center frame elements for the 34 active frames (244..277)
frame_elements = {}
for f in range(244, 278):
    progress = (f - 244) / (277 - 244)
    v_idx = min(len(v_frames) - 1, int(round(progress * (len(v_frames) - 1))))
    frame_elements[f] = make_center_frame(v_frames[v_idx])

# 3. Trajectory mapping for Center Frame
frame_tops = {}
frame_alphas = {}

# Entrance frames 244..254
entrance_tops = [241, 229, 218, 208, 199, 190, 183, 176, 169, 163, 158]
for idx, f in enumerate(range(244, 255)):
    frame_tops[f] = entrance_tops[idx]
    frame_alphas[f] = 0.5 if f == 244 else 1.0

# Resting stationary frames 255..269
resting_tops = [153, 149, 145, 141, 138, 136, 133, 131, 129, 128, 126, 126, 125, 125, 125]
for idx, f in enumerate(range(255, 270)):
    frame_tops[f] = resting_tops[idx]
    frame_alphas[f] = 1.0

# Exiting frames 270..277
exit_tops = [122, 114, 97, 68, 23, -35, -96, -151]
for idx, f in enumerate(range(270, 278)):
    frame_tops[f] = exit_tops[idx]
    frame_alphas[f] = 0.5 if f == 277 else 1.0

# 4. Trajectory mapping for Header text "BITSOM Hackathon"
# Active frames 233..273
header_tops = {}
# 233..243
h_entrance = [427, 383, 346, 319, 291, 266, 245, 224, 207, 191, 178]
for idx, f in enumerate(range(233, 244)):
    header_tops[f] = h_entrance[idx]

# 244..254
h_mid = [165, 153, 143, 132, 122, 114, 106, 98, 90, 84, 78]
for idx, f in enumerate(range(244, 255)):
    header_tops[f] = h_mid[idx]

# 255..269 (resting at top)
for f in range(255, 270):
    header_tops[f] = 51

# 270..273 (exit)
h_exit = [49, 40, 24, 10]
for idx, f in enumerate(range(270, 274)):
    header_tops[f] = h_exit[idx]

font = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", size=36, index=1)

print(f"Processing frames 233..277...")

for f in range(233, 278):
    frame_path = f"{FRAMES_DIR}/frame-{f:04d}.webp"
    im = Image.open(frame_path).convert("RGBA")
    
    # 1. Update Header text if present
    if f in header_tops:
        y_text = header_tops[f]
        # Inpaint/clean old header area
        clean_box = (190, max(0, y_text - 15), 620, min(720, y_text + 45))
        im.paste(bg_grid.crop(clean_box), (clean_box[0], clean_box[1]))
        
        # Draw BITSOM Hackathon
        d = ImageDraw.Draw(im)
        d.text((200, y_text), "BITSOM Hackathon", fill=(0, 0, 0, 255), font=font)
    
    # 2. Update Center Video Frame if present
    if f in frame_tops:
        top_y = frame_tops[f]
        alpha = frame_alphas[f]
        elem = frame_elements[f]
        
        # Clean old frame area from grid_bg
        clean_frame_box = (270, max(0, top_y - 10), 1010, min(720, top_y + 555))
        im.paste(bg_grid.crop(clean_frame_box), (clean_frame_box[0], clean_frame_box[1]))
        
        # Re-draw header if it intersects with the clean box
        if f in header_tops and header_tops[f] < top_y + 555:
            d = ImageDraw.Draw(im)
            d.text((200, header_tops[f]), "BITSOM Hackathon", fill=(0, 0, 0, 255), font=font)
        
        # Paste new center frame
        layer = Image.new("RGBA", (1280, 720), (0, 0, 0, 0))
        layer.paste(elem, (277, top_y))
        if alpha < 0.999:
            r, g, b, a = layer.split()
            a = a.point(lambda p: int(p * alpha))
            layer.putalpha(a)
        im.alpha_composite(layer)
    
    im.convert("RGB").save(frame_path, "WEBP", quality=95, method=6)
    if f % 10 == 0 or f in [233, 244, 255, 268, 277]:
        print(f"Updated frame {f:04d}")

print("All BITSOM Hackathon frames updated successfully!")
