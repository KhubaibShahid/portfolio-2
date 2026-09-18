import type { Metadata } from "next";
import { SHOWCASE_THEME_URL } from "@/components/portfolio-showcase/PortfolioShowcase";

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
 * The `<html>` attributes and the `<head>` are the original page's. Its SEO and
 * social tags (description, Open Graph, Twitter) are left out: they describe
 * THE SHIFT's own site, and nothing on the page reads them.
 */
export const metadata: Metadata = {
  title: "Project | THE SHIFT",
};

const FAVICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAE80lEQVR4AcRXW0ycRRT+zixUVlhahCYaianUqEW0YrSk1tplF3CXYqM1+kC8NCZoU02apj5YLyXERvtQEmNqGiLGxEtMJI02ArtAl92ArUJCTIz1weuD8dLG2GiD0LL7H79/gYW9djXQTs7ZmTnnzMw3Z86c+dfgMhejnuajl5MNBG4AtwO6Ps6KWqjWsb0Foi2st+fPVhMEVRxfzjEuqFXKehVglZGvAfRmqHpYJ+Y0FBRTUAVgLdtfSLi/SsKBShkOVGDqfDUgJwFYZJtigB5AQUUJ9ZLOQZeE+ms53k1dEypcPkjsIERcgGwEUA0BASFRCAC72PuLDIiUYa6ou6kGRStGuKA90MyKrZ3YXNcug+9NzvZz/0pPT0xCg0OITdXTm69lsjYQvE3FSrJNzerxvaIbH3ZKZPBrGQ5ey50Y8txuB7qlo2PeG7Z9gtXtLtB634/q8dPJyQzj/AViPlyYJzA3X0BMYob5hsCBS1jSAVzCxe2lFgAozkELahCqe0k+75mylf+FJRKJSjhYBWuqEIr9KWNLYelXPJ5JHtOexboFAAIXJHoM3rEabW9fkC+2zqe9erUSQN4bSF1oLVRG8dnYAW1uvlrBEMXylkURnojMlbAcRzGt38Ljt+i2tKiOy7z+SdYfqNf/gG7a5pqHGb96kcChTBFPWTFKCru03v8yx8bnTfVAfB4J901AZB870+TMpLiSilYoPsYVM2eYzkMEs1cbm5lVqcmTMgKwxzKjvUnETnLizqa2CXIns6cNsogJywPFIcT0y/ndZaoxGT1H2yeh0sWxW7MCsEFcjAmyCzGrmnafkPMlQ+BrmBmfZt1r8h2VzU5GBn/CcGA7pJCPmXRzd39ms80gFz7H/pN01SnyWXKmoItqQ0M8VVP/DTnNhsEahYkyoPvbmL7LU48qV5+DAnfT4Bbu4iqodSsULxLp7OPEBskBh2PZ0rPhAnES+k7CA6f4lL4Kp7meQH6ggqmAv8YsPwAukyDp6zuLv8+sg5EHKTyB8/idrrfBrGOfWPmbTAaz0R9Vj+/5ZFV6z8606t12m3r8MwkPpJrJxMSMHO8/xqO5F4LH6aB/Um3+b3/2SZ88zZvwm1H3fc+q+/4Kbk/U4xtTj5+7WHjPGWAxHsf7BNFAMA7GS9a8QF0Bg/BgLmC6palR6303SSh0WkLB64xEBg5L5NM/6FdiyDV0iXQORy9n4nXlLynrEVC3TMR9ilRrvX+TvUD+AKK2+ZKxCyZ+3Vklz8mTSBYkeg4ruy5hlHfD/mi5Rxt8e1I9sIJTZF7ISBna26leMnLBkv0JAOptbgFkDZDmFYpIlunF6HiMt2TK/gKmJG9adO8vAGJvEnNlFa+hv1K9vsNQ/YjCeM5nnYuKUOBss0Mpl9G8Lg52dHwr9MIoZYXkJDLc789QeYZSJ9kmosQJQLspf4GCpwjOh/IS3vHAbA44HjgiNKAujeihaa33dWqjz6uNLU2AczeNOgAphQj/U+ivAN7hR+oOJqINPAK1E0cnlW9QcYTzvgvF92wX06AWEB9lrQAc5DxIH5NwcK8MBUMy1DsokUAnNm+4E9HojdAYP2AkDMgdMPI6VMb5Ggb3MYM9x4+L3ax3MZO18UHawbqV/UdkuP8hCQ88wW892zO4WOG4nsU2dttOvTIy9J0MD7zFuR/FDZV3wTjWY8aq+xcAAP//ZB+/+gAAAAZJREFUAwAmQqqVlKjxigAAAABJRU5ErkJggg==";

const APPLE_ICON_BASE = "https://d17292ff19wl6v.cloudfront.net/v2/assets/img/icon2";

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
        <link rel="icon" type="image/png" className="js-favicon" href={FAVICON} crossOrigin="anonymous" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-title" content="THE SHIFT" />
        <meta name="application-name" content="THE SHIFT" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-touch-fullscreen" content="YES" />
        <link rel="apple-touch-startup-image" href={`${APPLE_ICON_BASE}/icon-512x512.png`} />
        <link rel="apple-touch-icon" sizes="180x180" href={`${APPLE_ICON_BASE}/icon-192x192.png`} />
        <link rel="apple-touch-icon" sizes="192x192" href={`${APPLE_ICON_BASE}/icon-192x192.png`} />
        <link rel="apple-touch-icon-precomposed" sizes="192x192" href={`${APPLE_ICON_BASE}/icon-192x192.png`} />
        <link rel="apple-touch-icon" sizes="512x512" href={`${APPLE_ICON_BASE}/icon-512x512.png`} />
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
