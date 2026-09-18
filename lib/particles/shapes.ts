import { LOGO_PATHS, type LogoKey } from "./logoPaths";
import { sampleLogo } from "./logoSampler";

/**
 * Every logo's point cloud, packed into one float texture.
 *
 * Layout is a stack of row-blocks — logo 0 owns rows `0..rowsPerShape-1`, logo
 * 1 the next block, and so on — so the shader addresses a shape with a single
 * row offset and the atlas grows by adding rows rather than by changing any
 * shader code. Twenty logos would work exactly as seven do.
 *
 * `texWidth` stays small so the texture is never wide: 15,000 particles is 59
 * rows per logo, 354 rows for the set. A one-row-per-logo layout would need a
 * 15,000px-wide texture and fall off the low end of `MAX_TEXTURE_SIZE`.
 */
const TEX_WIDTH = 256;

/**
 * Floor on the brightness evening-out below.
 *
 * Correcting fully would make the sparse marks nearly invisible; this keeps
 * the correction to something that reads as the same material lit the same way.
 */
const MIN_DENSITY = 0.6;

export interface ShapeAtlas {
  /** RGBA float payload: xyz position plus depth-inside-the-silhouette. */
  data: Float32Array;
  texWidth: number;
  height: number;
  rowsPerShape: number;
  count: number;
  /** Per-logo opacity multiplier — see `buildShapeAtlas`. */
  densities: Float32Array;
}

/** Hand the main thread back so the loader can actually paint its progress. */
const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Sample every logo at the same particle count and pack the results.
 *
 * The count is identical across shapes by construction — that is the invariant
 * the whole morph rests on, and it is why the sampler duplicates points for a
 * hairline mark rather than returning fewer of them.
 *
 * `densities` exists because the marks are wildly different amounts of ink: the
 * Next.js disc covers 69% of its box and the Express frame 18%, so spreading a
 * fixed particle count over each packs the frame nearly four times denser.
 * Under additive blending that reads as one logo being much brighter than the
 * next. Scaling opacity by the square root of relative area cancels most of it
 * while leaving the sparse marks with some of their extra intensity.
 */
export async function buildShapeAtlas(
  logos: LogoKey[],
  count: number,
  onProgress?: (done: number, total: number) => void
): Promise<ShapeAtlas> {
  const rowsPerShape = Math.ceil(count / TEX_WIDTH);
  const height = rowsPerShape * logos.length;
  const data = new Float32Array(TEX_WIDTH * height * 4);
  const areas = new Float32Array(logos.length);

  for (let s = 0; s < logos.length; s++) {
    // Seeded per logo, so the clouds are reproducible but not clones of each
    // other — a shared seed would put every logo's jitter in the same places.
    const shape = sampleLogo(LOGO_PATHS[logos[s]], count, 0x5eed + s * 7919);
    areas[s] = shape.area;

    // Rows past `count` in the last block stay zero; nothing ever fetches them.
    data.set(shape.data.subarray(0, count * 4), s * rowsPerShape * TEX_WIDTH * 4);

    onProgress?.(s + 1, logos.length);
    if (s < logos.length - 1) await nextFrame();
  }

  let maxArea = 0;
  for (let s = 0; s < areas.length; s++) maxArea = Math.max(maxArea, areas[s]);

  const densities = new Float32Array(logos.length);
  for (let s = 0; s < logos.length; s++) {
    const ratio = maxArea > 0 ? Math.sqrt(areas[s] / maxArea) : 1;
    densities[s] = MIN_DENSITY + (1 - MIN_DENSITY) * ratio;
  }

  return { data, texWidth: TEX_WIDTH, height, rowsPerShape, count, densities };
}
