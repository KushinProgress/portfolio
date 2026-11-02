/* ============================================================
   Kush — Scroll-Driven Video Portfolio
   496 frames · frame-synced audio · keyboard & autoplay controls
   ============================================================ */

(() => {
  "use strict";

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  window.scrollTo(0, 0);

  /* ============================================================
     CONFIG: TECH STACK DESTINATION
     ------------------------------------------------------------
     Attach your tech stack URL, file, or route below.
     When the user clicks "Skip" OR when the intro finishes
     playing (frame 496), the site will navigate to this target.
     
     Examples:
       const TECH_STACK_URL = "tech-stack.html";
       const TECH_STACK_URL = "https://kush-portfolio.dev/tech-stack";
     ============================================================ */
  const TECH_STACK_URL = "portfolio.html"; // <-- Replace with your live site URL or path

  const FRAME_COUNT = 496;
  const SCROLL_PER_FRAME = 22; // px of page scroll per frame (tuned for calm, smooth trackpad scrubbing)
  const FPS = 24;

  /* ------------------------------------------------------------
     SEGMENT DELAYS (Auto-Scroll Timing)
     ------------------------------------------------------------
     Auto-scrolling delay specifically for IEEE Hack Synapse
     (frames 144 to 192).
     Delay increased by 1.25x of the original (FPS / 1.25 = 19.2 FPS).
     ------------------------------------------------------------ */
  const HACK_SYNAPSE_START = 144;
  const HACK_SYNAPSE_END = 192;
  const HACK_SYNAPSE_DELAY_FACTOR = 1.25; // 1.25x of original delay
  const HACK_SYNAPSE_FPS = FPS / HACK_SYNAPSE_DELAY_FACTOR; // 19.2 FPS

  const GRID_STEP = 61.2; // px between grid lines in the source frames
  const GRID_X = 69;
  const GRID_Y = 54;

  const canvas = document.getElementById("frameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const bgCanvas = document.createElement("canvas");
  const bgCtx = bgCanvas.getContext("2d");

  const loader = document.getElementById("loader");
  const loaderPct = document.getElementById("loaderPct");
  const loaderBar = document.getElementById("loaderBar");
  const loaderStatus = document.getElementById("loaderStatus");

  const progressBar = document.getElementById("progressBar");
  const frameNow = document.getElementById("frameNow");
  const cue = document.getElementById("cue");
  const cueLabel = document.getElementById("cueLabel");
  const skipBtn = document.getElementById("skipBtn");
  const endCta = document.getElementById("endCta");
  const track = document.querySelector(".scroll-track");
  const railButtons = Array.from(document.querySelectorAll(".rail button"));
  const sections = railButtons.map((button) => ({
    button,
    frame: Number(button.dataset.frame) || 0,
  }));

  const playBtn = document.getElementById("playBtn");
  const playIcon = document.getElementById("playIcon");
  const playLabel = document.getElementById("playLabel");

  const soundBtn = document.getElementById("soundBtn");
  const soundIcon = document.getElementById("soundIcon");
  const soundLabel = document.getElementById("soundLabel");

  const bgAudio = document.getElementById("bgAudio");

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  const frames = new Array(FRAME_COUNT);

  let ready = false;
  let finished = false;
  let loaded = 0;
  let failSafe = null;

  let current = 0;
  let target = 0;
  let lastDrawn = -1;
  let lastHudProgress = -1;
  let activeSection = -1;
  let endCtaVisible = false;

  let isAutoPlaying = false;
  let userPaused = false;
  let isSoundEnabled = true;
  let isProgrammaticScroll = false;
  let autoPlayLastTime = 0;
  let lastAudioSyncTime = 0;

  let dpr = 1;
  let layout = { scale: 1, dw: 0, dh: 0, ox: 0, oy: 0 };

  let hasNavigated = false;

  function goToTechStack() {
    if (hasNavigated) return;
    hasNavigated = true;
    pauseAutoPlay();

    if (cueLabel) cueLabel.textContent = "Entering Portfolio...";
    document.body.classList.add("is-exiting");

    window.setTimeout(() => {
      if (TECH_STACK_URL && TECH_STACK_URL !== "#") {
        const cacheBuster = "t=" + Date.now();
        const sep = TECH_STACK_URL.includes("?") ? "&" : "?";
        window.location.replace(TECH_STACK_URL + sep + cacheBuster);
      } else {
        document.body.classList.remove("is-exiting");
        hasNavigated = false;
      }
    }, 600);
  }

  /* ------------------------------------------------------------
     Frame source + ultra-fast parallel preload (ImageBitmap)
     ------------------------------------------------------------ */

  const FRAME_CACHE_TAG = "v=kush_v12";

  function frameSrc(index) {
    return `frames/frame-${String(index + 1).padStart(4, "0")}.webp?${FRAME_CACHE_TAG}`;
  }

  function loadFrames() {
    let next = 0;
    const concurrency = 32;
    const hasBitmap = typeof createImageBitmap === "function";
    let failSafeQuick = null;

    function loadOne() {
      if (next >= FRAME_COUNT) return;
      const index = next++;
      const src = frameSrc(index);

      if (hasBitmap) {
        fetch(src)
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.blob();
          })
          .then((blob) => createImageBitmap(blob))
          .then((bmp) => onLoaded(index, bmp))
          .catch(() => fallbackImage(index, src));
      } else {
        fallbackImage(index, src);
      }
    }

    function fallbackImage(index, src) {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => onLoaded(index, img);
      img.onerror = () => onLoaded(index, null);
      img.src = src;
    }

    function onLoaded(index, resource) {
      if (resource) {
        frames[index] = resource;
        if (ready && Math.abs(index - Math.round(current)) < 2) {
          lastDrawn = -1;
        }
      }
      loaded += 1;
      updateLoader();

      // All 496 frames load and decode in ~300ms over local/fast connection.
      // Unlock when all frames are ready, or trigger fast fallback if partial.
      if (!finished && loaded >= FRAME_COUNT) {
        finish();
      } else if (!finished && loaded >= 60 && !failSafeQuick) {
        failSafeQuick = window.setTimeout(() => finish(), 600);
      }

      loadOne();
    }

    for (let i = 0; i < concurrency; i += 1) loadOne();

    // Failsafe timer so user is never permanently stuck
    failSafe = window.setTimeout(() => finish(), 4000);
  }

  function updateLoader() {
    const p = Math.min(1, loaded / FRAME_COUNT);
    if (loaderPct) loaderPct.textContent = `${Math.round(p * 100)}%`;
    if (loaderBar) loaderBar.style.transform = `scaleX(${p})`;
    if (loaderStatus) {
      if (p > 0.4 && p < 1) loaderStatus.textContent = "Buffering showreel";
      if (p >= 1) loaderStatus.textContent = "Ready";
    }
  }

  function finish() {
    if (finished) return;
    finished = true;
    window.clearTimeout(failSafe);

    if (loaderPct) loaderPct.textContent = "100%";
    if (loaderBar) loaderBar.style.transform = "scaleX(1)";
    if (loaderStatus) loaderStatus.textContent = "Ready";
    if (loader) loader.classList.add("is-done");

    document.body.classList.remove("is-loading");
    document.body.classList.add("is-ready");

    const urlParams = new URLSearchParams(window.location.search);
    const initialFrame = urlParams.get("f");
    if (initialFrame !== null) {
      const idx = Math.max(0, Math.min(TOTAL_FRAMES - 1, parseInt(initialFrame, 10) - 1));
      current = idx;
      target = idx;
      const scrollMax = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, (idx / (TOTAL_FRAMES - 1)) * scrollMax);
    } else {
      window.scrollTo(0, 0);
      current = 0;
      target = 0;
    }
    drawFrame(Math.round(current));
    lastDrawn = Math.round(current);
    updateHud(lastDrawn);

    window.setTimeout(() => {
      if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
    }, 1000);

    ready = true;
    requestAnimationFrame(tick);

    // Auto-play intro from the very start to the very end
    window.setTimeout(() => {
      if (!isAutoPlaying && !hasNavigated && !userPaused) {
        startAutoPlay();
      }
    }, 350);
  }

  /* ------------------------------------------------------------
     Canvas layout + rendering
     ------------------------------------------------------------ */

  function computeLayout() {
    const cw = canvas.width;
    const ch = canvas.height;
    const iw = 1280;
    const ih = 720;
    const scale = Math.min(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    layout = {
      scale,
      dw,
      dh,
      ox: (cw - dw) / 2,
      oy: (ch - dh) / 2,
    };
  }

  function buildBackground() {
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;
    bgCtx.fillStyle = "#fbfbf9";
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

    // Extend the film's 61.2px grid into the letterbox on any aspect ratio
    const { scale, dw, dh, ox, oy } = layout;
    if (dw >= canvas.width - 1 && dh >= canvas.height - 1) return;

    const stepX = GRID_STEP * scale;
    const stepY = GRID_STEP * scale;
    bgCtx.beginPath();
    bgCtx.strokeStyle = "rgba(10, 10, 10, 0.072)";
    bgCtx.lineWidth = Math.max(1, dpr * 0.8);

    let x = ox + GRID_X * scale;
    while (x > 0) x -= stepX;
    for (; x <= canvas.width; x += stepX) {
      bgCtx.moveTo(x, 0);
      bgCtx.lineTo(x, canvas.height);
    }

    let y = oy + GRID_Y * scale;
    while (y > 0) y -= stepY;
    for (; y <= canvas.height; y += stepY) {
      bgCtx.moveTo(0, y);
      bgCtx.lineTo(canvas.width, y);
    }
    bgCtx.stroke();
  }

  function drawFrame(index) {
    const img = frames[index] || resolveFrame(index);
    if (!img) return;
    ctx.drawImage(img, layout.ox, layout.oy, layout.dw, layout.dh);
  }

  function resolveFrame(index) {
    if (frames[index]) return frames[index];
    for (let d = 1; d < FRAME_COUNT; d += 1) {
      if (frames[index - d]) return frames[index - d];
      if (frames[index + d]) return frames[index + d];
    }
    return null;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "medium";

    computeLayout();
    buildBackground();

    // Fill background & letterbox grid once on resize
    ctx.drawImage(bgCanvas, 0, 0);

    lastDrawn = -1;
    const index = Math.round(current);
    drawFrame(index);
    lastDrawn = index;
  }

  /* ------------------------------------------------------------
     Scroll & frame mapping
     ------------------------------------------------------------ */

  function maxScroll() {
    return Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );
  }

  function readScroll() {
    const max = maxScroll();
    const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    target = progress * (FRAME_COUNT - 1);
    if (cue) cue.classList.toggle("is-hidden", window.scrollY > 40);
  }

  function scrollToFrame(frame, smooth = true) {
    const y = (frame / (FRAME_COUNT - 1)) * maxScroll();
    isProgrammaticScroll = true;
    window.scrollTo({
      top: y,
      behavior: smooth && !reduceMotion ? "smooth" : "auto",
    });
  }

  function stepFrames(delta) {
    pauseAutoPlay();
    const next = Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(current + delta)));
    scrollToFrame(next, false);
  }

  function jumpSection(direction) {
    pauseAutoPlay();
    let idx = activeSection + direction;
    idx = Math.max(0, Math.min(sections.length - 1, idx));
    scrollToFrame(sections[idx].frame, true);
  }

  /* ------------------------------------------------------------
     Audio & Auto-play engine
     ------------------------------------------------------------ */

  function toggleSound() {
    isSoundEnabled = !isSoundEnabled;
    if (soundBtn) soundBtn.classList.toggle("is-active", isSoundEnabled);
    if (soundLabel) soundLabel.textContent = isSoundEnabled ? "Sound ON" : "Sound";
    if (soundIcon) soundIcon.textContent = isSoundEnabled ? "🔊" : "🔇";

    if (isSoundEnabled) {
      if (bgAudio.duration) {
        bgAudio.currentTime = (current / (FRAME_COUNT - 1)) * bgAudio.duration;
      }
      if (isAutoPlaying) {
        bgAudio.play().catch(() => {});
      }
    } else {
      bgAudio.pause();
    }
  }

  function togglePlay() {
    if (isAutoPlaying) {
      userPaused = true;
      pauseAutoPlay();
    } else {
      userPaused = false;
      startAutoPlay();
    }
  }

  function startAutoPlay() {
    if (hasNavigated) return;
    userPaused = false;

    // If at or near the end, restart from beginning
    if (current >= FRAME_COUNT - 2) {
      current = 0;
      target = 0;
      scrollToFrame(0, false);
    }

    isAutoPlaying = true;
    if (playBtn) {
      playBtn.classList.add("is-active");
      playBtn.setAttribute("aria-label", "Pause showreel");
    }
    if (playLabel) playLabel.textContent = "Pause";
    if (playIcon) playIcon.textContent = "⏸";
    if (cueLabel) cueLabel.textContent = "Intro Playing";

    if (isSoundEnabled && bgAudio) {
      if (current < 1) {
        bgAudio.currentTime = 0;
      } else if (bgAudio.duration) {
        bgAudio.currentTime = (current / (FRAME_COUNT - 1)) * bgAudio.duration;
      }
      const playPromise = bgAudio.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(() => {
          const unlock = () => {
            if (isSoundEnabled && isAutoPlaying && bgAudio) {
              if (current < 1) bgAudio.currentTime = 0;
              else if (bgAudio.duration) bgAudio.currentTime = (current / (FRAME_COUNT - 1)) * bgAudio.duration;
              bgAudio.play().catch(() => {});
            }
            window.removeEventListener("pointerdown", unlock, true);
            window.removeEventListener("touchstart", unlock, true);
            window.removeEventListener("wheel", unlock, true);
            window.removeEventListener("keydown", unlock, true);
          };
          window.addEventListener("pointerdown", unlock, true);
          window.addEventListener("touchstart", unlock, true);
          window.addEventListener("wheel", unlock, true);
          window.addEventListener("keydown", unlock, true);
        });
      }
    }

    autoPlayLastTime = performance.now();
  }

  function pauseAutoPlay() {
    if (!isAutoPlaying) return;
    isAutoPlaying = false;
    if (playBtn) {
      playBtn.classList.remove("is-active");
      playBtn.setAttribute("aria-label", "Play showreel");
    }
    if (playLabel) playLabel.textContent = "Play";
    if (playIcon) playIcon.textContent = "▶";
    if (cueLabel && !hasNavigated) cueLabel.textContent = "Scroll to scrub";
    if (bgAudio) bgAudio.pause();
  }

  function syncAudioScrub(index) {
    if (!isSoundEnabled || isAutoPlaying || !bgAudio || !bgAudio.duration) return;
    const now = performance.now();
    if (now - lastAudioSyncTime < 100) return;
    lastAudioSyncTime = now;
    const targetTime = (index / (FRAME_COUNT - 1)) * bgAudio.duration;
    if (Math.abs(bgAudio.currentTime - targetTime) > 0.2) {
      bgAudio.currentTime = targetTime;
    }
  }

  function updateHud(index) {
    const p = index / (FRAME_COUNT - 1);

    if (progressBar && Math.abs(p - lastHudProgress) > 0.00001) {
      progressBar.style.transform = `scaleX(${p})`;
      lastHudProgress = p;
    }

    const label = String(index + 1).padStart(3, "0");
    if (frameNow && frameNow.textContent !== label) frameNow.textContent = label;

    const showCta = p > 0.965;
    if (endCta && showCta !== endCtaVisible) {
      endCtaVisible = showCta;
      endCta.classList.toggle("is-visible", showCta);
    }

    let sectionIndex = 0;
    for (let i = 0; i < sections.length; i += 1) {
      if (index >= sections[i].frame) sectionIndex = i;
    }
    if (sectionIndex !== activeSection) {
      activeSection = sectionIndex;
      sections.forEach((section, i) => {
        const isActive = i === sectionIndex;
        section.button.classList.toggle("is-active", isActive);
        if (isActive) {
          section.button.setAttribute("aria-current", "step");
        } else {
          section.button.removeAttribute("aria-current");
        }
      });
    }
  }

  /* ------------------------------------------------------------
     Main Animation Loop (tick)
     ------------------------------------------------------------ */

  function tick(timestamp) {
    if (!ready) return;

    // Handle auto-play timing
    if (isAutoPlaying) {
      const delta = Math.min(0.1, (timestamp - autoPlayLastTime) / 1000);
      autoPlayLastTime = timestamp;

      // Calculate effective FPS (increased delay for IEEE Hack Synapse segment only)
      const currentFps =
        target >= HACK_SYNAPSE_START && target <= HACK_SYNAPSE_END
          ? HACK_SYNAPSE_FPS
          : FPS;

      // Advance frames according to segment speed
      const step = delta * currentFps;
      target = Math.min(FRAME_COUNT - 1, target + step);

      const max = maxScroll();
      if (max > 0) {
        isProgrammaticScroll = true;
        window.scrollTo(0, (target / (FRAME_COUNT - 1)) * max);
      }

      if (target >= FRAME_COUNT - 1) {
        pauseAutoPlay();
        if (!hasNavigated) {
          window.setTimeout(() => {
            goToTechStack();
          }, 1000);
        }
      }
    }

    // Adaptive easing for ultra-smooth scrolling:
    // 0.12 gives a butter-smooth, cinematic inertia on trackpads and mouse wheels
    let ease;
    if (reduceMotion) {
      ease = 1.0;
    } else if (isAutoPlaying) {
      ease = 0.35;
    } else {
      ease = 0.12; // Silky smooth damping for manual scroll / wheel / trackpad
    }

    current += (target - current) * ease;
    if (Math.abs(target - current) < 0.02) current = target;

    const index = Math.max(
      0,
      Math.min(FRAME_COUNT - 1, Math.round(current))
    );

    if (index !== lastDrawn) {
      drawFrame(index);
      lastDrawn = index;
      syncAudioScrub(index);
    }

    updateHud(index);
    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------
     Interactions & Events
     ------------------------------------------------------------ */

  function initSections() {
    sections.forEach((section) => {
      section.button.setAttribute(
        "aria-label",
        `Go to ${section.button.querySelector(".rail-label").textContent}`
      );
      section.button.addEventListener("click", () => {
        pauseAutoPlay();
        scrollToFrame(section.frame, true);
      });
    });
  }

  function initBrand() {
    const brand = document.querySelector("[data-scroll-top]");
    if (!brand) return;
    brand.addEventListener("click", (event) => {
      event.preventDefault();
      pauseAutoPlay();
      window.scrollTo({
        top: 0,
        behavior: reduceMotion ? "auto" : "smooth",
      });
    });
  }

  function initControls() {
    if (playBtn) {
      const handlePlay = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        togglePlay();
      };
      playBtn.addEventListener("click", handlePlay);
      playBtn.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
      });
    }
    if (soundBtn) {
      soundBtn.addEventListener("click", (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        toggleSound();
      });
      soundBtn.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
      });
    }
    if (skipBtn) {
      skipBtn.addEventListener("click", (e) => {
        e.preventDefault();
        goToTechStack();
      });
    }

    // Comprehensive Keyboard Navigation
    window.addEventListener("keydown", (event) => {
      // Don't intercept if user is typing in an input
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;

      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "Escape" || event.key === "s" || event.key === "S") {
        if (!event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          goToTechStack();
        }
      } else if (event.key === "m" || event.key === "M") {
        toggleSound();
      } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        stepFrames(event.shiftKey ? 1 : 4);
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        stepFrames(event.shiftKey ? -1 : -4);
      } else if (event.key === "PageDown") {
        event.preventDefault();
        jumpSection(1);
      } else if (event.key === "PageUp") {
        event.preventDefault();
        jumpSection(-1);
      } else if (event.key === "Home") {
        event.preventDefault();
        pauseAutoPlay();
        scrollToFrame(0, true);
      } else if (event.key === "End") {
        event.preventDefault();
        pauseAutoPlay();
        scrollToFrame(FRAME_COUNT - 1, true);
      }
    });
  }

  function initCursor() {
    if (!finePointer) return;
    document.body.classList.add("has-pointer");

    const ring = document.getElementById("cursorRing");
    const dot = document.getElementById("cursorDot");
    if (!ring || !dot) return;

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;

    window.addEventListener(
      "pointermove",
      (event) => {
        mx = event.clientX;
        my = event.clientY;
        document.body.classList.add("cursor-active");
        dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`;
      },
      { passive: true }
    );

    document.addEventListener("pointerover", (event) => {
      if (!(event.target instanceof Element)) return;
      const interactive = event.target.closest("a, button");
      document.body.classList.toggle("cursor-hover", Boolean(interactive));
    });

    function cursorTick() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(cursorTick);
    }
    cursorTick();
  }

  /* ------------------------------------------------------------
     Boot
     ------------------------------------------------------------ */

  track.style.setProperty("--frames", String(FRAME_COUNT));
  track.style.setProperty("--step", `${SCROLL_PER_FRAME}px`);

  initSections();
  initBrand();
  initControls();
  initCursor();

  // Any direct user interaction pauses auto-play so user has full manual control
  window.addEventListener(
    "wheel",
    () => {
      if (isAutoPlaying) pauseAutoPlay();
      readScroll();
    },
    { passive: true }
  );

  window.addEventListener(
    "touchmove",
    () => {
      if (isAutoPlaying) pauseAutoPlay();
      readScroll();
    },
    { passive: true }
  );

  window.addEventListener(
    "scroll",
    () => {
      if (isProgrammaticScroll) {
        isProgrammaticScroll = false;
        return;
      }
      if (isAutoPlaying) {
        pauseAutoPlay();
      }
      readScroll();
    },
    { passive: true }
  );

  window.addEventListener("resize", () => {
    window.requestAnimationFrame(() => {
      resize();
      readScroll();
    });
  });

  window.addEventListener("orientationchange", () => {
    window.setTimeout(() => {
      resize();
      readScroll();
    }, 250);
  });

  resize();
  readScroll();
  loadFrames();
})();