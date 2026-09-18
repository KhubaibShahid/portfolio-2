import * as THREE from "three";
import type { LogoKey } from "./logoPaths";
import { buildShapeAtlas } from "./shapes";
import { particleFragment, particleVertex } from "./shaders";
import { buildTimeline, resolve, type MorphState, type Segment } from "./timeline";

/* -------------------------------------------------------------------------- */
/*  Tuning                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * How much the field moves, in the two modes the section runs in.
 *
 * The reduced profile is not the normal one turned down — it is a different
 * answer to the same brief. Scroll still drives the morph, because that is the
 * user's own input and removing it would leave the section meaningless, but
 * everything the page does on its own is gone: no dispersal, no vortex, no
 * turbulence, no camera, and only the faintest breath left in the wave. What is
 * left is a short, direct interpolation that follows the scroll wheel and holds
 * still when it stops.
 */
interface MotionProfile {
  /** Spread of per-particle departure times, as a fraction of the transition. */
  stagger: number;
  /** Radial and depth throw at mid-transition. */
  burst: number;
  /** Peak vortex rotation, in radians. */
  swirl: number;
  /** Noise displacement while in flight. */
  turbulence: number;
  /** Noise displacement while settled — the thing that stops it looking dead. */
  idle: number;
  /** Standing wave through the cloud. Never switches off. */
  wave: number;
  /** Particle diameter in CSS pixels. */
  sizePx: number;
  opacity: number;
  /** How far the cloud and camera lean into the pointer. */
  mouse: number;
  /** Scroll smoothing rate. Higher follows the wheel more literally. */
  damping: number;
}

const FULL_MOTION: MotionProfile = {
  stagger: 0.5,
  // Trimmed as the mark grew. The silhouette now fills most of the stage, so a
  // dispersal that threw as far as it used to would spend the middle of every
  // transition outside the frame.
  burst: 0.48,
  swirl: 0.8,
  turbulence: 0.4,
  idle: 0.03,
  wave: 0.05,
  // Thick enough that a particle is an object rather than a speck of dust. The
  // marks are sampled from solid silhouettes, so at this size a settled logo
  // reads as one mass with a grain to it instead of as scattered pepper.
  sizePx: 3.2,
  // Straight alpha over white: overlapping particles stack toward solid rather
  // than clipping at white, so this leaves headroom for the crowd while still
  // giving a lone particle real presence.
  opacity: 0.85,
  mouse: 1,
  // Lenis has already smoothed the wheel; this second pass is the cloud's own
  // weight, and a long one is what lets a transition keep drifting for a beat
  // after the wheel stops rather than arriving with it.
  damping: 5,
};

const REDUCED_MOTION: MotionProfile = {
  stagger: 0.14,
  burst: 0,
  swirl: 0,
  turbulence: 0,
  idle: 0.005,
  wave: 0.012,
  sizePx: 3.3,
  opacity: 0.82,
  mouse: 0,
  damping: 14,
};

const FOV = 42;

/** Half the longest side a normalised logo occupies, plus a hair of slack. */
const LOGO_RADIUS = 2.12;

/**
 * The band of the pinned stage the mark spans, measured down from its top edge.
 *
 * The composition is stated here and the camera is solved for it rather than
 * the other way round: `resize` turns these fractions into a distance and a
 * height, so the mark lands in the same band of the viewport on every screen it
 * is opened on.
 *
 * It is deliberately most of the stage. The two glass cards sit in opposite
 * corners and the field passes behind both of them, which is the whole reason
 * they are glass — a mark that stopped short of them would leave the section
 * looking like a diagram with captions rather than like one object being read
 * from two sides.
 */
interface Composition {
  markTop: number;
  markBottom: number;
}

const LANDSCAPE: Composition = { markTop: 0.08, markBottom: 0.9 };

/** Portrait fits to width long before it fits to height, so this only decides
 *  where the mark is centred once it has been shrunk to fit across. */
const PORTRAIT: Composition = { markTop: 0.16, markBottom: 0.82 };

/**
 * Fraction of the frame's half-width the mark may claim before the camera pulls
 * back. Margin, so a narrow window shrinks the scene rather than cutting it.
 */
const SAFE_X = 0.92;

