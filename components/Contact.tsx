"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import DecryptText from "./DecryptText";
import ScrambleLink from "./ScrambleLink";
import { CALL_HREF, CONTACT_EMAIL, SOCIALS, TIME_ZONE } from "@/lib/contact";

/* -------------------------------------------------------------------------- */
/*  Copy — everything you would want to edit lives here                        */
/* -------------------------------------------------------------------------- */

const CONTACT_LABEL = "(05) Contact";

/** One entry per line of the heading — they decrypt in this order. */
const CONTACT_TITLE = ["Have an idea?", "Let’s build it."];

const CONTACT_STATUS = "Open to new projects";

/**
 * The last screen before the footer, set in the loader's voice: corner
 * readouts in mono, a status line with the blinking amber dot, and one line of
 * type big enough to be the screen, decrypting letter by letter as it arrives.
 * Under it, the ways in — the address itself as the largest link on the page,
 * a call and an email as buttons, and the socials as an index.
 *
 * The graduated rule along the bottom is the loader's progress bar again, here
 * filled by the scroll through the section rather than by anything loading.
 */
export default function Contact() {
  const sectionRef = useRef<HTMLElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);

  /* --- the clock in the corner ------------------------------------------- */

  useEffect(() => {
    const el = timeRef.current;
    if (!el) return;

    // Rendered as a placeholder on the server and filled here: a time written
    // during the server render would be stale — and a hydration mismatch — by
    // the time the page reached anyone.
    const format = new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE.id,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const tick = () => {
      el.textContent = format.format(new Date());
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  /* --- the rule, filled by the scroll through the section ---------------- */

  useEffect(() => {
    const section = sectionRef.current;
    const fill = fillRef.current;
    if (!section || !fill) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.fromTo(
        fill,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "bottom bottom",
            scrub: true,
          },
        }
      );
    }, section);

    return () => ctx.revert();
  }, []);

  const mailto = `mailto:${CONTACT_EMAIL}`;

  return (
    <section className="section contact" id="contact" ref={sectionRef} aria-labelledby="contact-title">
      <div className="contact-row">
        <span className="contact-eyebrow">{CONTACT_LABEL}</span>
        <span className="contact-eyebrow">
          Local time{" "}
          <span className="contact-time" ref={timeRef}>
            --:--:--
          </span>{" "}
          {TIME_ZONE.label}
        </span>
      </div>

      <div className="contact-main">
        <p className="contact-status">
          <span className="contact-status__dot" aria-hidden="true" />
          <span className="contact-eyebrow">{CONTACT_STATUS}</span>
        </p>

        <DecryptText as="h2" id="contact-title" className="contact-title" lines={CONTACT_TITLE} />

        <ScrambleLink className="contact-email" href={mailto} label={CONTACT_EMAIL} />

        <div className="contact-cta">
          <ScrambleLink
            className="btn btn-solid"
            href={CALL_HREF}
            target="_blank"
            rel="noreferrer"
            label="Book a call"
          />
          <ScrambleLink className="btn btn-ghost" href={mailto} label="Send an email" />
        </div>
      </div>

      <div className="contact-foot">
        <ul className="contact-socials">
          {SOCIALS.map((social, i) => {
            const external = !social.href.startsWith("mailto:");
            return (
              <li key={social.label}>
                <a
                  className="contact-social"
                  href={social.href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noreferrer" : undefined}
                >
                  <span className="contact-social__n">{String(i + 1).padStart(2, "0")}</span>
                  <span className="contact-social__label">{social.label}</span>
                  <span className="contact-social__arrow" aria-hidden="true">
                    ↗
                  </span>
                </a>
              </li>
            );
          })}
        </ul>

        <div className="contact-rule" aria-hidden="true">
          <span ref={fillRef} />
        </div>
      </div>
    </section>
  );
}
