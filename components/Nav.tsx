"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const MENU_LINKS = [
  { label: "Work", href: "#work" },
  { label: "Studio", href: "#studio" },
  { label: "Contact", href: "#contact" },
];

/**
 * Where the nav decides it is over a light background, in px from the top of
 * the viewport. The bar is 4rem tall with 1.28rem of top padding, so this sits
 * roughly on the mark's own centre line — the switch lands when the section
 * edge crosses the logo, not when it crosses the top of the screen.
 */
const LIGHT_LINE = 40;

export default function Nav() {
  const navRef = useRef<HTMLElement>(null);
  const wrapRef = useRef<HTMLAnchorElement>(null);
  const menuLinksRef = useRef<HTMLDivElement>(null);

  /* --- reveal past the hero, and the light/dark switch ------------------- */

  useEffect(() => {
    const nav = navRef.current;
    const wrap = wrapRef.current;
    if (!nav || !wrap) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      /*
       * The nav is white on black for most of the page and inverts over the one
       * white section. This used to be `mix-blend-mode: difference` on the bar,
       * which cannot work now that the mark is a raster image: a black PNG
       * differenced against white comes back white. So the swap is explicit —
       * a class on the bar switches `color` for the menu and crossfades the two
       * logo files, and the CSS does the actual work.
       */
      const light = document.querySelector<HTMLElement>(".section.tech");
      if (light) {
        ScrollTrigger.create({
          trigger: light,
          start: () => `top ${LIGHT_LINE}px`,
          end: () => `bottom ${LIGHT_LINE}px`,
          onToggle: (self) => nav.classList.toggle("is-over-light", self.isActive),
          onRefresh: (self) => nav.classList.toggle("is-over-light", self.isActive),
        });
      }

      /* --- show the logo only once the hero has scrolled past ------------- */
      const hasHero = !!document.querySelector(".nothin-hero-w");
      if (!hasHero) {
        gsap.set(wrap, { autoAlpha: 1 });
        return;
      }

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
    }, nav);

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
    <nav className="nav-boiler" ref={navRef}>
      {/*
        Both files are always in the DOM and stacked; the crossfade is opacity
        only, so neither has to decode at the moment the section edge crosses
        the bar. The dark one is decorative — the light one carries the label.
      */}
      <a href="/" className="nav-logo-wrap" ref={wrapRef} aria-label="Nothin’ — home">
        <img src="/logo-white.png" alt="Nothin’" className="nav-logo nav-logo--light" draggable="false" />
        <img
          src="/logo-black.png"
          alt=""
          aria-hidden="true"
          className="nav-logo nav-logo--dark"
          draggable="false"
        />
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
