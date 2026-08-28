"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import NavWordmark from "./NavWordmark";

/** Letter geometry, matched to the clip windows in NavWordmark. */
const LETTERS = ["nav-o", "nav-t", "nav-h", "nav-i", "nav-n-last"] as const;

const CLOSED_VIEWBOX_W = 338;
const OPEN_VIEWBOX_W = 1398;
const APOS_CLOSED_X = -1060;
const LETTER_PARKED_Y = 320;

const MENU_LINKS = [
  { label: "Work", href: "#work" },
  { label: "Studio", href: "#studio" },
  { label: "Contact", href: "#contact" },
];

export default function Nav() {
  const wrapRef = useRef<HTMLAnchorElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const menuLinksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const svg = svgRef.current;
    if (!wrap || !svg) return;

    gsap.registerPlugin(ScrollTrigger);

    const apos = svg.querySelector<SVGPathElement>(".nav-apos");
    const letters = LETTERS.map((c) => svg.querySelector<SVGPathElement>(`.${c}`));

    // Animated state, written back to attributes on every tick.
    const box = { w: CLOSED_VIEWBOX_W };
    const aposPos = { x: APOS_CLOSED_X };

    let phase: "idle" | "spacing-in" | "open" | "letters-in" | "letters-out" | "spacing-out" =
      "idle";
    let spacingTl: gsap.core.Timeline | null = null;
    let lettersTl: gsap.core.Timeline | null = null;

    const ctx = gsap.context(() => {
      gsap.set(svg, { attr: { viewBox: `0 0 ${CLOSED_VIEWBOX_W} 291` } });
      gsap.set(apos, { attr: { transform: `translate(${APOS_CLOSED_X}, 0)` } });
      letters.forEach((l) => {
        if (l) gsap.set(l, { attr: { transform: `translate(0, ${LETTER_PARKED_Y})` } });
      });

      const shuffle = (arr: number[]) => {
        const out = arr.slice();
        for (let i = out.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
      };

      const sync = () => {
        svg.setAttribute("viewBox", `0 0 ${box.w.toFixed(1)} 291`);
        apos?.setAttribute("transform", `translate(${aposPos.x.toFixed(1)}, 0)`);
      };

      /** Widen the viewBox, then float the letters up. */
      const spacingIn = () => {
        phase = "spacing-in";
        const order = shuffle([0, 1, 2, 3, 4]);
        spacingTl = gsap.timeline({
          onUpdate: sync,
          onComplete: () => {
            phase = "open";
          },
        });
        spacingTl.to(box, { w: OPEN_VIEWBOX_W, duration: 0.7, ease: "power4.inOut" }, 0);
        spacingTl.to(aposPos, { x: 0, duration: 0.7, ease: "power4.inOut" }, 0);
        order.forEach((letterIdx, i) => {
          const el = letters[letterIdx];
          if (el) {
            spacingTl!.to(
              el,
              { attr: { transform: "translate(0, 0)" }, duration: 0.6, ease: "power4.inOut" },
              0.35 + i * 0.06
            );
          }
        });
      };

      /** Re-entering while the letters are still leaving: bring them back. */
      const lettersIn = () => {
        phase = "letters-in";
        const order = shuffle([0, 1, 2, 3, 4]);
        lettersTl = gsap.timeline({
          onUpdate: sync,
          onComplete: () => {
            phase = "open";
          },
        });
        lettersTl.to(box, { w: OPEN_VIEWBOX_W, duration: 0.6, ease: "power4.inOut" }, 0);
        lettersTl.to(aposPos, { x: 0, duration: 0.6, ease: "power4.inOut" }, 0);
        order.forEach((letterIdx, i) => {
          const el = letters[letterIdx];
          if (el) {
            lettersTl!.to(
              el,
              { attr: { transform: "translate(0, 0)" }, duration: 0.6, ease: "power4.inOut" },
              i * 0.06
            );
          }
        });
      };

      /** Drop the letters, then close the viewBox back down. */
      const lettersOut = () => {
        phase = "letters-out";
        const order = shuffle([0, 1, 2, 3, 4]);
        lettersTl = gsap.timeline({ onComplete: spacingOut });
        order.forEach((letterIdx, i) => {
          const el = letters[letterIdx];
          if (el) {
            lettersTl!.to(
              el,
              {
                attr: { transform: `translate(0, ${LETTER_PARKED_Y})` },
                duration: 0.6,
                ease: "power4.inOut",
              },
              i * 0.08
            );
          }
        });
      };

      const spacingOut = () => {
        phase = "spacing-out";
        spacingTl = gsap.timeline({
          onUpdate: sync,
          onComplete: () => {
            phase = "idle";
          },
        });
        spacingTl.to(box, { w: CLOSED_VIEWBOX_W, duration: 0.7, ease: "power4.inOut" }, 0);
        spacingTl.to(aposPos, { x: APOS_CLOSED_X, duration: 0.7, ease: "power4.inOut" }, 0);
      };

      const killTimelines = () => {
        spacingTl?.kill();
        lettersTl?.kill();
      };

      const onEnter = () => {
        killTimelines();
        if (phase === "idle" || phase === "spacing-out") spacingIn();
        else if (phase === "letters-out") lettersIn();
      };

      const onLeave = () => {
        killTimelines();
        if (phase === "open" || phase === "letters-in" || phase === "spacing-in") lettersOut();
      };

      const isDesktop = !window.matchMedia("(max-width: 991px)").matches;
      if (isDesktop) {
        wrap.addEventListener("mouseenter", onEnter);
        wrap.addEventListener("mouseleave", onLeave);
      }

      /* --- show the nav only once the hero has scrolled past ------------- */
      const hasHero = !!document.querySelector(".nothin-hero-w");
      if (hasHero) {
        gsap.set(wrap, { autoAlpha: 0 });
        let visible = false;
        const setVisible = (next: boolean) => {
          if (next === visible) return;
          visible = next;
          gsap.to(wrap, {
            autoAlpha: next ? 1 : 0,
            duration: next ? 0.4 : 0.3,
            ease: next ? "power2.out" : "power2.in",
          });
        };
        const update = () => {
          const y = window.scrollY || window.pageYOffset || 0;
          setVisible(y >= window.innerHeight * 0.1);
        };
        ScrollTrigger.create({
          start: () => window.innerHeight * 0.1,
          end: () => ScrollTrigger.maxScroll(window) + window.innerHeight,
          onToggle: update,
          onRefresh: update,
        });
        update();
      } else {
        gsap.set(wrap, { autoAlpha: 1 });
      }

      return () => {
        wrap.removeEventListener("mouseenter", onEnter);
        wrap.removeEventListener("mouseleave", onLeave);
        killTimelines();
      };
    }, wrap);

    return () => ctx.revert();
  }, []);

  /* --- menu hover ------------------------------------------------------- */
  useEffect(() => {
    const links = menuLinksRef.current;
    if (!links) return;

    const items = [...links.querySelectorAll<HTMLElement>("[data-menu-link]")];
    gsap.set(items, { yPercent: 120, autoAlpha: 0 });

    const wrapper = links.parentElement!;
    const show = () =>
      gsap.to(items, {
        yPercent: 0,
        autoAlpha: 1,
        duration: 0.5,
        ease: "power3.out",
        stagger: 0.05,
      });
    const hide = () =>
      gsap.to(items, {
        yPercent: 120,
        autoAlpha: 0,
        duration: 0.35,
        ease: "power3.in",
        stagger: { each: 0.04, from: "end" },
      });

    wrapper.addEventListener("mouseenter", show);
    wrapper.addEventListener("mouseleave", hide);
    return () => {
      wrapper.removeEventListener("mouseenter", show);
      wrapper.removeEventListener("mouseleave", hide);
      gsap.killTweensOf(items);
    };
  }, []);

  return (
    <nav className="nav-boiler">
      <a href="/" className="nav-logo-wrap" ref={wrapRef} aria-label="Nothin’ — home">
        <NavWordmark ref={svgRef} />
      </a>

      <div className="menu-w">
        <div className="menu-btn">
          <div className="menu-btn-text">menu</div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="100%"
            viewBox="0 0 6 6"
            fill="none"
            className="menu-svg"
          >
            <rect y="4" width="2" height="2" fill="currentColor" />
            <rect x="4" y="4" width="2" height="2" fill="currentColor" />
            <rect width="2" height="2" fill="currentColor" />
            <rect x="4" width="2" height="2" fill="currentColor" />
          </svg>
        </div>

        <div className="menu-links-w" ref={menuLinksRef}>
          {MENU_LINKS.map((link) => (
            <div key={link.href} style={{ overflow: "hidden" }}>
              <a href={link.href} className="link" data-menu-link>
                {link.label}
              </a>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}
