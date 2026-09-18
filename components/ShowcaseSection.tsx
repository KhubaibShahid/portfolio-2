"use client";

import { useEffect, useRef } from "react";
import { useLenis } from "./SmoothScroll";

/** The route that renders `<PortfolioShowcase />` under its own root layout. */
const SHOWCASE_SRC = "/showcase";

/**
 * The portfolio slider, as a section of the home page.
 *
 * `<PortfolioShowcase />` cannot be dropped into this page directly. It is a
 * whole page of another site's theme: its CSS styles `html`, `body` and every
 * link, its scripts write their state onto `<html>`, pin their own header,
 * cursor and WebGL canvas to the viewport, and take the wheel for the entire
 * document. Mounted inline it would restyle the site around it and stop the
 * page scrolling. So it runs where it already runs unchanged — its own route —
 * and this frames that route: the same component, in a document of its own.
 *
 * The one thing the frame changes is the wheel. Over the slider, the theme
 * turns every wheel event into slider movement, which inside a page would trap
 * the reader: a full-screen section that eats the wheel is a section nobody can
 * scroll past. So vertical wheel intent is handed back to this page, through
 * Lenis like any other scroll; horizontal intent — a trackpad swipe sideways —
 * stays with the slider, and so does dragging.
 */
export default function ShowcaseSection() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const lenis = useLenis();

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    let detach: (() => void) | null = null;

    const attach = () => {
      detach?.();
      // Same origin, so the frame's window is reachable directly.
      const inner = frame.contentWindow;
      if (!inner) return;

      // Events this handler dispatched into the frame itself, to let through.
      const handedOver = new WeakSet<Event>();

      const onWheel = (event: WheelEvent) => {
        if (handedOver.has(event)) return;

        // Capture phase on the frame's window runs ahead of every listener the
        // theme has, so the slider never sees the original.
        event.preventDefault();
        event.stopImmediatePropagation();

        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
          // Replayed on this window, where Lenis listens, so the page moves
          // with the same smoothing and multiplier as a wheel anywhere else.
          if (lenis) {
            window.dispatchEvent(
              new WheelEvent("wheel", {
                deltaY: event.deltaY,
                deltaMode: event.deltaMode,
                cancelable: true,
              })
            );
          } else {
            window.scrollBy(0, event.deltaY);
          }
          return;
        }

        // Sideways. The theme only reads the vertical axis — a real sideways
        // swipe barely moves it, even on its own page — so hand the slider the
        // vertical wheel it listens for, at the element under the pointer.
        // Built from the frame's own constructor, so it is a WheelEvent there.
        const InnerWheelEvent = (inner as Window & typeof globalThis).WheelEvent;
        const forward = new InnerWheelEvent("wheel", {
          deltaY: event.deltaX,
          deltaMode: event.deltaMode,
          clientX: event.clientX,
          clientY: event.clientY,
          bubbles: true,
          cancelable: true,
        });
        handedOver.add(forward);
        (event.target ?? inner.document.body).dispatchEvent(forward);
      };

      // Chrome still fires the legacy `mousewheel` twin of every wheel, and the
      // theme listens for that too; the `wheel` handler above has already
      // decided where this movement goes.
      const onMouseWheel = (event: Event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };

      // Touch has no wheel to forward, and doesn't need one: the theme's mobile
      // slider only moves on sideways swipes, and a vertical swipe the frame
      // cannot scroll chains on to this page natively, momentum and all —
      // unless overscroll is switched off, which the theme does on `html` and
      // `body` to stop the rubber band on its own page. Framed, that setting
      // is what would pin a thumb to the slider.
      for (const el of [inner.document.documentElement, inner.document.body]) {
        el.style.overscrollBehaviorY = "auto";
      }

      inner.addEventListener("wheel", onWheel, { capture: true, passive: false });
      inner.addEventListener("mousewheel", onMouseWheel, { capture: true, passive: false });
      detach = () => {
        inner.removeEventListener("wheel", onWheel, { capture: true });
        inner.removeEventListener("mousewheel", onMouseWheel, { capture: true });
      };
    };

    // The frame's window is replaced when its document loads; listen on the
    // real one, and catch a frame that finished loading before this ran.
    frame.addEventListener("load", attach);
    if (frame.contentDocument?.readyState === "complete") attach();

    return () => {
      frame.removeEventListener("load", attach);
      detach?.();
    };
  }, [lenis]);

  return (
    <section className="section showcase" id="work" aria-label="Selected work">
      <iframe
        ref={frameRef}
        className="showcase-frame"
        src={SHOWCASE_SRC}
        title="Selected work"
        // A second WebGL page is not free; nothing starts until the reader is
        // on the way down to it.
        loading="lazy"
      />
    </section>
  );
}
