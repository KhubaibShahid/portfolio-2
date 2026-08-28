"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * The section that scrolls up over the hero.
 *
 * Its media starts full-bleed and is scrubbed down to a small corner tile. That
 * inline width is also the signal the fluid engine polls: once it drops below
 * 99% the hero is out of view and the simulation parks itself.
 */
export default function Showreel() {
  const sectionRef = useRef<HTMLElement>(null);
  const mediaWrapRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const mediaWrap = mediaWrapRef.current;
    if (!section || !mediaWrap) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // Skip the scrub on mobile, exactly like the original.
      if (!window.matchMedia("(max-width: 991px)").matches) {
        gsap.fromTo(
          mediaWrap,
          { width: "100%", height: "100%" },
          {
            width: "33.3%",
            height: "35%",
            ease: "power4.inOut",
            immediateRender: false,
            scrollTrigger: {
              trigger: section,
              start: "top top",
              end: "bottom bottom",
              scrub: 3,
              invalidateOnRefresh: true,
            },
          }
        );
      }

      // Line-by-line reveal for the heading.
      const lines = headingRef.current?.querySelectorAll(".line-child");
      if (lines?.length) {
        gsap.fromTo(
          lines,
          { yPercent: 110 },
          {
            yPercent: 0,
            duration: 1.1,
            ease: "power4.out",
            stagger: 0.08,
            scrollTrigger: { trigger: headingRef.current, start: "top 80%" },
          }
        );
      }
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section className="section showreel" ref={sectionRef}>
      <div className="container-showreel">
        <div className="space-150" />
        <h2 className="h1-home" ref={headingRef}>
          <div className="line-mask-child-mask">
            <div className="line-child">Most brands produce content.</div>
          </div>
          <div className="line-mask-child-mask">
            <div className="line-child">We prefer ideas.</div>
          </div>
        </h2>

        <div className="showreel-stage">
          <div className="video-showreel-full-w" ref={mediaWrapRef}>
            <div className="showreel-media" />
          </div>
        </div>
      </div>
    </section>
  );
}
