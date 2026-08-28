"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import ScrambleLink from "./ScrambleLink";

/* -------------------------------------------------------------------------- */
/*  Copy — everything you would want to edit lives here                        */
/* -------------------------------------------------------------------------- */

const NAME = "Khubaib Shahid";

/** Cycled one at a time under the name, in this order. */
const ROLES = [
  "Web Developer",
  "Programmer",
  "Full Stack Developer",
  "Back-end Developer",
  "Front-end Developer",
  "Gen AI Engineer",
  "AI Native Dev",
];

const BIO =
  "I build for the web end to end — interfaces people actually enjoy using, the services running behind them, and the AI woven through both. Equally at home in a design file, a database, or a model prompt.";

/** Placeholder about copy — swap for the real thing. */
const ABOUT_NOTE =
  "Somewhere between design and engineering. I like the problems that need both — a clear interface on top, something well built underneath.";

const CALL_HREF = "https://calendly.com/hello-noth/30min";
const ABOUT_HREF = "#about";

/** Seconds a role holds on screen, and how long the swap to the next takes. */
const ROLE_HOLD = 1.7;
const ROLE_SWAP = 0.65;

/**
 * The hero's top-left copy: name, cycling roles, bio, two calls to action.
 *
 * It rides the same handoff as the banner — the loader fires
 * `loader:hero-reveal-start` as it lifts, and everything rises out of its mask
 * from there. Until then the block is held at `opacity: 0` by CSS (the shared
 * `[data-rise]` rule), so it can never flash in un-animated.
 *
 * Sits inside `.section-fake-hero`, which is `mix-blend-mode: difference` — so
 * white text and a white button fill both invert themselves against whatever
 * the liquid has uncovered underneath.
 */
export default function HeroIntro() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cleanup: (() => void) | undefined;

    const ctx = gsap.context(() => {
      const rise = gsap.utils.toArray<HTMLElement>("[data-rise]");
      const roles = gsap.utils.toArray<HTMLElement>(".role");

      // Reduced motion: no entrance, no cycling — just the finished state.
      if (reduced) {
        gsap.set(rise, { autoAlpha: 1, yPercent: 0 });
        gsap.set(roles, { yPercent: 100 });
        gsap.set(roles[0], { yPercent: 0 });
        return;
      }

      // Parked below their masks. Opacity stays at the CSS 0 until reveal.
      gsap.set(rise, { yPercent: 110 });
      gsap.set(roles, { yPercent: 100 });

      // Each role slides out upwards as the next one takes its place.
      const cycle = gsap.timeline({ repeat: -1, paused: true });
      roles.forEach((role, i) => {
        const next = roles[(i + 1) % roles.length];
        cycle
          .to(
            role,
            { yPercent: -100, duration: ROLE_SWAP, ease: "power4.inOut" },
            `+=${ROLE_HOLD}`
          )
          .fromTo(
            next,
            { yPercent: 100 },
            { yPercent: 0, duration: ROLE_SWAP, ease: "power4.inOut" },
            "<"
          );
      });

      const reveal = () => {
        const tl = gsap.timeline();
        tl.to(rise, {
          autoAlpha: 1,
          yPercent: 0,
          duration: 1.1,
          ease: "power4.out",
          stagger: 0.08,
        });
        // The first role arrives with the name rather than after it.
        tl.to(roles[0], { yPercent: 0, duration: 0.9, ease: "power4.out" }, 0.2);
        tl.add(() => cycle.play(), ">-0.2");
      };

      window.addEventListener("loader:hero-reveal-start", reveal, { once: true });
      cleanup = () => window.removeEventListener("loader:hero-reveal-start", reveal);
    }, root);

    return () => {
      cleanup?.();
      ctx.revert();
    };
  }, []);

  return (
    <div className="hero-intro" ref={rootRef}>
      <h1 className="hero-name uppercase ">
        <span className="line-mask-child-mask">
          <span className="line-child " data-rise>
            {NAME}
          </span>
        </span>
      </h1>

      <p className="hero-roles">
        {/* The cycling stack is decorative; the flat list below is what gets read out. */}
        <span className="role-cycler" aria-hidden="true">
          {ROLES.map((role) => (
            <span className="role" key={role}>
              {role}
            </span>
          ))}
        </span>
        <span className="sr-only">{ROLES.join(", ")}</span>
      </p>

      <p className="hero-bio">
        <span className="line-mask-child-mask">
          <span className="line-child" data-rise>
            {BIO}
          </span>
        </span>
      </p>

      <div className="hero-cta" data-rise>
        <ScrambleLink
          className="btn btn-solid"
          href={CALL_HREF}
          target="_blank"
          rel="noreferrer"
          label="Call now"
        />
        <ScrambleLink className="btn btn-ghost" href={ABOUT_HREF} label="About me" />
      </div>

      {/* Pinned to the hero's opposite corner, above <About>'s tile — see
          `.hero-about-note` for why it is markup in this block. */}
      <p className="hero-about-note" data-rise>
        {ABOUT_NOTE}
      </p>
    </div>
  );
}
