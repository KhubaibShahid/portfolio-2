"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const LenisContext = createContext<Lenis | null>(null);

/** Access the shared Lenis instance (null until it has mounted). */
export const useLenis = () => useContext(LenisContext);

export default function SmoothScroll({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    /*
     * The page's weight, and the single biggest thing deciding how it feels.
     *
     * Two numbers do the work and they are doing different jobs. `duration` is
     * how long the page keeps gliding after the wheel stops — long, so a flick
     * carries and coasts to a halt instead of arriving with the input.
     * `wheelMultiplier` is how much distance one notch of the wheel buys, and
     * it is *under* one on purpose: every scroll-driven sequence on this page —
     * the hero opening into the about tile, the stack morphing through six
     * marks — is meant to be watched rather than passed, and at the browser's
     * default a single flick crossed most of one.
     *
     * Touch is left near unity. A thumb expects the page to track it, and the
     * same discount that reads as weight on a wheel reads as a broken drag.
     */
    const instance = new Lenis({
      duration: 1.65,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 0.7,
      touchMultiplier: 1.6,
    });

    lenisRef.current = instance;
    setLenis(instance);

    // Keep ScrollTrigger's notion of scroll position in sync with Lenis.
    instance.on("scroll", ScrollTrigger.update);

    // Drive Lenis from GSAP's ticker so both run on one rAF.
    const raf = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Let ScrollTrigger scroll through Lenis (e.g. for scrollTo).
    ScrollTrigger.scrollerProxy(document.documentElement, {
      scrollTop(value) {
        if (arguments.length && typeof value === "number") {
          instance.scrollTo(value, { immediate: true });
        }
        return instance.scroll;
      },
      getBoundingClientRect() {
        return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
      },
    });

    ScrollTrigger.refresh();

    return () => {
      instance.off("scroll", ScrollTrigger.update);
      gsap.ticker.remove(raf);
      ScrollTrigger.scrollerProxy(document.documentElement, {});
      instance.destroy();
      lenisRef.current = null;
      setLenis(null);
    };
  }, []);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}
