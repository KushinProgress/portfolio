/**
 * ScrambledText (React Bits) - Vanilla JS + CSS Implementation
 * Inspired by Tom Miller (GSAP Community) / React Bits
 * Supports 'scramble', 'lift', 'blur', 'magnify' effects,
 * proximity hover, click burst shockwaves, and scroll intro decode.
 */

(() => {
  "use strict";

  const PHYSICAL = { lift: true, blur: true, magnify: true };

  const falloff = (distance, radius) => {
    if (distance >= radius) return 0;
    const f = 1 - (distance / radius) ** 2;
    return f * f;
  };

  function initScrambledText(root, options = {}) {
    if (!root) return null;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const settings = {
      radius: Math.max(1, options.radius ?? 100),
      duration: Math.max(0.1, options.duration ?? 1.2),
      speed: Math.max(0.05, options.speed ?? 0.5),
      scrambleChars: options.scrambleChars || ".:",
      scrambleColor: options.scrambleColor || "",
      effect: options.effect || "scramble",
      strength: Math.max(0, options.strength ?? 1),
      trail: Math.max(0.05, options.trail ?? 0.6),
      clickBurst: options.clickBurst ?? true,
      intro: options.intro ?? true,
      color: options.color || "",
      fontFamily: options.fontFamily || "",
      className: options.className || "",
    };

    root.classList.add("scrambled-text");
    if (settings.className) {
      settings.className
        .split(/\s+/)
        .filter(Boolean)
        .forEach((cls) => root.classList.add(cls));
    }
    if (settings.color) root.style.color = settings.color;
    if (settings.fontFamily) root.style.fontFamily = settings.fontFamily;

    const originalText = root.textContent.trim();
    const srSpan = document.createElement("span");
    srSpan.className = "scrambled-text-sr";
    srSpan.textContent = originalText;

    const charElements = [];
    const glyphElements = [];
    const originals = [];

    const processText = (text, parentEl) => {
      const tokens = text.split(/(\s+)/);
      tokens.forEach((token) => {
        if (!token) return;
        if (/^\s+$/.test(token)) {
          parentEl.appendChild(document.createTextNode(token));
        } else {
          const wordSpan = document.createElement("span");
          wordSpan.className = "scrambled-word";
          for (let i = 0; i < token.length; i++) {
            const ch = token[i];
            const charSpan = document.createElement("span");
            charSpan.className = "scrambled-char";

            const sizer = document.createElement("span");
            sizer.className = "scrambled-sizer";
            sizer.textContent = ch;

            const glyph = document.createElement("span");
            glyph.className = "scrambled-glyph";
            glyph.textContent = ch;

            charSpan.appendChild(sizer);
            charSpan.appendChild(glyph);
            wordSpan.appendChild(charSpan);

            charElements.push(charSpan);
            glyphElements.push(glyph);
            originals.push(ch);
          }
          parentEl.appendChild(wordSpan);
        }
      });
    };

    const traverse = (node, parentEl) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === 3) {
          processText(child.textContent, parentEl);
        } else if (child.nodeType === 1) {
          const clone = child.cloneNode(false);
          clone.removeAttribute("id");
          traverse(child, clone);
          parentEl.appendChild(clone);
        }
      });
    };

    const contentEl = document.createElement("div");
    contentEl.className = "scrambled-content";
    contentEl.setAttribute("aria-hidden", "true");

    traverse(root, contentEl);

    root.replaceChildren(srSpan, contentEl);

    const chars = charElements;
    const glyphs = glyphElements;
    const points = chars.map(() => ({
      x: 0,
      y: 0,
      energy: 0,
      dx: 0,
      dy: 0,
      shown: false,
      scrambling: false,
      revealAt: 0,
      scrambleEnd: 0,
      nextSwap: 0,
    }));

    const pointer = { x: 0, y: 0, sx: 0, sy: 0, inside: false };
    const waves = [];
    let measured = false;
    let fontPx = 16;
    let raf = 0;
    let last = 0;
    let moveFrame = 0;
    let observer = null;

    const toLocal = (e) => {
      const rect = root.getBoundingClientRect();
      const scaleX = root.offsetWidth ? rect.width / root.offsetWidth : 1;
      const scaleY = root.offsetHeight ? rect.height / root.offsetHeight : 1;
      return [
        (e.clientX - rect.left) / (scaleX || 1),
        (e.clientY - rect.top) / (scaleY || 1),
      ];
    };

    const measure = () => {
      fontPx = parseFloat(window.getComputedStyle(root).fontSize) || 16;
      const rootRect = root.getBoundingClientRect();
      chars.forEach((char, i) => {
        const rect = char.getBoundingClientRect();
        points[i].x = rect.left - rootRect.left + rect.width / 2;
        points[i].y = rect.top - rootRect.top + rect.height / 2;
      });
      measured = true;
    };

    const clear = (i) => {
      const char = chars[i];
      char.style.transform = "";
      char.style.filter = "";
      char.style.opacity = "";
      char.style.zIndex = "";
      points[i].shown = false;
    };

    const paint = (i, mode, amount) => {
      const p = points[i];
      const e = p.energy;
      if (e < 0.001) {
        if (p.shown) clear(i);
        return;
      }
      const char = chars[i];
      p.shown = true;
      if (mode === "lift") {
        char.style.transform = `translate3d(0, ${(-e * fontPx * 0.75 * amount).toFixed(2)}px, 0)`;
      } else if (mode === "blur") {
        char.style.filter = `blur(${(e * fontPx * 0.24 * amount).toFixed(2)}px)`;
        char.style.opacity = (1 - e * Math.min(0.7, 0.45 * amount)).toFixed(3);
        char.style.transform = `scale(${(1 + e * 0.15 * amount).toFixed(4)})`;
      } else {
        char.style.transform = `translate3d(${p.dx.toFixed(2)}px, ${p.dy.toFixed(2)}px, 0) scale(${(1 + e * 0.85 * amount).toFixed(4)})`;
        char.style.zIndex = `${Math.round(e * 10)}`;
      }
    };

    const triggerScramble = (index, durationSec, revealDelaySec = 0) => {
      const nowSec = performance.now() / 1000;
      const p = points[index];
      p.scrambling = true;
      p.revealAt = nowSec + (revealDelaySec > 0 ? revealDelaySec : durationSec);
      p.scrambleEnd = nowSec + durationSec;
      p.nextSwap = 0;
    };

    const tick = (now) => {
      raf = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const nowSec = now / 1000;

      if (!measured) measure();

      const mode = PHYSICAL[settings.effect] && !reduce ? settings.effect : "";
      const amount = Math.max(0, settings.strength);
      const reach = Math.max(1, settings.radius);
      const width = Math.max(fontPx * 1.3, 16);
      const swell = mode === "magnify" ? 0.55 : 1;
      const follow = 1 - Math.exp(-dt / 0.06);
      const attack = 1 - Math.exp(-dt / 0.08);
      const release = 1 - Math.exp(-dt / Math.max(0.04, settings.trail / 3));

      pointer.sx += (pointer.x - pointer.sx) * follow;
      pointer.sy += (pointer.y - pointer.sy) * follow;

      for (let j = waves.length - 1; j >= 0; j--) {
        const wave = waves[j];
        wave.age += dt;
        const t = Math.min(1, wave.age / wave.life);
        wave.r = wave.reach * (1 - (1 - t) * (1 - t));
        wave.fade = t < 0.75 ? 1 : 1 - Math.pow((t - 0.75) / 0.25, 2);
        if (wave.age >= wave.life) waves.splice(j, 1);
      }

      let busy =
        waves.length > 0 ||
        Math.abs(pointer.x - pointer.sx) + Math.abs(pointer.y - pointer.sy) > 0.2;

      const swapInterval = Math.max(
        0.025,
        0.06 / Math.max(0.1, settings.speed)
      );

      for (let i = 0; i < chars.length; i++) {
        const p = points[i];
        let target = 0;
        let tx = 0;
        let ty = 0;

        if (mode && pointer.inside) {
          const ax = p.x - pointer.sx;
          const ay = p.y - pointer.sy;
          target = falloff(Math.hypot(ax, ay), reach);
          tx = ax * 0.5 * amount * target;
          ty = ay * 0.5 * amount * target;
        }

        for (const wave of waves) {
          const ax = p.x - wave.x;
          const ay = p.y - wave.y;
          const d = Math.hypot(ax, ay);
          const strengthAt = 1 - (0.6 * d) / wave.reach;
          if (!wave.hit[i] && d <= wave.r) {
            wave.hit[i] = 1;
            const dur = Math.max(
              0.2,
              settings.duration * (0.2 + 0.5 * strengthAt)
            );
            triggerScramble(i, dur);
          }
          if (mode) {
            const band =
              swell *
              strengthAt *
              wave.fade *
              Math.exp(-Math.pow((d - wave.r) / width, 2));
            if (band > target) {
              const push = (fontPx * 0.6 * amount * band) / (d || 1);
              target = band;
              tx = ax * push;
              ty = ay * push;
            }
          }
        }

        if (p.scrambling) {
          if (nowSec >= p.revealAt) {
            p.scrambling = false;
            glyphs[i].textContent = originals[i];
            if (settings.scrambleColor) glyphs[i].style.color = "";
          } else {
            busy = true;
            if (nowSec >= p.nextSwap) {
              p.nextSwap = nowSec + swapInterval;
              const sc = settings.scrambleChars;
              const randCh = sc[Math.floor(Math.random() * sc.length)];
              glyphs[i].textContent = randCh;
              if (settings.scrambleColor) {
                glyphs[i].style.color = settings.scrambleColor;
              }
            }
          }
        }

        const k = target > p.energy ? attack : release;
        p.energy += (target - p.energy) * k;
        if (Math.abs(target - p.energy) > 0.0005) busy = true;

        if (mode === "magnify") {
          p.dx += (tx - p.dx) * k;
          p.dy += (ty - p.dy) * k;
        }

        if (!mode) {
          if (p.shown) clear(i);
          continue;
        }
        paint(i, mode, amount);
      }

      if (busy) raf = requestAnimationFrame(tick);
      else last = 0;
    };

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const scrambleNearPointer = () => {
      moveFrame = 0;
      if (!measured) measure();
      const reach = Math.max(1, settings.radius);
      const dur = settings.duration;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const dist = Math.hypot(pointer.x - p.x, pointer.y - p.y);
        if (dist < reach) {
          triggerScramble(i, dur * (1 - dist / reach));
        }
      }
      wake();
    };

    const handleEnter = () => {
      measured = false;
    };

    const handleMove = (e) => {
      const [x, y] = toLocal(e);
      pointer.x = x;
      pointer.y = y;
      if (!pointer.inside) {
        pointer.sx = x;
        pointer.sy = y;
        pointer.inside = true;
      }
      if (PHYSICAL[settings.effect]) {
        if (!reduce) wake();
      } else if (!moveFrame) {
        moveFrame = requestAnimationFrame(scrambleNearPointer);
      }
    };

    const handleLeave = () => {
      pointer.inside = false;
      wake();
    };

    const handleDown = (e) => {
      if (
        !settings.clickBurst ||
        (e.pointerType === "mouse" && e.button !== 0)
      ) {
        return;
      }
      if (!measured) measure();
      const [x, y] = toLocal(e);
      let reach = 0;
      for (const p of points) {
        reach = Math.max(reach, Math.hypot(p.x - x, p.y - y));
      }
      reach += fontPx;
      if (waves.length > 3) waves.shift();
      waves.push({
        x,
        y,
        age: 0,
        r: 0,
        fade: 1,
        reach,
        life: 0.45 + reach / 1100,
        hit: new Uint8Array(chars.length),
      });
      wake();
    };

    if (settings.intro && !reduce) {
      // Put all characters in initial scramble state immediately
      glyphs.forEach((glyph) => {
        const sc = settings.scrambleChars;
        glyph.textContent = sc[Math.floor(Math.random() * sc.length)];
        if (settings.scrambleColor) glyph.style.color = settings.scrambleColor;
      });

      const startIntro = () => {
        measure();
        const introLength = settings.duration;
        for (let i = 0; i < points.length; i++) {
          const reveal =
            0.15 +
            introLength *
              (0.75 * (i / points.length) + 0.25 * Math.random());
          triggerScramble(i, reveal + 0.1, reveal);
        }
        wake();
      };

      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          observer.disconnect();
          startIntro();
        },
        { threshold: 0.05 }
      );

      const initialRect = root.getBoundingClientRect();
      if (initialRect.bottom > 0 && initialRect.top < window.innerHeight) {
        startIntro();
      } else {
        observer.observe(root);
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      measured = false;
      wake();
    });
    resizeObserver.observe(root);

    if (document.fonts?.ready) {
      document.fonts.ready
        .then(() => {
          measured = false;
          wake();
        })
        .catch(() => {});
    }

    root.addEventListener("pointerenter", handleEnter);
    root.addEventListener("pointermove", handleMove, { passive: true });
    root.addEventListener("pointerleave", handleLeave);
    root.addEventListener("pointerdown", handleDown);

    return {
      wake,
      destroy: () => {
        root.removeEventListener("pointerenter", handleEnter);
        root.removeEventListener("pointermove", handleMove);
        root.removeEventListener("pointerleave", handleLeave);
        root.removeEventListener("pointerdown", handleDown);
        resizeObserver.disconnect();
        cancelAnimationFrame(raf);
        cancelAnimationFrame(moveFrame);
        observer?.disconnect();
        root.innerHTML = originalText;
      },
    };
  }

  window.initScrambledText = initScrambledText;
  window.ScrambledText = initScrambledText;
})();
