import { SHOWCASE_MARKUP } from "./markup";
import { SHOWCASE_PROJECTS, type ShowcaseProject } from "./projects";

/** Where `public/showcase` serves the theme from. */
export const SHOWCASE_THEME_URL = "/showcase/wp-content/themes/the-shift";

/** Escapes text for the markup strings below. */
function html(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The theme's `THUMB` entry for each project — what its WebGL loads as the
 * slide's texture, matched to the card by `post_id`. One file serves every
 * resolution the theme asks for.
 *
 * The URL goes in without its `.webp`: the theme appends that itself whenever
 * the browser supports WebP, because THE SHIFT's server kept a `.webp` twin of
 * every JPEG. A browser without WebP could not show these files anyway, so the
 * extension it adds back is always the right one.
 */
function thumbsFor(projects: ShowcaseProject[]) {
  return projects.map((project, i) => {
    if (!project.image.endsWith(".webp")) {
      throw new Error(
        `Showcase image "${project.image}" must be a .webp — the slider only ever requests .webp files.`
      );
    }
    const src = project.image.slice(0, -".webp".length);

    return {
      title: project.title.join(" "),
      post_id: String(i + 1),
      type: "project",
      media: "image",
      ratio: { w: String(project.width), h: String(project.height) },
      video: { src: "" },
      image: { d2x: src, d1x: src, mob: src },
    };
  });
}

/**
 * Where a card's link opens. Never in the frame the slider sits in on the home
 * page: another site would refuse to load there or be squeezed into a section,
 * and a page of this one would nest the site inside itself. The theme's router
 * leaves a link with a `target` alone. A bare `#` is the placeholder, and stays
 * put.
 */
function linkTarget(href: string): string {
  if (href === "#") return "";
  return /^https?:\/\//.test(href) ? ' target="_blank" rel="noreferrer"' : ' target="_top"';
}

/**
 * One card, in the markup the theme's cards were served in. The parity classes,
 * the `data-d` line indices and the parked `translate(9999px)` are the theme's;
 * its scripts position and animate the card from there.
 */
function slide(project: ShowcaseProject, i: number): string {
  const lines = project.title
    .map(
      (line, d) => `
                              <div class="l ${d % 2 ? "even" : "odd"}">
                                <div class="w" data-d="${d}">
                                  <div class="o" data-d="${d}">
                                    <div class="t">${html(line)}</div>
                                  </div>
                                </div>
                              </div>`
    )
    .join("");

  return `<article
                    class="slide-plane flip-origin ${i % 2 ? "odd" : "even"}"
                    data-powx="0.8"
                    data-powy="0.5"
                    data-index="${i + 1}"
                    data-post-id="${i + 1}"
                    style="transform: translate(9999px, 0px)"
                    data-visible="0"
                  >
                    <div class="in">
                      <div class="slide-a">
                        <a href="${html(project.href)}"${linkTarget(project.href)} class="slide-in in"
                          ><div class="slide-plane-title">
                            <div data-disable="any" class="js-delay-n flip-b">${lines}
                            </div>
                          </div>
                          <div class="ui-btn-arrow">
                            <div class="o">
                              <div class="i i-arrow-right"></div>
                              <div class="b"></div>
                            </div></div
                        ></a>
                      </div>
                      <div class="slide-plane-parts clip slide-plane-y">
                        <div class="o"><div class="t js-css">${html(project.year)}</div></div>
                      </div>
                      <h2 class="slide-plane-parts clip slide-plane-t">
                        <div class="o">
                          <div class="t js-css">
                            <div class="parentheses">
                              <div class="s">(</div>
                              <div class="n">${pad(i + 1)}</div>
                              <div class="s">)</div>
                            </div>
                            <div class="w">${html(project.title.join(" "))}</div>
                          </div>
                        </div>
                      </h2>
                    </div>
                  </article>`;
}

/** The theme's minimap item — hidden, but kept one per slide for its scripts. */
const MAP_ITEM = `<div class="slide-scroll-map-li" data-visible="0">
                    <div><div></div></div>
                  </div>`;

/**
 * The slide meter, bottom left, in place of the theme's minimap: which project
 * is in the middle of the screen, of how many, as a count and a row of
 * segments. Styled in `public/showcase/portfolio.css`.
 *
 * The theme keeps its slider state to itself, so the meter reads the result
 * instead: every so often it finds the card nearest the centre of the screen —
 * across all the copies, since the loop cycles through them — and lights that
 * card's index. A tenth of a second or so is plenty for a readout, and far
 * cheaper than measuring every card every frame.
 *
 * It looks the meter up afresh each time rather than holding on to it: the
 * theme's page transitions can swap the markup out from under it.
 */
function meter(count: number): string {
  const segments = Array.from({ length: count }, (_, i) =>
    `<span class="ks-meter__seg${i === 0 ? " is-on" : ""}"></span>`
  ).join("");

  return `<div class="ks-meter" aria-hidden="true">
              <span class="ks-meter__count"><span class="ks-meter__num">01</span><span class="ks-meter__total">/${pad(count)}</span></span>
              <span class="ks-meter__track">${segments}</span>
            </div>
            <script>
              (function () {
                function read() {
                  var meter = document.querySelector(".ks-meter");
                  if (meter) {
                    var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
                    var best = -1, bestDist = Infinity;
                    document.querySelectorAll(".slide-plane").forEach(function (card) {
                      var r = card.getBoundingClientRect();
                      if (!r.width) return;
                      var dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
                      var dist = dx * dx + dy * dy;
                      if (dist < bestDist) { bestDist = dist; best = +card.dataset.index - 1; }
                    });
                    if (best >= 0 && String(best) !== meter.dataset.current) {
                      meter.dataset.current = String(best);
                      meter.querySelectorAll(".ks-meter__seg").forEach(function (seg, i) {
                        seg.classList.toggle("is-on", i === best);
                      });
                      meter.querySelector(".ks-meter__num").textContent = String(best + 1).padStart(2, "0");
                    }
                  }
                  setTimeout(read, document.hidden ? 500 : 120);
                }
                read();
              })();
            </script>`;
}

/**
 * The page config the theme's scripts read on load, as top-level `const`s — the
 * same statements the original page ran in its `<head>`. They are classic-script
 * globals rather than `window` properties, and the scripts refer to them by bare
 * name, so they have to stay exactly that.
 *
 * The paths point at `public/showcase` rather than being relative to the page,
 * and `THUMB` holds the projects.
 */
function pageConfig(projects: ShowcaseProject[]): string {
  // `<` escaped so no title can ever close the script tag it sits in.
  const data = JSON.stringify(thumbsFor(projects), null, 2).replace(/</g, "\\u003c");
  return [
    "window.styleMenu = null;",
    'const UNIQID = "69a7d4a2bbe74";',
    `const TEMPLATE_URL = "${SHOWCASE_THEME_URL}";`,
    'const SITE_URL = "/";',
    'const CDN_URL = "https://d17292ff19wl6v.cloudfront.net/v2";',
    `const SCRIPT_FOR_DESKTOP = "${SHOWCASE_THEME_URL}/assets/js/prod-desktop.js?69a7d4a2bbecb";`,
    `const SCRIPT_FOR_MOBILE = "${SHOWCASE_THEME_URL}/assets/js/prod-mobile.js?69a7d4a2bbeea";`,
    `const THUMB = ${data};`,
  ].join("\n");
}

/** The original page's first body script, verbatim. */
const WEBP_DETECT = `
      // EWWW Image Optimizer normally injects the detection that defines
      // \`ewww_webp_supported\`; it is not part of this saved copy, so detect
      // WebP support here instead of throwing a ReferenceError.
      if (typeof ewww_webp_supported === "undefined") {
        var ewww_webp_supported =
          document
            .createElement("canvas")
            .toDataURL("image/webp")
            .indexOf("data:image/webp") === 0;
      }
      if (ewww_webp_supported) {
        document.body.classList.add("webp-support");
      }
    `;

interface PortfolioShowcaseProps {
  /** The slides. Defaults to `projects.ts`. */
  projects?: ShowcaseProject[];
}

/**
 * THE SHIFT's project archive — the tilted WebGL card slider — running on the
 * theme's own scripts, with this site's projects in it.
 *
 * The slides, the minimap items and the meter are written into the markup from
 * `projects`; the theme's header, language switch, "(DRAG)" label, minimap and
 * cursor follower are hidden, and the cursor replaced, by
 * `public/showcase/portfolio.css`.
 *
 * Nothing of the slider is reimplemented here. Its behaviour lives in the
 * theme's own minified bundles (`public/showcase/wp-content/.../js`), which
 * take the page over once it has loaded: `prod-loader.js` waits for `load`,
 * then pulls in the desktop or mobile bundle, and that builds the slides out of
 * `THUMB` into the markup below. A port would not be the same slider.
 *
 * That shapes how this renders:
 *
 * - The markup goes in through `dangerouslySetInnerHTML`, not JSX. The bundles
 *   rewrite it — slides, classes, the cursor — and React hydrating a tree that
 *   something else has already changed would throw those changes away and hand
 *   the bundles detached nodes. Inner HTML is the one thing React leaves alone.
 *   The wrapper is `display: contents`, so it adds no box to the layout.
 * - The inline scripts run because this page is server-rendered: the browser
 *   executes them as it parses, in document order, the same as the original.
 * - It needs the whole document. The theme styles `html` and `body` directly
 *   and reads its state off `<html>` attributes, so it only works under the
 *   showcase root layout (`app/(showcase)/layout.tsx`), never inside the site's.
 */
export default function PortfolioShowcase({ projects = SHOWCASE_PROJECTS }: PortfolioShowcaseProps) {
  const markup = SHOWCASE_MARKUP.replaceAll("<!--slides-->", projects.map(slide).join("\n                  "))
    .replace("<!--map-->", projects.map(() => MAP_ITEM).join("\n                  "))
    .replace("<!--meter-->", meter(projects.length));

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: pageConfig(projects) }} />
      <script data-cfasync="false" dangerouslySetInnerHTML={{ __html: WEBP_DETECT }} />
      {/* By hydration the theme has already rewritten this markup, which React
          reports as a mismatch and — correctly — leaves alone. */}
      <div
        style={{ display: "contents" }}
        dangerouslySetInnerHTML={{ __html: markup }}
        suppressHydrationWarning
      />
    </>
  );
}
