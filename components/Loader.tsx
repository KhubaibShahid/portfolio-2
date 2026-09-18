"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useLenis } from "./SmoothScroll";

/* -------------------------------------------------------------------------- */
/*  Copy — everything you would want to edit lives here                        */
/* -------------------------------------------------------------------------- */

/** One entry per line of the centrepiece; each letter decrypts as it rises. */
const LOADER_NAME = ["Khubaib", "Shahid"];

const LOADER_TAGLINE = "From the first pixel — to the last query";

const LOADER_CORNERS = { left: "K—S / Portfolio", right: `Edition ${new Date().getFullYear()}` };

/**
 * The status line under the name, keyed to the counter rather than to which
 * asset happened to land first — so the order never shuffles between visits.
 */
const LOADER_STAGES: [number, string][] = [
  [0, "Booting interface"],
  [0.22, "Loading typefaces"],
  [0.48, "Decoding imagery"],
  [0.76, "Warming the canvas"],
  [1, "Ready"],
];

/* -------------------------------------------------------------------------- */
/*  Tuning                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Off: the loader plays on every page load, reloads included. On: once per
 * tab, and every load after that goes straight to the hero.
 */
const PLAY_ONCE_PER_TAB = false;

/** Where the once-per-tab flag is kept. Renamed from the old loader's key, which
 *  was written the moment it started and so is sitting in open tabs already. */
const SESSION_KEY = "ks:loader-played";

/**
 * The counter never runs ahead of this, however warm the cache — it is the
 * time the name gets to arrive and be read. Past it, the counter waits on the
 * real assets instead.
 */
const MIN_DURATION = 2.8;

/** A stalled request must not hold the page hostage; past this it lets go. */
const MAX_WAIT = 8;

/** Vertical slats the curtain splits into on the way out. */
const SLATS = 5;

/** What an unresolved letter can show — the same set the buttons scramble in. */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+/<>[]{}";

/** How often an unresolved letter re-rolls — see ScrambleLink for the why. */
const ROLL_MS = 50;

/**
 * Everything the hero needs decoded before it can look finished: the type, the
 * banner the fluid sim bakes, the layer it dissolves to, and the about tile
 * parked in the corner. Each settles on error too — a missing file is a broken
 * image later, not a loader that never ends.
 */
function trackAssets(onSettle: () => void): number {
  const decode = (src: string) => {
    const img = new Image();
    img.src = src;
    return img.decode();
  };

  const tasks: Promise<unknown>[] = [
    document.fonts?.ready ?? Promise.resolve(),
    decode("/front_hero.jpeg"),
    decode("/back_hero.jpeg"),
    decode("/about-image.jpeg"),
  ];

  tasks.forEach((task) => task.catch(() => {}).then(onSettle));
  return tasks.length;
}

/**
 * Intro loader, and the thing that hands off to the hero.
 *
 * A counter driven by the real asset load — floored at `MIN_DURATION` so it
 * never flickers past — under the name decrypting letter by letter. At 100 the
 * chrome drops out of its masks and the black splits into slats that lift away
 * from the centre, while the hero banner rises up behind them.
 *
 * It then fires `loader:hero-revealed` — the signal Hero waits for before
 * baking the banner into the fluid shader's base texture.
 */
