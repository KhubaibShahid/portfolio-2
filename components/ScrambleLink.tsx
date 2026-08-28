"use client";

import { useCallback, useEffect, useRef } from "react";

/* -------------------------------------------------------------------------- */
/*  Tuning                                                                     */
/* -------------------------------------------------------------------------- */

/** What an unresolved character can show. Uppercase, to match the button. */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+/<>[]{}";

/** How long the reveal takes to move past one character — so a run lasts this
 *  times the label's length. The knob to turn to pace the whole effect. */
const MS_PER_CHAR = 85;

/** How often the still-scrambled characters re-roll. Kept well under
 *  MS_PER_CHAR so glyphs churn a couple of times before the reveal reaches
 *  them; re-rolling every frame instead reads as noise on a 120Hz screen and
 *  as a different speed on a 60Hz one. */
const ROLL_MS = 50;

interface ScrambleLinkProps {
  /** Doubles as the accessible name — the rendered spans are decorative. */
  label: string;
  className: string;
  href: string;
  target?: string;
  rel?: string;
}

/**
 * A `.btn` whose label decrypts on hover: every character starts as a random
 * glyph and the real text resolves left to right.
 *
 * The animation only ever writes to the overlaid `.btn-label__text` span. The
 * hidden `.btn-label__size` copy underneath holds the button's width at the
 * finished text, so nothing reflows while the glyphs churn — measuring instead
 * would race the webfont, which loads after first paint.
 */
export default function ScrambleLink({
  label,
  className,
  href,
  target,
  rel,
}: ScrambleLinkProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | null>(null);

  // A run always ends on the real text, so unmounting mid-scramble is safe —
  // this just stops the frame loop from outliving the element.
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const scramble = useCallback(() => {
    const el = textRef.current;
    if (!el || rafRef.current !== null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const chars = [...label];
    const reroll = () =>
      chars.map(() => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);

    // Rolled up front rather than on the first tick, so no frame can ever
    // render before there are glyphs to render.
    let noise = reroll();
    let rolledAt = 0;
    const start = performance.now();

    const tick = (now: number) => {
      // A frame's rAF timestamp is taken at the start of that frame, which can
      // predate the hover handler that set `start`. Left unclamped, the first
      // tick runs on negative time and blanks the label.
      const elapsed = Math.max(0, now - start);
      const revealed = elapsed / MS_PER_CHAR;

      if (revealed >= chars.length) {
        rafRef.current = null;
        el.textContent = label;
        return;
      }

      const step = Math.floor(elapsed / ROLL_MS);
      if (step !== rolledAt) {
        rolledAt = step;
        noise = reroll();
      }

      el.textContent = chars
        .map((ch, i) => (i < revealed || ch === " " ? ch : noise[i]))
        .join("");

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [label]);

  return (
    <a
      className={className}
      href={href}
      target={target}
      rel={rel}
      aria-label={label}
      onMouseEnter={scramble}
      onFocus={scramble}
    >
      <span className="btn-label">
        <span className="btn-label__size" aria-hidden="true">
          {label}
        </span>
        <span className="btn-label__text" aria-hidden="true" ref={textRef}>
          {label}
        </span>
      </span>
    </a>
  );
}