/**
 * The scene's inks, passed as raw sRGB components rather than through
 * `THREE.Color`.
 *
 * Same reasoning as the hero's fluid engine: these shaders write `gl_FragColor`
 * straight to the framebuffer with no linear -> sRGB encode, so a colour that
 * had been converted into the renderer's linear working space would come out
 * visibly darker than the identical hex in CSS.
 *
 * The set is built for a white page, which turns the old reading inside out.
 * `INK_DEEP` carries the outline and `INK_SOFT` the body — dark on light rather
 * than light on dark. `INK_GLOW` is what a particle takes on while it is in
 * flight, and it is the accent the glass cards are keyed to, so the section has
 * one colour rather than two.
 */
const hex = (value: number): THREE.Vector3 =>
  new THREE.Vector3(
    ((value >> 16) & 0xff) / 255,
    ((value >> 8) & 0xff) / 255,
    (value & 0xff) / 255
  );

const INK_DEEP = hex(0x0b1a24);
const INK_SOFT = hex(0x93a7b4);
const INK_GLOW = hex(0x17a4c4);

/* -------------------------------------------------------------------------- */
/*  Device budget                                                              */
/* -------------------------------------------------------------------------- */

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

/**
 * How many particles this machine should be asked to move.
 *
 * Viewport width is the first cut because it is also the thing that decides how
 * large the mark is on screen. The counts roughly doubled when the mark grew to
 * fill the stage: spreading the old budget over three times the area left the
 * silhouettes thin and gappy, and density is most of what makes a point cloud
 * read as a solid.
 *
 * Core count and memory then pull the number down again for the cheap laptops
 * that report a desktop width — and they cut harder than they used to, because
 * each particle now costs more to fill as well as more to transform.
 */
export function resolveParticleCount(width: number): number {
  let count = width < 640 ? 8000 : width < 1024 ? 16000 : width < 1600 ? 24000 : 30000;

  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = (navigator as NavigatorWithMemory).deviceMemory ?? 8;
  if (cores <= 4) count *= 0.55;
  if (memory <= 4) count *= 0.6;

  return Math.max(5000, Math.round(count));
}

/** Whether a WebGL context can be had at all, without building anything. */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return false;
    // Hand it straight back. Browsers cap how many live contexts a document may
    // hold, and a probe has no business keeping one of them — which it would,
    // twice, under the double-mount React runs effects with in development.
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*  Engine                                                                     */
/* -------------------------------------------------------------------------- */

export interface ParticleMorphOptions {
  container: HTMLElement;
  /** Logos to morph through, in scroll order. Length sets the timeline. */
  logos: LogoKey[];
  count: number;
  reducedMotion: boolean;
  /** Called once per rendered frame with the resolved morph state. */
  onFrame?: (state: MorphState) => void;
  /** Progress of the one-time shape build. */
  onBuildProgress?: (done: number, total: number) => void;
}

