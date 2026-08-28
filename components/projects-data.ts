/* -------------------------------------------------------------------------- */
/*  Your projects — this file is the only one you need to edit                 */
/* -------------------------------------------------------------------------- */

export interface ProjectLink {
  label: string;
  href: string;
}

export interface Project {
  /** Stable key. Also used as the detail dialog's element id. */
  id: string;
  /** Cover shot, shown in the gallery and blown up in the detail view. */
  image: string;
  alt?: string;
  title: string;
  year?: string;
  role?: string;
  /** Shown in the panel that slides in. Write as many sentences as you like. */
  description: string;
  tags?: string[];
  links?: ProjectLink[];
}

/**
 * The images are placeholders from picsum.photos. Drop your own screenshots in
 * `/public/projects/` and point `image` at `/projects/<file>` — nothing else
 * needs to change, and it stops the section depending on a third-party host.
 *
 * Everything below the image is what appears in the sliding detail panel, so
 * each project carries its own heading, copy and links.
 */
export const PROJECTS: Project[] = [
  {
    id: "project-one",
    image: "https://picsum.photos/id/180/1600/1200",
    alt: "Project One cover",
    title: "Project One",
    year: "2025",
    role: "Design & build",
    description:
      "A short paragraph about what this project is, the problem it solves and who it was for. Two or three sentences is usually enough here — the reader is scanning, and the links below are what they came for.",
    tags: ["Next.js", "TypeScript", "Postgres"],
    links: [
      { label: "Live site", href: "#" },
      { label: "Source", href: "#" },
    ],
  },
  {
    id: "project-two",
    image: "https://picsum.photos/id/0/1600/1200",
    alt: "Project Two cover",
    title: "Project Two",
    year: "2025",
    role: "Full stack",
    description:
      "What you built, what it runs on, and the one detail you are actually proud of. Mention the constraint that made it interesting — a deadline, a scale problem, an integration nobody had documented.",
    tags: ["React", "Node", "Redis"],
    links: [{ label: "Live site", href: "#" }],
  },
  {
    id: "project-three",
    image: "https://picsum.photos/id/48/1600/1200",
    alt: "Project Three cover",
    title: "Project Three",
    year: "2024",
    role: "Front-end",
    description:
      "Describe the shape of the work rather than listing every feature. If there is a number worth quoting — load time, users, records processed — this is where it earns its place.",
    tags: ["Svelte", "Tailwind"],
    links: [
      { label: "Case study", href: "#" },
      { label: "Source", href: "#" },
    ],
  },
  {
    id: "project-four",
    image: "https://picsum.photos/id/60/1600/1200",
    alt: "Project Four cover",
    title: "Project Four",
    year: "2024",
    role: "Gen AI",
    description:
      "A model-backed product: say which model, what it does for the user, and how you kept it from being a demo. Retrieval, evals, guardrails — whichever part took the real work.",
    tags: ["Claude API", "Python", "pgvector"],
    links: [{ label: "Write-up", href: "#" }],
  },
  {
    id: "project-five",
    image: "https://picsum.photos/id/119/1600/1200",
    alt: "Project Five cover",
    title: "Project Five",
    year: "2023",
    role: "Back-end",
    description:
      "The infrastructure piece. What it replaced, what it made possible, and what it cost to run. Short is fine — a reader who wants more will follow the link.",
    tags: ["Go", "Docker", "AWS"],
    links: [
      { label: "Source", href: "#" },
      { label: "Docs", href: "#" },
    ],
  },
];
