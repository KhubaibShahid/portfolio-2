"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { useLenis } from "./SmoothScroll";
import ScrambleLink from "./ScrambleLink";
import type { Project } from "./projects-data";

/** Where the media animates out of, and back into, on close. */
export interface DetailSource {
  project: Project;
  el: HTMLElement | null;
}

interface ProjectDetailProps {
  source: DetailSource | null;
  onClose: () => void;
}

const OPEN_DURATION = 0.72;
const CLOSE_DURATION = 0.5;
const EASE = "power4.inOut";

/** Below this the split is stacked, so the panel slides up instead of across. */
const STACK_QUERY = "(max-width: 991px)";

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * How long to wait for the cover image to decode before starting anyway. A
 * cached image resolves in well under this; the cap just stops a slow network
 * from making the click feel dead.
 */
const DECODE_BUDGET = 140;

/**
 * The opening state has to be in place before the browser paints, or the panel
 * shows for one frame at its final size and then jumps back to the thumbnail.
 * `useEffect` runs after paint, so that has to be a layout effect — guarded
 * because it would warn during SSR.
 */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Measure with the given elements' own transforms suspended.
 *
 * Needed because closing mid-open leaves the media and its image part-way
 * through the grow — measuring then would feed the animation its own output.
 * Nothing is written when there is no transform to suspend, so the common path
 * costs no extra reflow.
 */
function measureUntransformed<T>(els: (HTMLElement | null)[], measure: () => T): T {
  const touched: [HTMLElement, string][] = [];
  for (const el of els) {
    const prev = el?.style.transform;
    if (el && prev && prev !== "none") {
      touched.push([el, prev]);
      el.style.transform = "none";
    }
  }
  const out = measure();
  for (const [el, prev] of touched) el.style.transform = prev;
  return out;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where an `object-fit: cover` image actually paints, which is bigger than its
 * box — the overflow is what gets clipped away.
 *
 * This matters because the gallery deliberately over-sizes its media (that is
 * what gives it the parallax drift), so a panel and the detail view show
 * genuinely different crops of the same file. Matching them means matching
 * these rects, not the element boxes.
 */
function paintedRect(img: HTMLImageElement): Rect | null {
  const box = img.getBoundingClientRect();
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh || !box.width || !box.height) return null;
  const scale = Math.max(box.width / nw, box.height / nh);
  const width = nw * scale;
  const height = nh * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}

interface GrowGeometry {
  /** Container: its resting rect mapped onto the thumbnail. */
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  toX: number;
  toY: number;
  /** Painted image rect on screen, in the panel and at rest. */
  p0: Rect | null;
  p1: Rect | null;
}

/**
 * The media element keeps its final layout size the whole time and is only ever
 * transformed. Its first version tweened `top/left/width/height`, which reads
 * the same but re-rasters a full-bleed cover image on the main thread every
 * frame. Transforms composite instead, so nothing repaints.
 */
function growGeometry(from: DOMRect, to: DOMRect, p0: Rect | null, p1: Rect | null): GrowGeometry {
  return {
    dx: from.left - to.left,
    dy: from.top - to.top,
    sx: to.width ? from.width / to.width : 1,
    sy: to.height ? from.height / to.height : 1,
    toX: to.left,
    toY: to.top,
    p0,
    p1,
  };
}

