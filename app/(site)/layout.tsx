import type { Metadata } from "next";
import "../globals.css";
import SmoothScroll from "@/components/SmoothScroll";

const TITLE = "Khubaib Shahid — Full-Stack & AI Developer";

const DESCRIPTION =
  "I build for the web end to end — interfaces people actually enjoy using, the services running behind them, and the AI woven through both.";

/*
 * The favicon is `icon.svg` beside this file — the K with the loader's amber
 * dot — and `apple-icon.png` is the same drawing, square, for home screens.
 */
export const metadata: Metadata = {
  title: {
    default: TITLE,
    // For any page added under this layout later.
    template: "%s — Khubaib Shahid",
  },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Hoisted into <head> by React. Both hero layers are above the fold,
            and the fluid engine cannot bake its base texture until front_hero
            has decoded. */}
        <link rel="preload" as="image" href="/front_hero.jpeg" fetchPriority="high" />
        <link rel="preload" as="image" href="/back_hero.jpeg" />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
