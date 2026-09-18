"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ParticleMorph,
  isWebGLAvailable,
  resolveParticleCount,
} from "@/lib/particles/ParticleMorph";
import { LEVELS, TECHNOLOGIES } from "@/lib/particles/technologies";
import { buildTimeline, type MorphState } from "@/lib/particles/timeline";
import { useLenis } from "./SmoothScroll";

/* -------------------------------------------------------------------------- */
/*  The intro act                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Viewports of scroll spent before the morph starts.
 *
 * The runway height in `globals.css` covers this plus the morph; the fraction
 * it works out to is measured off the trigger at refresh rather than written
 * down here, so the two cannot disagree about where the intro ends.
 */
const INTRO_VH = 2;

/**
 * The beats, as fractions of the intro's own scroll.
 *
 * Read them down the page and they are the whole choreography: nothing at all,
 * then the title, then the title alone for a beat, then it leaves — and the
 * field starts coming in before it has finished leaving, because a stage that
 * is empty twice reads as a stall rather than as a pause.
 *
 * The name arrives last of all, once the particles are most of the way home,
 * so it lands as the caption to a mark that already exists rather than as a
 * label waiting for one.
 */
const TITLE_IN: readonly [number, number] = [0.08, 0.34];
const TITLE_OUT: readonly [number, number] = [0.56, 0.8];
const ARRIVE: readonly [number, number] = [0.6, 1];
const WORD_IN: readonly [number, number] = [0.76, 1];
const HINT_OUT: readonly [number, number] = [0.03, 0.2];

/** The title, one masked line per entry. */
const INTRO_TITLE = ["The stack,", "in motion."];

/* -------------------------------------------------------------------------- */
/*  Name crossfade                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The handoff between two names, as fractions of a transition.
 *
 * Both hold their entry until 40% and the next is fully in by 60%, so the swap
 * happens inside a fifth of the transition — the middle of it, where the mark
 * is least legible anyway, and there is exactly one instant with no name on
 * screen. Transitions are long, close to two viewports, so a generous dead zone
 * would be a long time to look at an unnamed cloud.
 *
 * Reading the opacities off the scroll position rather than firing tweens is
 * what makes them reverse: scrolling back up runs `t` from 1 to 0 and the two
 * names simply trade places again.
 */
const FADE_OUT_START = 0.4;
const FADE_OUT_END = 0.5;
const FADE_IN_START = 0.5;
const FADE_IN_END = 0.6;
const WORD_TRAVEL = 18;

/**
 * The size every name is measured at before being scaled to its target.
 *
 * Large enough that sub-pixel rounding in the measurement is noise against it,
 * small enough not to lay out a word several screens wide while doing it.
 */
const REF_FONT_PX = 160;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** `smoothstep` over a named beat. */
function beat(range: readonly [number, number], x: number): number {
  return smoothstep(range[0], range[1], x);
}

/* -------------------------------------------------------------------------- */
/*  Jumping to a mark                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The middle of each technology's hold, on the morph's own 0..1.
 *
 * Built with the same call the engine makes, so a row in the sidebar lands the
 * scroll exactly where its mark stands still — not somewhere in the transition
 * either side of it.
 */
const HOLD_CENTRES = buildTimeline(TECHNOLOGIES.length)
  .filter((segment) => segment.kind === "hold")
  .map((segment) => (segment.start + segment.end) / 2);

/* -------------------------------------------------------------------------- */
/*  Section                                                                    */
/* -------------------------------------------------------------------------- */

type Status = "idle" | "building" | "ready" | "unsupported";

/**
 * The technology section: one particle field, morphed through the stack by the
 * scroll position and read against its own name set across the back of the
 * stage.
 *
 * It opens on nothing. The white ground slides up over the about stage carrying
 * no content at all, the title then fills the screen and leaves again, and only
 * then is the field pulled in from outside the frame to assemble the first
 * mark. Everything after that is the morph, on the same runway.
 *
 * The canvas is pinned inside that runway, so the viewport holds still while
 * the scroll drives the transformation — the section reads as one continuous
 * object being reshaped rather than as seven things scrolling past. The runway is
 * deliberately long: `timeline.ts` spends two thirds of what the intro leaves
 * mid-transition, which puts close to two viewports of scroll behind every
 * transformation.
 *
 * Nothing here re-renders while any of that runs. The engine hands back the
 * resolved morph state once a frame and this writes it, and the intro's own
 * beats, straight onto the elements; React only sees the three status changes
 * around the one-time build.
 */
