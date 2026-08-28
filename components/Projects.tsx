"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import AccordionGallery, { type AccordionGalleryItem } from "./AccordionGallery";
import ProjectDetail, { type DetailSource } from "./ProjectDetail";
import { PROJECTS } from "./projects-data";

/**
 * The projects section.
 *
 * The gallery is themed to the site's palette and left greyscale until a panel
 * opens. Clicking the open panel hands its element to `ProjectDetail`, which
 * animates the cover image out of that exact rect — so the detail view grows
 * from the thumbnail rather than appearing on top of it.
 *
 * Edit `projects-data.ts` to change what is shown; nothing here needs touching.
 */
export default function Projects() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [detail, setDetail] = useState<DetailSource | null>(null);

  const items = useMemo<AccordionGalleryItem[]>(
    () =>
      PROJECTS.map((p) => ({
        image: p.image,
        label: p.title,
        alt: p.alt,
        // Kept so each panel is a real <a> — Enter works, and it still means
        // something with JS off. `onSelect` suppresses the navigation itself.
        link: `#${p.id}`,
      })),
    []
  );

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const lines = headingRef.current?.querySelectorAll(".line-child");
      if (!lines?.length) return;

      gsap.fromTo(
        lines,
        { yPercent: 110 },
        {
          yPercent: 0,
          duration: 1.1,
          ease: "power4.out",
          stagger: 0.08,
          scrollTrigger: { trigger: headingRef.current, start: "top 85%" },
        }
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section className="section projects" id="projects" ref={sectionRef}>
      <div className="container-projects">
        <h2 className="h1-home" ref={headingRef}>
          <div className="line-mask-child-mask">
            <div className="line-child">Selected work.</div>
          </div>
        </h2>

        <div className="projects-gallery">
          <AccordionGallery
            items={items}
            defaultIndex={2}
            trigger="hover"
            accentColor="#ffffff"
            overlayColor="#000000"
            textColor="#ffffff"
            height={520}
            gap={12}
            radius={4}
            expandRatio={0.5}
            onSelect={(i, _item, el) => setDetail({ project: PROJECTS[i], el })}
          />
        </div>

        <p className="projects-hint">Click a project to read more.</p>
      </div>

      <ProjectDetail source={detail} onClose={() => setDetail(null)} />
    </section>
  );
}
