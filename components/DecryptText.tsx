"use client";

import { createElement, useEffect, useRef } from "react";
import gsap from "gsap";

/** What an unresolved letter can show — the set the loader and buttons use. */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+/<>[]{}";

/** How often an unresolved letter re-rolls — see ScrambleLink for the why. */
const ROLL_MS = 50;

/** How long a letter shows noise after it starts to rise, in seconds. */
const RESOLVE_AFTER = 0.35;

interface DecryptTextProps {
  /** One entry per line. */
  lines: string[];
  as?: "h2" | "p" | "div";
  className?: string;
  id?: string;
  /** Seconds between one letter starting and the next. */
  stagger?: number;
}

/**
 * The loader's name effect, for type further down the page: each letter rises
 * out of its line's mask as a random glyph and settles on the real one a beat
 * later, left to right. It plays once, when half the text is on screen.
 *
 * On screen by area rather than past a line: the footer's name is the last
 * thing on the page, and its top never scrolls up past any line drawn much
 * above the bottom of a short screen.
 *
 * Every letter is a hidden copy of itself with the glyph laid over it, so the
 * line holds its finished width however wide the noise runs — the split the
 * loader and `.btn-label` use. The real text is in an `sr-only` span; the
 * letters are decoration.
 */
export default function DecryptText({
  lines,
  as = "div",
  className,
  id,
  stagger = 0.035,
}: DecryptTextProps) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const chars = gsap.utils.toArray<HTMLElement>(root.querySelectorAll(".decrypt__char"));
    const glyphs = chars.map((char) => char.querySelector<HTMLElement>(".decrypt__glyph")!);
    let raf = 0;
    let observer: IntersectionObserver | null = null;

    const ctx = gsap.context(() => {
      // Parked below the masks until the text arrives. Set here rather than in
      // CSS, which GSAP would read back as pixels and add to.
      gsap.set(chars, { yPercent: 110 });
    }, root);

    // Added to the context so an unmount mid-run reverts these tweens too.
    const play = () =>
      ctx.add(() => {
        gsap.to(chars, { yPercent: 0, duration: 1.1, ease: "power4.out", stagger });

        const resolveAt = chars.map((_, i) => (i * stagger + RESOLVE_AFTER) * 1000);
        const last = resolveAt[resolveAt.length - 1] ?? 0;
        const start = performance.now();
        let rolled = -1;

        const tick = (now: number) => {
          // A frame's timestamp can predate `start` — see ScrambleLink.
          const elapsed = Math.max(0, now - start);
          const step = Math.floor(elapsed / ROLL_MS);

          if (step !== rolled) {
            rolled = step;
            glyphs.forEach((glyph, i) => {
              const resolved = elapsed >= resolveAt[i];
              glyph.classList.toggle("is-noise", !resolved);
              glyph.textContent = resolved
                ? chars[i].dataset.char!
                : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
            });
          }

          if (elapsed < last) raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
      });

    observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer?.disconnect();
        play();
      },
      { threshold: 0.5 }
    );
    observer.observe(root);

    return () => {
      observer?.disconnect();
      cancelAnimationFrame(raf);
      ctx.revert();
      // A run cut short by unmounting must not leave noise behind.
      glyphs.forEach((glyph, i) => {
        glyph.classList.remove("is-noise");
        glyph.textContent = chars[i].dataset.char!;
      });
    };
  }, [stagger]);

  return createElement(
    as,
    { ref: rootRef, className: className ? `decrypt ${className}` : "decrypt", id },
    <span className="sr-only">{lines.join(" ")}</span>,
    lines.map((line, l) => (
      <span className="decrypt__line" aria-hidden="true" key={l}>
        {[...line].map((ch, c) =>
          ch === " " ? (
            <span className="decrypt__space" key={c} />
          ) : (
            <span className="decrypt__char" data-char={ch} key={c}>
              <span className="decrypt__size">{ch}</span>
              <span className="decrypt__glyph">{ch}</span>
            </span>
          )
        )}
      </span>
    ))
  );
}
