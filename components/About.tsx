"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/* -------------------------------------------------------------------------- */
/*  Copy — everything you would want to edit lives here                        */
/* -------------------------------------------------------------------------- */

const ABOUT_LABEL = "About";

/** One entry per masked line of the heading — they reveal in this order. */
const ABOUT_TITLE = ["From the first pixel", "to the last query."];

/** Placeholder about copy — swap for the real thing. */
const ABOUT_BODY = [
  "I build the whole thing — the interface people touch, the services running behind it, and the models threaded through both. Most of my work starts in a design file and ends in a deploy log, and I would rather own that whole line than hand it off halfway.",
  "Lately that means putting AI where it actually earns its place: retrieval that retrieves, agents that stay on task, and interfaces that make either one feel obvious rather than clever.",
];

/**
 * The about section — the tile parked in the hero's bottom-right corner,
 * scrubbed open until it holds the left half of the screen, with the heading
 * and description arriving in the right half beside it.
 *
 * It is stacked over the hero rather than placed after it (see `.section.about`
 * for the scroll arithmetic), so at scroll 0 the tile reads as part of the hero
 * rather than as a section waiting below the fold.
 *
 * Because the image no longer opens full-bleed, it cannot black the hero out on
 * its own — `.about-backdrop` cross-fades to black underneath it over the same
 * window, and that is also the layer Hero.tsx polls to park the fluid sim. The
 * teaser paragraph at rest is markup in <HeroIntro>, which is the layer where
 * text stays legible over the liquid banner — `.hero-about-note` explains the
 * split.
 */
export default function About() {
  const sectionRef = useRef<HTMLElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const media = mediaRef.current;
    const backdrop = backdropRef.current;
    const copy = copyRef.current;
    if (!section || !media || !backdrop || !copy) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // Below the breakpoint there is no stage to scrub over — the section
      // stacks like any other block. Same call the showreel makes.
      if (window.matchMedia("(max-width: 991px)").matches) return;

      // The rest rect is CSS's to own; this only restates it as the tween's
      // start, and only because GSAP needs both ends in the same unit to keep
      // interpolating in `%` rather than resolving everything to pixels.
      const root = getComputedStyle(document.documentElement);
      const token = (name: string) => root.getPropertyValue(name).trim();

      const lines = copy.querySelectorAll<HTMLElement>(".line-child");
      const paragraphs = copy.querySelectorAll<HTMLElement>(".about-body");

      /*
       * One viewport of scroll, split between the four moves. `immediateRender`
       * is off across the board so nothing is written until the trigger is
       * reached — until then CSS holds every rest value, which is what keeps
       * the tile small and the copy hidden while the hero is on screen.
       *
       * The heading lines are the exception: `yPercent` has no CSS rest state,
       * so they start at the same beat the panel begins fading in and are
       * covered by its opacity until then.
       */
      const tl = gsap.timeline({
        defaults: { immediateRender: false },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          // One viewport to open. The sticky stage holds the finished layout
          // for the viewport after that.
          end: () => "+=" + window.innerHeight,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      });

      tl.fromTo(
        media,
        {
          width: token("--about-tile-w"),
          height: token("--about-tile-h"),
          right: token("--about-tile-gap"),
          bottom: token("--about-tile-lift"),
        },
        {
          width: token("--about-open-w"),
          height: "100%",
          right: token("--about-open-right"),
          bottom: 0,
          ease: "power2.inOut",
          duration: 1,
        },
        0
      )
        /*
         * The blackout lands before the copy starts, not alongside it —
         * overlapping the two leaves the hero's own paragraph showing through
         * this one for a beat, which just reads as a muddy double exposure.
         */
        .fromTo(
          backdrop,
          { opacity: 0 },
          { opacity: 1, ease: "none", duration: 0.42 },
          0.18
        )
        .fromTo(
          copy,
          { opacity: 0 },
          { opacity: 1, ease: "none", duration: 0.26 },
          0.58
        )
        .fromTo(
          lines,
          { yPercent: 110 },
          { yPercent: 0, ease: "power3.out", duration: 0.32, stagger: 0.05 },
          0.58
        )
        .fromTo(
          paragraphs,
          { y: 22 },
          { y: 0, ease: "power2.out", duration: 0.28, stagger: 0.04 },
          0.66
        );

      /*
       * `.section.about` is `pointer-events: none` because for the whole time
       * the tile is small this box lies over the hero's social links — and the
       * copy panel lands on exactly that corner. So the panel only takes the
       * pointer back once the image has opened and the hero is covered, and
       * gives it up again on the way out.
       */
      ScrollTrigger.create({
        trigger: section,
        start: () => "top+=" + window.innerHeight * 0.8 + " top",
        end: () => "top+=" + window.innerHeight * 2 + " top",
        invalidateOnRefresh: true,
        onToggle: (self) => {
          copy.style.pointerEvents = self.isActive ? "auto" : "none";
        },
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section className="section about" ref={sectionRef} aria-labelledby="about-title">
      <div className="about-stage">
        {/* Takes over the hero's blackout now that the image only holds half
            the frame — see the component note. */}
        <div className="about-backdrop" ref={backdropRef} aria-hidden="true" />

        <div className="about-media-w" ref={mediaRef}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/about-image.jpeg"
            alt="A figure in a mirrored black helmet lit by an orange visor line, twin hilts across the back"
            className="about-media"
            decoding="async"
            draggable={false}
          />
        </div>

        <div className="about-copy" ref={copyRef}>
          <p className="about-label">{ABOUT_LABEL}</p>

          <h2 className="about-title" id="about-title">
            {ABOUT_TITLE.map((line) => (
              <span className="line-mask-child-mask" key={line}>
                <span className="line-child">{line}</span>
              </span>
            ))}
          </h2>

          {ABOUT_BODY.map((paragraph) => (
            <p className="about-body" key={paragraph}>
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
