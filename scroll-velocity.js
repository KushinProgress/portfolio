/**
 * ScrollVelocity (React Bits) - Vanilla JS + CSS Implementation
 * Features:
 * - Opposite direction infinite scrolling rows
 * - Scroll velocity tracking with spring physics (damping & stiffness)
 * - Velocity-based skewX and scaleY surging
 * - Pointer drag scrub and fling with inertia
 * - Soft edge fade masks
 * - Infinite seamless looping wrapping
 */

(() => {
  "use strict";

  const smootherstep = (t) => t * t * t * (t * (t * 6 - 15) + 10);

  const FADE_STEPS = Array.from({ length: 9 }, (_, i) => i / 8);

  const FADE_MASK = `linear-gradient(to right, ${[
    ...FADE_STEPS.map(
      (t) =>
        `rgba(0, 0, 0, ${smootherstep(t).toFixed(3)}) ${(t * 12).toFixed(1)}%`
    ),
    ...FADE_STEPS.map(
      (t) =>
        `rgba(0, 0, 0, ${smootherstep(1 - t).toFixed(3)}) ${(
          88 +
          t * 12
        ).toFixed(1)}%`
    ),
  ].join(", ")})`;

  function wrap(min, max, v) {
    const range = max - min;
    const mod = (((v - min) % range) + range) % range;
    return mod + min;
  }

  function initScrollVelocity(container, options = {}) {
    if (!container) return null;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const settings = {
      texts: options.texts && options.texts.length ? options.texts : ["PORTFOLIO", "SCROLL DOWN"],
      velocity: Math.max(10, options.velocity ?? 100),
      skewWithVelocity: options.skewWithVelocity ?? 16,
      scaleWithVelocity: options.scaleWithVelocity ?? 0.18,
      draggable: options.draggable ?? true,
      fontSize: options.fontSize || "clamp(46px, 7.5vw, 104px)",
      fontWeight: options.fontWeight || 900,
      fontFamily: options.fontFamily || "var(--serif, 'Playfair Display', Georgia, serif)",
      color: options.color || "var(--paper, #f4e9e3)",
      outlineColor: options.outlineColor || "var(--red, #ff2738)",
      outlineAlternate: options.outlineAlternate ?? true,
      separator: options.separator !== undefined ? options.separator : "—",
      gap: options.gap ?? 28,
      numCopies: Math.max(4, options.numCopies ?? 8),
      fadeEdges: options.fadeEdges ?? true,
      pauseOnHover: options.pauseOnHover ?? false,
      damping: options.damping ?? 50,
      stiffness: options.stiffness ?? 400,
      className: options.className || "",
    };

    container.innerHTML = "";
    container.classList.add("scroll-velocity-container");

    const section = document.createElement("div");
    section.className = "scroll-velocity-section";
    section.style.width = "100%";
    section.style.position = "relative";
    section.style.overflow = "hidden";
    if (settings.fadeEdges) {
      section.style.webkitMaskImage = FADE_MASK;
      section.style.maskImage = FADE_MASK;
    }

    let isSectionHovered = false;
    section.addEventListener("pointerenter", () => {
      isSectionHovered = true;
    });
    section.addEventListener("pointerleave", () => {
      isSectionHovered = false;
    });

    // Global scroll velocity tracker with spring physics
    let lastScrollY = window.scrollY;
    let lastScrollTime = performance.now();
    let rawVelocity = 0;
    let smoothVelocity = 0;
    let springVelocity = 0;

    const onScroll = () => {
      const now = performance.now();
      const dt = Math.max(1, now - lastScrollTime);
      const currentY = window.scrollY;
      const dy = currentY - lastScrollY;
      rawVelocity = (dy / dt) * 1000;
      lastScrollY = currentY;
      lastScrollTime = now;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const rows = [];

    settings.texts.forEach((text, rowIndex) => {
      const isOdd = rowIndex % 2 !== 0;
      const baseVelocity = isOdd ? -settings.velocity : settings.velocity;
      const isOutlined = settings.outlineAlternate && isOdd;

      const rowWrapper = document.createElement("div");
      rowWrapper.className = `parallax scroll-velocity-row ${settings.className}`;
      rowWrapper.style.position = "relative";
      rowWrapper.style.overflow = "hidden";
      rowWrapper.style.width = "100%";
      rowWrapper.style.margin = rowIndex === 0 ? "0 0 10px 0" : "0";
      if (settings.draggable) {
        rowWrapper.style.cursor = "grab";
        rowWrapper.style.userSelect = "none";
        rowWrapper.style.webkitUserSelect = "none";
        rowWrapper.style.touchAction = "pan-y";
      }

      const scroller = document.createElement("div");
      scroller.className = "scroller scroll-velocity-scroller";
      scroller.style.display = "flex";
      scroller.style.whiteSpace = "nowrap";
      scroller.style.willChange = "transform";
      scroller.style.fontFamily = settings.fontFamily;
      scroller.style.fontSize = typeof settings.fontSize === "number" ? `${settings.fontSize}px` : settings.fontSize;
      scroller.style.fontWeight = String(settings.fontWeight);
      scroller.style.lineHeight = "0.96";
      scroller.style.letterSpacing = "-0.03em";

      if (isOutlined) {
        scroller.style.webkitTextFillColor = "transparent";
        scroller.style.webkitTextStroke = `max(1.5px, 0.025em) ${settings.outlineColor}`;
        scroller.style.color = settings.outlineColor;
      } else {
        scroller.style.color = settings.color;
      }

      const copyElements = [];
      for (let i = 0; i < settings.numCopies; i++) {
        const copySpan = document.createElement("span");
        copySpan.className = "scroll-velocity-copy";
        copySpan.style.display = "inline-flex";
        alignText(copySpan, text, settings.separator, settings.gap);
        if (i > 0) copySpan.setAttribute("aria-hidden", "true");
        scroller.appendChild(copySpan);
        copyElements.push(copySpan);
      }

      rowWrapper.appendChild(scroller);
      section.appendChild(rowWrapper);

      const rowState = {
        scroller,
        copyEl: copyElements[0],
        copyWidth: 0,
        baseX: 0,
        skewX: 0,
        scaleY: 1,
        directionFactor: 1,
        pace: 1,
        fling: 0,
        baseVelocity,
        drag: {
          active: false,
          pointerId: -1,
          lastX: 0,
          lastTime: 0,
          velocity: 0,
          travel: 0,
        },
      };

      if (settings.draggable) {
        rowWrapper.addEventListener("pointerdown", (e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          const grab = rowState.drag;
          grab.active = true;
          grab.pointerId = e.pointerId;
          grab.lastX = e.clientX;
          grab.lastTime = e.timeStamp || performance.now();
          grab.velocity = 0;
          grab.travel = 0;
          rowState.fling = 0;
          if (rowWrapper.setPointerCapture) rowWrapper.setPointerCapture(e.pointerId);
          rowWrapper.style.cursor = "grabbing";
        });

        rowWrapper.addEventListener("pointermove", (e) => {
          const grab = rowState.drag;
          if (!grab.active || e.pointerId !== grab.pointerId) return;
          const now = e.timeStamp || performance.now();
          const dx = e.clientX - grab.lastX;
          const dt = Math.max(now - grab.lastTime, 1);
          grab.lastX = e.clientX;
          grab.lastTime = now;
          grab.travel += Math.abs(dx);
          rowState.baseX += dx;
          grab.velocity += ((dx / dt) * 1000 - grab.velocity) * (1 - Math.exp(-dt / 50));
        });

        const onPointerUp = (e) => {
          const grab = rowState.drag;
          if (!grab.active || e.pointerId !== grab.pointerId) return;
          grab.active = false;
          const now = e.timeStamp || performance.now();
          const resting = now - grab.lastTime > 90;
          rowState.fling = resting
            ? 0
            : Math.max(-5000, Math.min(5000, grab.velocity));
          grab.velocity = 0;
          if (rowWrapper.hasPointerCapture && rowWrapper.hasPointerCapture(e.pointerId)) {
            try {
              rowWrapper.releasePointerCapture(e.pointerId);
            } catch (_) {}
          }
          rowWrapper.style.cursor = "grab";
        };

        rowWrapper.addEventListener("pointerup", onPointerUp);
        rowWrapper.addEventListener("pointercancel", onPointerUp);

        rowWrapper.addEventListener("click", (e) => {
          if (rowState.drag.travel > 6) {
            e.preventDefault();
            e.stopPropagation();
          }
        }, true);
      }

      rows.push(rowState);
    });

    container.appendChild(section);

    function alignText(el, text, sep, gap) {
      el.textContent = text + "\u00A0";
      if (sep) {
        const sepSpan = document.createElement("span");
        sepSpan.style.opacity = "0.55";
        sepSpan.style.margin = gap > 0 ? `0 ${gap / 2}px` : "0 8px";
        sepSpan.textContent = sep;
        el.appendChild(sepSpan);
        el.appendChild(document.createTextNode("\u00A0"));
      } else if (gap > 0) {
        el.style.paddingRight = `${gap}px`;
      }
    }

    const measureWidths = () => {
      rows.forEach((row) => {
        const w = row.copyEl.getBoundingClientRect().width;
        if (w > 0) row.copyWidth = w;
      });
    };

    measureWidths();
    const resizeObserver = new ResizeObserver(measureWidths);
    resizeObserver.observe(container);
    if (document.fonts?.ready) {
      document.fonts.ready.then(measureWidths).catch(() => {});
    }

    let rafId = 0;
    let lastFrameTime = performance.now();

    const animate = (now) => {
      const deltaMs = Math.min(now - lastFrameTime, 64);
      lastFrameTime = now;
      const dtSec = deltaMs / 1000;

      // Decay raw velocity if scrolling stopped
      if (now - lastScrollTime > 60) {
        rawVelocity = 0;
      }

      // Spring simulation for smoothVelocity
      const springForce = -settings.stiffness * (smoothVelocity - rawVelocity);
      const dampingForce = -settings.damping * springVelocity;
      const acceleration = springForce + dampingForce;
      springVelocity += acceleration * dtSec;
      smoothVelocity += springVelocity * dtSec;

      const velocityFactor = (Math.abs(smoothVelocity) / 1000) * 5;

      rows.forEach((row) => {
        if (reduceMotion) return;

        const grab = row.drag;
        const targetPace =
          grab.active || (settings.pauseOnHover && isSectionHovered) ? 0 : 1;
        row.pace += (targetPace - row.pace) * (1 - Math.exp(-deltaMs / 150));

        let moveBy = row.directionFactor * row.baseVelocity * dtSec;

        if (smoothVelocity < -8) {
          row.directionFactor = -1;
        } else if (smoothVelocity > 8) {
          row.directionFactor = 1;
        }

        moveBy += row.directionFactor * moveBy * velocityFactor;
        let travel = moveBy * row.pace;

        if (!grab.active && row.fling !== 0) {
          travel += row.fling * dtSec;
          row.fling *= Math.exp(-deltaMs / 420);
          if (Math.abs(row.fling) < 4) row.fling = 0;
        }

        row.baseX += travel;

        const copyW = row.copyWidth || 300;
        const x = wrap(-copyW, 0, row.baseX);

        if (settings.skewWithVelocity || settings.scaleWithVelocity) {
          const thrown = grab.active ? grab.velocity : row.fling;
          const scrollSurge = Math.tanh(Math.abs(smoothVelocity) / 1600) * row.pace;
          const throwSurge = Math.tanh(Math.abs(thrown) / 2000);
          const surge = Math.max(scrollSurge, throwSurge);
          const heading =
            throwSurge > scrollSurge
              ? Math.sign(thrown)
              : Math.sign(travel) ||
                row.directionFactor * Math.sign(row.baseVelocity);
          const ease = 1 - Math.exp(-deltaMs / 110);
          const nextSkew =
            row.skewX +
            (-heading * settings.skewWithVelocity * surge - row.skewX) * ease;
          const nextScale =
            row.scaleY +
            (1 + settings.scaleWithVelocity * surge - row.scaleY) * ease;

          row.skewX =
            Math.abs(nextSkew) < 0.01 && !settings.skewWithVelocity
              ? 0
              : nextSkew;
          row.scaleY =
            Math.abs(nextScale - 1) < 0.0005 && !settings.scaleWithVelocity
              ? 1
              : nextScale;
        }

        row.scroller.style.transform = `translate3d(${x.toFixed(
          2
        )}px, 0, 0) skewX(${row.skewX.toFixed(2)}deg) scaleY(${row.scaleY.toFixed(
          4
        )})`;
      });

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return {
      destroy: () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener("scroll", onScroll);
        resizeObserver.disconnect();
        container.innerHTML = "";
      },
    };
  }

  window.initScrollVelocity = initScrollVelocity;
  window.ScrollVelocity = initScrollVelocity;
})();

