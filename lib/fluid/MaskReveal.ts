import * as THREE from "three";
import {
  advectionFragment,
  curlFragment,
  divergenceFragment,
  gradientSubtractFragment,
  maskFragment,
  maskVertex,
  passVertex,
  pressureFragment,
  splatFragment,
  vorticityFragment,
} from "./shaders";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Anything the engine can turn into a texture: a CSS colour, an image or video
 * URL, a live `<video>`/`<canvas>`, or a live `<svg>`/`<img>` (which gets
 * rasterised in place, keeping its position and size on screen).
 */
export type LayerSource =
  | string
  | SVGElement
  | HTMLVideoElement
  | HTMLCanvasElement
  | HTMLImageElement
  | { video: string }
  | { image: string }
  | { color: string }
  | null;

export interface FluidSettings {
  /** Resolution of the velocity/pressure grid. */
  simResolution: number;
  /** Resolution of the dye (mask) grid — the thing you actually see. */
  dyeResolution: number;
  /** Per-frame velocity decay. Lower = the swirl dies out faster. */
  velocityDissipation: number;
  /** Per-frame dye decay. Lower = the reveal heals shut faster. */
  dyeDissipation: number;
  /** Jacobi iterations for the pressure solve. Higher = more accurate. */
  pressureIterations: number;
  /** Vorticity confinement. 0 = smooth ink, higher = curly turbulence. */
  curlStrength: number;
  /** Gaussian radius of the pointer splat. */
  splatRadius: number;
  /** How hard the pointer pushes the fluid. */
  splatForce: number;
  /** Multiplier on dye before the mask threshold — grows the revealed area. */
  revealSize: number;
  /** Threshold where the reveal starts. */
  edgeSoftness: number;
  /** Width of the smoothstep ramp. Small = crisp liquid edge. */
  edgeWidth: number;
}

export interface SetLayersOptions {
  base?: LayerSource;
  reveal?: LayerSource;
  /** Background painted behind a baked base layer. */
  baseBg?: string | null;
  /** Background painted behind a baked reveal layer. */
  revealBg?: string | null;
  /** Hide the source element in the DOM once it has been baked into a texture. */
  hideOriginal?: boolean;
}

export interface MaskRevealOptions {
  container: HTMLElement;
  base?: LayerSource;
  reveal?: LayerSource;
  settings?: Partial<FluidSettings>;
  /**
   * While this returns false the simulation is cleared and parked — used to
   * switch the effect off once the hero is scrolled away behind the showreel.
   */
  isActive?: () => boolean;
}

/** Tuned to match the original site exactly. */
export const DEFAULT_SETTINGS: FluidSettings = {
  simResolution: 256,
  dyeResolution: 512,
  velocityDissipation: 0.962,
  dyeDissipation: 0.988,
  pressureIterations: 20,
  curlStrength: 0,
  splatRadius: 0.00006,
  splatForce: 5900,
  revealSize: 3.9,
  edgeSoftness: 0.5,
  edgeWidth: 0.01,
};

interface DoubleFBO {
  read: THREE.WebGLRenderTarget;
  write: THREE.WebGLRenderTarget;
  swap(): void;
}

interface ResolvedSource {
  texture: THREE.Texture;
  aspect: number;
  ownedVideo?: HTMLVideoElement | null;
  onLoaded?: ((cb: (aspect: number) => void) => void) | null;
}

/* -------------------------------------------------------------------------- */
/*  Source resolution helpers                                                  */
/* -------------------------------------------------------------------------- */

/*
 * This is a 2D compositing pass, not a lit scene: the mask shader writes
 * `gl_FragColor` straight to the framebuffer with no linear -> sRGB encode.
 * So the textures must NOT be tagged sRGB either — that would make the GPU
 * decode them to linear on sample, and the un-encoded result renders visibly
 * darker than the same image in the DOM (a 188 midtone lands at 128).
 *
 * Tagging everything linear takes the texels through untouched, so the canvas
 * matches the source `<img>` and `.video-hero-bg` byte for byte.
 */
const TEXTURE_COLOR_SPACE = THREE.LinearSRGBColorSpace;

const IMAGE_RE = /^(https?:|data:image|\/|\.{0,2}\/)/;
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i;
const VIDEO_RE = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;

const looksLikeImage = (s: string) => IMAGE_RE.test(s) || IMAGE_EXT_RE.test(s);
const looksLikeVideo = (s: string) => VIDEO_RE.test(s) || /^data:video\//i.test(s);

