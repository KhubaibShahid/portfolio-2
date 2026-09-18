"use client";

import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "./SmoothScroll";

export interface NavItem {
  label: string;
  /** An in-page hash. `#top` needs no element — it means the top of the page. */
  href: string;
}

export interface NavCta {
  label: string;
  href: string;
  /** Opens in a new tab. */
  external?: boolean;
}

export interface NavbarProps {
  /** Rendered loose in the top-left corner, in white — it inverts against the page. */
  logo: ReactNode;
  /** The logo link's accessible name. */
  logoLabel: string;
  logoHref?: string;
  /** In document order: the active link is the last one whose section has reached mid-screen. */
  items: NavItem[];
  cta: NavCta;
  /**
   * A window event to hold the entrance for — the loader's handoff, on this
   * site. Left out, the bar animates in on mount.
   */
  revealEvent?: string;
  /** Seconds between that event and the entrance starting. */
  revealDelay?: number;
}

/** The visor amber the loader spends its accent on. */
const ACCENT = "#ffb21e";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/**
 * The navbar: the logo loose in the top-left corner, and the links and call to
 * action in a black tab cut into the top-right one.
 *
 * It belongs to the top of the page rather than to the screen: both pieces are
 * absolute against the document, so they scroll away with the hero instead of
 * following the reader down.
 *
 * Two pieces rather than one bar, and the wrapper deliberately has no position
 * of its own. The logo is `mix-blend-mode: difference` — the same treatment as
 * the hero copy, so it reads black over the white banner and white over
 * everything dark — and a blend only reaches the page if no positioned
 * ancestor isolates it first.
 *
 * The tab's inverted corners are CSS (`.nav-tab`). Below `lg` the links pill
 * gives way to a menu button, and the links drop into a panel under the tab.
 */
