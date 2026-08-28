# Nothin' — Next.js rebuild

A Next.js 15 (App Router, TypeScript) recreation of the `noth.in` home page, with the
hero's hover-driven **liquid reveal** ported faithfully from the original.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm run start
```

## Stack

| Library         | Version | Used for                                        |
| --------------- | ------- | ----------------------------------------------- |
| `next` / `react`| 15 / 19 | App Router, RSC shell                           |
| `three`         | 0.180   | The fluid simulation + mask shader (as original)|
| `gsap`          | 3.15    | Loader, hero reveal, nav morph, ScrollTrigger   |
| `lenis`         | 1.3     | Smooth scrolling                                |
| `tailwindcss`   | v4      | Design tokens + utilities                       |

## How the liquid hero works

The banner you see at rest **is not the DOM `<img>`**. It is `front_hero.jpeg`
rasterised in place onto a canvas and uploaded as the base texture of a shader.

Layers inside `.section-w` (bottom → top):

| z | Element                 | What it is                                   |
| - | ----------------------- | -------------------------------------------- |
| 0 | `.video-hero-bg`        | `back_hero.jpeg` — what the liquid reveals   |
| 1 | `.mask-reveal-canvas`   | injected by the engine; the `front_hero.jpeg` banner |
| 2 | `.section-fake-hero`    | foreground copy, `mix-blend-mode: difference` |

Moving the pointer injects velocity and *dye* into a Navier–Stokes fluid solver
(`lib/fluid/`). Each frame runs: **splat → curl → vorticity → advection →
divergence → 20 Jacobi pressure iterations → gradient subtract**. The dye buffer
is then used purely as a **mask**:

```glsl
float mask = smoothstep(uEdgeSoftness, uEdgeSoftness + uEdgeWidth, dye * uRevealSize);
gl_FragColor = mix(baseColor, revealColor, mask);
```

Because the reveal layer is fully transparent, the mask punches a hole straight
through the banner, and `.video-hero-bg` shows through in liquid trails.

### Tuning

All knobs live in `DEFAULT_SETTINGS` in [`lib/fluid/MaskReveal.ts`](lib/fluid/MaskReveal.ts),
matched to the original site:

```ts
velocityDissipation: 0.962,  // how fast the swirl dies
dyeDissipation:      0.988,  // how fast the reveal heals shut
curlStrength:        0,      // >0 adds curly turbulence
splatForce:          5900,   // how hard the pointer pushes
revealSize:          3.9,    // how much area each trail uncovers
edgeWidth:           0.01,   // small = crisp liquid edge
```

### Swapping the layers

`HERO_LAYERS` at the top of [`components/Hero.tsx`](components/Hero.tsx). The engine
accepts a live `<svg>` or `<img>` (rasterised in place, keeping its on-screen
position and `object-fit`), a CSS colour, an image or video URL, or a
`<canvas>`/`<video>` — so to cross-fade the two images inside the shader instead:

```ts
const HERO_LAYERS = { base: "/front_hero.jpeg", baseBg: null, reveal: "/back_hero.jpeg" };
```

To go back to the `Nothin'` wordmark hero, render `<HeroWordmark ref={…} />`
inside `.nothin-hero-w` instead of the `<img>` — the component is still there.

## Sequencing

The loader owns the handoff, because the banner must be **settled** before it is
baked into a texture — it is rasterised at its bounding rect, so a leftover
transform would shift the texture:

```
Loader timeline ends
  └─ slides the banner up from behind its mask, then clears GSAP's residual transform
  └─ dispatches `loader:hero-revealed`
       └─ Hero boots MaskReveal, bakes the <img>, hides the DOM copy
       └─ hands `.section.hero-home`'s white background over to the canvas
```

The loader plays once per tab (`sessionStorage`), same as the original.

## Performance

- The sim **parks itself** once the showreel scrubs over the hero: `isActive()` polls
  `.video-showreel-full-w`'s inline width and stops stepping below 99%.
- Effect strength fades with scroll (`computeScrollFade`), so it costs nothing once
  the hero is out of view.
- `prefers-reduced-motion: reduce` skips the engine entirely and keeps a static hero.

## Gotchas worth knowing

- **`container` is a Tailwind utility.** The original Webflow class of the same name
  collided with it and capped the hero at 80rem, so those are `.container-hero` /
  `.container-showreel` here.
- **`.section-w` is 300vh with `margin-top: -100vh`.** The hero is centred in that
  stage, which is what puts it at the viewport top on load and gives the canvas room
  above and below to fade against.