/** Framerate-independent exponential approach. */
function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export class ParticleMorph {
  private readonly options: ParticleMorphOptions;
  private readonly profile: MotionProfile;
  private readonly timeline: Segment[];

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private group = new THREE.Group();
  private canvas: HTMLCanvasElement;

  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private atlasTexture: THREE.DataTexture | null = null;
  private points: THREE.Points | null = null;
  /** Per-logo opacity multipliers, filled in by `build`. */
  private densities: Float32Array = new Float32Array();

  private rafId = 0;
  private clock = new THREE.Clock();
  private elapsed = 0;
  private destroyed = false;
  private active = false;
  private built = false;

  /** Where the scroll is, and where it is being pulled to. */
  private scroll = 0;
  private targetScroll = 0;
  /** Whether a real scroll position has been seen yet — see `setScroll`. */
  private primed = false;

  /** How far in from outside the frame the field has been gathered, 0..1. */
  private assemble = 0;
  private targetAssemble = 0;
  private assemblePrimed = false;

  private pointer = new THREE.Vector2();
  private pointerTarget = new THREE.Vector2();

  private fitDistance = 9;
  /** Solved in `resize`: how far out a particle has to sit to clear the frame. */
  private entryRadius = 9;

  constructor(options: ParticleMorphOptions) {
    this.options = options;
    this.profile = options.reducedMotion ? REDUCED_MOTION : FULL_MOTION;
    this.timeline = buildTimeline(options.logos.length);

    this.canvas = document.createElement("canvas");
    this.canvas.className = "tech-canvas";
    // The cloud is decoration for the labels beside it, which carry the same
    // information as real text.
    this.canvas.setAttribute("aria-hidden", "true");
    options.container.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
      // Nothing reads the buffer back, and not preserving it lets the driver
      // pick the cheaper path.
      preserveDrawingBuffer: false,
    });
    // Transparent, so the section's white — and the survey grid CSS lays behind
    // the canvas — is what the scene is actually composited onto.
    this.renderer.setClearAlpha(0);

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    this.scene.add(this.group);

    this.resize();
    window.addEventListener("resize", this.onResize, { passive: true });
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    this.canvas.addEventListener("webglcontextlost", this.onContextLost);
    this.canvas.addEventListener("webglcontextrestored", this.onContextRestored);
  }

  /**
   * Sample the logos and hand them to the GPU.
   *
   * Kept out of the constructor because it is the one slow step — a few hundred
   * milliseconds of rasterising and scattering — and the caller needs to be
   * able to show something while it runs. It yields between logos, so the
   * loader's progress is real rather than a guess.
   */
  async build(): Promise<void> {
    const { logos, count } = this.options;
    const atlas = await buildShapeAtlas(logos, count, this.options.onBuildProgress);
    if (this.destroyed) return;

    const texture = new THREE.DataTexture(
      atlas.data,
      atlas.texWidth,
      atlas.height,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    // Neighbouring texels are unrelated particles, so any filtering at all
    // would blend one particle's position into the next one's.
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    this.atlasTexture = texture;

    const geometry = new THREE.BufferGeometry();

    // `position` is never read by the shader — every coordinate comes from the
    // atlas — but three sizes the draw call from it, so it has to exist. Zeros
    // keep it cheap; frustum culling is off because the bounding volume this
    // implies has nothing to do with where the vertices end up.
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));

    // Four independent randoms per particle: departure time, radial push,
    // depth throw and size, spin. Three would mean two of those decisions
    // sharing a channel, and a particle that always spins the way it pushes
    // makes the whole field move as one.
    const indices = new Float32Array(count);
    const randoms = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      indices[i] = i;
      randoms[i * 4] = Math.random();
      randoms[i * 4 + 1] = Math.random();
      randoms[i * 4 + 2] = Math.random();
      randoms[i * 4 + 3] = Math.random();
    }
    geometry.setAttribute("aIndex", new THREE.BufferAttribute(indices, 1));
    geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 4));
    this.geometry = geometry;

    this.material = new THREE.ShaderMaterial({
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      transparent: true,
      // Straight alpha over the section's white, not the additive blending this
      // used over black — adding light to a page already at full brightness
      // does nothing at all. Crowded particles now stack toward solid ink, so
      // density reads as weight instead of as glow, and the glow is the pad's
      // job. The fragment shader premultiplies to match the renderer.
      blending: THREE.NormalBlending,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uShapes: { value: texture },
        uTexSize: { value: new THREE.Vector2(atlas.texWidth, atlas.height) },
        uTexWidth: { value: atlas.texWidth },
        uRowsPerShape: { value: atlas.rowsPerShape },
        uFromShape: { value: 0 },
        uToShape: { value: 0 },
        uT: { value: 0 },
        uTime: { value: 0 },
        uSizePx: { value: this.profile.sizePx },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uFitDistance: { value: this.fitDistance },
        uOpacity: { value: this.profile.opacity },
        uStagger: { value: this.profile.stagger },
        uBurst: { value: this.profile.burst },
        uSwirl: { value: this.profile.swirl },
        uTurbulence: { value: this.profile.turbulence },
        uIdle: { value: this.profile.idle },
        uWave: { value: this.profile.wave },
        // Starts parked outside the frame. The section's intro is what gathers
        // it in, so anything that mounts the engine without driving `setAssemble`
        // would get an empty stage — which is the honest default: an ungathered
        // field has not been asked for yet.
        uAssemble: { value: 0 },
        uEntryRadius: { value: this.entryRadius },
        uMouse: { value: new THREE.Vector2() },
        uSeed: { value: 0 },
        uSpinBias: { value: 1 },
        uDensityFrom: { value: 1 },
        uDensityTo: { value: 1 },
        uInkSoft: { value: INK_SOFT },
        uInkDeep: { value: INK_DEEP },
        uInkGlow: { value: INK_GLOW },
      },
    });

    this.densities = atlas.densities;

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.group.add(this.points);

    this.built = true;
    this.clock.start();
    this.start();
  }

  /** Normalised scroll through the section, 0..1. Safe to call every frame. */
  setScroll(progress: number): void {
    // A non-finite value would not just be wrong for one frame — it would be
    // damped into `scroll` and never wash out, leaving the field stuck. Cheap
    // enough to check that there is no reason to trust the caller.
    if (!Number.isFinite(progress)) return;

    const clamped = progress <= 0 ? 0 : progress >= 1 ? 1 : progress;
    this.targetScroll = clamped;

    // Damping is for movement the reader can see. A reading taken before the
    // section is on screen — the first one after the build, or any that arrive
    // while it is scrolled away — is a position, not a movement, and easing
    // toward it would replay every transition in between as a fast-forward the
    // instant the section appeared. Approaching from below is the case that
    // makes this obvious: progress arrives at 1, and without the snap the field
    // would race React through to the last mark in the stack before settling.
    if (!this.primed || !this.active) {
      this.scroll = clamped;
      this.primed = true;
    }
  }

  /**
   * How far the field has been gathered in from outside the frame: 0 leaves
   * every particle parked past the edge of the screen, 1 lands them on the
   * first logo. Safe to call every frame.
   *
   * Damped like the scroll, and snapped for the same reasons — a reading taken
   * while the section is off screen is a position rather than a movement, and
   * easing toward it would play the whole arrival back at whatever speed the
   * damping happened to allow the instant the section appeared.
   */
  setAssemble(value: number): void {
    if (!Number.isFinite(value)) return;

    const clamped = value <= 0 ? 0 : value >= 1 ? 1 : value;
    this.targetAssemble = clamped;

    if (!this.assemblePrimed || !this.active) {
      this.assemble = clamped;
      this.assemblePrimed = true;
    }
  }

  /**
   * Whether the section is on screen.
   *
   * Time only accumulates while it is, which keeps the idle drift from jumping
   * a minute forward when the section scrolls back into view.
   */
  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    if (active) this.start();
  }

  private start(): void {
    if (this.rafId || this.destroyed || !this.built) return;
    this.clock.getDelta();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = (): void => {
    if (this.destroyed) return;

    // Clamped so a backgrounded tab does not resume with one enormous step.
    const dt = Math.min(this.clock.getDelta(), 0.05);

    // Off screen: let the loop end rather than schedule a frame that does
    // nothing. `setActive(true)` restarts it, and `elapsed` not advancing in
    // between is what keeps the idle drift from jumping when it comes back.
    if (!this.active || !this.material) {
      this.rafId = 0;
      return;
    }

    this.rafId = requestAnimationFrame(this.tick);
    this.elapsed += dt;

    this.scroll = damp(this.scroll, this.targetScroll, this.profile.damping, dt);
    this.assemble = damp(this.assemble, this.targetAssemble, this.profile.damping, dt);

    const state = resolve(this.timeline, this.scroll);
    const u = this.material.uniforms;

    u.uTime.value = this.elapsed;
    u.uAssemble.value = this.assemble;
    u.uFromShape.value = state.from;
    u.uToShape.value = state.to;
    u.uT.value = state.t;
    u.uDensityFrom.value = this.densities[state.from] ?? 1;
    u.uDensityTo.value = this.densities[state.to] ?? 1;
    // Both only ever reach the shader multiplied by the burst envelope, so
    // changing them on a segment boundary — where that envelope is zero — is
    // free. Alternating the lean gives consecutive transitions opposite spins.
    u.uSeed.value = state.from;
    u.uSpinBias.value = state.from % 2 === 0 ? 1 : -1;

    const lean = this.profile.mouse;
    this.pointer.x = damp(this.pointer.x, this.pointerTarget.x * lean, 3.5, dt);
    this.pointer.y = damp(this.pointer.y, this.pointerTarget.y * lean, 3.5, dt);
    (u.uMouse.value as THREE.Vector2).set(this.pointer.x, this.pointer.y);

    // Restrained on purpose: enough rotation to read the cloud as a solid with
    // a front and a back, nowhere near enough to make the mark ambiguous.
    this.group.rotation.y = this.pointer.x * 0.28 + Math.sin(this.elapsed * 0.08) * 0.05 * lean;
    this.group.rotation.x = -this.pointer.y * 0.2 + Math.sin(this.elapsed * 0.11) * 0.03 * lean;

    // Restrained: the mark now fills most of the stage, so a camera that
    // wandered would push its edges out of frame.
    this.camera.position.x = this.pointer.x * 0.3;
    this.camera.position.y = this.pointer.y * 0.12 + (state.progress - 0.5) * 0.16 * lean;
    this.camera.position.z = this.fitDistance;
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
    this.options.onFrame?.(state);
  };

  private onResize = (): void => this.resize();

  /**
   * Solve the camera for the composition.
   *
   * `unit` is the world distance that spans one unit of normalised device
   * height at the origin plane, so a screen fraction converts to a world height
   * by multiplying and back by dividing. Fitting is then two constraints: the
   * mark must span exactly the band it was given, and it may not reach the side
   * of the frame. Whichever needs more room wins, which is what lets a narrow
   * window shrink the scene instead of cropping it.
   */
  private resize(): void {
    const { clientWidth, clientHeight } = this.options.container;
    const width = Math.max(1, clientWidth);
    const height = Math.max(1, clientHeight);

    // Capped at 2: past that the pixels are invisible and the fill cost is not.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    // `false` — the canvas is sized by CSS, and letting three write inline
    // dimensions would fight it on every resize.
    this.renderer.setSize(width, height, false);

    const aspect = width / height;
    this.camera.aspect = aspect;

    const layout = aspect < 1 ? PORTRAIT : LANDSCAPE;
    // Screen fraction, measured from the top, to normalised device Y.
    const ndc = (fraction: number) => 1 - 2 * fraction;

    const top = ndc(layout.markTop);
    const bottom = ndc(layout.markBottom);

    const byHeight = (2 * LOGO_RADIUS) / (top - bottom);
    const byWidth = LOGO_RADIUS / (aspect * SAFE_X);
    const unit = Math.max(byHeight, byWidth);

    const halfFov = (FOV * Math.PI) / 360;
    this.fitDistance = unit / Math.tan(halfFov);

    // `unit` is the frame's world half-height at the origin plane, so this is
    // the distance to its corner — the shortest radius that is outside the
    // frame in every direction rather than only along the axes. The margin on
    // top is what keeps a particle's own spin and turbulence from swinging it
    // back into view before it has been asked for.
    this.entryRadius = Math.hypot(unit * aspect, unit) * 1.12 + 1.2;

    this.group.position.y = ((top + bottom) / 2) * unit;

    this.camera.position.z = this.fitDistance;
    this.camera.updateProjectionMatrix();

    if (this.material) {
      this.material.uniforms.uPixelRatio.value = dpr;
      this.material.uniforms.uFitDistance.value = this.fitDistance;
      this.material.uniforms.uEntryRadius.value = this.entryRadius;
    }
  }

  private onPointerMove = (event: PointerEvent): void => {
    this.pointerTarget.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      -((event.clientY / window.innerHeight) * 2 - 1)
    );
  };

  /**
   * A lost context is recoverable, so hold the loop and let the browser hand
   * it back — three re-uploads the geometry and the atlas on the next render.
   * Without `preventDefault` the restore event never fires at all.
   */
  private onContextLost = (event: Event): void => {
    event.preventDefault();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  };

  private onContextRestored = (): void => {
    if (!this.destroyed) this.start();
  };

  destroy(): void {
    this.destroyed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;

    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);

    if (this.points) this.group.remove(this.points);
    this.geometry?.dispose();
    this.material?.dispose();
    this.atlasTexture?.dispose();
    this.renderer.dispose();
    // Frees the GPU context immediately rather than waiting for the canvas to
    // be collected, which matters in dev where the effect remounts.
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
