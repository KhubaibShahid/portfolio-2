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
| `three`         | 0.180   | Hero fluid sim + the technology particle field   |
| `gsap`          | 3.15    | Loader, hero reveal, nav reveal, ScrollTrigger   |
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

## How the technology morph works

One `THREE.Points` — 8,000 to 30,000 particles depending on the device — assembles
into six technology marks and is reshaped between them by the scroll position:

```
React → Next.js → Python → GitHub → Docker → PostgreSQL
```

It is a morph, not a crossfade. The particle system is built once and never torn
down; a transition changes two integers and a float. The particle that sits on
React's nucleus is the one that travels to the Next.js disc.

The section is the one white room in an otherwise black page — a hard cut into
white at the top edge and back to black at the bottom, no ramp either way.

It opens on nothing. The white ground slides up over the about stage carrying no
content at all; the title then fills the screen, holds, and fades away again; and
only then is the field pulled in from outside the frame to assemble the first
mark. See [The intro act](#the-intro-act).

The field is read from two corners on a diagonal, with the mark passing behind
both. Top left is the name, off the room's back wall rather than out of a caption:
one word per technology behind the transparent canvas, spanning half the viewport
and set in that technology's own colour at a little over half strength, fading to
nothing toward its baseline. Bottom right is how well it is known — the rung, named
and drawn as a four-segment meter lit in the same colour.

Neither is a panel. The glass cards these replace had to draw themselves an edge to
sit on a white page, and once the mark is being named by the wall behind it a
bordered box in the corner is one frame too many.

Both decks are driven from the same two numbers, so the name and the proficiency
can never disagree about which mark is on screen. Every entry is stacked in one
grid cell and written to each frame, never mounted or unmounted, which is what lets
the crossfade reverse with the scroll.

Half the viewport *exactly*, whatever the word is. `fitWords` in
[`TechStack.tsx`](components/TechStack.tsx) sets every name to one reference size,
reads what each actually measures, and scales each to the target — a character
count is wrong by a fifth either way across a set running from `React` to
`PostgreSQL`. `--tech-word-fill` on `.tech-word-w` is the share it aims for, and
the mobile layout raises it to 0.86 because half a phone is a word nobody reads.

### From SVG to point cloud

Nothing is hand-placed. [`lib/particles/logoSampler.ts`](lib/particles/logoSampler.ts)
turns each mark into a cloud at startup:

```
Path2D → alpha mask → distance transform → weighted scatter → polar sort
```

Two of those steps are load-bearing:

- **The distance transform** ("how far is this pixel from an edge") drives depth.
  `z = ±maxDepth · √distance` extrudes the flat mask into a rounded solid, so a
  hairline like the PostgreSQL elephant becomes a round tube and the solid
  Next.js disc becomes a thick coin with bevelled edges — both read as sculpture
  when the cloud turns.
- **The polar sort** — by angle around the centre, then radius — is what makes the
  morph coherent. All six clouds are ordered the same way, so particle *i* leaves
  one logo's angular sector and arrives in roughly the same sector of the next,
  travelling a short arc instead of crossing the frame.

The scatter is weighted toward edges (`floor + (1-floor)·e^(-d/falloff)`), which
puts a bright rim on every silhouette and every interior hole. That is what keeps
the marks readable down to the 4,000-particle mobile count.

### The morph itself

All six clouds live in one `RGBA32F` texture, stacked as row blocks. The vertex
shader reads two of them per frame using the particle's own index, so adding a
seventh logo grows the texture and changes no shader code.

A straight `mix()` between them reads as a slide, so four displacements are layered
on top, all scaled by `sin(π·t)` so they are exactly zero at both ends:

| Term | What it does |
| ---- | ------------ |
| radial push | breaks the cloud off its axis — *signed*, so a third of the field collapses inward and the centre never hollows out |
| vortex | shears the halves against each other, leaning opposite ways on consecutive transitions |
| depth throw | sends particles past the camera and behind it |
| turbulence | a simplex field, offset per transition so no two look alike |

Because those terms vanish at `t=0` and `t=1`, a settled logo is always the exact
sampled cloud, however the scroll is parked. Two things are left running on a
settled mark: a slow unseeded noise field for the idle drift, and a standing wave
with no envelope on it at all — a projection that holds perfectly still stops
looking projected.

The interpolation itself is smootherstep (`6t⁵−15t⁴+10t³`), not smoothstep: zero
*acceleration* at both ends rather than only zero velocity. Over a transition this
long a cubic still opens with a visible shove.

### Colour, on a white page

Light cannot be added to a surface already at full brightness, so there is no
additive blending anywhere in this section. The field is dark ink laid onto white
with straight alpha, and crowding reads as density rather than glow; what glows is
the cyan, which a particle takes on in flight and again when it drops into the
pad's light. Every fragment shader here writes **premultiplied** colour, because
the renderer composites that way — straight alpha over white comes out milky.

### The intro act

The first `INTRO_VH` viewports of the runway (2, in `TechStack.tsx`) are not the
morph. They are split into beats, all read off the scroll position rather than
tweened, so the whole thing scrubs backwards as readily as forwards:

| Beat | Fraction of the intro |
| ---- | --------------------- |
| empty stage | `0 → 0.08` |
| title in, settling from `scale(0.9)` | `0.08 → 0.34` |
| title held, filling the screen | `0.34 → 0.56` |
| title away, still opening | `0.56 → 0.80` |
| field gathered in from outside the frame | `0.60 → 1.00` |
| the first name fades up behind it | `0.76 → 1.00` |

The gather is a sixth displacement in the vertex shader, driven by `uAssemble`
rather than by the transition. At 0 every particle sits at `uEntryRadius` — the
world distance to the frame's *corner*, solved from the camera on each resize, so
"off screen" means off the screen the page is actually open on. Departures are
staggered and spun per particle, and each one fades up as it crosses the edge.
At 1 every term is multiplied by zero, which is why it can sit in the path of
every frame the section ever draws.

The fraction the intro claims is **measured**, not declared: the trigger knows how
much scroll it spans, so `INTRO_VH · innerHeight` is divided out of it at refresh.
Shorten the runway and the intro keeps its two viewports.

### Scroll mapping

[`lib/particles/timeline.ts`](lib/particles/timeline.ts) lays alternating holds and
morphs across `0..1`, derived from the number of technologies — six logos give six
holds and five transitions, with extra weight on the first and last so the section
has a beat to arrive and leave on. `resolve()` is a pure lookup with no memory of
previous calls, which is why scrolling back up reverses everything for free: the
state is a function of scroll position, not of how it was reached.

Morphs carry three times a hold's weight, so two thirds of the runway is spent
mid-transition — close to two viewports of wheel behind each one.

`.tech-stage` is `position: sticky`; ScrollTrigger only *reports* progress, it does
not pin. `.tech-runway`'s height (1500vh) is the one number to change to make the
sequence faster or slower — the intro takes its fixed two viewports off the top and
the timeline divides what is left.

### Composition

`ParticleMorph` states the composition as screen fractions — where the mark's top
and bottom sit, where the pad sits — and solves the camera for them, rather than
fitting the camera and placing objects afterwards. The band between the mark's
`resize` turns those fractions into a distance and a height, so the mark lands in
the same band of the viewport on every screen — deliberately most of the stage, with
the name lying across the middle of it rather than clear of it.

### Adding a technology

1. Paste a 24×24 single-path SVG into [`lib/particles/logoPaths.ts`](lib/particles/logoPaths.ts)
   (Simple Icons' format — one closed path, holes cut by winding).
2. Add an entry to [`lib/particles/technologies.ts`](lib/particles/technologies.ts).

Nothing counts to six. The timeline, the texture and the stack of names all derive
from that array's length.

`color` is the one field with a constraint on it. It is set as a giant word behind
a near-black mark on a white page, so two things eat a brand hex: the page, which
swallows React's own `#61DAFB`, and the mark, which swallows anything of its own
value — hence the violet for Next.js and Git's orange for GitHub. `level` and
`blurb` are the copy the section's spoken list and its no-WebGL fallback carry —
drafts written to fit the design, not anyone's real CV.

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

- The sim **parks itself** once the about section covers the hero: `isActive()` polls
  `.about-backdrop`'s inline opacity and stops stepping at 0.99.
- Effect strength fades with scroll (`computeScrollFade`), so it costs nothing once
  the hero is out of view.
- `prefers-reduced-motion: reduce` skips the engine entirely and keeps a static hero.
- The particle field's rAF loop **ends** while its section is off screen (an
  `IntersectionObserver` restarts it), particle count scales with viewport width,
  core count and `deviceMemory`, and DPR is capped at 2.
- Reduced motion there keeps the scroll-driven morph — that is the reader's own
  input — but drops the dispersal, vortex, turbulence and camera entirely, leaves
  only a breath of the standing wave, and shortens the runway from 1500vh to 900vh.

## Gotchas worth knowing

- **The page's weight lives in two Lenis numbers.** `duration: 1.65` is how long it
  keeps gliding after the wheel stops; `wheelMultiplier: 0.7` is how much distance
  one notch buys, and it is under one deliberately — every scroll-driven sequence
  here is meant to be watched rather than passed, and at the browser's default a
  single flick crossed most of one. Touch is left near unity, because a thumb
  expects the page to track it and the same discount reads as a broken drag. See
  [`SmoothScroll.tsx`](components/SmoothScroll.tsx); nothing else on the page
  compensates for these, so changing them changes how every section feels.

- **`container` is a Tailwind utility.** The original Webflow class of the same name
  collided with it and capped the hero at 80rem, so those are `.container-hero` /
  `.container-projects` here.
- **`--about-open-vh` is the hero/about contract.** It is how many viewports the
  about tile takes to open (3), and three boxes are solved from it rather than
  restating it: `.hero-pin-w`'s height, `.section.about`'s height and negative
  margin, and the blackout inset below it. The hero has to stay pinned for exactly
  as long as the image is still opening over it, so changing one of those by hand
  desynchronises the pin. `About.tsx` reads the same token as the end of its scrub.
- **`.section.tech` carries `margin-top: -100vh`.** `.section.about`'s sticky stage
  holds all but its last viewport; something has to land on the unstick and cover it
  as it scrolls away, and the technology section is that something — which is also
  why that section now starts with the runway and no heading of its own. Mobile
  unsticks the about stage and drops this to 0.
- **`.section-w` is 300vh with `margin-top: -100vh`.** The hero is centred in that
  stage, which is what puts it at the viewport top on load and gives the canvas room
  above and below to fade against.