export default function TechStack() {
  const sectionRef = useRef<HTMLElement>(null);
  const runwayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLHeadingElement>(null);

  // One entry per technology in each deck, driven from the same two numbers so
  // the name and the sidebar can never disagree about which mark is on screen.
  // No deck ever mounts or unmounts an entry — see `.tech-word` for why the
  // crossfade has to be written rather than tweened.
  //
  // The sidebar's readout is three decks rather than one — the counter, the
  // level, the note — because each sits in its own pill: a single deck would
  // carry the pills inside every page, and two pages mid-crossfade would draw
  // two of each. Splitting it leaves the pills standing still and only their
  // contents changing.
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const indexRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const levelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const noteRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sideRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const triggerRef = useRef<ScrollTrigger | null>(null);
  const lenis = useLenis();

  /** The row currently lit — written on a change of dominant mark, not every frame. */
  const activeRef = useRef(-1);

  /** The last slide-in value written, so a sidebar at rest costs no style writes. */
  const sideInRef = useRef("");

  /**
   * Where the scroll is in the runway, undamped, and how much of that runway
   * the intro claims.
   *
   * The morph is read off the engine's damped copy, which is what gives the
   * cloud its weight. The intro is not: a title fading in should follow the
   * wheel exactly, and lagging it behind the particles it is handing over to
   * would put the two acts out of step.
   */
  const rawProgressRef = useRef(0);
  const introFractionRef = useRef(0);

  const [status, setStatus] = useState<Status>("idle");
  const [built, setBuilt] = useState(0);

  /* --- a row in the sidebar, clicked -------------------------------------- */

  /** Scrolls to where mark `index` stands still, through every morph between. */
  const jumpTo = (index: number) => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const intro = introFractionRef.current;
    const progress = intro + HOLD_CENTRES[index] * (1 - intro);
    const top = trigger.start + progress * (trigger.end - trigger.start);

    if (lenis) {
      lenis.scrollTo(top, { duration: 1.6 });
    } else {
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  /* --- every name to the same width --------------------------------------- */

  /**
   * Solve each name's font size so it spans `--tech-word-fill` of the viewport,
   * whatever its length.
   *
   * Measured, not derived. The obvious version of this is a character count —
   * `92vw / length` and be done — but it is wrong by a fifth either way here,
   * because the set runs from `React` to `Express` and the face gives a capital
   * `E` half again the advance of a full stop. `Next.js` came out narrow and the
   * longest name came out over the edge of the screen.
   *
   * So: set every name to one reference size, read what it actually measures,
   * then scale each one to the target. Two passes rather than one, deliberately
   * — writing and reading a size per element in the same loop forces a layout
   * per name, and doing all the writes before all the reads makes it one.
   */
  useEffect(() => {
    if (status !== "ready") return;

    const fit = () => {
      const words = wordRefs.current.filter((el): el is HTMLSpanElement => !!el);
      if (!words.length) return;

      const fill =
        parseFloat(getComputedStyle(words[0]).getPropertyValue("--tech-word-fill")) || 0.5;
      const target = window.innerWidth * fill;

      for (const word of words) word.style.fontSize = `${REF_FONT_PX}px`;
      const natural = words.map((word) => word.getBoundingClientRect().width);

      words.forEach((word, i) => {
        if (natural[i] > 0) {
          word.style.fontSize = `${((REF_FONT_PX * target) / natural[i]).toFixed(2)}px`;
        }
      });
    };

    fit();

    // The display face arrives over the network, and a name measured in the
    // fallback is a name sized for the wrong glyphs.
    let alive = true;
    void document.fonts?.ready.then(() => {
      if (alive) fit();
    });

    window.addEventListener("resize", fit, { passive: true });
    return () => {
      alive = false;
      window.removeEventListener("resize", fit);
    };
  }, [status]);

  useEffect(() => {
    const section = sectionRef.current;
    const runway = runwayRef.current;
    const stage = stageRef.current;
    const host = canvasHostRef.current;
    if (!section || !runway || !stage || !host) return;

    // Stable for the life of the effect; the pages of all three share one
    // opacity and one offset, so the frame writes them in a single pass.
    const sideDecks = [indexRefs, levelRefs, noteRefs];

    if (!isWebGLAvailable()) {
      setStatus("unsupported");
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let engine: ParticleMorph | null = null;
    let trigger: ScrollTrigger | null = null;
    let visibility: IntersectionObserver | null = null;
    let cancelled = false;

    /**
     * Writes the frame's state onto the DOM. No React involved.
     *
     * Every element the section animates is written here, including the ones
     * driven by the raw scroll rather than by the morph, because this runs on
     * the frame loop and the scroll callback does not — a reader who lands
     * mid-section without moving the wheel still gets a correct first frame.
     */
    const paint = (state: MorphState) => {
      const intro = introFractionRef.current;
      const q = intro > 0 ? Math.min(rawProgressRef.current / intro, 1) : 1;

      /* --- the title: in, held, then away ------------------------------- */

      const titleIn = beat(TITLE_IN, q);
      const titleOut = beat(TITLE_OUT, q);

      if (introRef.current) {
        introRef.current.style.opacity = String(titleIn * (1 - titleOut));
        // Two scales on one axis: it settles as it arrives and keeps opening
        // as it goes, so it reads as passing the reader rather than as a
        // cross-fade held at one size.
        introRef.current.style.transform = `scale(${(
          0.9 +
          0.1 * titleIn +
          0.16 * titleOut
        ).toFixed(4)})`;
      }

      /* --- the name, and the proficiency opposite it --------------------- */

      const wordIn = beat(WORD_IN, q);
      const morphing = state.from !== state.to;

      // The sidebar carries the intro gate for everything inside it, so its
      // pages are written with the crossfade alone. It slides in from the edge
      // it is cut into rather than fading — CSS turns the one number into
      // travel along x on a desktop and along y below the breakpoint — and only
      // takes the pointer once it is all the way in.
      const side = sideRef.current;
      const sideIn = wordIn.toFixed(4);
      if (side && sideIn !== sideInRef.current) {
        sideInRef.current = sideIn;
        side.style.setProperty("--tech-side-in", sideIn);
        side.style.pointerEvents = wordIn > 0.98 ? "auto" : "none";
      }

      for (let i = 0; i < TECHNOLOGIES.length; i++) {
        let opacity = 0;
        let offset = 0;

        if (!morphing) {
          opacity = i === state.from ? 1 : 0;
        } else if (i === state.from) {
          opacity = 1 - smoothstep(FADE_OUT_START, FADE_OUT_END, state.t);
          offset = -WORD_TRAVEL * (1 - opacity);
        } else if (i === state.to) {
          opacity = smoothstep(FADE_IN_START, FADE_IN_END, state.t);
          offset = WORD_TRAVEL * (1 - opacity);
        }

        const word = wordRefs.current[i];
        if (word) {
          word.style.opacity = String(opacity * wordIn);
          word.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
        }

        const alpha = String(opacity);
        // A third of the name's travel: the same move at the same distance on a
        // body-sized block reads as a jump rather than as a drift.
        const shift = `translate3d(0, ${(offset / 3).toFixed(2)}px, 0)`;

        for (const deck of sideDecks) {
          const page = deck.current[i];
          if (page) {
            page.style.opacity = alpha;
            page.style.transform = shift;
          }
        }
      }

      /* --- the sidebar's list ---------------------------------------------- */

      // The grey pill rides the same handoff as the names — still until 40% of
      // a transition, on the next row by 60% — so it travels while the two
      // names trade places, and runs back up the list when the scroll does.
      if (indicatorRef.current) {
        const slide = morphing ? smoothstep(FADE_OUT_START, FADE_IN_END, state.t) : 0;
        const row = state.from + (state.to - state.from) * slide;
        indicatorRef.current.style.transform = `translate3d(0, ${(row * 100).toFixed(3)}%, 0)`;
      }

      // The lit label switches at the midpoint, where the level and the note
      // swap over too.
      const dominant = morphing && state.t >= 0.5 ? state.to : state.from;
      if (dominant !== activeRef.current) {
        activeRef.current = dominant;
        rowRefs.current.forEach((row, i) => {
          if (!row) return;
          row.classList.toggle("is-active", i === dominant);
          if (i === dominant) row.setAttribute("aria-current", "true");
          else row.removeAttribute("aria-current");
        });
      }

      /* --- chrome -------------------------------------------------------- */

      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${rawProgressRef.current.toFixed(4)})`;
      }

      if (hintRef.current) {
        // 0.45 is the rest opacity `.tech-hint` is designed at; this scales it
        // to nothing rather than flashing the hint to full strength first. It
        // is gone before the title is fully in — it has done its job the moment
        // there is something on screen to have scrolled to.
        hintRef.current.style.opacity = String(0.45 * (1 - beat(HINT_OUT, q)));
      }
    };

    const boot = async () => {
      if (cancelled) return;
      setStatus("building");

      try {
        engine = new ParticleMorph({
          container: host,
          logos: TECHNOLOGIES.map((t) => t.logo),
          count: resolveParticleCount(window.innerWidth),
          reducedMotion,
          onFrame: paint,
          onBuildProgress: (done) => {
            if (!cancelled) setBuilt(done);
          },
        });

        await engine.build();
      } catch {
        // A context that dies between the probe and the first draw, a driver
        // that refuses the float texture — either way the fallback list is the
        // honest thing to show.
        engine?.destroy();
        engine = null;
        if (!cancelled) setStatus("unsupported");
        return;
      }

      if (cancelled) {
        engine.destroy();
        engine = null;
        return;
      }

      setStatus("ready");

      /**
       * Where the intro ends, as a fraction of the runway.
       *
       * Measured rather than declared: the trigger already knows how much
       * scroll it spans, so taking the intro's viewports out of that is the
       * one place the CSS runway height and `INTRO_VH` have to meet. Shorten
       * the runway and the intro keeps its two viewports; it does not scale.
       */
      const measure = (self: ScrollTrigger) => {
        const span = self.end - self.start;
        introFractionRef.current =
          span > 0 ? Math.min((INTRO_VH * window.innerHeight) / span, 0.9) : 0;
      };

      /** Splits one runway position into the intro's beat and the morph's. */
      const drive = (self: ScrollTrigger) => {
        const p = self.progress;
        rawProgressRef.current = p;

        const intro = introFractionRef.current;
        const q = intro > 0 ? Math.min(p / intro, 1) : 1;

        engine?.setAssemble(beat(ARRIVE, q));
        engine?.setScroll(intro >= 1 ? 0 : Math.max(0, (p - intro) / (1 - intro)));
      };

      // Pinning is CSS's (`.tech-stage` is sticky); this only reports where the
      // scroll is inside the runway.
      trigger = triggerRef.current = ScrollTrigger.create({
        trigger: runway,
        start: "top top",
        end: "bottom bottom",
        invalidateOnRefresh: true,
        onUpdate: drive,
        onRefresh: (self) => {
          measure(self);
          drive(self);
        },
      });

      // Cheaper and more reliable than asking ScrollTrigger: while the stage is
      // off screen the loop stops rendering entirely.
      visibility = new IntersectionObserver(
        (entries) => engine?.setActive(entries.some((e) => e.isIntersecting)),
        { threshold: 0 }
      );
      visibility.observe(stage);
    };

    // Build a viewport early so the field is standing by when the section
    // arrives, without competing with the hero for the main thread on load.
    const approach = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        approach.disconnect();
        void boot();
      },
      { rootMargin: "150% 0px" }
    );
    approach.observe(section);

    return () => {
      cancelled = true;
      approach.disconnect();
      visibility?.disconnect();
      trigger?.kill();
      triggerRef.current = null;
      engine?.destroy();
      engine = null;
    };
  }, []);

  /* --- markup -------------------------------------------------------------- */

  return (
    <section className="section tech" id="tech" ref={sectionRef} aria-labelledby="tech-title">
      {/*
        The list the page actually means. The canvas and the name behind it are
        decoration on top of it: every name, role, level and note below is real
        text, in order, whether or not WebGL ever starts.
      */}
      <ul className="sr-only">
        {TECHNOLOGIES.map((tech) => (
          <li key={tech.id}>
            {tech.name} — {tech.subtitle}. {tech.level}. {tech.blurb}
          </li>
        ))}
      </ul>

      <div className="tech-runway" ref={runwayRef}>
        <div className="tech-stage" ref={stageRef}>
          {/* Behind the canvas, which is transparent — see `.tech-word-w`. */}
          <div className="tech-word-w" aria-hidden="true">
            {TECHNOLOGIES.map((tech, i) => (
              <span
                className="tech-word"
                key={tech.id}
                ref={(el) => {
                  wordRefs.current[i] = el;
                }}
                style={{ "--tech-word-color": tech.color } as React.CSSProperties}
              >
                {tech.name}
              </span>
            ))}
          </div>

          <div className="tech-canvas-w" ref={canvasHostRef} />

          {/*
            Nothing drives this but the frame loop, so on a machine where the
            loop will never start it has to be pinned visible instead — an
            invisible `aria-labelledby` target is no heading at all. The build
            states are not that case: they always resolve, one way or the other,
            and they do it a viewport and a half before the section arrives.
          */}
          <h2
            className={
              status === "unsupported" ? "tech-intro tech-intro--held" : "tech-intro"
            }
            id="tech-title"
            ref={introRef}
          >
            {INTRO_TITLE.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h2>

          {status === "ready" && (
            <>
              <p className="tech-hint" ref={hintRef}>
                Scroll to morph
              </p>

              <div className="tech-progress" aria-hidden="true">
                <span ref={barRef} />
              </div>

              {/*
                The sidebar: the navbar's black tab, cut into the stage's right
                edge. The whole stack as a list to jump through, and how well
                the mark on screen is known.

                Inside the stage, so it is pinned with the field and leaves with
                the section. The readout decks are decoration over the
                `sr-only` list above; the rows are real buttons.
              */}
              <aside
                className="tech-side"
                ref={sideRef}
                aria-label="Stack"
                style={{ "--tech-side-count": TECHNOLOGIES.length } as React.CSSProperties}
              >
                <div className="tech-side__head" aria-hidden="true">
                  <span className="tech-side__label">Proficiency</span>
                  <span className="tech-side__count">
                    {TECHNOLOGIES.map((tech, i) => (
                      <span
                        className="tech-side__index"
                        key={tech.id}
                        ref={(el) => {
                          indexRefs.current[i] = el;
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                        <em>/{String(TECHNOLOGIES.length).padStart(2, "0")}</em>
                      </span>
                    ))}
                  </span>
                </div>

                <div className="tech-side__list">
                  <span className="tech-side__indicator" ref={indicatorRef} aria-hidden="true" />
                  <ul>
                    {TECHNOLOGIES.map((tech, i) => (
                      <li key={tech.id}>
                        <button
                          type="button"
                          className="tech-side__row"
                          ref={(el) => {
                            rowRefs.current[i] = el;
                          }}
                          onClick={() => jumpTo(i)}
                          aria-label={`Jump to ${tech.name}`}
                        >
                          {tech.name}
                          <span className="tech-side__num" aria-hidden="true">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="tech-side__detail" aria-hidden="true">
                  <div className="tech-side__deck">
                    {TECHNOLOGIES.map((tech, i) => {
                      const rung = LEVELS.indexOf(tech.level);
                      return (
                        <div
                          className="tech-side__page"
                          key={tech.id}
                          ref={(el) => {
                            levelRefs.current[i] = el;
                          }}
                          style={{ "--tech-word-color": tech.color } as React.CSSProperties}
                        >
                          <span className="tech-level">{tech.level}</span>
                          <span className="tech-meter">
                            {LEVELS.map((name, step) => (
                              <span key={name} className={step <= rung ? "is-on" : undefined} />
                            ))}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="tech-side__deck tech-side__deck--note">
                    {TECHNOLOGIES.map((tech, i) => (
                      <div
                        className="tech-side__page"
                        key={tech.id}
                        ref={(el) => {
                          noteRefs.current[i] = el;
                        }}
                        style={{ "--tech-word-color": tech.color } as React.CSSProperties}
                      >
                        <span className="tech-eyebrow tech-side__role">{tech.subtitle}</span>
                        <p className="tech-note">{tech.blurb}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </>
          )}

          {(status === "idle" || status === "building") && (
            <div className="tech-loading" aria-hidden="true">
              <p className="tech-eyebrow">Building particle field</p>
              <div className="tech-loading-bar">
                <span style={{ transform: `scaleX(${built / TECHNOLOGIES.length})` }} />
              </div>
            </div>
          )}

          {status === "unsupported" && (
            /* No WebGL. The section still has to say what it was going to say. */
            <ul className="tech-fallback">
              {TECHNOLOGIES.map((tech) => (
                <li key={tech.id}>
                  <span className="tech-fallback__name">{tech.name}</span>
                  <span className="tech-eyebrow">
                    {tech.subtitle} · {tech.level}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </section>
  );
}
