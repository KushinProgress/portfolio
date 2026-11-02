import os
import cv2
import numpy as np
from PIL import Image, ImageDraw

FRAMES_DIR = "/Users/kush/Documents/Default Project/frames"
BACKUP_DIR = "/Users/kush/Documents/Default Project/frames_backup"

# 1. Prepare Photo Booth Image for Phone 1 (288 x 512)
photo_path = "/Users/kush/Downloads/HACK SYNAPSE Hackathon Photo Booth.png"
if not os.path.exists(photo_path):
    photo_path = "/Users/kush/.gemini/antigravity/brain/a6e27a15-1e48-4776-a4a2-7ce97b1a02d3/.user_uploaded/media_1793563323002_8daed555.jpg"

raw_photo = Image.open(photo_path).convert("RGBA")
scale = 512.0 / raw_photo.height
scaled_w = int(round(raw_photo.width * scale))
scaled_photo = raw_photo.resize((scaled_w, 512), Image.Resampling.LANCZOS)
left_crop = (scaled_w - 288) // 2
photo_288x512 = scaled_photo.crop((left_crop, 0, left_crop + 288, 512))

# 2. Extract and pre-resize all video frames for Phone 2
video_path = "/Users/kush/Downloads/WhatsApp Video 2026-11-02 at 1.33.00 AM.mp4"
cap = cv2.VideoCapture(video_path)
total_v_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
v_frames = []
for i in range(total_v_frames):
    ret, frame = cap.read()
    if not ret:
        break
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    v_im = Image.fromarray(frame_rgb).resize((288, 512), Image.Resampling.LANCZOS).convert("RGBA")
    v_frames.append(v_im)
cap.release()
print(f"Loaded photo {photo_288x512.size} and {len(v_frames)} video frames.")

# Create rounded masks
inner_mask = Image.new("L", (288, 512), 0)
d_m = ImageDraw.Draw(inner_mask)
d_m.rounded_rectangle([0, 0, 287, 511], radius=19, fill=255)

# Render base phone elements (outer size 294 x 518)
def make_phone(media_im):
    elem = Image.new("RGBA", (294, 518), (0, 0, 0, 0))
    elem.paste(media_im, (3, 3), inner_mask)
    d = ImageDraw.Draw(elem)
    d.rounded_rectangle([0, 0, 293, 517], radius=22, outline=(0, 0, 0, 255), width=3)
    return elem

p1_base = make_phone(photo_288x512)

# Define trajectory tables for frames 144..195
# In frames 168..181: resting stationary at top=144, bot=661
# In frames 163..167: [178, 174, 170, 166, 163]
# In frames 182..185: [140, 131, 112, 79]

top_p1 = {}
top_p2 = {}
alpha_p1 = {}
alpha_p2 = {}

# Entrance frames 144..154
# Linear / smooth interpolation
p1_entrance_tops = [364, 319, 298, 265, 244, 231, 212, 203, 195, 174, 169]
p2_entrance_tops = [426, 392, 365, 343, 323, 305, 289, 275, 263, 251, 241]
p1_entrance_alphas = [0.20, 0.28, 0.36, 0.45, 0.55, 0.65, 0.75, 0.82, 0.90, 0.95, 0.98]
p2_entrance_alphas = [0.20, 0.28, 0.36, 0.45, 0.55, 0.65, 0.75, 0.82, 0.90, 0.95, 0.98]

for idx, f in enumerate(range(144, 155)):
    top_p1[f] = p1_entrance_tops[idx]
    top_p2[f] = p2_entrance_tops[idx]
    alpha_p1[f] = p1_entrance_alphas[idx]
    alpha_p2[f] = p2_entrance_alphas[idx]

# Settling frames 155..162
p1_settle = [153, 145, 137, 129, 123, 120, 117, 115]
p2_settle = [232, 223, 215, 207, 201, 194, 188, 183]
for idx, f in enumerate(range(155, 163)):
    top_p1[f] = p1_settle[idx]
    top_p2[f] = p2_settle[idx]
    alpha_p1[f] = 1.0
    alpha_p2[f] = 1.0