/** A 1x1 texture of a flat RGBA colour. */
function solidTexture(r: number, g: number, b: number, a: number): THREE.Texture {
  const data = new Uint8Array([r, g, b, a]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = TEXTURE_COLOR_SPACE;
  return tex;
}

/** Resolve any CSS colour string (`red`, `#fff`, `rgba(...)`) to RGBA bytes. */
function parseCssColor(value: string): [number, number, number, number] {
  if (typeof document === "undefined") return [0, 0, 0, 255];
  const probe = document.createElement("div");
  probe.style.color = "";
  probe.style.color = value;
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  document.body.removeChild(probe);

  const match = computed.match(/rgba?\(([^)]+)\)/);
  if (!match) return [0, 0, 0, 255];
  const parts = match[1].split(",").map((n) => parseFloat(n.trim()));
  return [
    Math.round(parts[0] || 0),
    Math.round(parts[1] || 0),
    Math.round(parts[2] || 0),
    parts.length === 4 ? Math.round((parts[3] || 0) * 255) : 255,
  ];
}

function primeVideo(video: HTMLVideoElement) {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("muted", "");

  const play = () => {
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  };
  play();
  video.addEventListener("loadeddata", play, { once: true });
  video.addEventListener("canplay", play, { once: true });

  // Browsers that still refuse autoplay: start on the first user gesture.
  const onGesture = () => {
    play();
    window.removeEventListener("pointerdown", onGesture);
    window.removeEventListener("touchstart", onGesture);
    window.removeEventListener("keydown", onGesture);
  };
  window.addEventListener("pointerdown", onGesture, { once: true, passive: true });
  window.addEventListener("touchstart", onGesture, { once: true, passive: true });
  window.addEventListener("keydown", onGesture, { once: true });
}

function videoTexture(video: HTMLVideoElement): ResolvedSource {
  primeVideo(video);
  const texture = new THREE.VideoTexture(video);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = TEXTURE_COLOR_SPACE;
  texture.generateMipmaps = false;

  const aspectOf = () =>
    video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;

  return {
    texture,
    aspect: aspectOf(),
    onLoaded: (cb) => {
      if (video.videoWidth && video.videoHeight) {
        cb(aspectOf());
        return;
      }
      const handler = () => {
        if (video.videoWidth && video.videoHeight) cb(aspectOf());
      };
      video.addEventListener("loadedmetadata", handler, { once: true });
      video.addEventListener("loadeddata", handler, { once: true });
    },
  };
}