interface GrowTargets {
  media: HTMLElement;
  img: Element | null;
  scrim: Element | null;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Resize the image's box to equal its painted rect, once, before animating.
 *
 * `object-fit: cover` crops to the element's box, so scaling the element also
 * shrinks the window onto the picture — the image ends up letterboxed inside
 * its own container instead of filling it. Giving the box the painted rect's
 * dimensions makes the two the same thing, leaving the container's
 * `overflow: hidden` as the only thing doing any cropping. The box now matches
 * the file's aspect ratio, so `object-fit` no longer has anything to do.
 *
 * Cleared again once the animation settles, handing the resting layout back to
 * the stylesheet so a resize while open still lands correctly.
 */
function unclipImage(img: Element | null, g: GrowGeometry) {
  if (!img || !g.p1) return;
  // Pinned at the container's origin: every offset is carried by the transform,
  // so there is only one place the position can come from.
  gsap.set(img, { left: 0, top: 0, width: g.p1.width, height: g.p1.height });
}

/**
 * `p` runs 0 (sitting exactly on the thumbnail) to 1 (open).
 *
 * The container carries a non-uniform scale, because the thumbnail and the open
 * panel are different shapes. The image inside is given the exact inverse of
 * that scale, times the uniform factor that carries its painted rect from the
 * one the gallery shows to the one the detail shows. Both painted rects are
 * cover fits of the same file, so they share an aspect ratio and that factor is
 * uniform — the picture is never stretched, only re-framed.
 */
function applyGrow({ media, img, scrim }: GrowTargets, g: GrowGeometry, p: number) {
  const cx = g.sx + (1 - g.sx) * p;
  const cy = g.sy + (1 - g.sy) * p;
  const tx = g.dx * (1 - p);
  const ty = g.dy * (1 - p);

  gsap.set(media, { x: tx, y: ty, scaleX: cx, scaleY: cy, transformOrigin: "top left" });

  /*
   * Carries the gallery panel's caption gradient at p = 0 and clears by p = 1.
   * At the start of the transition this sits exactly over the panel it grew
   * from, so without it the picture jumps brighter the instant you click — the
   * panel is darkened for caption legibility and the detail view is not. It
   * scales with the container, so the gradient maps onto the panel's footprint.
   */
  if (scrim) gsap.set(scrim, { opacity: 1 - p });

  if (!img) return;

  if (!g.p0 || !g.p1) {
    // No painted rects to match: just undo the container's squash.
    gsap.set(img, { scaleX: 1 / cx, scaleY: 1 / cy, x: 0, y: 0, transformOrigin: "top left" });
    return;
  }

  // Where the painted image should sit on screen at this point in the morph.
  const lx = lerp(g.p0.x, g.p1.x, p);
  const ly = lerp(g.p0.y, g.p1.y, p);
  const lw = lerp(g.p0.width, g.p1.width, p);
  const lh = lerp(g.p0.height, g.p1.height, p);

  // Solve for the local transform that lands it there through the container.
  gsap.set(img, {
    scaleX: lw / (g.p1.width * cx),
    scaleY: lh / (g.p1.height * cy),
    x: (lx - g.toX - tx) / cx,
    y: (ly - g.toY - ty) / cy,
    transformOrigin: "top left",
  });
}

export default function ProjectDetail({ source, onClose }: ProjectDetailProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  /** Set while the exit is running, so a second close cannot start another. */
  const closingRef = useRef(false);
  /** Read once per open — the rect the media flies out of and back into. */
  const sourceElRef = useRef<HTMLElement | null>(null);
  const lenis = useLenis();

  const project = source?.project ?? null;
  const projectId = project?.id ?? null;

  sourceElRef.current = source?.el ?? null;

  /* --- open ------------------------------------------------------------- */
  useIsomorphicLayoutEffect(() => {
    if (!projectId) return;

    const media = mediaRef.current;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!media || !panel || !backdrop) return;

    closingRef.current = false;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stacked = window.matchMedia(STACK_QUERY).matches;
    const dur = reduced ? 0 : OPEN_DURATION;

    // Hold the page still underneath.
    lenis?.stop();
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";

    /*
     * `.nav-boiler` is fixed, full width, and `mix-blend-mode: difference`, so
     * the compositor re-reads the backdrop under it on every frame it produces.
     * It is behind this dialog and unreachable anyway, so take it out of the
     * frame while the dialog is up.
     */
    document.body.classList.add("detail-open");

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const img = media.querySelector("img");
    const targets: GrowTargets = { media, img, scrim: media.querySelector(".project-detail__scrim") };
    const sourceEl = sourceElRef.current;
    const { to, p1 } = measureUntransformed([media, img as HTMLElement | null], () => ({
      to: media.getBoundingClientRect(),
      p1: img ? paintedRect(img as HTMLImageElement) : null,
    }));
    // The panel's own transforms are how it really sits, so measure it live.
    const panelImg = sourceEl?.querySelector("img") ?? null;
    const p0 = panelImg ? paintedRect(panelImg) : null;
    const from = sourceEl?.getBoundingClientRect() ?? null;
    const grows = !!from && from.width > 0 && to.width > 0;
    const geo = grows && from ? growGeometry(from, to, p0, p1) : null;
    const rises = panel.querySelectorAll("[data-detail-rise]");

    // Opening state, applied in this same frame so nothing flashes.
    gsap.set(backdrop, { opacity: 0 });
    gsap.set(panel, stacked ? { yPercent: 100 } : { xPercent: 100 });
    gsap.set(rises, { y: 22, opacity: 0 });
    if (geo) {
      unclipImage(img, geo);
      applyGrow(targets, geo, 0);
    } else {
      gsap.set(media, { opacity: 0 });
      if (targets.scrim) gsap.set(targets.scrim, { opacity: 0 });
    }

    let cancelled = false;

    const play = () => {
      if (cancelled) return;

      const tl = gsap.timeline({
        onComplete: () => {
          // Hand the element back to CSS, so a resize while open still lands.
          gsap.set(media, { clearProps: "transform" });
          if (img) gsap.set(img, { clearProps: "transform,left,top,width,height" });
          closeRef.current?.focus({ preventScroll: true });
        },
      });

      tl.to(backdrop, { opacity: 1, duration: dur * 0.5, ease: "power2.out" }, 0);

      if (geo) {
        const state = { p: 0 };
        tl.to(
          state,
          {
            p: 1,
            duration: dur,
            ease: EASE,
            onUpdate: () => applyGrow(targets, geo, state.p),
          },
          0
        );
      } else {
        tl.to(media, { opacity: 1, duration: dur, ease: EASE }, 0);
      }

      tl.to(
        panel,
        stacked
          ? { yPercent: 0, duration: dur, ease: EASE }
          : { xPercent: 0, duration: dur, ease: EASE },
        0
      );

      tl.to(
        rises,
        { y: 0, opacity: 1, duration: reduced ? 0 : 0.6, ease: "power3.out", stagger: 0.06 },
        dur * 0.55
      );

      tlRef.current = tl;
    };

    /*
     * Decode first. This <img> is new to the document even when the bytes are
     * cached, and paying for the decode mid-transition costs frames. Waiting
     * here moves it to before the motion starts, where it reads as part of the
     * click rather than as a stutter.
     */
    /*
     * Then give the compositor a frame to actually raster the new layers at
     * their starting state. Creating them is the single most expensive thing
     * that happens here, and left until the tween starts it eats the opening
     * frames — the part of the motion the eye is most likely to catch.
     */
    const playWhenComposited = () => {
      requestAnimationFrame(() => requestAnimationFrame(play));
    };

    if (img) {
      let settled = false;
      const go = () => {
        if (settled) return;
        settled = true;
        playWhenComposited();
      };
      img.decode().then(go, go);
      window.setTimeout(go, DECODE_BUDGET);
    } else {
      playWhenComposited();
    }

    return () => {
      cancelled = true;
      tlRef.current?.kill();
      tlRef.current = null;
      html.style.overflow = prevOverflow;
      document.body.classList.remove("detail-open");
      lenis?.start();
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [projectId, lenis]);

  /* --- close ------------------------------------------------------------ */
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;

    const media = mediaRef.current;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!media || !panel || !backdrop) {
      onClose();
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stacked = window.matchMedia(STACK_QUERY).matches;
    const dur = reduced ? 0 : CLOSE_DURATION;

    tlRef.current?.kill();

    const img = media.querySelector("img");
    const targets: GrowTargets = { media, img, scrim: media.querySelector(".project-detail__scrim") };
    const { to, p1 } = measureUntransformed([media, img as HTMLElement | null], () => ({
      to: media.getBoundingClientRect(),
      p1: img ? paintedRect(img as HTMLImageElement) : null,
    }));
    // Re-measured, not reused: the gallery may have resized since it opened.
    const sourceEl = sourceElRef.current;
    const panelImg = sourceEl?.querySelector("img") ?? null;
    const p0 = panelImg ? paintedRect(panelImg) : null;
    const back = sourceEl?.getBoundingClientRect() ?? null;
    const geo = back && back.width > 0 && to.width > 0 ? growGeometry(back, to, p0, p1) : null;

    if (geo) unclipImage(img, geo);

    const tl = gsap.timeline({ onComplete: onClose });

    tl.to(
      panel,
      stacked
        ? { yPercent: 100, duration: dur, ease: EASE }
        : { xPercent: 100, duration: dur, ease: EASE },
      0
    );

    if (geo) {
      const state = { p: 1 };
      tl.to(
        state,
        {
          p: 0,
          duration: dur,
          ease: EASE,
          onUpdate: () => applyGrow(targets, geo, state.p),
        },
        0
      );
    } else {
      tl.to(media, { opacity: 0, duration: dur, ease: EASE }, 0);
    }

    tl.to(backdrop, { opacity: 0, duration: dur * 0.8, ease: "power2.in" }, dur * 0.2);

    tlRef.current = tl;
  }, [onClose]);

