"use client";

import { useRef, useEffect, useState, useCallback, type CSSProperties } from "react";
import { gsap } from "gsap";

import "./AccordionGallery.css";

/**
 * AccordionGallery — from React Bits (reactbits.dev), ported to TypeScript.
 *
 * A row of image panels where one is expanded at a time. GSAP drives the
 * `flex-grow` of every panel plus a little 3D tilt, an internal parallax drift
 * and the caption reveal, all from one timeline so they stay in step.
 *
 * Changes from the published JS source, all forced by this codebase:
 *   - typed props and refs (the project builds with `strict`)
 *   - ref callbacks use block bodies — React 19 treats a returned value as a
 *     cleanup function, and `ref={el => (arr[i] = el)}` returns the element
 *   - the panel renders as an explicit `<a>` or `<div>` rather than a dynamic
 *     `Tag`, so the element keeps its real type
 *   - custom properties in `style` are cast, since `CSSProperties` has no
 *     index signature
 */

export interface AccordionGalleryItem {
  image: string;
  label?: string;
  link?: string;
  alt?: string;
}

export interface AccordionGalleryProps {
  items?: AccordionGalleryItem[];
  /** Panel expanded on load, so the gallery never looks dead. */
  defaultIndex?: number;
  accentColor?: string;
  overlayColor?: string;
  textColor?: string;
  /** Row height in px (column width when vertical). */
  height?: number;
  gap?: number;
  radius?: number;
  /** Fraction of the row the expanded panel takes, clamped to 0.2–0.9. */
  expandRatio?: number;
  orientation?: "horizontal" | "vertical";
  duration?: number;
  ease?: string;
  /** Strength of the internal image drift as panels resize; 0 disables it. */
  parallax?: number;
  /** Degrees of 3D rotation on collapsed panels, easing to flat on the open one. */
  tilt?: number;
  stagger?: number;
  /** How a panel expands on pointer devices. Focus and tap always expand too. */
  trigger?: "hover" | "click";
  showLabels?: boolean;
  grayscale?: boolean;
  className?: string;
  /**
   * Added for this project (not in the published component).
   *
   * Fires when an already-expanded panel is activated — clicked, tapped a
   * second time, or Enter/Space while focused. That is the gesture that means
   * "open this one" rather than "look at this one", so it is what drives the
   * project detail view. `el` is the panel element, so the caller can measure
   * it and animate out of it.
   *
   * Providing this suppresses the panel's own link navigation.
   */
  onSelect?: (index: number, item: AccordionGalleryItem, el: HTMLElement | null) => void;
}

const DEFAULT_ITEMS: AccordionGalleryItem[] = [
  { image: "https://picsum.photos/id/1015/900/1200", label: "Canyon", link: "#" },
  { image: "https://picsum.photos/id/1018/900/1200", label: "Ridgeline", link: "#" },
  { image: "https://picsum.photos/id/1039/900/1200", label: "Falls", link: "#" },
  { image: "https://picsum.photos/id/1043/900/1200", label: "Harbour", link: "#" },
  { image: "https://picsum.photos/id/1044/900/1200", label: "Skyline", link: "#" },
];

