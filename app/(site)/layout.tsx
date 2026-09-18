import type { Metadata } from "next";
import "../globals.css";
import SmoothScroll from "@/components/SmoothScroll";

export const metadata: Metadata = {
  title: "Nothin' | Home",
  description:
    "Nothin' A protean augmented-creative studio in Paris. Branding, editorial, art direction & AI for fashion & luxury strategists who refuse the generic.",
  openGraph: {
    title: "Nothin' | Home",
    description:
      "A protean augmented-creative studio in Paris. Branding, editorial, art direction & AI.",
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
