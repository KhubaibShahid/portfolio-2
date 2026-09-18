import type { Metadata } from "next";
import { SHOWCASE_THEME_URL } from "@/components/portfolio-showcase/PortfolioShowcase";
// The site's own icons. Imported, not linked by path: inside a route group,
// Next serves them under hashed names.
import appleIcon from "../(site)/apple-icon.png";
import icon from "../(site)/icon.svg";

/**
 * The root layout for `/showcase` — a second one, beside `app/(site)`'s.
 *
 * The showcase is a whole page of someone else's theme: it styles `html` and
 * `body` directly, drives its own scrolling and cursor, and reads its state off
 * attributes on `<html>`. Under the site's layout it would get the site's global
 * CSS, Tailwind's preflight and Lenis on top of its own; here it gets nothing
 * but what the original page had. Moving between the two root layouts is a
 * full page load, which is also what the theme's scripts need — they start
 * once, on `load`, and never tear down.
 *
 * The `<html>` attributes and the `<head>` are the original page's, except the
 * title and favicon, which are this site's. Its SEO and social tags
 * (description, Open Graph, Twitter) are left out: they describe THE SHIFT's
 * own site, and nothing on the page reads them.
 */
export const metadata: Metadata = {
  title: "Work — Khubaib Shahid",
};

const FONTS = [
  { file: "icon/i.woff", type: "font/woff" },
  { file: "YakuHanJP/YakuHanJP-DemiLight.woff2", type: "font/woff2" },
  { file: "gallery/Regular.woff2", type: "font/woff2" },
  { file: "lausanne/150.woff2", type: "font/woff2" },
  { file: "everett/Light.woff2", type: "font/woff2" },
  { file: "everett/Regular.woff2", type: "font/woff2" },
];

export default function ShowcaseLayout({ children }: { children: React.ReactNode }) {
  return (
    // The theme's loader rewrites several of these on start-up — the device
    // classes and the `data-retina`/`data-webp`/`data-browser`/`data-touch`
    // detections — before React hydrates, and on another browser they come out
    // differently. Those are the theme's to own, hence the suppression.
    <html
      lang="en"
      className="is-desktop is-splash is-mouse-active"
      data-retina="false"
      data-webp="true"
      data-browser="chrome"
      data-touch="false"
      data-theme="dark"
      data-page-name="archive-project"
      data-page-type="archive"
      data-page-theme="dark"
      data-scroll-direction="vertical"
      data-cursor-type="none"
      data-scroll-mode="hr"
      data-scroll-infinite="true"
      suppressHydrationWarning
    >
      <head>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="format-detection" content="telephone=no" />
        <meta httpEquiv="Last-Modified" content="Wed, 04 Mar 2026 06:43:46" />
        {/* The theme's `js-favicon` class stays in case its scripts look for it. */}
        <link rel="icon" type="image/svg+xml" className="js-favicon" href={icon.src} />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-title" content="Khubaib Shahid" />
        <meta name="application-name" content="Khubaib Shahid" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-touch-fullscreen" content="YES" />
        <link rel="apple-touch-icon" sizes="180x180" href={appleIcon.src} />
        <link rel="preconnect" href="https://d17292ff19wl6v.cloudfront.net/" crossOrigin="" />
        {FONTS.map((font) => (
          <link
            key={font.file}
            rel="preload"
            href={`${SHOWCASE_THEME_URL}/assets/fonts/${font.file}`}
            as="font"
            type={font.type}
            crossOrigin=""
          />
        ))}
        <link rel="manifest" href={`${SHOWCASE_THEME_URL}/assets/js/manifest.json`} />
        {/* Linked, not imported: its `url()`s are relative to where it is
            served, and `public/showcase` is where the fonts sit beside it. */}
        <link rel="stylesheet" href="/showcase/styles.css" />
        {/* This site's changes to the theme — after it, so they win. */}
        <link rel="stylesheet" href="/showcase/portfolio.css" />
      </head>
      {/* `x-init` is on the original body. The WebP check adds a class to it
          before hydration, hence the suppression here too. */}
      <body x-init="init()" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
