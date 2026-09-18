import type { LogoKey } from "./logoPaths";

/**
 * The sequence the particle field morphs through, in scroll order.
 *
 * This array is the only thing that decides how many logos there are. The
 * scroll timeline is derived from its length (`timeline.ts`), the shape texture
 * is sized from it (`shapes.ts`), and the section renders one giant name and
 * one list item per entry — so adding a seventh technology is: paste a path
 * into `logoPaths.ts`, add a line here, done. Nothing in the engine counts the
 * entries for itself.
 *
 * `level` and `blurb` are the copy the section's spoken list carries. They are
 * first drafts written to fit the design, not a survey of anyone's actual CV —
 * read them and make them yours before this goes anywhere public.
 */
export interface Technology {
  /** Stable id — also the React key for the label stack. */
  id: string;
  /** The name, set huge behind the mark while this logo is assembled. */
  name: string;
  /** The line under it. */
  subtitle: string;
  /** Which silhouette in `LOGO_PATHS` the particles form. */
  logo: LogoKey;
  /**
   * The colour the name is set in behind the mark — the technology's own, so
   * the section changes temperature as it moves through the stack rather than
   * repeating one accent the whole way down.
   *
   * These are brand hexes, adjusted wherever the true one disappears against
   * what is actually behind it. Two things eat a colour here: the white page,
   * which swallows React's own #61DAFB, and the mark itself, which is near-
   * black ink and swallows any wordmark of the same value. That is the whole
   * reason Next.js is set in the violet from its own docs gradient rather than
   * in its black, why version control takes Git's orange rather than GitHub's
   * near-black, and why Express — whose brand colour is flatly #000 — takes the
   * Node green of the runtime it sits on. All three would otherwise read as a
   * smudge behind their own logo.
   *
   * The word is decoration — the real list is the `sr-only` one — but it is
   * the only place the name is written on screen, so it has to survive the
   * ground it is on.
   */
  color: string;
  /** Proficiency, read out by the section's list and its no-WebGL fallback. */
  level: SkillLevel;
  /** A sentence or two on the skill and where you are with it. */
  blurb: string;
}

/**
 * The four rungs a proficiency may sit on.
 *
 * A closed set rather than free text, so the levels stay comparable across the
 * stack and anything that wants to draw one — a meter, a sort, a filter — has
 * an order to read them in.
 */
export const LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"] as const;

export type SkillLevel = (typeof LEVELS)[number];

export const TECHNOLOGIES: Technology[] = [
  {
    id: "react",
    name: "React",
    subtitle: "Frontend Development",
    logo: "react",
    color: "#149eca",
    level: "Advanced",
    blurb:
      "At home in hooks, context and suspense, and past the point of fighting re-renders — most of the work now is deciding which state should not exist in the first place.",
  },
  {
    id: "next",
    name: "Next.js",
    subtitle: "Full-Stack Development",
    logo: "next",
    color: "#7928ca",
    level: "Advanced",
    blurb:
      "App Router, server components and streaming. My default when a project needs a rendered page and the API that feeds it to live in one place.",
  },
  {
    id: "python",
    name: "Python",
    subtitle: "Backend & Automation",
    logo: "python",
    color: "#3776ab",
    level: "Intermediate",
    blurb:
      "Scripting, data wrangling and small services. Fluent in the standard library and the everyday toolchain; the deeper async and packaging corners still send me to the docs.",
  },
  {
    id: "github",
    name: "GitHub",
    subtitle: "Version Control",
    logo: "github",
    color: "#f05032",
    level: "Advanced",
    blurb:
      "Branching strategy, review flow and Actions. Comfortable unpicking a bad merge by hand and wiring CI that fails for the right reasons rather than the loud ones.",
  },
  {
    id: "docker",
    name: "Docker",
    subtitle: "Containerization",
    logo: "docker",
    color: "#1d78c1",
    level: "Intermediate",
    blurb:
      "Multi-stage builds and Compose for local stacks. Confident shipping a service in a container; image hardening and orchestration are where I am still building depth.",
  },
  {
    id: "express",
    name: "Express",
    subtitle: "APIs & Services",
    logo: "express",
    // Node's green, not Express's own #000 — see the note on `color` above.
    color: "#5fa04e",
    level: "Intermediate",
    blurb:
      "Routing, middleware order and error handling. Long past learning that middleware is a stack, and that where a handler sits in it is most of what it actually does.",
  },
  {
    id: "fastapi",
    name: "FastAPI",
    subtitle: "Typed Python APIs",
    logo: "fastapi",
    color: "#009688",
    level: "Intermediate",
    blurb:
      "Pydantic models, dependency injection and async endpoints, with the OpenAPI schema falling out of the type hints for free. Background work is where I am still building depth.",
  },
];
