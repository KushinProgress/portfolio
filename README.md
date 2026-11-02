# Kush — Scroll-Driven Video Portfolio

A smooth, scroll-scrubbed portfolio site built from your reference video (`Video-51955.mp4`). The page is pinned to a full-screen canvas; every scroll position smoothly scrubs through **496 high-definition WebP frames** extracted directly from the video, with lerped interpolation, frame-synced audio playback, auto-play mode, and keyboard controls.

## Features

- **Butter-Smooth 60/120fps Trackpad Scrubbing**: Adaptive easing detects two-finger trackpad and wheel gestures for instantaneous, 1:1 finger tracking with zero lag, while preserving smooth inertia.
- **Hardware-Accelerated `ImageBitmap` Pipeline**: Pre-decodes all 496 frames off-thread into GPU textures in ~350ms, eliminating synchronous decode stalls and fill-rate bottlenecks.
- **Audio Synchronization**: Original video soundtrack (`audio.mp3`) extracted and synced with scrub position and auto-play.
- **Auto-Play / Preview Mode**: Hit the **Play** button or tap <kbd>Space</kbd> to watch the video at its native 24fps. Scrolling anytime pauses auto-play and gives immediate manual control.
- **Fast Staged Loading**: Interactivity unlocks instantly as soon as the first second of frames buffers, while the remaining frames stream in seamlessly in the background.
- **Section Rail**: Quick jump navigation across key reel chapters (Intro, Achievements, IEEE Hack Synapse, Motion Graphics, Vibe/Transition, Mograph, Jugg/Vibe, Outro).
- **Responsive & High-DPI Grid**: Auto-matches device pixel ratio (Retina 2x) with an extended 61.2px background grid into letterboxed areas so content is never cropped.
- **Comprehensive Keyboard Navigation**:
  - <kbd>Space</kbd>: Play / Pause auto-play
  - <kbd>M</kbd>: Toggle Sound ON / OFF
  - <kbd>↓</kbd> / <kbd>→</kbd>: Scrub forward
  - <kbd>↑</kbd> / <kbd>←</kbd>: Scrub backward
  - <kbd>Page Down</kbd> / <kbd>Page Up</kbd>: Jump to next / previous section
  - <kbd>Home</kbd> / <kbd>End</kbd>: Jump to beginning / outro

## Quick Start

```bash
cd "Default Project"
python3 -m http.server 8000
```

Open your browser to <http://localhost:8000>.

## Project Structure

| File | Purpose |
| --- | --- |
| `index.html` | 496-frame scroll-driven cinematic canvas intro with audio, scrubber & navigation |
| `styles.css` | Editorial dark-on-paper Swiss typography, responsive layout |
| `main.js` | Frame preloader, canvas rendering, lerp scroll mapping, audio & auto-play engine |
| `portfolio.html` | Complete modern portfolio with skills, bio, project showcases & contact |
| `tech-stack.html` | Synchronized copy of the interactive portfolio |
| `ghost-cursor.js` | React Bits `<GhostCursor />` fluid smoke/cloud dynamics across sections |
| `scroll-reveal.js` | React Bits `<ScrollReveal />` scrub-driven typography animation on bio |
| `fold-text.js` | React Bits `<FoldText />` 3D paper fold animation with hover refold |
| `audio.mp3` | Mastered audio soundtrack extracted from the video |
| `frames/` | 496 WebP frames (1280×720) extracted from `Video-51955.mp4` |
| `favicon.svg` | Custom minimalist asterisk mark icon |

## Customization

- **Change Brand / Contact**: Update the name and email links in `index.html`.
- **Change Scroll Sensitivity**: Adjust `SCROLL_PER_FRAME` in `main.js` (default: `22px` per frame; increase for less sensitive / slower scrub, decrease for faster scrub).
- **Use Custom Frames**: Place 24fps frames named `frame-0001.webp` ... `frame-XXXX.webp` into `frames/` and update `FRAME_COUNT` in `main.js` and `--frames` in `index.html`.
