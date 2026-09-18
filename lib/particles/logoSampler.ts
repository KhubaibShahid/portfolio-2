import type { LogoPath } from "./logoPaths";

/**
 * Turns a filled silhouette into a 3D point cloud.
 *
 * The pipeline, once per logo:
 *
 *   Path2D -> alpha mask -> distance transform -> weighted scatter -> polar sort
 *
 * Two of those steps are doing more work than they look like.
 *
 * The **distance transform** answers "how far is this pixel from the nearest
 * edge", and that one number drives both the depth and the shading. Depth is
 * `sqrt(distance)` scaled, which extrudes the mask into a rounded solid rather
 * than a flat plane: a hairline stroke like the Express frame becomes a round
 * tube, and a solid mass like the Next.js disc becomes a thick coin with
 * bevelled edges. Both read as sculpture from the side, which a constant-Z
 * jitter never does.
 *
 * The **polar sort** is what makes the morph a morph. Particle 4,000 has to
 * mean something consistent across every cloud, or every transition is
 * 15,000 particles teleporting across the frame. Sorting each cloud the same
 * way — by angle around the centre, then by radius — maps the i-th particle to
 * roughly the same angular sector of the next logo, so a transition reads as
 * the shape reflowing into another shape. The scatter and turbulence that make
 * it look organic are the shader's job, layered on top of an ordering that is
 * already coherent.
 */

/** Mask resolution. Fine enough to keep the Express frame's hairlines. */
const RASTER = 512;

/** Longest side of a logo, in world units, after normalisation. */
export const LOGO_SIZE = 4;

/** Depth never exceeds this half-thickness, however massive the silhouette. */
const MAX_HALF_DEPTH = 0.34;

/**
 * How strongly the scatter favours edges.
 *
 * A uniform scatter over a solid mark spends most of its particles in the
 * middle, where they say nothing, and leaves the outline ragged — the outline
 * being the entire reason the mark is recognisable. Weighting pixels by
 * `floor + (1 - floor) * exp(-distance / falloff)` puts a bright rim on every
 * silhouette and every interior hole while still filling the body, which is
 * also what keeps the marks readable at the 4,000-particle mobile count.
 */
const EDGE_FLOOR = 0.3;
const EDGE_FALLOFF = 3.4;

/** Angular sectors used to align the clouds with each other. */
const ANGLE_BUCKETS = 64;

export interface SampledShape {
  /** `count * 4` floats: x, y, z, edgeness (0 at the silhouette edge, 1 deep inside). */
  data: Float32Array;
  /** Ink area in mask pixels — `buildShapes` evens out brightness with it. */
  area: number;
}

/** Deterministic RNG, so a reload rebuilds the identical cloud. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fill the paths into an offscreen canvas and read back the alpha channel. */
function rasterize(logo: LogoPath): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = RASTER;
  canvas.height = RASTER;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas unavailable");

  const scale = RASTER / logo.viewBox;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = "#fff";
  // Nonzero is the default and the rule these paths are authored for — it is
  // what cuts the holes (React's ring interiors, the Next.js "N").
  for (const d of logo.paths) ctx.fill(new Path2D(d));

  const pixels = ctx.getImageData(0, 0, RASTER, RASTER).data;
  const mask = new Uint8Array(RASTER * RASTER);
  for (let i = 0, p = 3; i < mask.length; i++, p += 4) {
    mask[i] = pixels[p] > 127 ? 1 : 0;
  }
  return mask;
}

/**
 * Distance from each inside pixel to the nearest outside pixel.
 *
 * Two-pass 3-4 chamfer: an approximation of the Euclidean distance that costs
 * two linear sweeps instead of a full Voronoi, and is well inside tolerance for
 * something only used to shape depth. Anything off the edge of the mask counts
 * as outside, so a logo touching the frame is not treated as infinitely deep.
 */
function distanceTransform(mask: Uint8Array): Float32Array {
  const dist = new Float32Array(mask.length);
  const INF = 1e9;
  const last = RASTER - 1;

  for (let i = 0; i < mask.length; i++) dist[i] = mask[i] ? INF : 0;

  // Seed the frame instead of bounds-checking every neighbour read. Ink that
  // touches the edge of the mask is one orthogonal step (weight 3) from the
  // outside, which lets both sweeps below run unguarded over the interior — the
  // difference between ~2M branch-laden closure calls per logo and none.
  for (let x = 0; x <= last; x++) {
    if (mask[x]) dist[x] = 3;
    const bottom = last * RASTER + x;
    if (mask[bottom]) dist[bottom] = 3;
  }
  for (let y = 0; y <= last; y++) {
    const left = y * RASTER;
    if (mask[left]) dist[left] = 3;
    const right = left + last;
    if (mask[right]) dist[right] = 3;
  }

  for (let y = 1; y < last; y++) {
    const row = y * RASTER;
    const up = row - RASTER;
    for (let x = 1; x < last; x++) {
      const i = row + x;
      if (!mask[i]) continue;
      let d = dist[i];
      const a = dist[up + x - 1] + 4;
      if (a < d) d = a;
      const b = dist[up + x] + 3;
      if (b < d) d = b;
      const c = dist[up + x + 1] + 4;
      if (c < d) d = c;
      const e = dist[i - 1] + 3;
      if (e < d) d = e;
      dist[i] = d;
    }
  }

  for (let y = last - 1; y > 0; y--) {
    const row = y * RASTER;
    const down = row + RASTER;
    for (let x = last - 1; x > 0; x--) {
      const i = row + x;
      if (!mask[i]) continue;
      let d = dist[i];
      const a = dist[down + x + 1] + 4;
      if (a < d) d = a;
      const b = dist[down + x] + 3;
      if (b < d) d = b;
      const c = dist[down + x - 1] + 4;
      if (c < d) d = c;
      const e = dist[i + 1] + 3;
      if (e < d) d = e;
      dist[i] = d;
    }
  }

  // The chamfer counts an orthogonal step as 3; bring it back to pixels.
  for (let i = 0; i < dist.length; i++) dist[i] /= 3;
  return dist;
}

