"use client";

import { useEffect, useRef } from "react";
import HeroIntro from "./HeroIntro";
import { MaskReveal } from "@/lib/fluid/MaskReveal";

/**
 * The hero.
 *
 * Layering inside `.section-w` (bottom to top):
 *   0. `.video-hero-bg`      — back_hero.jpeg, the image the liquid reveals
 *   1. `.mask-reveal-canvas` — injected by the engine; the front_hero banner
 *   2. `.section-fake-hero`  — foreground copy, `mix-blend-mode: difference`
 *
 * The banner you see at rest is not the DOM `<img>` — that gets rasterised in
 * place and used as the shader's base layer. Moving the pointer stirs a fluid
 * sim whose dye dissolves that layer to transparent, so back_hero bleeds
 * through in liquid trails.
 */
/**
 * What the liquid mixes between.
 *
 * `base` is what you see at rest, `reveal` is what the dye uncovers. Keeping
 * `reveal` transparent lets `.video-hero-bg` (back_hero.jpeg, set in CSS) show
 * through — that is how the original site does it.
 *
 * To cross-fade the two images inside the shader instead, swap in:
 *   base:   "/front_hero.jpeg",
 *   reveal: "/back_hero.jpeg",
 * A video works too: `{ video: "/hero.mp4" }`.
 */
const HERO_LAYERS = {
  base: "img" as const, // the front_hero banner, baked onto `baseBg`
  baseBg: "#ffffff",
  reveal: "rgba(0,0,0,0)",
};

/**
 * The opacity GSAP last scrubbed into an element inline, or null while it is
 * untouched — before its trigger is reached, or on the mobile layouts that skip
 * the tween entirely.
 */
function inlineOpacity(selector: string): number | null {
  const el = document.querySelector<HTMLElement>(selector);
  const raw = el?.style.opacity.trim();
  const value = raw ? parseFloat(raw) : NaN;
  return Number.isNaN(value) ? null : value;
}

export default function Hero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const heroHomeRef = useRef<HTMLElement>(null);
  const bannerRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const container = sectionRef.current;
    const banner = bannerRef.current;
    const heroHome = heroHomeRef.current;
    if (!container || !banner || !heroHome) return;

    // Respect reduced motion: keep the plain white hero, no simulation.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let engine: MaskReveal | null = null;
    let cancelled = false;

    const boot = async () => {
      if (cancelled) return;

      engine = new MaskReveal({
        container,
        // Reads a value GSAP scrubs inline, and asks one question: is any of
        // the hero still on screen?
        isActive: () => {
          // The about section opens over the hero. Its image only takes the
          // left half, so the blackout behind it is what says the hero is
          // covered — at full opacity there is nothing left underneath to stir.
          const about = inlineOpacity(".about-backdrop");
          return about === null || about < 0.99;
        },
      });

      await engine.setLayers({
        base: HERO_LAYERS.base === "img" ? banner : HERO_LAYERS.base,
        baseBg: HERO_LAYERS.baseBg,
        reveal: HERO_LAYERS.reveal,
        hideOriginal: true,
      });

      if (cancelled) {
        engine.destroy();
        engine = null;
        return;
      }

      // Hand the white background over in the same frame the canvas first
      // draws the banner — and the same frame the engine hides the DOM <img>.
      // Any gap between the three shows as a flash.
      engine.onNextRender(() => {
        if (!cancelled) heroHome.style.backgroundColor = "transparent";
      });
    };

    // The loader animates the banner in; bake it only once it has settled,
    // otherwise the texture would capture a mid-animation frame.
    const onRevealed = () => void boot();
    window.addEventListener("loader:hero-revealed", onRevealed, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("loader:hero-revealed", onRevealed);
      engine?.destroy();
      engine = null;
      heroHome.style.backgroundColor = "";
    };
  }, []);

  return (
    // The pin's runway; `.section-w` sticks inside it while the about image
    // opens, so the hero holds its position instead of scrolling away.
    <div className="hero-pin-w">
      <div className="section-w" ref={sectionRef}>
        {/* The layer revealed by the liquid. */}
        <div className="video-hero-bg" />

        {/* Sits between the canvas and the copy — see `.hero-scrim`. */}
        <div className="hero-scrim" aria-hidden="true" />

        {/* Foreground copy — inverts against whatever is behind it. */}
        <div className="section-fake-hero">
          <div className="div-block">
            <HeroIntro />
          </div>

          <div className="link-hero-bottom-w">
            <div>
              <div className="line-mask-child-mask">
                <div className="line-child">Creative studio in Paris</div>
              </div>
            </div>

            <div className="link-hero-lang-w">
              <div className="link-hero-w">
                <a
                  href="https://www.linkedin.com/company/nothin/"
                  target="_blank"
                  rel="noreferrer"
                  className="link"
                >
                  Linkedin
                  <span className="link-underline" />
                </a>
                <a
                  href="https://www.instagram.com/nothin.paris/"
                  target="_blank"
                  rel="noreferrer"
                  className="link"
                >
                  Instagram
                  <span className="link-underline" />
                </a>
              </div>
              <a href="#" className="link-lang">
                EN
              </a>
            </div>
          </div>
        </div>

        {/* Sits under the canvas; its white background moves into the texture. */}
        <section className="section hero-home" ref={heroHomeRef}>
          <div className="container-hero">
            <div className="nothin-hero-w">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={bannerRef}
                src="/front_hero.jpeg"
                alt=""
                className="hero-banner-img"
                fetchPriority="high"
                decoding="async"
                draggable={false}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