# Converged frames 163..167
p_sync = [178, 174, 170, 166, 163]
for idx, f in enumerate(range(163, 168)):
    top_p1[f] = p_sync[idx]
    top_p2[f] = p_sync[idx]
    alpha_p1[f] = 1.0
    alpha_p2[f] = 1.0

# Resting stationary frames 168..181
resting_tops = [160, 157, 154, 152, 150, 148, 147, 146, 145, 144, 143, 143, 143, 143]
for idx, f in enumerate(range(168, 182)):
    top_p1[f] = resting_tops[idx]
    top_p2[f] = resting_tops[idx]
    alpha_p1[f] = 1.0
    alpha_p2[f] = 1.0

# Exit frames 182..185
p_exit = [140, 131, 112, 79]
for idx, f in enumerate(range(182, 186)):
    top_p1[f] = p_exit[idx]
    top_p2[f] = p_exit[idx]
    alpha_p1[f] = 1.0
    alpha_p2[f] = 1.0

# Frames 186..195 (Phone 1 gone, Phone 2 continues exit + fade)
p2_fade_tops = [31, -29, -89, -142, -186, -230, -277, -320, -360, -407]
for idx, f in enumerate(range(186, 196)):
    top_p2[f] = p2_fade_tops[idx]
    alpha_p2[f] = max(0.0, 1.0 - (idx + 1) * 0.10)

print(f"Configured coordinates for {len(top_p1)} P1 frames and {len(top_p2)} P2 frames.")

# Process all frames 144..195
# Clean template for background grid
grid_bg = Image.open(f"{BACKUP_DIR}/frame-0143.webp").convert("RGBA")

for f in range(144, 196):
    frame_path = f"{FRAMES_DIR}/frame-{f:04d}.webp"
    im = Image.open(frame_path).convert("RGBA")
    
    # Video index for this frame
    if f <= 185:
        progress = (f - 144) / (185 - 144)
    else:
        progress = 1.0
    v_idx = min(len(v_frames) - 1, int(round(progress * (len(v_frames) - 1))))
    p2_base = make_phone(v_frames[v_idx])
    
    # 1. Composite Phone 1 if present
    if f in top_p1:
        t1 = top_p1[f]
        a1 = alpha_p1[f]
        # Inpaint/clean phone 1 region from grid_bg to remove old video completely
        # Region: x: 290..590, y: max(0, t1)..min(720, t1+518)
        p1_region = (290, max(0, t1), 590, min(720, t1 + 518))
        im.paste(grid_bg.crop(p1_region), (p1_region[0], p1_region[1]))
        
        # Now paste new Phone 1
        p1_layer = Image.new("RGBA", (1280, 720), (0, 0, 0, 0))
        p1_layer.paste(p1_base, (294, t1))
        if a1 < 0.999:
            # apply alpha
            r, g, b, a = p1_layer.split()
            a = a.point(lambda p: int(p * a1))
            p1_layer.putalpha(a)
        im.alpha_composite(p1_layer)
    
    # 2. Composite Phone 2 if present
    if f in top_p2:
        t2 = top_p2[f]
        a2 = alpha_p2[f]
        p2_region = (690, max(0, t2), 990, min(720, t2 + 518))
        im.paste(grid_bg.crop(p2_region), (p2_region[0], p2_region[1]))
        
        p2_layer = Image.new("RGBA", (1280, 720), (0, 0, 0, 0))
        p2_layer.paste(p2_base, (694, t2))
        if a2 < 0.999:
            r, g, b, a = p2_layer.split()
            a = a.point(lambda p: int(p * a2))
            p2_layer.putalpha(a)
        im.alpha_composite(p2_layer)
    
    # Save back as webp quality=95 method=6
    im.convert("RGB").save(frame_path, "WEBP", quality=95, method=6)
    if f % 10 == 0 or f in [144, 185, 195]:
        print(f"Updated frame {f:04d}")

print("All Hack Synapse frames (144..195) updated successfully!")
