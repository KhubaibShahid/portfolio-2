/**
 * The page body of the original THE SHIFT project archive.
 *
 * Generated from `portfolio-showcase/index.html` rather than rewritten: the
 * theme's scripts find every element here by class and take the DOM over from
 * there, so this has to be the markup they were written against. What differs
 * from the saved file:
 *
 * - Asset paths point at `/showcase/wp-content/...`, where `public/showcase`
 *   serves them, instead of being relative to the page.
 * - The inspector overlay a browser extension injected when the page was saved
 *   (`#Woblo-inspector-canvas`, `#Woblo-tooltip`) is left out. It was never part
 *   of the site.
 * - The slides are placeholders, filled from `projects.ts` by
 *   `PortfolioShowcase.tsx`: `<!--slides-->` in each of the three copies the
 *   infinite loop runs through, `<!--map-->` for the theme's minimap (hidden,
 *   but still one item per slide for the scripts that count them), and
 *   `<!--meter-->` for the slide meter that replaces it.
 *
 * The first body script (WebP detection) and the page config live in
 * `PortfolioShowcase.tsx`; the visual changes live in `public/showcase/portfolio.css`.
 */
export const SHOWCASE_MARKUP = String.raw`<header class="site-header">
      <a
        href="/en/"
        data-to="home"
        class="site-name flip js-put-navi-a"
        @mouseenter="ui.onEnter"
        @mouseleave="ui.onLeave"
        data-c="a"
        ><h1 class="fadein">
          <div class="o"><div class="t">THE SHIFT</div></div>
        </h1></a
      >
      <nav
        class="site-navi js-css"
        @mouseenter="styleMenu.onEnter()"
        @mouseleave="styleMenu.onLeave()"
        data-anim="0"
      >
        <div class="site-navi-origin fadein in">
          <div
            class="site-navi-head js-css f-s"
            @click.prevent="styleMenu.onToggle()"
            data-anim="0"
          >
            <a href="#"
              ><div class="ui-btn-link">
                <div class="o"><div class="t">MENU</div></div>
              </div></a
            >
          </div>
          <div class="site-navi-body js-css" data-anim="0">
            <ul class="site-navi-ul flip">
              <li>
                <a data-to="home" href="/en/" class="js-put-navi-a"
                  ><div class="in">
                    <div class="u js-css" data-anim="0"><div></div></div>
                    <div class="o">
                      <div class="t js-css" data-anim="0">
                        <div class="w">Home</div>
                      </div>
                    </div>
                  </div></a
                >
              </li>
              <li>
                <a
                  data-to="archive-project"
                  href="/en/project/"
                  class="js-put-navi-a active"
                  ><div class="in">
                    <div class="u js-css" data-anim="0"><div></div></div>
                    <div class="o">
                      <div class="t js-css" data-anim="0">
                        <div class="w">Project</div>
                      </div>
                    </div>
                  </div></a
                >
              </li>
              <li>
                <a
                  data-to="archive-research"
                  href="/en/research/"
                  class="js-put-navi-a"
                  ><div class="in">
                    <div class="u js-css" data-anim="0"><div></div></div>
                    <div class="o">
                      <div class="t js-css" data-anim="0">
                        <div class="w">Research</div>
                      </div>
                    </div>
                  </div></a
                >
              </li>
              <li>
                <a data-to="about" href="/en/about/" class="js-put-navi-a"
                  ><div class="in">
                    <div class="u js-css" data-anim="0"><div></div></div>
                    <div class="o">
                      <div class="t js-css" data-anim="0">
                        <div class="w">About</div>
                      </div>
                    </div>
                  </div></a
                >
              </li>
            </ul>
            <ul class="site-navi-lang js-css flip">
              <li
                class="ui-lang-a"
                @click.prevent="__LANG__.onToggle"
                data-to="en"
              >
                <a
                  href="/en/project/"
                  class="ui-btn-link ui-btn-link-re js-put-lang-en"
                  ><div class="o"><div class="t">EN</div></div></a
                >
              </li>
              <li
                class="ui-lang-a"
                @click.prevent="__LANG__.onToggle"
                data-to="ja"
              >
                <a
                  href="/project/"
                  class="ui-btn-link ui-btn-link-re js-put-lang-ja"
                  ><div class="o"><div class="t">JA</div></div></a
                >
              </li>
            </ul>
          </div>
          <div class="site-navi-bg js-css"><div></div></div>
        </div>
      </nav>
    </header>
    <script>
      const init = () => {};
    </script>
    <main class="site-window" id="top">
      <div class="page-content" data-xhr="wrapper" aria-live="polite">
        <div
          class="page-origin"
          data-en="/en/project/"
          data-ja="/project/"
          data-current-lang="en"
          data-page-theme="dark"
          data-xhr="container"
          data-page-type="archive"
          data-xhr-namespace="archive-project"
          style="opacity: 1"
        >
          <div
            class="slide-scroll-wrap js-h js-inview"
            data-n="1"
            style="height: 953px"
            data-shown="1"
            data-visible="1"
          >
            <div
              class="site-lang ui-lang-a js-inview"
              data-to="ja"
              @click.prevent="__LANG__.onToggle"
              @mouseenter="ui.onEnter"
              @mouseleave="ui.onLeave"
              data-c="a"
              data-shown="1"
              data-visible="1"
            >
              <a href="/project/"
                ><div class="ui-btn-link fadein">
                  <div class="o"><div class="t">JA</div></div>
                </div></a
              >
            </div>
            <div
              class="slide-scroll js-h"
              data-n="1"
              style="height: 953px; transform: rotate(15deg)"
            >
              <div
                class="slide-scroll-body js-h"
                data-n="1"
                style="height: 953px"
              >
                <div
                  class="slide-scroll-contents js-h before"
                  data-n="1"
                  style="height: 961px; width: 6364.5px"
                >
                  <!--slides-->
                </div>
                <div
                  class="slide-scroll-contents js-h"
                  data-n="1"
                  style="height: 953px; width: 6364.5px"
                >
                  <!--slides-->
                </div>
                <div
                  class="slide-scroll-contents js-h after"
                  data-n="1"
                  style="height: 961px; width: 6364.5px"
                >
                  <!--slides-->
                </div>
              </div>
            </div>
            <div class="slide-scroll-control">
              <div class="in">
                <div class="slide-scroll-map">
                  <!--map-->
                </div>
                <div class="slide-scroll-thumb">
                  <div
                    class="pivot before"
                    style="
                      width: 56.4733px;
                      height: 45.9992px;
                      transform: translate3d(-234.502px, -50%, 0px);
                    "
                  ></div>
                  <div
                    class="pivot after"
                    style="
                      width: 56.4733px;
                      height: 45.9992px;
                      transform: translate3d(21.4976px, -50%, 0px);
                    "
                  ></div>
                </div>
              </div>
            </div>
            <!--meter-->
            <div class="parts parts-t1 f-xxs">
              <div class="flip2">
                <div class="o">
                  <div class="t">
                    <div class="parentheses">
                      <div class="s">(</div>
                      <div class="n slide-scroll-progress">08</div>
                      <div class="s">)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="parts parts-b4 f-xxs">
              <div class="flip2">
                <div class="o">
                  <div class="t">
                    <div class="parentheses">
                      <div class="s">(</div>
                      <div class="n css-drag"></div>
                      <div class="s">)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <ul class="get-global-navi">
            <li>
              <a data-to="home" href="/en/" class="js-get-navi-a">Home</a>
            </li>
            <li>
              <a
                data-to="archive-project"
                href="/en/project/"
                class="js-get-navi-a"
                >Project</a
              >
            </li>
            <li>
              <a
                data-to="archive-research"
                href="/en/research/"
                class="js-get-navi-a"
                >Research</a
              >
            </li>
            <li>
              <a data-to="about" href="/en/about/" class="js-get-navi-a"
                >About</a
              >
            </li>
          </ul>
        </div>
      </div>
    </main>
    <div class="ui-cursor" style="transform: translate3d(1399px, 509px, 0px)">
      <div class="ui-cursor-body clip">
        <div class="ui-cursor-text" data-c="drag">
          <div class="in">
            <div class="o"><div class="t">Drag</div></div>
          </div>
        </div>
        <div class="ui-cursor-text" data-c="click">
          <div class="in">
            <div class="o"><div class="t">Click</div></div>
          </div>
        </div>
        <div class="ui-cursor-text" data-c="explore">
          <div class="in">
            <div class="o"><div class="t">Explore</div></div>
          </div>
        </div>
        <div class="ui-cursor-text" data-c="next">
          <div class="in">
            <div class="o"><div class="t">Next</div></div>
          </div>
        </div>
        <div class="ui-cursor-text" data-c="copy">
          <div class="in">
            <div class="o">
              <div class="t"><div>Copy an email address</div></div>
            </div>
            <div class="o">
              <div class="t"><div>Copied</div></div>
            </div>
          </div>
        </div>
        <div class="ui-cursor-bg"><div class="b"></div></div>
      </div>
    </div>
    <div class="site-footer">
      <div class="js-scroll-height"></div>
      <canvas
        width="1854"
        height="961"
        class="js-webgl"
        style="width: 1854px; height: 961px; opacity: 1"
      ></canvas>
    </div>
    <div class="site-mask"></div>
    <div class="alert" aria-hidden="true">
      <div class="alert-body alert-brows">
        We are sorry, your browser version is not supported.
      </div>
      <div class="alert-body alert-noscript">
        For full functionality of this site it is necessary to enable
        JavaScript. Here are the
        <a
          href="https://www.enable-javascript.com/"
          rel="noopener"
          target="_blank"
          >instructions how to enable JavaScript in your web browser</a
        >.
      </div>
    </div>
    <noscript>
      <link
        rel="stylesheet"
        href="/showcase/wp-content/themes/the-shift/assets/css/prod-noscript.css"
      />
    </noscript>
    <script
      defer=""
      src="/showcase/wp-content/themes/the-shift/assets/js/prod-loader.js?69a7d4a3406d5"
    ></script>
    <script
      defer=""
      src="/showcase/wp-content/themes/the-shift/assets/js/cdn.min.js"
    ></script>

    <script
      defer="true"
      src="/showcase/wp-content/themes/the-shift/assets/js/prod-desktop.js?69a7d4a2bbecb"
    ></script>`;