function createOffscreenVideo(src: string): HTMLVideoElement {
  const video = document.createElement("video");
  video.src = src;
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("muted", "");
  video.autoplay = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  Object.assign(video.style, {
    position: "absolute",
    left: "-9999px",
    top: "-9999px",
    width: "1px",
    height: "1px",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(video);
  return video;
}

function destroyVideo(video: HTMLVideoElement | null) {
  if (!video) return;
  try {
    video.pause();
  } catch {}
  try {
    video.removeAttribute("src");
    video.load();
  } catch {}
  video.parentNode?.removeChild(video);
}

function resolveSource(source: LayerSource): ResolvedSource {
  if (!source) return { texture: solidTexture(0, 0, 0, 0), aspect: 1, onLoaded: null };

  if (typeof source === "object" && !(source instanceof Element)) {
    if ("video" in source && typeof source.video === "string") {
      const video = createOffscreenVideo(source.video);
      const resolved = videoTexture(video);
      resolved.ownedVideo = video;
      return resolved;
    }
    if ("image" in source && typeof source.image === "string") return resolveSource(source.image);
    if ("color" in source && typeof source.color === "string") return resolveSource(source.color);
  }

  if (typeof source === "string") {
    if (looksLikeVideo(source)) {
      const video = createOffscreenVideo(source);
      const resolved = videoTexture(video);
      resolved.ownedVideo = video;
      return resolved;
    }
    if (looksLikeImage(source)) {
      const loader = new THREE.TextureLoader();
      let aspect = 1;
      let notify: ((a: number) => void) | null = null;
      const texture = loader.load(source, (tex) => {
        const img = tex.image as HTMLImageElement | undefined;
        if (img?.naturalWidth) {
          aspect = img.naturalWidth / img.naturalHeight;
          notify?.(aspect);
        }
      });
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.colorSpace = TEXTURE_COLOR_SPACE;
      return {
        texture,
        aspect,
        onLoaded: (cb) => {
          notify = cb;
        },
      };
    }
    // Fall through: treat it as a CSS colour.
    const [r, g, b, a] = parseCssColor(source);
    return { texture: solidTexture(r, g, b, a), aspect: 1, onLoaded: null };
  }

  if (source instanceof HTMLVideoElement) return videoTexture(source);

  if (source instanceof HTMLCanvasElement || source instanceof HTMLImageElement) {
    const texture = new THREE.Texture(source);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = TEXTURE_COLOR_SPACE;
    const w =
      (source as HTMLImageElement).naturalWidth || (source as HTMLCanvasElement).width || 1;
    const h =
      (source as HTMLImageElement).naturalHeight || (source as HTMLCanvasElement).height || 1;
    return { texture, aspect: w / h, onLoaded: null };
  }

  return { texture: solidTexture(0, 0, 0, 0), aspect: 1, onLoaded: null };
}

/* -------------------------------------------------------------------------- */
/*  DOM baking                                                                 */
/* -------------------------------------------------------------------------- */

/** Elements the engine rasterises in place rather than turning into a texture. */
type BakeableElement = SVGElement | HTMLImageElement;

const isBakeable = (v: unknown): v is BakeableElement =>
  v instanceof SVGElement || v instanceof HTMLImageElement;

function svgToImage(svg: SVGElement, width: number, height: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const clone = svg.cloneNode(true) as SVGElement;
    if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(Math.max(1, Math.round(width))));
    clone.setAttribute("height", String(Math.max(1, Math.round(height))));
    clone.style.visibility = "visible";
    clone.style.opacity = "1";
    clone.style.display = "";
    clone.removeAttribute("hidden");

    // `fill="currentColor"` needs a resolved colour once detached from the DOM.
    const color = getComputedStyle(svg).color;
    if (color) clone.setAttribute("color", color);

    const markup = new XMLSerializer().serializeToString(clone);
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Wait for an `<img>` to have pixels, so `drawImage` does not draw a blank. */
async function ensureDecoded(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth) return;
  try {
    await img.decode();
  } catch {
    await new Promise<void>((resolve) => {
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
    });
  }
}

/**
 * Rasterise a live `<svg>` or `<img>` onto a canvas the size of the container,
 * positioned exactly where it sits on screen — so the texture lines up
 * pixel-for-pixel with the DOM element it replaces.
 *
 * An `<img>` is drawn through its computed `object-fit`, so a `cover` banner
 * bakes with the same crop the browser would paint.
 */
async function bakeDomLayer(
  el: BakeableElement,
  container: HTMLElement,
  background: string | null = null
): Promise<HTMLCanvasElement> {
  const containerRect = container.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const width = Math.max(1, Math.round(containerRect.width * dpr));
  const height = Math.max(1, Math.round(containerRect.height * dpr));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, width, height);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  const x = (elRect.left - containerRect.left) * dpr;
  const y = (elRect.top - containerRect.top) * dpr;
  const w = Math.max(1, elRect.width * dpr);
  const h = Math.max(1, elRect.height * dpr);

  if (el instanceof HTMLImageElement) {
    await ensureDecoded(el);
    if (!el.naturalWidth) return canvas;

    const fit = getComputedStyle(el).objectFit || "fill";
    const sw = el.naturalWidth;
    const sh = el.naturalHeight;

    if (fit === "cover" || fit === "contain") {
      // Scale the source to the box, then centre it — cover crops the source,
      // contain insets the destination.
      const scale =
        fit === "cover" ? Math.max(w / sw, h / sh) : Math.min(w / sw, h / sh);
      const drawW = sw * scale;
      const drawH = sh * scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.drawImage(el, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
      ctx.restore();
    } else {
      ctx.drawImage(el, x, y, w, h);
    }

    return canvas;
  }

  const img = await svgToImage(el, w, h);
  ctx.drawImage(img, x, y, w, h);

  return canvas;
}

/* -------------------------------------------------------------------------- */
/*  Engine                                                                     */
/* -------------------------------------------------------------------------- */

export class MaskReveal {
  private container: HTMLElement;
  private settings: FluidSettings;
  private isActive: () => boolean;
  private disposed = false;

  private canvas!: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;

  private quadScene!: THREE.Scene;
  private quadCamera!: THREE.OrthographicCamera;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;

  private mouse = { x: 0.5, y: 0.5 };
  private prevMouse = { x: 0.5, y: 0.5 };
  private mouseHasMoved = false;
  private size = { width: 1, height: 1 };

  private baseTexture!: THREE.Texture;
  private revealTexture!: THREE.Texture;
  private baseAspect = 1;
  private revealAspect = 16 / 9;

  private ownedVideos: { base: HTMLVideoElement | null; reveal: HTMLVideoElement | null } = {
    base: null,
    reveal: null,
  };
  private domLayerSources: { base: BakeableElement | null; reveal: BakeableElement | null } = {
    base: null,
    reveal: null,
  };
  private domLayerBg: { base: string | null; reveal: string | null } = { base: null, reveal: null };

  private velocity!: DoubleFBO;
  private pressure!: DoubleFBO;
  private dye!: DoubleFBO;
  private curlRT!: THREE.WebGLRenderTarget;
  private divergenceRT!: THREE.WebGLRenderTarget;

  private simTexelSize!: THREE.Vector2;
  private dyeTexelSize!: THREE.Vector2;

  private quadGeo!: THREE.PlaneGeometry;
  private planeGeo!: THREE.PlaneGeometry;
  private quadMesh!: THREE.Mesh;
  private planeMesh!: THREE.Mesh;

  private curlMat!: THREE.ShaderMaterial;
  private vorticityMat!: THREE.ShaderMaterial;
  private advectionMat!: THREE.ShaderMaterial;
  private splatMat!: THREE.ShaderMaterial;
  private divergenceMat!: THREE.ShaderMaterial;
  private pressureMat!: THREE.ShaderMaterial;
  private gradientSubMat!: THREE.ShaderMaterial;
  private maskMaterial!: THREE.ShaderMaterial;

  private rafId = 0;
  private maskCleaned = false;
  private resizeObserver: ResizeObserver | null = null;
  private rebakeTimeout: ReturnType<typeof setTimeout> | null = null;
  private afterRender: (() => void)[] = [];

  private onMouseMove!: (e: MouseEvent) => void;
  private onTouchMove!: (e: TouchEvent) => void;
  private onResize!: () => void;

  constructor(options: MaskRevealOptions) {
    this.container = options.container;
    this.settings = { ...DEFAULT_SETTINGS, ...(options.settings ?? {}) };
    this.isActive = options.isActive ?? (() => true);

    this.buildCanvas();
    this.buildRenderer();
    this.buildScenes();
    this.buildTextures(options.base ?? null, options.reveal ?? null);
    this.initFluid();
    this.buildMaskMaterial();
    this.buildMeshes();
    this.bindEvents();
    this.resize();

    this.animate = this.animate.bind(this);
    this.rafId = requestAnimationFrame(this.animate);
  }

  /* --- setup ------------------------------------------------------------- */

  private buildCanvas() {
    const canvas = document.createElement("canvas");
    canvas.className = "mask-reveal-canvas";
    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      pointerEvents: "none",
      zIndex: "1",
    });

    if (getComputedStyle(this.container).position === "static") {
      this.container.style.position = "relative";
    }

    // Sit above the background layer but below the hero content.
    const hero = this.container.querySelector(".section.hero-home");
    if (hero) this.container.insertBefore(canvas, hero);
    else this.container.appendChild(canvas);

    this.canvas = canvas;
  }

  private buildRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    // Matches TEXTURE_COLOR_SPACE: nothing converts on the way in or out.
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.autoClear = false;
  }

  private buildScenes() {
    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.set(0, 0, 5);
  }

  private createRT(width: number, height: number, filter: THREE.MagnificationTextureFilter) {
    return new THREE.WebGLRenderTarget(width, height, {
      minFilter: filter,
      magFilter: filter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    });
  }

  private createDoubleFBO(
    width: number,
    height: number,
    filter: THREE.MagnificationTextureFilter
  ): DoubleFBO {
    return {
      read: this.createRT(width, height, filter),
      write: this.createRT(width, height, filter),
      swap() {
        const tmp = this.read;
        this.read = this.write;
        this.write = tmp;
      },
    };
  }

  private makePassMat(fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
    return new THREE.ShaderMaterial({
      vertexShader: passVertex,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
  }

  private initFluid() {
    const s = this.settings;
    const sim = s.simResolution;
    const dye = s.dyeResolution;

    this.velocity = this.createDoubleFBO(sim, sim, THREE.LinearFilter);
    this.pressure = this.createDoubleFBO(sim, sim, THREE.NearestFilter);
    this.dye = this.createDoubleFBO(dye, dye, THREE.LinearFilter);
    this.curlRT = this.createRT(sim, sim, THREE.NearestFilter);
    this.divergenceRT = this.createRT(sim, sim, THREE.NearestFilter);

    this.simTexelSize = new THREE.Vector2(1 / sim, 1 / sim);
    this.dyeTexelSize = new THREE.Vector2(1 / dye, 1 / dye);

    this.quadGeo = new THREE.PlaneGeometry(2, 2);

    this.curlMat = this.makePassMat(curlFragment, {
      uVelocity: { value: null },
      uTexelSize: { value: this.simTexelSize },
    });
    this.vorticityMat = this.makePassMat(vorticityFragment, {
      uVelocity: { value: null },
      uCurl: { value: null },
      uTexelSize: { value: this.simTexelSize },
      uCurlStrength: { value: s.curlStrength },
      uDt: { value: 0.016 },
    });
    this.advectionMat = this.makePassMat(advectionFragment, {
      uVelocity: { value: null },
      uSource: { value: null },
      uTexelSize: { value: this.simTexelSize },
      uDt: { value: 1 },
      uDissipation: { value: s.velocityDissipation },
    });
    this.splatMat = this.makePassMat(splatFragment, {
      uTarget: { value: null },
      uAspectRatio: { value: 1 },
      uPoint: { value: new THREE.Vector2() },
      uColor: { value: new THREE.Vector3() },
      uRadius: { value: s.splatRadius },
    });
    this.divergenceMat = this.makePassMat(divergenceFragment, {
      uVelocity: { value: null },
      uTexelSize: { value: this.simTexelSize },
    });
    this.pressureMat = this.makePassMat(pressureFragment, {
      uPressure: { value: null },
      uDivergence: { value: null },
      uTexelSize: { value: this.simTexelSize },
    });
    this.gradientSubMat = this.makePassMat(gradientSubtractFragment, {
      uPressure: { value: null },
      uVelocity: { value: null },
      uTexelSize: { value: this.simTexelSize },
    });

    this.quadMesh = new THREE.Mesh(this.quadGeo, this.curlMat);
    this.quadScene.add(this.quadMesh);
  }

  private buildTextures(base: LayerSource, reveal: LayerSource) {
    const b = resolveSource(base);
    this.baseTexture = b.texture;
    this.baseAspect = b.aspect;
    if (b.ownedVideo) this.ownedVideos.base = b.ownedVideo;
    b.onLoaded?.((a) => {
      this.baseAspect = a;
    });

    const r = resolveSource(reveal);
    this.revealTexture = r.texture;
    this.revealAspect = r.aspect;
    if (r.ownedVideo) this.ownedVideos.reveal = r.ownedVideo;
    r.onLoaded?.((a) => {
      this.revealAspect = a;
    });
  }

  private buildMaskMaterial() {
    const s = this.settings;
    this.maskMaterial = new THREE.ShaderMaterial({
      vertexShader: maskVertex,
      fragmentShader: maskFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uBaseTexture: { value: this.baseTexture },
        uRevealTexture: { value: this.revealTexture },
        uDye: { value: null },
        uRevealSize: { value: s.revealSize },
        uEdgeSoftness: { value: s.edgeSoftness },
        uEdgeWidth: { value: s.edgeWidth },
        uBaseImageAspect: { value: this.baseAspect },
        uRevealImageAspect: { value: this.revealAspect },
        uPlaneAspect: { value: 1 },
      },
    });
  }

  private buildMeshes() {
    this.planeGeo = new THREE.PlaneGeometry(1, 1, 1, 1);
    this.planeMesh = new THREE.Mesh(this.planeGeo, this.maskMaterial);
    this.scene.add(this.planeMesh);
  }

  /* --- public API -------------------------------------------------------- */

  /** Swap either layer at runtime. SVG elements are baked to a canvas first. */
  async setLayers({
    base,
    reveal,
    hideOriginal = true,
    baseBg = null,
    revealBg = null,
  }: SetLayersOptions = {}) {
    if (this.disposed) return;

    const baked: BakeableElement[] = [];
    const prepare = async (src: LayerSource, bg: string | null = null): Promise<LayerSource> => {
      if (isBakeable(src)) {
        baked.push(src);
        return await bakeDomLayer(src, this.container, bg);
      }
      return src;
    };

    if (base !== undefined) {
      this.domLayerBg.base = isBakeable(base) ? baseBg : null;
      const prepared = await prepare(base, baseBg);
      this.domLayerSources.base = isBakeable(base) ? base : null;

      const resolved = resolveSource(prepared);
      this.baseTexture?.dispose?.();
      if (this.ownedVideos.base) destroyVideo(this.ownedVideos.base);

      this.baseTexture = resolved.texture;
      this.baseAspect = resolved.aspect;
      this.ownedVideos.base = resolved.ownedVideo ?? null;
      resolved.onLoaded?.((a) => {
        this.baseAspect = a;
        this.maskMaterial.uniforms.uBaseImageAspect.value = a;
      });
      this.maskMaterial.uniforms.uBaseTexture.value = this.baseTexture;
      this.maskMaterial.uniforms.uBaseImageAspect.value = this.baseAspect;
    }

    if (reveal !== undefined) {
      this.domLayerBg.reveal = isBakeable(reveal) ? revealBg : null;
      const prepared = await prepare(reveal, revealBg);
      this.domLayerSources.reveal = isBakeable(reveal) ? reveal : null;

      const resolved = resolveSource(prepared);
      this.revealTexture?.dispose?.();
      if (this.ownedVideos.reveal) destroyVideo(this.ownedVideos.reveal);

      this.revealTexture = resolved.texture;
      this.revealAspect = resolved.aspect;
      this.ownedVideos.reveal = resolved.ownedVideo ?? null;
      resolved.onLoaded?.((a) => {
        this.revealAspect = a;
        this.maskMaterial.uniforms.uRevealImageAspect.value = a;
      });
      this.maskMaterial.uniforms.uRevealTexture.value = this.revealTexture;
      this.maskMaterial.uniforms.uRevealImageAspect.value = this.revealAspect;
    }

    if (hideOriginal && baked.length) {
      // Not yet: the canvas has the new texture but has not drawn it. Hiding
      // the source now leaves one frame where neither is visible, which reads
      // as a flicker. Hand over once the frame carrying it is on screen.
      this.onNextRender(() => {
        baked.forEach((el) => {
          el.dataset._maskHidden = "1";
          el.style.visibility = "hidden";
        });
      });
    }
  }

  updateSettings(next: Partial<FluidSettings>) {
    Object.assign(this.settings, next);
  }

  /**
   * Run `cb` immediately after the next visible frame is drawn, before the
   * browser paints it. Use it to swap DOM state in lockstep with the canvas,
   * so there is never a frame where neither is showing the layer.
   */
  onNextRender(cb: () => void) {
    if (this.disposed) return;
    this.afterRender.push(cb);
  }

  /* --- events & layout --------------------------------------------------- */

  private bindEvents() {
    this.onMouseMove = (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - rect.left) / rect.width;
      this.mouse.y = 1 - (e.clientY - rect.top) / rect.height;
      this.mouseHasMoved = true;
    };
    this.onTouchMove = (e: TouchEvent) => {
      if (!e.touches.length) return;
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = (touch.clientX - rect.left) / rect.width;
      this.mouse.y = 1 - (touch.clientY - rect.top) / rect.height;
      this.mouseHasMoved = true;
    };
    this.onResize = () => this.resize();

    window.addEventListener("mousemove", this.onMouseMove, { passive: true });
    window.addEventListener("touchmove", this.onTouchMove, { passive: true });
    window.addEventListener("resize", this.onResize);

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
    }
  }

  private resize() {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    this.size = { width, height };
    this.renderer.setSize(width, height, false);

    const aspect = width / height;
    this.camera.aspect = aspect;
    this.camera.fov = 50;
    this.camera.updateProjectionMatrix();

    // Scale the plane so it exactly fills the camera frustum at z = 0.
    const dist = this.camera.position.z;
    const vFov = (this.camera.fov * Math.PI) / 180;
    const planeHeight = 2 * Math.tan(vFov / 2) * dist;
    const planeWidth = planeHeight * aspect;
    this.planeMesh.scale.set(planeWidth, planeHeight, 1);

    this.maskMaterial.uniforms.uPlaneAspect.value = aspect;
    this.scheduleDomRebake();
  }

  /** A baked element is resolution-dependent, so re-bake it after a resize. */
  private scheduleDomRebake() {
    const { base, reveal } = this.domLayerSources;
    if (!base && !reveal) return;

    if (this.rebakeTimeout) clearTimeout(this.rebakeTimeout);
    this.rebakeTimeout = setTimeout(() => {
      const opts: SetLayersOptions = {};
      if (isBakeable(base)) {
        opts.base = base;
        opts.baseBg = this.domLayerBg.base;
      }
      if (isBakeable(reveal)) {
        opts.reveal = reveal;
        opts.revealBg = this.domLayerBg.reveal;
      }
      if (Object.keys(opts).length) {
        opts.hideOriginal = false;
        this.setLayers(opts).catch(() => {});
      }
    }, 120);
  }

  /** 0 while the hero is fully in view, ramping to 1 as it scrolls away. */
  private computeScrollFade() {
    const rect = this.canvas.getBoundingClientRect();
    const height = rect.height || 1;
    let fade = -rect.top / height;
    if (fade < 0) fade = 0;
    if (fade > 1) fade = 1;
    return fade;
  }

  /* --- render loop ------------------------------------------------------- */

  private clearFluid() {
    const clear = (rt: THREE.WebGLRenderTarget) => {
      this.renderer.setRenderTarget(rt);
      this.renderer.clear();
    };
    clear(this.dye.read);
    clear(this.dye.write);
    clear(this.velocity.read);
    clear(this.velocity.write);
    clear(this.pressure.read);
    clear(this.pressure.write);
    this.renderer.setRenderTarget(null);
  }

  private renderClean() {
    this.maskMaterial.uniforms.uDye.value = this.dye.read.texture;
    this.renderVisible();
  }

  /**
   * The visible pass. Callbacks queued with `onNextRender` run straight after
   * it — still inside this frame's rAF, so the DOM changes they make and the
   * pixels just drawn reach the compositor in the same paint.
   */
  private renderVisible() {
    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    if (this.afterRender.length) {
      const queued = this.afterRender;
      this.afterRender = [];
      for (const cb of queued) cb();
    }
  }

  private animate() {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);

    // Parked: wipe the sim once, draw the untouched base, then idle.
    if (!this.isActive()) {
      if (!this.maskCleaned) {
        this.clearFluid();
        this.renderClean();
        this.maskCleaned = true;
      } else if (this.afterRender.length) {
        // Scrolled past before the layers finished baking — draw once anyway,
        // otherwise the queued DOM handoff would never run.
        this.renderClean();
      }
      return;
    }

    if (this.maskCleaned) {
      this.maskCleaned = false;
      this.prevMouse.x = this.mouse.x;
      this.prevMouse.y = this.mouse.y;
      this.mouseHasMoved = false;
    }

    this.step();
  }

  private renderPass(material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quadMesh.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  private step() {
    const s = this.settings;
    const aspect = this.size.width / this.size.height;

    // Fade the effect out as the hero scrolls away.
    const fade = this.computeScrollFade();
    const fadeSq = fade * fade;
    const strength = 1 - fadeSq;

    if (this.mouseHasMoved) {
      const dx = this.mouse.x - this.prevMouse.x;
      const dy = this.mouse.y - this.prevMouse.y;

      if (Math.sqrt(dx * dx + dy * dy) > 0 && strength > 0.001) {
        // Push the velocity field along the pointer's motion vector.
        this.splatMat.uniforms.uTarget.value = this.velocity.read.texture;
        this.splatMat.uniforms.uAspectRatio.value = aspect;
        this.splatMat.uniforms.uPoint.value.set(this.mouse.x, this.mouse.y);
        this.splatMat.uniforms.uColor.value.set(
          dx * s.splatForce * strength,
          dy * s.splatForce * strength,
          0
        );
        this.splatMat.uniforms.uRadius.value = s.splatRadius;
        this.renderPass(this.splatMat, this.velocity.write);
        this.velocity.swap();

        // Drop dye at the same point — this is what becomes the mask.
        this.splatMat.uniforms.uTarget.value = this.dye.read.texture;
        this.splatMat.uniforms.uColor.value.set(strength, strength, strength);
        this.splatMat.uniforms.uRadius.value = s.splatRadius;
        this.renderPass(this.splatMat, this.dye.write);
        this.dye.swap();
      }

      this.prevMouse.x = this.mouse.x;
      this.prevMouse.y = this.mouse.y;
    }

    // Vorticity confinement.
    this.curlMat.uniforms.uVelocity.value = this.velocity.read.texture;
    this.renderPass(this.curlMat, this.curlRT);

    this.vorticityMat.uniforms.uVelocity.value = this.velocity.read.texture;
    this.vorticityMat.uniforms.uCurl.value = this.curlRT.texture;
    this.vorticityMat.uniforms.uCurlStrength.value = s.curlStrength;
    this.vorticityMat.uniforms.uDt.value = 0.016;
    this.renderPass(this.vorticityMat, this.velocity.write);
    this.velocity.swap();

    // Advect velocity through itself.
    this.advectionMat.uniforms.uVelocity.value = this.velocity.read.texture;
    this.advectionMat.uniforms.uSource.value = this.velocity.read.texture;
    this.advectionMat.uniforms.uTexelSize.value = this.simTexelSize;
    this.advectionMat.uniforms.uDissipation.value = s.velocityDissipation;
    this.renderPass(this.advectionMat, this.velocity.write);
    this.velocity.swap();

    // Advect the dye — healing shut faster the further the hero is scrolled.
    const dyeDissipation = s.dyeDissipation + (0.97 - s.dyeDissipation) * fadeSq;
    this.advectionMat.uniforms.uVelocity.value = this.velocity.read.texture;
    this.advectionMat.uniforms.uSource.value = this.dye.read.texture;
    this.advectionMat.uniforms.uTexelSize.value = this.dyeTexelSize;
    this.advectionMat.uniforms.uDissipation.value = dyeDissipation;
    this.renderPass(this.advectionMat, this.dye.write);
    this.dye.swap();

    // Projection: make the velocity field divergence-free.
    this.divergenceMat.uniforms.uVelocity.value = this.velocity.read.texture;
    this.renderPass(this.divergenceMat, this.divergenceRT);

    this.renderer.setRenderTarget(this.pressure.read);
    this.renderer.clear();
    this.renderer.setRenderTarget(null);

    this.pressureMat.uniforms.uDivergence.value = this.divergenceRT.texture;
    for (let i = 0; i < s.pressureIterations; i++) {
      this.pressureMat.uniforms.uPressure.value = this.pressure.read.texture;
      this.renderPass(this.pressureMat, this.pressure.write);
      this.pressure.swap();
    }

    this.gradientSubMat.uniforms.uPressure.value = this.pressure.read.texture;
    this.gradientSubMat.uniforms.uVelocity.value = this.velocity.read.texture;
    this.renderPass(this.gradientSubMat, this.velocity.write);
    this.velocity.swap();

    // A video layer's aspect only becomes known once it has metadata.
    const revealImage = this.revealTexture?.image as HTMLVideoElement | undefined;
    if (revealImage instanceof HTMLVideoElement && revealImage.videoWidth && revealImage.videoHeight) {
      const a = revealImage.videoWidth / revealImage.videoHeight;
      if (Math.abs(a - this.revealAspect) > 0.001) this.revealAspect = a;
    }

    const u = this.maskMaterial.uniforms;
    u.uDye.value = this.dye.read.texture;
    u.uRevealSize.value = s.revealSize;
    u.uEdgeSoftness.value = s.edgeSoftness;
    u.uEdgeWidth.value = s.edgeWidth;
    u.uBaseImageAspect.value = this.baseAspect;
    u.uRevealImageAspect.value = this.revealAspect;

    this.renderVisible();
  }

  /* --- teardown ---------------------------------------------------------- */

  destroy() {
    if (this.disposed) return;
    this.disposed = true;

    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.rebakeTimeout) clearTimeout(this.rebakeTimeout);
    // Never hand over to a canvas that is going away.
    this.afterRender = [];

    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("touchmove", this.onTouchMove);
    window.removeEventListener("resize", this.onResize);
    this.resizeObserver?.disconnect();

    const disposeFBO = (fbo?: DoubleFBO) => {
      fbo?.read?.dispose();
      fbo?.write?.dispose();
    };
    disposeFBO(this.velocity);
    disposeFBO(this.pressure);
    disposeFBO(this.dye);
    this.curlRT?.dispose();
    this.divergenceRT?.dispose();
    this.quadGeo?.dispose();
    this.planeGeo?.dispose();

    [
      this.curlMat,
      this.vorticityMat,
      this.advectionMat,
      this.splatMat,
      this.divergenceMat,
      this.pressureMat,
      this.gradientSubMat,
      this.maskMaterial,
    ].forEach((m) => m?.dispose());

    this.baseTexture?.dispose?.();
    this.revealTexture?.dispose?.();
    this.renderer?.dispose();

    destroyVideo(this.ownedVideos.base);
    destroyVideo(this.ownedVideos.reveal);

    // Restore anything we hid in the DOM when baking it into a texture.
    for (const el of Object.values(this.domLayerSources)) {
      if (isBakeable(el) && el.dataset._maskHidden) {
        el.style.visibility = "";
        delete el.dataset._maskHidden;
      }
    }

    this.canvas?.parentNode?.removeChild(this.canvas);
  }
}
