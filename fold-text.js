/**
 * FoldText (React Bits) - Vanilla JS + CSS Implementation
 * 3D paper folding text animation with scroll trigger and cursor refold
 */

(() => {
  "use strict";

  const HINGES = {
    top: { origin: "50% 0%", axis: "rotateX", sign: -1 },
    bottom: { origin: "50% 100%", axis: "rotateX", sign: 1 },
    left: { origin: "0% 50%", axis: "rotateY", sign: 1 },
    right: { origin: "100% 50%", axis: "rotateY", sign: -1 },
  };

  const SLATS = {
    rotateX: {
      origins: ["50% 25%", "50% 75%"],
      clips: ["inset(-40% -20% 50% -20%)", "inset(50% -20% -40% -20%)"],
    },
    rotateY: {
      origins: ["25% 50%", "75% 50%"],
      clips: ["inset(-40% 50% -40% -20%)", "inset(-40% -20% -40% 50%)"],
    },
  };

  const FOLD_STYLES = ["paper", "blinds", "flip"];
  const SLAT_DELAY = 0.24;
  const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

  // High-precision power3.out easing function if GSAP is not loaded
  const easePower3Out = (t) => 1 - Math.pow(1 - t, 3);
  const easePower2In = (t) => t * t;

  function initFoldText(container, options = {}) {
    if (!container) return null;

    const text = options.text || container.textContent.trim() || "Design unfolds";
    const splitBy = options.splitBy || "char";
    const hinge = options.hinge || "top";
    const foldStyle = FOLD_STYLES.includes(options.foldStyle) ? options.foldStyle : "paper";
    const duration = options.duration ?? 0.65;
    const stagger = options.stagger ?? 0.045;
    const staggerFrom = options.staggerFrom || "start";
    const foldAngle = clamp(options.foldAngle ?? 92, 0, 180);
    const perspective = Math.max(120, options.perspective ?? 700);
    const creaseShading = clamp(options.creaseShading ?? 0.55, 0, 1);
    const trigger = options.trigger || "scroll";
    const loopDelay = Math.max(0, options.loopDelay ?? 1.4);
    const hoverRefold = options.hoverRefold ?? true;
    const refoldRadius = Math.max(1, options.refoldRadius ?? 140);
    const refoldAngle = clamp(options.refoldAngle ?? 45, 0, 180);

    const safeHinge = HINGES[hinge] ? hinge : "top";
    const hingeConfig = HINGES[safeHinge];
    const startsFolded = trigger !== "hover";

    container.classList.add("fold-text");
    container.style.setProperty("--fold-perspective", `${perspective}px`);
    if (options.fontSize) container.style.fontSize = options.fontSize;
    if (options.fontWeight) container.style.fontWeight = options.fontWeight;

    // Build the visual elements
    container.innerHTML = "";

    const srOnly = document.createElement("span");
    srOnly.className = "fold-text-sr-only";
    srOnly.textContent = text;
    container.appendChild(srOnly);

    const visual = document.createElement("span");
    visual.className = "fold-text-visual";
    visual.setAttribute("aria-hidden", "true");

    function createPiece(content, isLine = false) {
      const seg = document.createElement("span");
      seg.className = "fold-text-segment";
      if (isLine) seg.setAttribute("data-fold-split", "line");

      if (foldStyle === "blinds") {
        const piece = document.createElement("span");
        piece.className = "fold-text-piece";
        piece.setAttribute("data-fold-hinge", safeHinge);
        piece.setAttribute("data-fold-style", "blinds");
        if (startsFolded) piece.style.opacity = "0";

        const slatA = document.createElement("span");
        slatA.className = "fold-text-slat";
        slatA.setAttribute("data-fold-text", content);
        slatA.textContent = content;

        const slatB = document.createElement("span");
        slatB.className = "fold-text-slat";
        slatB.setAttribute("data-fold-slat", "b");
        slatB.setAttribute("data-fold-text", content);
        slatB.textContent = content;

        piece.appendChild(slatA);
        piece.appendChild(slatB);
        seg.appendChild(piece);
      } else {
        const piece = document.createElement("span");
        piece.className = "fold-text-piece";
        piece.setAttribute("data-fold-hinge", safeHinge);
        piece.setAttribute("data-fold-style", foldStyle);
        piece.setAttribute("data-fold-text", content);
        if (startsFolded) piece.style.opacity = "0";
        piece.textContent = content;
        seg.appendChild(piece);
      }
      return seg;
    }

    if (splitBy === "line") {
      text.split("\n").forEach((line) => {
        visual.appendChild(createPiece(line || "\u00A0", true));
      });
    } else {
      const parts = text.split(/(\s+)/);
      parts.forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          visual.appendChild(document.createTextNode(part));
          return;
        }

        if (splitBy === "word") {
          visual.appendChild(createPiece(part));
          return;
        }

        const word = document.createElement("span");
        word.className = "fold-text-word";
        Array.from(part).forEach((ch) => {
          word.appendChild(createPiece(ch));
        });
        visual.appendChild(word);
      });
    }

    container.appendChild(visual);

    const elements = Array.from(container.querySelectorAll(".fold-text-piece"));
    if (!elements.length) return null;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const { axis, sign, origin } = hingeConfig;
    const slats = SLATS[axis];
    const angle = reduceMotion ? 0 : foldStyle === "flip" ? 180 : foldAngle;
    const crease = reduceMotion ? 0 : creaseShading;
    const refold = hoverRefold && !reduceMotion ? refoldAngle : 0;
    const lift = foldStyle === "flip" && !reduceMotion ? 0.45 : 0;
    const unfoldDuration = reduceMotion ? Math.min(duration, 0.22) : duration;

    const pieces = elements.map((element) => {
      const parts = foldStyle === "blinds" ? Array.from(element.children) : [element];
      if (foldStyle === "blinds") {
        element.style.opacity = "1";
        parts.forEach((part, index) => {
          part.style.transformOrigin = slats.origins[index];
          if (index > 0) part.style.clipPath = slats.clips[index];
        });
      } else {
        element.style.transformOrigin = foldStyle === "flip" ? "50% 50%" : origin;
        element.style.backfaceVisibility = foldStyle === "flip" ? "visible" : "";
      }
      return { element, parts, t: startsFolded ? 0 : 1, f: 0, r: 0, aim: 0 };
    });

    const shade = (progress, tilt) => String(crease * clamp(1 - progress + tilt / 90, 0, 1));

    const render = () => {
      pieces.forEach((piece) => {
        const tilt = piece.r * refold;

        if (foldStyle === "blinds") {
          let resting = tilt < 0.05;
          piece.parts.forEach((part, index) => {
            const offset = index * SLAT_DELAY;
            const open = easePower3Out(clamp((piece.t - offset) / (1 - SLAT_DELAY), 0, 1));
            const close = easePower2In(clamp((piece.f - offset) / (1 - SLAT_DELAY), 0, 1));
            const progress = open * (1 - close);
            if (Math.abs(1 - progress) > 0.002) resting = false;
            part.style.transform = `${axis}(${sign * ((1 - progress) * angle + tilt)}deg)`;
            part.style.opacity = String(clamp(progress, 0, 1));
            part.style.setProperty("--fold-crease", shade(progress, tilt));
          });
          piece.parts[0].style.clipPath = resting ? "none" : slats.clips[0];
          piece.parts[1].style.visibility = resting ? "hidden" : "visible";
          return;
        }

        const progress = easePower3Out(piece.t) * (1 - easePower2In(piece.f));
        const rise = lift * Math.sin(Math.PI * clamp(progress, 0, 1));
        const turn = `${axis}(${sign * ((1 - progress) * angle + tilt)}deg)`;
        piece.element.style.transform = rise > 0.001 ? `translateZ(${rise}em) ${turn}` : turn;
        piece.element.style.opacity = String(clamp(progress, 0, 1));
        piece.element.style.setProperty("--fold-crease", shade(progress, tilt));
      });
    };

    let animRaf = 0;
    let hasPlayed = false;

    const play = (loop = false) => {
      if (hasPlayed && !loop) return;
      hasPlayed = true;
      cancelAnimationFrame(animRaf);

      const count = pieces.length;
      const startTime = performance.now();
      const totalDuration = unfoldDuration * 1000 + Math.max(0, count - 1) * stagger * 1000;

      function step(now) {
        const elapsed = (now - startTime) / 1000;
        let allDone = true;

        pieces.forEach((piece, idx) => {
          let delay = idx * stagger;
          if (staggerFrom === "end") delay = (count - 1 - idx) * stagger;
          else if (staggerFrom === "center") delay = Math.abs(idx - (count - 1) / 2) * stagger;

          const pElapsed = elapsed - delay;
          if (pElapsed < unfoldDuration) {
            allDone = false;
          }
          piece.t = clamp(pElapsed / unfoldDuration, 0, 1);
        });

        render();

        if (!allDone) {
          animRaf = requestAnimationFrame(step);
        } else if (loop) {
          setTimeout(() => {
            // Fold back
            const closeStart = performance.now();
            function closeStep(cNow) {
              const cElapsed = (cNow - closeStart) / 1000;
              let cAllDone = true;
              pieces.forEach((piece, idx) => {
                const delay = idx * stagger;
                const pElapsed = cElapsed - delay;
                if (pElapsed < unfoldDuration * 0.75) cAllDone = false;
                piece.f = clamp(pElapsed / (unfoldDuration * 0.75), 0, 1);
              });
              render();
              if (!cAllDone) requestAnimationFrame(closeStep);
              else setTimeout(() => play(true), 350);
            }
            requestAnimationFrame(closeStep);
          }, loopDelay * 1000);
        }
      }

      animRaf = requestAnimationFrame(step);
    };

    // Scroll trigger observer
    let observer = null;
    if (trigger === "scroll") {
      render();
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              play(false);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: options.threshold !== undefined ? options.threshold : 0.15 }
      );
      observer.observe(container);
    } else if (trigger === "hover") {
      render();
      container.addEventListener("mouseenter", () => play(false));
    } else {
      play(trigger === "loop");
    }

    // Hover Refold cursor interaction
    let pointer = null;
    let centers = null;
    let measured = null;
    let relaxing = false;
    let relaxRaf = 0;
    let lastTime = 0;

    const measure = (box) => {
      centers = pieces.map((piece) => {
        const rect = piece.element.parentElement.getBoundingClientRect();
        return {
          x: rect.left - box.left + rect.width / 2,
          y: rect.top - box.top + rect.height / 2,
        };
      });
      measured = { width: box.width, height: box.height };
    };

    const relax = (now) => {
      const deltaTime = lastTime ? now - lastTime : 16;
      lastTime = now;
      const step = Math.min(deltaTime, 64) / 1000;
      let moving = false;

      pieces.forEach((piece) => {
        const rate = piece.aim > piece.r ? 14 : 6;
        piece.r += (piece.aim - piece.r) * (1 - Math.exp(-rate * step));
        if (Math.abs(piece.aim - piece.r) > 0.001) moving = true;
        else piece.r = piece.aim;
      });

      render();

      if (moving) {
        relaxRaf = requestAnimationFrame(relax);
      } else {
        relaxing = false;
        lastTime = 0;
      }
    };

    const aim = () => {
      const box = container.getBoundingClientRect();
      const near =
        pointer &&
        pointer.x > box.left - refoldRadius &&
        pointer.x < box.right + refoldRadius &&
        pointer.y > box.top - refoldRadius &&
        pointer.y < box.bottom + refoldRadius;

      if (
        near &&
        (!centers ||
          Math.abs(box.width - measured.width) + Math.abs(box.height - measured.height) > 1)
      ) {
        measure(box);
      }

      let changed = false;
      pieces.forEach((piece, index) => {
        let value = 0;
        if (near && centers && centers[index]) {
          const center = centers[index];
          const distance =
            Math.hypot(box.left + center.x - pointer.x, box.top + center.y - pointer.y) /
            refoldRadius;
          if (distance < 1) value = 1 - distance * distance * (3 - 2 * distance);
        }
        if (value !== piece.aim) changed = true;
        piece.aim = value;
      });

      if (changed && !relaxing) {
        relaxing = true;
        lastTime = performance.now();
        relaxRaf = requestAnimationFrame(relax);
      }
    };

    const handleMove = (event) => {
      pointer = { x: event.clientX, y: event.clientY };
      aim();
    };

    const handleLeave = () => {
      pointer = null;
      aim();
    };

    const handleScroll = () => {
      if (pointer) aim();
    };

    if (refold) {
      window.addEventListener("pointermove", handleMove, { passive: true });
      window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
      document.documentElement.addEventListener("pointerleave", handleLeave);
    }

    return {
      play,
      destroy: () => {
        cancelAnimationFrame(animRaf);
        cancelAnimationFrame(relaxRaf);
        if (observer) observer.disconnect();
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("scroll", handleScroll, { capture: true });
        document.documentElement.removeEventListener("pointerleave", handleLeave);
      },
    };
  }

  window.initFoldText = initFoldText;
  window.FoldText = initFoldText;
})();