export default function Loader() {
  const rootRef = useRef<HTMLDivElement>(null);
  const lenis = useLenis();

  /*
   * Lenis arrives a render after this mounts. Reading it through a ref keeps it
   * out of the main effect's deps: re-running that effect would tear down a
   * loader that is halfway through and start it again.
   */
  const lenisRef = useRef(lenis);
  const holdingRef = useRef(false);
  useEffect(() => {
    lenisRef.current = lenis;
    if (holdingRef.current) lenis?.stop();
  }, [lenis]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;
    let tick: (() => void) | null = null;

    const ctx = gsap.context(() => {
      const banner = document.querySelector<HTMLImageElement>(".hero-banner-img");

      /** Reveal the hero banner, then tell Hero it may bake the texture. */
      const revealHero = () => {
        window.dispatchEvent(new CustomEvent("loader:hero-reveal-start"));

        if (!banner) {
          window.dispatchEvent(new CustomEvent("loader:hero-revealed"));
          return;
        }

        const done = () => {
          // Strip the inline matrix GSAP leaves behind. The tween ends at
          // identity, so this is a no-op visually — but it matters: Hero
          // rasterises this <img> at its bounding rect straight after, and a
          // residual transform would shift the baked texture.
          gsap.set(banner, { clearProps: "transform,transformOrigin,scale" });
          window.dispatchEvent(new CustomEvent("loader:hero-revealed"));
        };

        gsap
          .timeline({ onComplete: done })
          .fromTo(
            banner,
            { autoAlpha: 1, yPercent: 100, scale: 1.12 },
            {
              yPercent: 0,
              scale: 1,
              duration: 1.8,
              ease: "power4.inOut",
              transformOrigin: "center center",
            },
            0.2
          );
      };

      /* --- already seen this session: skip straight to the hero ---------- */
      let played = false;
      if (PLAY_ONCE_PER_TAB) {
        try {
          played = sessionStorage.getItem(SESSION_KEY) === "1";
        } catch {}
      }

      if (played) {
        gsap.set(root, { display: "none" });
        // Next frame, not now. `loader:hero-reveal-start` goes out
        // synchronously, so firing it from inside an effect makes the listeners
        // in Hero and HeroIntro depend on React flushing their effects before
        // this one. That happens to hold today, but it is hydration-order
        // detail rather than a guarantee — a frame's delay costs nothing and
        // puts every listener up first.
        requestAnimationFrame(revealHero);
        return;
      }

      // Hold the page still while the loader runs. On a reload the browser
      // would otherwise put back the old scroll position once the page has
      // loaded — underneath the loader, so it lifts onto the middle of the page.
      holdingRef.current = true;
      lenisRef.current?.stop();
      if ("scrollRestoration" in history) history.scrollRestoration = "manual";
      window.scrollTo(0, 0);

      if (banner) gsap.set(banner, { autoAlpha: 0 });

      const q = gsap.utils.selector(root);
      const ui = q<HTMLElement>(".loader-ui")[0];
      const letters = q<HTMLElement>(".loader-char");
      const glyphs = letters.map((el) => el.querySelector<HTMLElement>(".loader-char__glyph")!);
      const rises = q<HTMLElement>("[data-loader-rise]");
      const fill = q<HTMLElement>(".loader-rule__fill")[0];
      const status = q<HTMLElement>(".loader-status__text")[0];
      const digitStrips = q<HTMLElement>(".loader-digit__strip");

      /* --- entrance ------------------------------------------------------- */
      /*
       * Each letter rises out of its mask as a random glyph and settles on the
       * real one a beat later, left to right across both lines. The chrome
       * (corners, tagline, status, counter) rises in its own masks alongside.
       */
      const LETTER_STAGGER = 0.045;
      const LETTER_DELAY = 0.25;
      const resolveAt = letters.map((_, i) => LETTER_DELAY + i * LETTER_STAGGER + 0.38);

      if (!reduced) {
        gsap.set(letters, { yPercent: 110 });
        gsap.set(rises, { yPercent: 110 });
      }

      // CSS holds the chrome at `opacity: 0` until it has been parked above, so
      // nothing can paint in its finished spot before it animates.
      gsap.set(ui, { autoAlpha: 1 });

      if (!reduced) {
        gsap.to(letters, {
          yPercent: 0,
          duration: 1.1,
          ease: "power4.out",
          stagger: LETTER_STAGGER,
          delay: LETTER_DELAY,
        });
        gsap.to(rises, {
          yPercent: 0,
          duration: 1,
          ease: "power4.out",
          stagger: 0.06,
          delay: 0.1,
        });
      }

      /* --- progress ------------------------------------------------------- */
      let settled = 0;
      const total = trackAssets(() => {
        settled += 1;
      });

      /*
       * The counter is an odometer: three strips of 0–9 plus a trailing 0.
       * Each column eases toward its digit as a running total rather than as
       * the digit itself, and draws that total modulo ten — so 9 rolls forward
       * into the trailing 0 instead of spinning back through the whole strip.
       */
      const columns = digitStrips.map((strip) => ({ strip, pos: 0, target: 0 }));
      const setDigits = (value: number) => {
        const targets = [Math.floor(value / 100), Math.floor(value / 10), value];
        columns.forEach((col, i) => {
          if (col.target === targets[i]) return;
          col.target = targets[i];
          gsap.to(col, {
            pos: col.target,
            duration: reduced ? 0 : 0.55,
            ease: "power3.out",
            overwrite: true,
            onUpdate: () => {
              gsap.set(col.strip, { yPercent: -((col.pos % 10) / 11) * 100 });
            },
          });
        });
      };

      let stage = -1;
      let swap: gsap.core.Timeline | null = null;
      const setStage = (progress: number) => {
        let next = 0;
        LOADER_STAGES.forEach(([at], i) => {
          if (progress >= at) next = i;
        });
        if (next === stage || !status) return;
        const first = stage === -1;
        stage = next;
        const label = LOADER_STAGES[next][1];
        if (first || reduced) {
          status.textContent = label;
          return;
        }
        // A fast load can cross two stages inside one swap; the newer label wins.
        swap?.kill();
        swap = gsap
          .timeline()
          .to(status, { yPercent: -110, duration: 0.2, ease: "power3.in" })
          .add(() => {
            status.textContent = label;
          })
          .fromTo(status, { yPercent: 110 }, { yPercent: 0, duration: 0.35, ease: "power3.out" });
      };

      const floor = gsap.parseEase("power2.inOut");
      const start = performance.now();
      let last = start;
      let shown = 0;
      let rolledAt = -1;
      let finished = false;

      tick = () => {
        const now = performance.now();
        const elapsed = (now - start) / 1000;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;

        /* The counter chases the lower of what has loaded and the floor. */
        const loaded = elapsed >= MAX_WAIT ? 1 : settled / total;
        const target = Math.min(loaded, floor(Math.min(1, elapsed / MIN_DURATION)));
        shown += (target - shown) * (1 - Math.exp(-dt * 7));
        if (target === 1 && shown > 0.998) shown = 1;

        const value = Math.round(shown * 100);
        setDigits(value);
        setStage(shown);
        if (fill) gsap.set(fill, { scaleX: shown });

        /* Letters re-roll together, and each settles at its own beat. */
        if (!reduced) {
          const step = Math.floor((now - start) / ROLL_MS);
          if (step !== rolledAt) {
            rolledAt = step;
            glyphs.forEach((glyph, i) => {
              const resolved = elapsed >= resolveAt[i];
              glyph.classList.toggle("is-noise", !resolved);
              glyph.textContent = resolved
                ? letters[i].dataset.char!
                : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
            });
          }
        }

        const lettersDone = reduced || elapsed >= resolveAt[resolveAt.length - 1];
        if (shown === 1 && lettersDone && !finished) {
          finished = true;
          gsap.ticker.remove(tick!);
          tick = null;
          // The re-roll above is gated to 50ms steps, so the last tick can skip
          // it. Settle every letter before the name leaves, whatever it holds.
          glyphs.forEach((glyph, i) => {
            glyph.classList.remove("is-noise");
            glyph.textContent = letters[i].dataset.char!;
          });
          exit();
        }
      };

      gsap.ticker.add(tick);

      /* --- exit ----------------------------------------------------------- */
      const exit = () => {
        const finish = () => {
          if (disposed) return;
          gsap.set(root, { display: "none" });
          holdingRef.current = false;
          lenisRef.current?.start();
          try {
            sessionStorage.setItem(SESSION_KEY, "1");
          } catch {}
        };

        if (reduced) {
          gsap.to(root, {
            autoAlpha: 0,
            duration: 0.4,
            delay: 0.2,
            onStart: revealHero,
            onComplete: finish,
          });
          return;
        }

        const slats = q<HTMLElement>(".loader-slat");

        gsap
          .timeline({ delay: 0.35, onComplete: finish })
          // Everything leaves upward, out of the same masks it arrived in.
          .to(letters, {
            yPercent: -110,
            duration: 0.8,
            ease: "power4.in",
            stagger: { each: 0.025, from: "center" },
          })
          .to(
            rises,
            { yPercent: -110, duration: 0.6, ease: "power4.in", stagger: 0.03 },
            0.05
          )
          .to(q(".loader-rule, .loader-grid"), { autoAlpha: 0, duration: 0.5, ease: "power2.in" }, 0.2)
          /*
           * The curtain lifts from the centre out, bottoms first — the same
           * direction the banner rises behind it, so the two read as one move.
           * The banner is sent off first: its tween idles for its first few
           * tenths, and starting both together leaves the slats uncovering an
           * empty page while it catches up.
           */
          .add(revealHero, 0.35)
          .to(
            slats,
            {
              scaleY: 0,
              duration: 1.3,
              ease: "power4.inOut",
              stagger: { each: 0.06, from: "center" },
            },
            0.6
          );
      };
    }, root);

    return () => {
      disposed = true;
      if (tick) gsap.ticker.remove(tick);
      holdingRef.current = false;
      ctx.revert();
    };
  }, []);

  let charIndex = 0;

  return (
    <div className="loader" ref={rootRef} role="status" aria-live="polite" aria-label="Loading">
      <div className="loader-slats" aria-hidden="true">
        {Array.from({ length: SLATS }, (_, i) => (
          <div
            className="loader-slat"
            key={i}
            style={{ left: `${(i * 100) / SLATS}%`, width: `calc(${100 / SLATS}% + 2px)` }}
          />
        ))}
      </div>

      {/* The seams the curtain will split along, drawn faintly ahead of time. */}
      <div className="loader-grid" aria-hidden="true">
        {Array.from({ length: SLATS - 1 }, (_, i) => (
          <span key={i} style={{ left: `${((i + 1) * 100) / SLATS}%` }} />
        ))}
      </div>

      <div className="loader-ui" aria-hidden="true">
        <div className="loader-row">
          <span className="loader-mask">
            <span className="loader-eyebrow" data-loader-rise>
              {LOADER_CORNERS.left}
            </span>
          </span>
          <span className="loader-mask">
            <span className="loader-eyebrow" data-loader-rise>
              {LOADER_CORNERS.right}
            </span>
          </span>
        </div>

        <div className="loader-center">
          <p className="loader-name">
            {LOADER_NAME.map((line) => (
              <span className="loader-name__line" key={line}>
                {[...line].map((ch) => (
                  <span className="loader-char" data-char={ch} key={charIndex++}>
                    <span className="loader-char__size">{ch}</span>
                    <span className="loader-char__glyph">{ch}</span>
                  </span>
                ))}
              </span>
            ))}
          </p>

          <span className="loader-mask">
            <span className="loader-eyebrow loader-tagline" data-loader-rise>
              {LOADER_TAGLINE}
            </span>
          </span>
        </div>

        <div className="loader-foot">
          <div className="loader-row">
          <span className="loader-mask">
            <span className="loader-status" data-loader-rise>
              <span className="loader-status__dot" />
              <span className="loader-mask">
                <span className="loader-eyebrow loader-status__text">{LOADER_STAGES[0][1]}</span>
              </span>
            </span>
          </span>

          <span className="loader-mask">
            <span className="loader-count" data-loader-rise>
              {[0, 1, 2].map((i) => (
                <span className="loader-digit" key={i}>
                  <span className="loader-digit__strip">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, j) => (
                      <span key={j}>{d}</span>
                    ))}
                  </span>
                </span>
              ))}
              <span className="loader-count__unit">%</span>
            </span>
          </span>
          </div>

          <div className="loader-rule">
            <span className="loader-rule__fill" />
          </div>
        </div>
      </div>

      <span className="sr-only">Loading Khubaib Shahid’s portfolio</span>
    </div>
  );
}