  /* --- escape, and keeping Tab inside the dialog ------------------------ */
  useEffect(() => {
    if (!projectId) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
        return;
      }
      if (e.key !== "Tab") return;

      // `aria-modal` promises the rest of the page is inert, so honour it.
      const panel = panelRef.current;
      if (!panel) return;
      const targets = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null
      );
      if (!targets.length) return;

      const first = targets[0];
      const last = targets[targets.length - 1];
      const activeEl = document.activeElement;

      if (e.shiftKey && (activeEl === first || !panel.contains(activeEl))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (activeEl === last || !panel.contains(activeEl))) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [projectId, requestClose]);

  if (!project) return null;

  const headingId = `${project.id}-title`;

  return createPortal(
    <div className="project-detail" role="dialog" aria-modal="true" aria-labelledby={headingId}>
      <div className="project-detail__backdrop" ref={backdropRef} onClick={requestClose} />

      <div className="project-detail__media" ref={mediaRef}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={project.image} alt={project.alt || project.title} draggable="false" />
        <span className="project-detail__scrim" aria-hidden="true" />
      </div>

      <div className="project-detail__panel" ref={panelRef}>
        <button
          type="button"
          className="project-detail__close"
          onClick={requestClose}
          ref={closeRef}
          aria-label="Close project details"
        >
          <span aria-hidden="true">Close</span>
          <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>

        <div className="project-detail__body">
          {(project.year || project.role) && (
            <p className="project-detail__meta" data-detail-rise>
              {[project.year, project.role].filter(Boolean).join(" — ")}
            </p>
          )}

          <h3 className="project-detail__title" id={headingId} data-detail-rise>
            {project.title}
          </h3>

          <p className="project-detail__desc" data-detail-rise>
            {project.description}
          </p>

          {project.tags && project.tags.length > 0 && (
            <ul className="project-detail__tags" data-detail-rise>
              {project.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          )}

          {project.links && project.links.length > 0 && (
            <div className="project-detail__links" data-detail-rise>
              {project.links.map((link) => (
                <ScrambleLink
                  key={link.label}
                  className="btn btn-solid"
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  label={link.label}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
