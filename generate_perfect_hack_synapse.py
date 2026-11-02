import os, time
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FRAMES_DIR = "/Users/kush/Documents/Default Project/frames"
BACKUP_DIR = "/Users/kush/Documents/Default Project/frames_backup"

print("Step 1: Preparing Photo Booth (Phone 1)...")
photo_path = "/Users/kush/Downloads/HACK SYNAPSE Hackathon Photo Booth.png"
if not os.path.exists(photo_path):
    photo_path = "/Users/kush/.gemini/antigravity/brain/a6e27a15-1e48-4776-a4a2-7ce97b1a02d3/.user_uploaded/media_1793563323002_8daed555.jpg"

raw_photo = Image.open(photo_path).convert("RGBA")
scale = 512.0 / raw_photo.height
scaled_w = int(round(raw_photo.width * scale))
scaled_photo = raw_photo.resize((scaled_w, 512), Image.Resampling.LANCZOS)
left_crop = (scaled_w - 288) // 2
photo_288x512 = scaled_photo.crop((left_crop, 0, left_crop + 288, 512))

# Inner mask (radius 19)
inner_mask = Image.new("L", (288, 512), 0)
d_m = ImageDraw.Draw(inner_mask)
d_m.rounded_rectangle([0, 0, 287, 511], radius=19, fill=255)

def make_phone(media_im):
    elem = Image.new("RGBA", (294, 518), (0, 0, 0, 0))
    elem.paste(media_im, (3, 3), inner_mask)
    d = ImageDraw.Draw(elem)
    d.rounded_rectangle([0, 0, 293, 517], radius=22, outline=(0, 0, 0, 255), width=3)
    return elem

p1_base = make_phone(photo_288x512)

print("Step 2: Preparing Video Frames (Phone 2)...")
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
print(f"Loaded {len(v_frames)} video frames.")

# Pre-render video phones
v_phones = [make_phone(vf) for vf in v_frames]

# Trajectory
top_table = {}
alpha_table = {}

entrance_tops = [426, 392, 365, 343, 323, 305, 289, 275, 263, 251, 241]
entrance_alphas = [0.20, 0.28, 0.36, 0.45, 0.55, 0.65, 0.75, 0.82, 0.90, 0.95, 0.98]
for idx, f in enumerate(range(144, 155)):
    top_table[f] = entrance_tops[idx]
    alpha_table[f] = entrance_alphas[idx]

settle_tops = [232, 223, 215, 207, 201, 194, 188, 183]
for idx, f in enumerate(range(155, 163)):
    top_table[f] = settle_tops[idx]
    alpha_table[f] = 1.0

sync_tops = [178, 174, 170, 166, 163]
for idx, f in enumerate(range(163, 168)):
    top_table[f] = sync_tops[idx]
    alpha_table[f] = 1.0

resting_tops = [160, 157, 154, 152, 150, 148, 147, 146, 145, 144, 143, 143, 143, 143]
for idx, f in enumerate(range(168, 182)):
    top_table[f] = resting_tops[idx]
    alpha_table[f] = 1.0

exit_tops = [140, 131, 112, 79]
for idx, f in enumerate(range(182, 186)):
    top_table[f] = exit_tops[idx]
    alpha_table[f] = 1.0

motion_map = {
    143: (412, 228), 144: (367, 205), 145: (332, 185), 146: (305, 165),
    147: (282, 151), 148: (262, 125), 149: (245, 109), 150: (229, 88),
    151: (215, 70),  152: (202, 34),  153: (191, 21),  154: (181, 7),
    155: (171, 0),   156: (163, 0),   157: (155, 0),   158: (147, 0),
    159: (141, 0),   160: (134, 0),   161: (129, 0),   162: (123, 0),
    163: (118, 0),   164: (114, 0),   165: (110, 0),   166: (106, 0),
    167: (103, 0),   168: (100, 0),   169: (97, 0),    170: (95, 0),
    171: (92, 0),    172: (90, 0),    173: (89, 0),    174: (87, 0),
    175: (86, 0),    176: (85, 0),    177: (84, 0),    178: (83, 0),
    179: (83, 0),    180: (83, 0),    181: (83, 0),    182: (80, 0),
    183: (71, 0),    184: (52, 0),    185: (20, 0)
}

