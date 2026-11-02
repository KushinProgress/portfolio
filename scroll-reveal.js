/**
 * ScrollReveal (React Bits) - Vanilla JS + CSS Implementation
 * Mode: "scrub" (ties reveal directly to scroll position)
 * Splits text into words/pieces, applying progressive opacity, blur sharpening,
 * and seamless inline paragraph flow as you scroll down the page.
 */

(() => {
  "use strict";

  const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
  const smooth = (value) => value * value * (3 - 2 * value);
  const easeOut = (value) => 1 - Math.pow(1 - value, 3);
  const easeBack = (value, overshoot) => {
    const shifted = value - 1;
    return 1 + (overshoot + 1) * shifted * shifted * shifted + overshoot * shifted * shifted;
  };
  const glowAt = (t) =>
    t <= 0 || t >= 1 ? 0 : t < 0.35 ? smooth(t / 0.35) : 1 - smooth((t - 0.35) / 0.65);

  const paintPiece = (piece, t, look) => {
    let reveal = t;
    let fadeIn = t;
    let motion = "";

    if (look.effect === "rise") {
      reveal = easeOut(t);
      fadeIn = clamp01(reveal * 1.25);
      if (reveal < 1) {
        motion = look.masked
          ? `translateY(${((1 - reveal) * 100).toFixed(2)}%) translateY(${((1 - reveal) * 0.2).toFixed(3)}em)`
          : `translateY(${((1 - reveal) * 0.8).toFixed(3)}em)`;
      }
    } else if (look.effect === "flip") {
      reveal = easeBack(t, 1.2);
      fadeIn = clamp01(t * 2);
      if (t < 1) motion = `perspective(6em) rotateX(${((1 - reveal) * 90).toFixed(2)}deg)`;
    } else if (look.effect === "scale") {
      reveal = easeBack(t, 1.6);
      fadeIn = clamp01(t * 1.6);
      if (t < 1) motion = `scale(${(0.35 + 0.65 * reveal).toFixed(4)})`;
    }

    if (look.highlightColor) fadeIn = Math.max(fadeIn, clamp01(t / 0.35));

    const settle = clamp01(reveal);
    const lift = look.offset * (1 - settle);

    piece.style.opacity =
      t >= 1 ? "" : (look.baseOpacity + (1 - look.baseOpacity) * fadeIn).toFixed(3);
    piece.style.transform = [lift ? `translateY(${lift.toFixed(2)}px)` : "", motion]
      .filter(Boolean)
      .join(" ");
    piece.style.filter =
      look.blur && settle < 1 ? `blur(${(look.blur * (1 - settle)).toFixed(2)}px)` : "";

    if (look.highlightColor) {
      const glow = glowAt(t);
      piece.style.color =
        glow > 0.002
          ? `color-mix(in srgb, ${look.highlightColor} ${(glow * 100).toFixed(1)}%, currentColor)`
          : "";
    }
  };

  function initScrollReveal(container, options = {}) {
    if (!container) return null;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const settings = {
      mode: options.mode || "scrub",
      splitBy: options.splitBy || "words",
      effect: options.effect || "fade",
      stagger: options.stagger ?? 0.035,
      duration: options.duration ?? 0.8,
      smoothing: options.smoothing ?? 0,
      baseOpacity: options.baseOpacity ?? 0.15,
      baseRotation: options.baseRotation ?? 0,
      baseOffset: options.baseOffset ?? 0,
      enableBlur: options.enableBlur ?? true,
      blurStrength: options.blurStrength ?? 3.5,
      highlightColor: options.highlightColor || "",
    };

    container.classList.add("scroll-reveal");

    // Extract text nodes and element nodes (e.g. <strong>) while structuring into words/pieces
    const rawNodes = Array.from(container.childNodes);
    const cleanFullText = container.textContent.trim();
    container.setAttribute("aria-label", cleanFullText);
    container.innerHTML = "";

    const textWrapper = document.createElement("span");
    textWrapper.className = "scroll-reveal-text";
    textWrapper.style.display = "inline";
    textWrapper.setAttribute("aria-hidden", "true");

    const pieces = [];

    function processTextString(str, parentEl, isStrong = false) {
      const tokens = str.split(/(\s+)/);
      const words = tokens.filter((t) => t && !/^\s+$/.test(t));
      const totalWords = Math.max(1, words.length);
      let wordIdx = 0;

      tokens.forEach((token) => {
        if (!token) return;
        if (/^\s+$/.test(token)) {
          parentEl.appendChild(document.createTextNode(" "));
          return;
        }
        const wordSpan = document.createElement("span");
        wordSpan.className = "scroll-reveal-word";
        wordSpan.style.display = "inline-block";
        wordSpan.style.whiteSpace = "nowrap";

        if (settings.splitBy === "chars") {
          Array.from(token).forEach((ch) => {
            const pieceSpan = document.createElement("span");
            pieceSpan.className = "scroll-reveal-piece";
            pieceSpan.style.display = "inline-block";
            pieceSpan.textContent = ch;
            if (isStrong) {
              const f = totalWords > 1 ? wordIdx / (totalWords - 1) : 0;
              const r = Math.round(242 + (251 - 242) * f);
              const g = Math.round(105 + (165 - 105) * f);
              const b = Math.round(83 + (119 - 83) * f);
              pieceSpan.style.color = `rgb(${r},${g},${b})`;
              pieceSpan.style.fontWeight = "700";
              pieceSpan.style.textShadow = "0 0 16px rgba(242,105,83,0.25)";
            }
            wordSpan.appendChild(pieceSpan);
            pieces.push(pieceSpan);
          });
        } else {
          const pieceSpan = document.createElement("span");
          pieceSpan.className = "scroll-reveal-piece";
          pieceSpan.style.display = "inline-block";
          pieceSpan.textContent = token;
          if (isStrong) {
            const f = totalWords > 1 ? wordIdx / (totalWords - 1) : 0;
            const r = Math.round(242 + (251 - 242) * f);
            const g = Math.round(105 + (165 - 105) * f);
            const b = Math.round(83 + (119 - 83) * f);
            pieceSpan.style.color = `rgb(${r},${g},${b})`;
            pieceSpan.style.fontWeight = "700";
            pieceSpan.style.textShadow = "0 0 16px rgba(242,105,83,0.25)";
          }
          wordSpan.appendChild(pieceSpan);
          pieces.push(pieceSpan);
        }

        wordIdx++;
        parentEl.appendChild(wordSpan);
      });
    }

    rawNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        processTextString(node.textContent, textWrapper, false);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const clone = node.cloneNode(false);
        const isStrong = node.tagName === "STRONG" || node.tagName === "B";
        if (isStrong) {
          clone.style.webkitTextFillColor = "initial";
          clone.style.background = "none";
          clone.style.color = "#f26953";
          clone.style.fontWeight = "700";
          clone.style.display = "inline";
        }
        processTextString(node.textContent, clone, isStrong);
        textWrapper.appendChild(clone);
      }
    });

    container.appendChild(textWrapper);

    const look = {
      effect: settings.effect,
      masked: settings.effect === "rise",
      baseOpacity: settings.baseOpacity,
      blur: settings.enableBlur ? settings.blurStrength : 0,
      offset: settings.baseOffset,
      highlightColor: settings.highlightColor,
    };

    pieces.forEach((piece) => {
      piece.style.willChange = "opacity, filter";
    });

    if (reduceMotion) {
      pieces.forEach((piece) => {
        piece.style.opacity = "";
        piece.style.filter = "";
        piece.style.transform = "";
      });
      return { destroy: () => {} };
    }

    const SCRUB_SPAN = 0.45;
    const count = pieces.length;
    const gap = Math.max(0, settings.stagger);
    const total = SCRUB_SPAN + Math.max(0, count - 1) * gap;

    let targetProgress = 0;
    let smoothProgress = 0;
    let rafId = 0;
    let isTicking = false;

    function calcProgress() {
      const rect = container.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      // Start reveal smoothly when top approaches viewport bottom
      const startY = vh * 0.92;
      // Finish reveal when middle of the paragraph reaches upper-center
      const endY = vh * 0.38;
      const totalDist = startY - endY + rect.height * 0.35;
      const distScrolled = startY - rect.top;
      return clamp01(distScrolled / totalDist);
    }

    function render(p) {
      const at = p * total;
      for (let i = 0; i < count; i++) {
        const t = clamp01((at - i * gap) / SCRUB_SPAN);
        paintPiece(pieces[i], t, look);
      }

      if (settings.baseRotation) {
        const rot = (1 - p) * settings.baseRotation;
        container.style.transformOrigin = "0% 50%";
        container.style.transform = `rotate(${rot.toFixed(2)}deg)`;
      }
    }

    function update() {
      if (settings.smoothing > 0) {
        smoothProgress += (targetProgress - smoothProgress) * 0.14;
        render(smoothProgress);
        if (Math.abs(targetProgress - smoothProgress) > 0.001) {
          rafId = requestAnimationFrame(update);
          return;
        }
      } else {
        render(targetProgress);
      }
      isTicking = false;
    }

    function onScroll() {
      targetProgress = calcProgress();
      if (!isTicking) {
        isTicking = true;
        rafId = requestAnimationFrame(update);
      }
    }

    // Initial paint
    targetProgress = calcProgress();
    smoothProgress = targetProgress;
    render(targetProgress);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return {
      destroy: () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        pieces.forEach((piece) => {
          piece.style.opacity = "";
          piece.style.filter = "";
          piece.style.transform = "";
          piece.style.color = "";
        });
        container.style.transform = "";
      },
    };
  }

  window.initScrollReveal = initScrollReveal;
  window.ScrollReveal = initScrollReveal;
})();
