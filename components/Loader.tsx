"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useLenis } from "./SmoothScroll";

/** Plays once per tab, same as the original. */
const SESSION_KEY = "nothin:loader-played";

/** The original held for 5000ms; shortened here so repeat visits aren't a wait. */
const LOADER_DURATION = 2600;

/**
 * Intro loader, and the thing that hands off to the hero.
 *
 * On completion it slides the hero banner up from behind its mask, then fires
 * `loader:hero-revealed` — the signal Hero waits for before baking the banner
 * into the fluid shader's base texture.
 */
export default function Loader() {
  const rootRef = useRef<HTMLDivElement>(null);
  const nRef = useRef<SVGSVGElement>(null);
  const aposRef = useRef<SVGSVGElement>(null);
  const counterRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const lenis = useLenis();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      const banner = document.querySelector<HTMLImageElement>(".hero-banner-img");

      /** Reveal the hero banner, then tell Hero it may bake the texture. */
      const revealHero = () => {
        window.dispatchEvent(new CustomEvent("loader:hero-reveal-start"));

        if (nRef.current) {
          gsap.to(nRef.current, { yPercent: 100, duration: 1, ease: "power4.inOut" });
        }
        if (aposRef.current) {
          gsap.to(aposRef.current, { scale: 0, duration: 1, ease: "power4.inOut" });
        }

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
      try {
        played = sessionStorage.getItem(SESSION_KEY) === "1";
      } catch {}

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

      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {}

      // Hold the page still while the loader runs.
      lenis?.stop();
      window.scrollTo(0, 0);

      if (banner) gsap.set(banner, { autoAlpha: 0 });

      /* --- the loader itself --------------------------------------------- */
      const tl = gsap.timeline();

      gsap.set(nRef.current, { yPercent: 100, opacity: 0 });
      gsap.set(aposRef.current, { scale: 0, transformOrigin: "center center" });

      tl.to(nRef.current, { opacity: 1, yPercent: 0, duration: 1, ease: "power4.inOut" })
        .to(aposRef.current, { scale: 1, duration: 1, ease: "power4.inOut" }, "<");

      // Counter ticking down 100 -> 000.
      const counter = { val: 100 };
      tl.to(
        counter,
        {
          val: 0,
          duration: LOADER_DURATION / 1000,
          ease: "power2.inOut",
          onUpdate: () => {
            if (counterRef.current) {
              counterRef.current.textContent = Math.round(counter.val).toString().padStart(3, "0");
            }
          },
        },
        0
      );

      // Progress bar widening out from the mark.
      const barWidth = window.matchMedia("(max-width: 991px)").matches ? "10rem" : "20rem";
      tl.fromTo(
        barRef.current,
        { width: "1rem" },
        { width: barWidth, duration: LOADER_DURATION / 1000, ease: "power4.inOut" },
        0
      );

      /* --- exit ----------------------------------------------------------- */
      tl.to(barRef.current, { width: "1rem", duration: 0.8, ease: "power4.inOut" })
        .to(counterRef.current, { autoAlpha: 0, duration: 0.5, ease: "power4.inOut" }, "<")
        .to(
          root,
          {
            height: 0,
            duration: 1.8,
            ease: "power4.inOut",
            onStart: revealHero,
            onComplete: () => {
              gsap.set(root, { display: "none" });
              lenis?.start();
            },
          },
          "<"
        );
    }, root);

    return () => ctx.revert();
  }, [lenis]);

  return (
    <div className="loader" ref={rootRef}>
      <div className="loader-c">
        <div />

        <div className="loader-anim">
          <div style={{ overflow: "hidden", display: "flex" }}>
            <svg
              ref={nRef}
              xmlns="http://www.w3.org/2000/svg"
              width="100%"
              viewBox="0 0 99 120"
              fill="none"
              className="n-load"
            >
              <path
                d="M97.5773 0C98.5258 0 99 0.474199 99 1.42259V118.577C99 119.526 98.5258 120 97.5773 120H73.2249C72.6669 120 72.2764 119.805 72.0533 119.414L31.3821 62.3431C30.9358 61.7852 30.3779 61.6178 29.7084 61.841C29.0389 62.0084 28.7041 62.4547 28.7041 63.1799L29.2899 118.494C29.2899 119.498 28.8157 120 27.8673 120H1.50634C0.502113 120 0 119.526 0 118.577V1.42259C0 0.474199 0.502113 0 1.50634 0H25.5241C26.082 0 26.5004 0.223152 26.7794 0.669456L67.6179 62.092C68.0085 62.6499 68.5385 62.8452 69.2079 62.6778C69.9332 62.4547 70.2959 61.9805 70.2959 61.2552L69.7101 1.42259C69.7101 0.474199 70.1843 0 71.1327 0H97.5773Z"
                fill="currentColor"
              />
            </svg>
          </div>

          <div className="loader-img-w" ref={barRef}>
            <div
              style={{
                width: "100%",
                height: "1px",
                background: "currentColor",
                alignSelf: "center",
              }}
            />
          </div>

          <svg
            ref={aposRef}
            xmlns="http://www.w3.org/2000/svg"
            width="100%"
            viewBox="0 0 41 50"
            fill="none"
            className="apos-load"
          >
            <path
              d="M39.5359 0C39.9821 0 40.3447 0.195095 40.6235 0.585285C40.9582 0.975474 41.0697 1.39353 40.9582 1.83947L20.9631 48.9967C20.7958 49.6656 20.3217 50 19.5409 50H1.47004C1.02385 50 0.633448 49.8328 0.298802 49.4983C0.0199315 49.1081 -0.0637449 48.6901 0.0478035 48.2441L11.3421 1.17057C11.5652 0.39019 12.0393 0 12.7643 0H39.5359Z"
              fill="currentColor"
            />
          </svg>
        </div>

        <div className="loader-nbr-w" ref={counterRef}>
          100
        </div>
      </div>
    </div>
  );
}