/**
 * Scatter `count` points across one silhouette.
 *
 * Sampling runs off a cumulative weight table rather than by rejection, which
 * decouples the cost from how much of the frame the logo actually covers and
 * guarantees the exact count every time. When `count` exceeds the number of ink
 * pixels — a hairline mark at a high particle count — pixels are drawn more
 * than once and the sub-pixel jitter separates the duplicates, so the cloud
 * densifies instead of the count changing mid-morph.
 */
export function sampleLogo(logo: LogoPath, count: number, seed: number): SampledShape {
  const mask = rasterize(logo);
  const dist = distanceTransform(mask);

  let minX = RASTER;
  let minY = RASTER;
  let maxX = -1;
  let maxY = -1;
  let maxDist = 0;
  let area = 0;

  for (let y = 0; y < RASTER; y++) {
    for (let x = 0; x < RASTER; x++) {
      const i = y * RASTER + x;
      if (!mask[i]) continue;
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (dist[i] > maxDist) maxDist = dist[i];
    }
  }

  if (area === 0) throw new Error("logo silhouette is empty");

  // Cumulative weights over the ink pixels only.
  const indices = new Int32Array(area);
  const cumulative = new Float32Array(area);
  let running = 0;
  let cursor = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    running += EDGE_FLOOR + (1 - EDGE_FLOOR) * Math.exp(-dist[i] / EDGE_FALLOFF);
    indices[cursor] = i;
    cumulative[cursor] = running;
    cursor++;
  }

  const spanX = maxX - minX + 1;
  const spanY = maxY - minY + 1;
  // Uniform on both axes: the mark keeps its own proportions, and every logo
  // ends up occupying the same longest side so none of them jumps in size.
  const worldPerPx = LOGO_SIZE / Math.max(spanX, spanY);
  const centreX = (minX + maxX + 1) / 2;
  const centreY = (minY + maxY + 1) / 2;

  // Where depth stops growing: the thinner of "as deep as the shape is wide"
  // and the global ceiling. Hairlines get a round cross-section, masses get a
  // bevel of fixed thickness.
  const depthRefPx = Math.min(maxDist, MAX_HALF_DEPTH / worldPerPx);
  const halfDepth = depthRefPx * worldPerPx;

  const random = mulberry32(seed);
  const xs = new Float32Array(count);
  const ys = new Float32Array(count);
  const zs = new Float32Array(count);
  const es = new Float32Array(count);

  for (let n = 0; n < count; n++) {
    // Binary search the CDF.
    const target = random() * running;
    let lo = 0;
    let hi = area - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < target) lo = mid + 1;
      else hi = mid;
    }

    const pixel = indices[lo];
    const px = pixel % RASTER;
    const py = (pixel / RASTER) | 0;

    const edgeness = depthRefPx > 0 ? Math.min(dist[pixel] / depthRefPx, 1) : 0;

    xs[n] = (px + random() - centreX) * worldPerPx;
    // Canvas Y grows downward; the scene's does not.
    ys[n] = (centreY - (py + random())) * worldPerPx;
    zs[n] = (random() * 2 - 1) * halfDepth * Math.sqrt(edgeness);
    es[n] = edgeness;
  }

  return { data: polarSort(xs, ys, zs, es, count), area };
}

/**
 * Order the cloud so particle `i` means the same thing in every logo.
 *
 * Primary key is the angular sector around the centre, secondary is the radius
 * inside it. Both clouds hold the same number of points, so sorting them the
 * same way maps quantile to quantile in angle — particle `i` leaves sector `k`
 * of one logo and arrives in roughly sector `k` of the next, travelling a short
 * arc rather than crossing the frame.
 */
function polarSort(
  xs: Float32Array,
  ys: Float32Array,
  zs: Float32Array,
  es: Float32Array,
  count: number
): Float32Array {
  const keys = new Float64Array(count);
  let maxRadius = 1e-6;

  for (let i = 0; i < count; i++) {
    const r = Math.hypot(xs[i], ys[i]);
    if (r > maxRadius) maxRadius = r;
  }

  for (let i = 0; i < count; i++) {
    const angle = Math.atan2(ys[i], xs[i]) + Math.PI; // 0..2pi
    const bucket = Math.min(ANGLE_BUCKETS - 1, Math.floor((angle / (Math.PI * 2)) * ANGLE_BUCKETS));
    const radius = Math.hypot(xs[i], ys[i]) / maxRadius;
    keys[i] = bucket + radius;
  }

  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = i;
  // Sorting indices rather than tuples keeps this allocation-free; it runs once
  // per logo at startup rather than per frame.
  order.sort((a, b) => keys[a] - keys[b]);

  const data = new Float32Array(count * 4);
  for (let n = 0; n < count; n++) {
    const i = order[n];
    const o = n * 4;
    data[o] = xs[i];
    data[o + 1] = ys[i];
    data[o + 2] = zs[i];
    data[o + 3] = es[i];
  }
  return data;
}
