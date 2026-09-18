/**
 * The slides, in order. Everything the slider shows comes from here: the cards
 * and their captions (`PortfolioShowcase.tsx` writes them into the markup), the
 * textures the WebGL draws, and the meter's count.
 */
export interface ShowcaseProject {
  /** The card's title, one entry per line of the big hover title. */
  title: string[];
  /** Set down the right edge of the card. */
  year: string;
  /** Where the card links. */
  href: string;
  /**
   * A `.webp` served from `public/`, extension included. The same file is used
   * on every screen size. It has to be WebP — see `thumbsFor`.
   */
  image: string;
  /**
   * The image's pixel size. The slider sizes each card to this aspect ratio,
   * so it has to match the file — a mismatch stretches the picture.
   */
  width: number;
  height: number;
}

// TODO: the years and links are placeholders — set the real ones.
export const SHOWCASE_PROJECTS: ShowcaseProject[] = [
  { title: ["Siper"], year: "2025", href: "#", image: "/project1.webp", width: 640, height: 981 },
  {
    title: ["Comfort", "Zone"],
    year: "2025",
    href: "#",
    image: "/project2.webp",
    width: 1887,
    height: 2831,
  },
  { title: ["Shopco"], year: "2025", href: "#", image: "/project3.webp", width: 570, height: 600 },
  { title: ["Taber"], year: "2025", href: "#", image: "/project4.webp", width: 717, height: 855 },
  { title: ["Webranium"], year: "2025", href: "#", image: "/project5.webp", width: 768, height: 1360 },
];
