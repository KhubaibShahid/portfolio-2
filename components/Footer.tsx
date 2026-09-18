"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import DecryptText from "./DecryptText";
import { useLenis } from "./SmoothScroll";
import { SOCIALS } from "@/lib/contact";

/* -------------------------------------------------------------------------- */
/*  Copy — everything you would want to edit lives here                        */
/* -------------------------------------------------------------------------- */

const FOOTER_NAME = "Khubaib Shahid";

const FOOTER_BLURB =
  "Designed and built end to end — from the first pixel to the last query.";

const FOOTER_BUILT_WITH = "Built with Next.js, GSAP & three.js";

interface FooterProps {
  /** The page's sections, in order — the navbar's list. */
  items: { label: string; href: string }[];
}

/**
 * The loader, run backwards at the other end of the page.
 *
 * The loader counts 000 to 100 while the page arrives; this counts how much of
 * it has been read, on the same rolling digits and the same graduated rule, and
 * reaches 100 as the page runs out. Around it, the same furniture: mono
 * readouts, the blinking amber dot, and the name — set across the full width
 * and decrypting letter by letter as it comes up, the way it first appeared.
 */
export default function Footer({ items }: FooterProps) {
  const footerRef = useRef<HTMLElement>(null);
  const lenis = useLenis();

  /* --- how far down the page: the odometer and the rule ------------------- */

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;

    gsap.registerPlugin(ScrollTrigger);

    const fill = footer.querySelector<HTMLElement>(".footer-rule span");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /*
     * The loader's odometer: three strips of 0–9 plus a trailing 0, each
     * easing toward its digit as a running total and drawn modulo ten, so a 9
     * rolls forward into the trailing zero instead of spinning back.
     */
    const columns = gsap.utils
      .toArray<HTMLElement>(footer.querySelectorAll(".footer-digit__strip"))
      .map((strip) => ({ strip, pos: 0, target: 0 }));

    const setDigits = (value: number) => {
      const targets = [Math.floor(value / 100), Math.floor(value / 10), value];
      columns.forEach((col, i) => {
        if (col.target === targets[i]) return;
        col.target = targets[i];
        gsap.to(col, {
          pos: col.target,
          duration: reduced ? 0 : 0.6,
          ease: "power3.out",
          overwrite: true,
          onUpdate: () => {
            gsap.set(col.strip, { yPercent: -((col.pos % 10) / 11) * 100 });
          },
        });
      });
    };

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (self) => {
          setDigits(Math.round(self.progress * 100));
          if (fill) gsap.set(fill, { scaleX: self.progress });
        },
        onRefresh: (self) => {
          setDigits(Math.round(self.progress * 100));
          if (fill) gsap.set(fill, { scaleX: self.progress });
        },
      });
    }, footer);

    return () => ctx.revert();
  }, []);

  /* --- links --------------------------------------------------------------- */

  const scrollTo = (target: number | HTMLElement) => {
    if (lenis) lenis.scrollTo(target, { duration: 2 });
    else if (typeof target === "number") window.scrollTo({ top: target, behavior: "smooth" });
    else target.scrollIntoView({ behavior: "smooth" });
  };

  const onNavigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    const target = href === "#top" ? 0 : document.querySelector<HTMLElement>(href);
    if (target === null) return;
    event.preventDefault();
    scrollTo(target);
  };

  const year = new Date().getFullYear();

  return (
    <footer className="footer" ref={footerRef}>
      <div className="footer-top">
        <div className="footer-col">
          <p className="footer-eyebrow">K—S / Portfolio</p>
          <p className="footer-blurb">{FOOTER_BLURB}</p>
        </div>

        <nav className="footer-col" aria-label="Footer">
          <p className="footer-eyebrow">Index</p>
          <ul className="footer-list">
            {items.map((item, i) => (
              <li key={item.href}>
                <a className="footer-link" href={item.href} onClick={(event) => onNavigate(event, item.href)}>
                  <span className="footer-link__n">{String(i + 1).padStart(2, "0")}</span>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer-col">
          <p className="footer-eyebrow">Elsewhere</p>
          <ul className="footer-list">
            {SOCIALS.map((social) => {
              const external = !social.href.startsWith("mailto:");
              return (
                <li key={social.label}>
                  <a
                    className="footer-link"
                    href={social.href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noreferrer" : undefined}
                  >
                    {social.label}
                    <span className="footer-link__arrow" aria-hidden="true">
                      ↗
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="footer-col footer-col--end">
          <button type="button" className="footer-top-btn" onClick={() => scrollTo(0)}>
            Back to top
            <span aria-hidden="true">↑</span>
          </button>
        </div>
      </div>

      {/* The loader's bottom row, re-read: a status line, and the counter. */}
      <div className="footer-meter" aria-hidden="true">
        <div className="footer-meter__row">
          <p className="footer-status">
            <span className="footer-status__dot" />
            <span className="footer-eyebrow">End of page</span>
          </p>
          <span className="footer-count">
            {[0, 1, 2].map((i) => (
              <span className="footer-digit" key={i}>
                <span className="footer-digit__strip">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, j) => (
                    <span key={j}>{d}</span>
                  ))}
                </span>
              </span>
            ))}
            <span className="footer-count__unit">%</span>
          </span>
        </div>
        <div className="footer-rule">
          <span />
        </div>
      </div>

      <DecryptText as="p" className="footer-wordmark" lines={[FOOTER_NAME]} stagger={0.04} />

      <div className="footer-bottom">
        <span className="footer-eyebrow">
          © {year} {FOOTER_NAME}
        </span>
        <span className="footer-eyebrow">{FOOTER_BUILT_WITH}</span>
      </div>
    </footer>
  );
}