font_bold36 = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", size=36, index=1)
f144_bg = Image.open(f"{BACKUP_DIR}/frame-0144.webp").convert("RGB")

print("Step 3: Generating clean, synchronized frames 144..185...")
t0 = time.time()

for f in range(144, 186):
    backup_path = f"{BACKUP_DIR}/frame-{f:04d}.webp"
    im = Image.open(backup_path).convert("RGB")
    arr = np.array(im).copy()
    
    base_y, c_val = motion_map[f]
    t = top_table[f]
    alpha = alpha_table[f]
    
    # 1. Inpaint SHORT FORM using vertical linear interpolation
    top_y = max(0, base_y - 36)
    bot_y = min(719, base_y + 12)
    x_start = 195
    x_end = 450
    for x in range(x_start, x_end):
        c_top = arr[top_y, x].astype(float)
        c_bot = arr[bot_y, x].astype(float)
        for y in range(top_y + 1, bot_y):
            progress_y = (y - top_y) / (bot_y - top_y)
            bg = (1 - progress_y) * c_top + progress_y * c_bot
            if arr[y, x, 0] < bg[0] - 15:
                arr[y, x] = np.clip(bg, 0, 255).astype(np.uint8)
    
    # In entrance frames (144..154) where alpha < 1.0, wipe out the entering old phones
    if alpha < 0.999:
        # Paste clean background from f144 over the phone bounding areas
        p1_box = (290, max(0, t), 592, 720)
        p2_box = (690, max(0, t), 992, 720)
        arr[p1_box[1]:p1_box[3], p1_box[0]:p1_box[2]] = np.array(f144_bg)[p1_box[1]:p1_box[3], p1_box[0]:p1_box[2]]
        arr[p2_box[1]:p2_box[3], p2_box[0]:p2_box[2]] = np.array(f144_bg)[p2_box[1]:p2_box[3], p2_box[0]:p2_box[2]]
    
    clean_im = Image.fromarray(arr).convert("RGBA")
    
    # 2. Draw IEEE Hack Synapse header
    d_clean = ImageDraw.Draw(clean_im)
    fill_color = (c_val, c_val, c_val)
    d_clean.text((204, base_y), "IEEE Hack Synapse", fill=fill_color, font=font_bold36, anchor="ls")
    
    # 3. Paste Phone 1 (Photo Booth) at (294, t)
    if alpha < 0.999:
        p1_layer = Image.new("RGBA", (1280, 720), (0, 0, 0, 0))
        p1_layer.paste(p1_base, (294, t))
        r, g, b, a = p1_layer.split()
        a = a.point(lambda p: int(p * alpha))
        p1_layer.putalpha(a)
        clean_im = Image.alpha_composite(clean_im, p1_layer)
    else:
        clean_im.paste(p1_base, (294, t), p1_base)
    
    # 4. Paste Phone 2 (Video) at (694, t)
    v_prog = (f - 144) / (185 - 144)
    v_idx = min(len(v_phones) - 1, int(round(v_prog * (len(v_phones) - 1))))
    p2_base = v_phones[v_idx]
    
    if alpha < 0.999:
        p2_layer = Image.new("RGBA", (1280, 720), (0, 0, 0, 0))
        p2_layer.paste(p2_base, (694, t))
        r, g, b, a = p2_layer.split()
        a = a.point(lambda p: int(p * alpha))
        p2_layer.putalpha(a)
        clean_im = Image.alpha_composite(clean_im, p2_layer)
    else:
        clean_im.paste(p2_base, (694, t), p2_base)
    
    # Save back to frames dir
    out_path = f"{FRAMES_DIR}/frame-{f:04d}.webp"
    clean_im.convert("RGB").save(out_path, "WEBP", quality=95, method=6)
    
    if f % 10 == 0 or f in [144, 155, 160, 165, 177, 185]:
        print(f"  Frame {f:04d}: top={t}, text_y={base_y}, gap={t-base_y}px")

t1 = time.time()
print(f"All frames 144..185 generated in {t1 - t0:.2f}s.")
