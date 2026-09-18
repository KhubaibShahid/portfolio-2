import About from "@/components/About";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import Loader from "@/components/Loader";
import Navbar from "@/components/Navbar";
import ShowcaseSection from "@/components/ShowcaseSection";
import TechStack from "@/components/TechStack";
import { CALL_HREF } from "@/lib/contact";

const NAV_ITEMS = [
  { label: "Home", href: "#top" },
  { label: "About", href: "#about" },
  { label: "Stack", href: "#tech" },
  { label: "Work", href: "#work" },
  { label: "Contact", href: "#contact" },
];

const NAV_CTA = { label: "Let’s talk", href: CALL_HREF, external: true };

export default function Home() {
  return (
    <>
      <Loader />
      {/* Held for the loader's handoff, and timed to land as its slats clear
          the top of the screen — the last strip of the page they uncover. */}
      <Navbar
        logo={
          <>
            {/* The mark is black on white; inverted, its black ground vanishes
                under the link's difference blend and only the K inverts. The
                name beside it steps out between `lg` and `xl`, where the full
                links pill reaches across to where it would sit. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-white.png" alt="" className="size-10 object-contain invert" draggable={false} />
            <span aria-hidden="true" className="hidden h-7 w-px bg-white sm:block lg:hidden xl:block" />
            <span className="hidden font-mono text-[0.6875rem] leading-[1.4] tracking-[0.14em] uppercase sm:block lg:hidden xl:block">
              Khubaib Shahid
              <br />
              Portfolio — 2026
            </span>
          </>
        }
        logoLabel="Khubaib Shahid — back to top"
        items={NAV_ITEMS}
        cta={NAV_CTA}
        revealEvent="loader:hero-reveal-start"
        revealDelay={1.1}
      />
      <main>
        <Hero />
        <About />
        <TechStack />
        <ShowcaseSection />
        <Contact />
      </main>
      <Footer items={NAV_ITEMS} />
    </>
  );
}