export default function AccordionGallery({
  items = DEFAULT_ITEMS,
  defaultIndex = 2,
  accentColor = "#ffffff",
  overlayColor = "#060010",
  textColor = "#ffffff",
  height = 460,
  gap = 10,
  radius = 16,
  expandRatio = 0.52,
  orientation = "horizontal",
  duration = 0.6,
  ease = "power3.out",
  parallax = 0.5,
  tilt = 8,
  stagger = 0.06,
  trigger = "hover",
  showLabels = true,
  grayscale = true,
  className = "",
  onSelect,
}: AccordionGalleryProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLElement | null)[]>([]);
  const mediaRefs = useRef<(HTMLElement | null)[]>([]);
  const barRefs = useRef<(HTMLElement | null)[]>([]);
  const textRefs = useRef<(HTMLElement | null)[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const firstRunRef = useRef(true);
  const mediaSizeRef = useRef(320);

  const vertical = orientation === "vertical";
  const count = items.length;
  const [active, setActive] = useState(Math.min(Math.max(defaultIndex, 0), count - 1));

  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const applyLayout = useCallback(
    (animate: boolean) => {
      const panels = panelRefs.current;
      if (!panels.length) return;

      const r = Math.min(Math.max(expandRatio, 0.2), 0.9);
      const grow = count > 1 ? (r * (count - 1)) / (1 - r) : 1;
      const mediaSize = mediaSizeRef.current;

      tlRef.current?.kill();
      const dur = animate && !prefersReduced ? duration : 0;
      const tl = gsap.timeline();

      panels.forEach((panel, i) => {
        if (!panel) return;
        const isActive = i === active;
        const media = mediaRefs.current[i];
        const bar = barRefs.current[i];
        const text = textRefs.current[i];

        const rot = isActive ? 0 : i < active ? tilt : -tilt;
        const rotProp = vertical ? { rotateX: -rot } : { rotateY: rot };

        // `--ag-dim` goes on the panel: the overlay that reads it is a sibling
        // of the media, so setting it there would never reach the overlay.
        tl.to(
          panel,
          {
            flexGrow: isActive ? grow : 1,
            ...rotProp,
            "--ag-dim": isActive ? 0 : 0.35,
            duration: dur,
            ease,
          },
          0
        );

        if (media) {
          const drift = Math.max(-1.5, Math.min(1.5, active - i));
          const shift = drift * parallax * mediaSize * 0.06;
          const gray = grayscale ? (isActive ? 0 : 1) : 0;
          tl.to(
            media,
            {
              xPercent: -50,
              yPercent: -50,
              x: vertical ? 0 : isActive ? 0 : shift,
              y: vertical ? (isActive ? 0 : shift) : 0,
              "--ag-gray": gray,
              duration: dur,
              ease,
            },
            0
          );
        }

        if (showLabels && bar && text) {
          if (isActive) {
            tl.to(
              [bar, text],
              { opacity: 1, x: 0, duration: dur, ease, stagger: prefersReduced ? 0 : stagger },
              0
            );
          } else {
            tl.to([bar, text], { opacity: 0, x: -14, duration: dur * 0.6, ease }, 0);
          }
        }
      });

      tlRef.current = tl;
    },
    [
      active,
      count,
      expandRatio,
      duration,
      ease,
      vertical,
      tilt,
      parallax,
      grayscale,
      showLabels,
      stagger,
      prefersReduced,
    ]
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const total = vertical ? rect.height : rect.width;
      const usable = Math.max(total - gap * (count - 1), 120);
      const size = Math.max(140, usable * Math.min(Math.max(expandRatio, 0.2), 0.9) * 1.22);
      mediaSizeRef.current = size;
      el.style.setProperty("--ag-media-size", `${size}px`);
      applyLayout(!firstRunRef.current);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [applyLayout, gap, count, expandRatio, vertical]);

  useEffect(() => {
    applyLayout(!firstRunRef.current);
    firstRunRef.current = false;
  }, [applyLayout]);

  useEffect(
    () => () => {
      tlRef.current?.kill();
    },
    []
  );

  const handleEnter = (i: number) => {
    if (trigger === "hover") setActive(i);
  };

  const handleClick = (i: number, e: React.MouseEvent) => {
    // First interaction expands the panel; a second one opens it. With
    // `trigger="hover"` the pointer has already expanded it, so on a mouse the
    // very first click opens — on touch it takes the expected two taps.
    if (i !== active) {
      e.preventDefault();
      setActive(i);
      return;
    }
    if (onSelect) {
      e.preventDefault();
      onSelect(i, items[i], panelRefs.current[i]);
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i + 1) % count);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i - 1 + count) % count);
    } else if (onSelect && (e.key === "Enter" || e.key === " ")) {
      // A `<div>` panel gets no click from Enter, and neither gets one from
      // Space, so open from the key event directly.
      e.preventDefault();
      setActive(i);
      onSelect(i, items[i], panelRefs.current[i]);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`accordion-gallery${vertical ? " accordion-gallery--vertical" : ""}${
        className ? ` ${className}` : ""
      }`}
      style={
        {
          "--ag-accent": accentColor,
          "--ag-overlay": overlayColor,
          "--ag-text": textColor,
          "--ag-gap": `${gap}px`,
          "--ag-radius": `${radius}px`,
          height: vertical ? `${Math.round(height * 1.6)}px` : `${height}px`,
        } as CSSProperties
      }
      role="list"
      aria-label="Image accordion gallery"
    >
      {items.map((item, i) => {
        const isActive = i === active;

        const panelProps = {
          ref: (el: HTMLElement | null) => {
            panelRefs.current[i] = el;
          },
          className: `ag-panel${isActive ? " ag-panel--active" : ""}`,
          style: { borderRadius: `${radius}px` },
          onClick: (e: React.MouseEvent) => handleClick(i, e),
          onMouseEnter: () => handleEnter(i),
          onFocus: () => setActive(i),
          onKeyDown: (e: React.KeyboardEvent) => handleKeyDown(i, e),
          role: "listitem",
          tabIndex: 0,
          "aria-current": isActive ? ("true" as const) : undefined,
          "aria-label": item.label,
        };

        const body = (
          <>
            <span className="ag-panel__frame">
              <span
                className="ag-panel__media"
                ref={(el) => {
                  mediaRefs.current[i] = el;
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image} alt={item.alt || item.label || ""} draggable="false" />
              </span>
              <span className="ag-panel__overlay" aria-hidden="true" />
            </span>
            {showLabels && (
              <span className="ag-panel__label" aria-hidden="true">
                <span
                  className="ag-panel__bar"
                  ref={(el) => {
                    barRefs.current[i] = el;
                  }}
                />
                <span
                  className="ag-panel__text"
                  ref={(el) => {
                    textRefs.current[i] = el;
                  }}
                >
                  {item.label}
                </span>
              </span>
            )}
          </>
        );

        return item.link ? (
          <a key={i} {...panelProps} href={item.link}>
            {body}
          </a>
        ) : (
          <div key={i} {...panelProps}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