export default function Navbar({
  logo,
  logoLabel,
  logoHref = "#top",
  items,
  cta,
  revealEvent,
  revealDelay = 0,
}: NavbarProps) {
  const headerRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const lenis = useLenis();

  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  /* --- scrolling to a section ------------------------------------------- */

  const scrollToHash = (hash: string) => {
    const target = hash === "#top" ? 0 : document.querySelector<HTMLElement>(hash);
    if (target === null) return;

    if (lenis) {
      lenis.scrollTo(target, { duration: 1.8 });
    } else if (typeof target === "number") {
      window.scrollTo({ top: target, behavior: "smooth" });
    } else {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  const onNavigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("#")) return;
    event.preventDefault();
    // Closing first matters: the open menu has Lenis stopped, and a stopped
    // Lenis ignores `scrollTo`.
    setOpen(false);
    requestAnimationFrame(() => scrollToHash(href));
  };

  /* --- entrance ----------------------------------------------------------- */

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cleanup: (() => void) | undefined;

    const ctx = gsap.context(() => {
      const logoEl = header.querySelector("[data-nav-logo]");
      const tab = header.querySelector("[data-nav-tab]");
      const pills = gsap.utils.toArray<HTMLElement>("[data-nav-pill]");

      /*
       * `from` tweens rather than a CSS rest state, so the bar can never be
       * stranded invisible: if the event never comes — or already went, before
       * a hot reload — it simply stays where it rendered.
       *
       * The tab drops in from above the fold, corners and all, then the pills
       * settle into it; the logo fades in on the opposite side alongside.
       */
      const enter = () => {
        if (reduced) return;
        gsap
          .timeline({ delay: revealDelay })
          .from(tab, { yPercent: -140, duration: 1, ease: "power4.out" })
          .from(
            pills,
            { autoAlpha: 0, y: -10, duration: 0.7, ease: "power3.out", stagger: 0.07 },
            0.35
          )
          .from(logoEl, { autoAlpha: 0, y: -10, duration: 0.8, ease: "power3.out" }, 0.2);
      };

      if (!revealEvent) {
        enter();
        return;
      }

      window.addEventListener(revealEvent, enter, { once: true });
      cleanup = () => window.removeEventListener(revealEvent, enter);
    }, header);

    return () => {
      cleanup?.();
      ctx.revert();
    };
  }, [revealEvent, revealDelay]);

  /* --- which section is on screen ---------------------------------------- */

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const update = () => {
      const line = window.innerHeight * 0.5;
      let next = 0;
      items.forEach((item, i) => {
        const el = item.href === "#top" ? null : document.querySelector(item.href);
        const top = el ? el.getBoundingClientRect().top : item.href === "#top" ? -window.scrollY : Infinity;
        if (top <= line) next = i;
      });
      setActive(next);
    };

    const trigger = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: update,
      onRefresh: update,
    });
    update();

    return () => trigger.kill();
  }, [items]);

  /* --- the grey pill that slides between links --------------------------- */

  useEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;

    const place = () => {
      const link = list.querySelectorAll<HTMLElement>("[data-nav-link]")[active];
      if (!link) return;
      indicator.style.width = `${link.offsetWidth}px`;
      indicator.style.transform = `translateX(${link.offsetLeft}px)`;
    };

    place();
    // Font swaps and resizes change every link's width.
    const observer = new ResizeObserver(place);
    observer.observe(list);

    // The first placement snaps; only moves after it slide.
    const raf = requestAnimationFrame(() => indicator.setAttribute("data-ready", ""));

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [active]);

  /* --- menu panel (below lg) --------------------------------------------- */

  const mountedRef = useRef(false);
  const lockedRef = useRef(false);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    // Only ever release a lock this menu took — the loader stops Lenis too, and
    // starting it from here on mount would let the page scroll under it.
    if (open && lenis && !lockedRef.current) {
      lenis.stop();
      lockedRef.current = true;
    } else if (!open && lockedRef.current) {
      lenis?.start();
      lockedRef.current = false;
    }

    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const links = panel.querySelectorAll<HTMLElement>("[data-menu-rise]");
    gsap.killTweensOf([panel, links]);

    if (open) {
      gsap.fromTo(
        panel,
        { autoAlpha: 0, y: -12 },
        { autoAlpha: 1, y: 0, duration: reduced ? 0 : 0.45, ease: "power3.out" }
      );
      if (!reduced) {
        gsap.fromTo(
          links,
          { yPercent: 110 },
          { yPercent: 0, duration: 0.7, ease: "power4.out", stagger: 0.05, delay: 0.05 }
        );
      }
    } else {
      gsap.to(panel, { autoAlpha: 0, y: -8, duration: reduced ? 0 : 0.25, ease: "power2.in" });
    }
  }, [open, lenis]);

  // Escape, a click outside the navbar, or growing past the breakpoint.
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const wide = window.matchMedia("(min-width: 1024px)");
    const onWide = () => wide.matches && setOpen(false);

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    wide.addEventListener("change", onWide);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  // Hands Lenis back if the bar unmounts with the menu open.
  useEffect(
    () => () => {
      if (lockedRef.current) lenis?.start();
    },
    [lenis]
  );

  const external = cta.external ? { target: "_blank", rel: "noreferrer" } : {};

  return (
    <header ref={headerRef} className="site-nav">
      {/* --- logo --------------------------------------------------------- */}
      <a
        href={logoHref}
        onClick={(event) => onNavigate(event, logoHref)}
        aria-label={logoLabel}
        data-nav-logo
        className={`absolute top-0 left-0 z-[1001] flex h-(--nav-tab-h) items-center gap-3 pl-4 text-white mix-blend-difference md:pl-5 ${FOCUS_RING}`}
      >
        {logo}
      </a>

      {/* --- the tab ------------------------------------------------------ */}
      <div
        data-nav-tab
        className="nav-tab absolute top-0 right-0 z-[1001] flex h-(--nav-tab-h) items-center gap-2 bg-black pr-3 pl-3 text-white lg:gap-2.5 lg:pl-6"
      >
        <nav aria-label="Primary" data-nav-pill className="hidden lg:block">
          <ul ref={listRef} className="relative flex h-13 items-center gap-2 rounded-full bg-[#161616] p-1">
            <span
              ref={indicatorRef}
              aria-hidden="true"
              className="absolute top-1 bottom-1 left-0 rounded-full bg-[#3a3a3a] data-[ready]:transition-[transform,width] data-[ready]:duration-600 data-[ready]:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            >
              <span
                className="absolute top-1/2 left-[1.125rem] size-1.5 -translate-y-1/2 rounded-full"
                style={{ backgroundColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
              />
            </span>

            {items.map((item, i) => (
              <li key={item.href}>
                {/* `relative` so it paints over the indicator, which is positioned. */}
                <a
                  href={item.href}
                  onClick={(event) => onNavigate(event, item.href)}
                  aria-current={i === active ? "true" : undefined}
                  data-nav-link
                  className={`relative flex h-11 items-center rounded-full pr-7 pl-[2.125rem] text-[0.8125rem] leading-none font-medium tracking-[0.06em] uppercase transition-colors duration-300 ${FOCUS_RING} ${
                    i === active ? "text-white" : "text-white/70 hover:text-white"
                  }`}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* One link, drawn as a pill holding a pill: the pair is one destination. */}
        <a
          href={cta.href}
          {...external}
          data-nav-pill
          className={`group flex h-13 items-center gap-4 rounded-full bg-[#161616] pr-1 pl-5 sm:pl-7 ${FOCUS_RING}`}
        >
          <span className="text-[0.8125rem] leading-none font-medium tracking-[0.06em] whitespace-nowrap uppercase">
            {cta.label}
          </span>
          <span className="grid h-11 w-14 place-items-center rounded-full bg-[#3a3a3a] transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:bg-white group-hover:text-black sm:w-[4.5rem]">
            <svg
              viewBox="0 0 28 12"
              fill="none"
              aria-hidden="true"
              className="h-3 w-7 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1 motion-reduce:transition-none"
            >
              <path d="M0 6h26.5M21.5 1l5 5-5 5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </span>
        </a>

        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Close menu" : "Open menu"}
          data-nav-pill
          className={`relative grid size-13 shrink-0 place-items-center rounded-full bg-[#161616] lg:hidden ${FOCUS_RING}`}
        >
          {/* Two bars that cross into an X. */}
          <span
            aria-hidden="true"
            className={`absolute h-px w-4 bg-current transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              open ? "rotate-45" : "-translate-y-[3px]"
            }`}
          />
          <span
            aria-hidden="true"
            className={`absolute h-px w-4 bg-current transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              open ? "-rotate-45" : "translate-y-[3px]"
            }`}
          />
        </button>
      </div>

      {/* --- menu panel --------------------------------------------------- */}
      <div
        ref={panelRef}
        id={panelId}
        style={{ visibility: "hidden", opacity: 0 }}
        className="absolute inset-x-3 top-[calc(var(--nav-tab-h)+0.5rem)] z-[1001] rounded-[1.75rem] bg-black p-2 text-white lg:hidden"
      >
        <nav aria-label="Primary (menu)">
          <ul className="flex flex-col gap-1">
            {items.map((item, i) => (
              <li key={item.href} className="overflow-hidden rounded-full">
                <a
                  href={item.href}
                  onClick={(event) => onNavigate(event, item.href)}
                  aria-current={i === active ? "true" : undefined}
                  data-menu-rise
                  className={`flex items-center gap-3 rounded-full px-5 py-3.5 transition-colors duration-300 ${
                    i === active ? "bg-[#3a3a3a] text-white" : "bg-[#161616] text-white/70 hover:text-white"
                  }`}
                >
                  <span className="font-mono text-[0.6875rem] tracking-[0.14em] text-white/40">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[1.5rem] leading-none font-bold tracking-[-0.02em] uppercase">
                    {item.label}
                  </span>
                  {i === active && (
                    <span
                      aria-hidden="true"
                      className="ml-auto size-1.5 rounded-full"
                      style={{ backgroundColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
                    />
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
