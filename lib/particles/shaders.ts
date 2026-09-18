/**
 * The morph runs entirely on the GPU.
 *
 * Every logo's point cloud lives in one float texture, and the vertex shader
 * reads two rows of it per frame — the logo being left and the logo being
 * formed — using the particle's own index as the lookup. That is what makes
 * this a morph rather than a crossfade: there is one `THREE.Points` with one
 * set of vertices for the life of the section, and a transition only changes
 * two integers and a float. Nothing is created, destroyed, or re-uploaded when
 * the logo changes, so the same particle that sat on React's nucleus is the one
 * that travels to the Next.js disc.
 *
 * Layering the motion on top of that interpolation is the rest of the job. A
 * straight `mix()` reads as a slide; four cheap displacements, all scaled by
 * `sin(pi * t)` so they vanish at both ends, turn it into a dispersal:
 *
 *   1. a radial push, throwing the cloud off its own axis
 *   2. a vortex, spun opposite ways on either half so the field shears
 *   3. a depth throw, which is what makes particles pass the camera
 *   4. curl-ish turbulence from a simplex field, so no two paths match
 *
 * Because those are zero at t=0 and t=1, the cloud is exactly the sampled logo
 * whenever it is not mid-transition — the silhouette can never be left
 * distorted, no matter where the scroll stops. The fifth displacement, the
 * standing wave, is the exception: it never switches off, because a field that
 * holds perfectly still stops looking suspended.
 *
 * The sixth is the arrival, and it answers to `uAssemble` rather than to the
 * transition: at zero the whole field is parked outside the frame, which is how
 * the section can open on an empty stage and then gather the first mark out of
 * its own edges. It is applied last, over everything above, and at one it costs
 * the same as the others cost at rest — a multiply by zero.
 *
 * The colour model is built for a white page, which inverts the usual reading.
 * There is no additive blending here — light cannot be added to a surface
 * already at full brightness — so the field is dark ink laid onto white, and
 * crowding reads as density rather than as glow. The cyan is what a particle
 * takes on while it is in flight, which is the only thing in the scene that
 * distinguishes a mark being carried from a mark being held.
 */

/**
 * Ashima's simplex noise (MIT). One evaluation per axis gives a vec3 flow
 * field — not divergence-free like true curl noise, but three lookups instead
 * of nine, and indistinguishable once it is scaled down to a displacement.
 */
const SIMPLEX_3D = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

vec3 flow(vec3 p) {
  return vec3(snoise(p), snoise(p + 31.416), snoise(p - 17.043));
}
`;

export const particleVertex = /* glsl */ `
precision highp float;

uniform sampler2D uShapes;
uniform vec2  uTexSize;       // texture dimensions, in texels
uniform float uTexWidth;      // particles per row
uniform float uRowsPerShape;  // rows one logo occupies
uniform float uFromShape;     // row block being left
uniform float uToShape;       // row block being formed
uniform float uT;             // 0..1 across the current transition

uniform float uTime;
uniform float uSizePx;        // particle diameter in CSS pixels, at uFitDistance
uniform float uPixelRatio;
uniform float uFitDistance;   // camera distance the size is calibrated against
uniform float uOpacity;

uniform float uStagger;       // spread of per-particle departure times
uniform float uBurst;         // radial + depth throw
uniform float uSwirl;         // vortex, in radians
uniform float uTurbulence;    // noise displacement while in flight
uniform float uIdle;          // noise displacement while settled
uniform float uWave;          // standing wave, on at all times

uniform float uAssemble;      // 0 = parked outside the frame, 1 = landed
uniform float uEntryRadius;   // world distance that clears the frame's corner

uniform vec2  uMouse;
uniform float uDensityFrom;
uniform float uDensityTo;

// Which transition this is. Only the in-flight terms read them, and those are
// scaled by the burst envelope, so both can change at a segment boundary without any jump:
// at t=0 and t=1 they are multiplied by zero.
uniform float uSeed;      // shifts the turbulence field, so no two match
uniform float uSpinBias;  // which way the vortex leans, alternating per pair

attribute float aIndex;
attribute vec4  aRandom;

varying float vAlpha;
varying float vTone;
varying float vGlow;

${SIMPLEX_3D}

const float PI = 3.141592653589793;

/**
 * One particle's slot in one logo: xyz plus how deep inside the silhouette it
 * sits (0 on the outline, 1 in the middle of the mass).
 *
 * The half-texel offset with NEAREST filtering makes this an exact fetch, not
 * an interpolation between neighbours — which matters, because neighbouring
 * texels are unrelated particles.
 */
vec4 fetchShape(float shape, float index) {
  float row = floor(index / uTexWidth);
  float col = index - row * uTexWidth;
  float y = shape * uRowsPerShape + row;
  return texture2D(uShapes, (vec2(col, y) + 0.5) / uTexSize);
}

void main() {
  vec4 a = fetchShape(uFromShape, aIndex);
  vec4 b = fetchShape(uToShape, aIndex);

  // Particles do not all leave at once: each waits out its own slice of the
  // transition first, so the logo erodes and re-forms instead of sliding.
  float lead = aRandom.x * uStagger;
  float t = clamp((uT - lead) / max(1.0 - uStagger, 0.001), 0.0, 1.0);

  // Smootherstep rather than smoothstep: zero *acceleration* at both ends, not
  // just zero velocity. Over a transition this long the difference is the whole
  // point — a cubic still starts with a visible shove, and the particle has
  // nearly two viewports of scroll in which to be watched doing it.
  float ease = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);

  vec3 pos = mix(a.xyz, b.xyz, ease);
  float edge = mix(a.w, b.w, ease);

  // Zero at both ends of the transition, so a settled logo is never displaced.
  float burst = sin(t * PI);
  float calm = 1.0 - burst;

  // 1. Break the cloud off its own axis.
  //
  //    Signed, not uniformly outward: the push factor runs from -0.5 to 1.0,
  //    so most of the field expands while roughly a third collapses inward
  //    through the middle. A push that is outward for every particle empties
  //    the centre, and every transition ends up the same hollow ring — the
  //    crossing traffic is what makes it read as a churn instead.
  //
  //    Dividing by a floored length also leaves particles near the centre
  //    pushed less than those on the rim, opening the cloud out rather than
  //    translating it.
  vec2 radial = pos.xy / max(length(pos.xy), 0.35);
  float push = aRandom.y * 1.5 - 0.5;
  pos.xy += radial * burst * uBurst * push;

  // 2. Vortex. Signed per particle so the halves shear against each other,
  //    plus a whole-field lean that flips from one transition to the next.
  float spin = burst * uSwirl * ((aRandom.w - 0.5) * 2.0 + uSpinBias * 0.35);
  float cs = cos(spin);
  float sn = sin(spin);
  pos.xy = mat2(cs, -sn, sn, cs) * pos.xy;

  // 3. Depth throw — the part that reads as three-dimensional, because some
  //    particles cross in front of the camera and others fall behind.
  pos.z += burst * uBurst * (aRandom.z - 0.5) * 1.7;

  // 4. Two noise fields, and they are doing different jobs.
  //
  //    The idle field is slow, broad and unseeded: it is the breath a settled
  //    logo needs so it never looks like a still image, and it has to stay
  //    continuous across segment boundaries. Its sampling point descends over
  //    time, which sends the drift it produces the other way — the settled mark
  //    reads as motes rising off the pad rather than as noise.
  //
  //    The flight field is finer and faster, which is what gives a dispersal
  //    its filaments rather than a smooth swell, and it is offset by uSeed so
  //    each transition draws from a different part of the field and no two look
  //    alike.
  vec3 idleField = flow(pos * 0.5 - vec3(0.0, uTime * 0.14, 0.0) + uTime * 0.04);
  vec3 flightField = flow(pos * 0.85 + uTime * 0.22 + uSeed * 11.3);
  pos += idleField * (calm * uIdle) + flightField * (burst * uTurbulence);

  // 5. The standing wave, and the one displacement with no envelope on it.
  //
  //    A slow travelling sway climbing the cloud, phase-shifted by height so
  //    the mark ripples from the bottom up rather than swinging as a block —
  //    the thing that reads as a projection being held in the air. Quietened
  //    but never cut during a transition, where there is already plenty of
  //    motion to look at.
  float wavePhase = uTime * 0.5 - pos.y * 0.55 + pos.x * 0.3;
  float waveAmp = uWave * mix(1.0, 0.35, burst);
  pos.x += sin(wavePhase) * waveAmp * (0.45 + 0.55 * aRandom.y);
  pos.y += sin(uTime * 0.37 + pos.x * 0.5 + aRandom.x * 6.2831) * waveAmp * 0.5;
  pos.z += cos(wavePhase * 0.83) * waveAmp * 0.8;

  // 6. The arrival, which is the only displacement that is not about the
  //    transition at all.
  //
  //    The section opens on an empty stage, so at uAssemble = 0 every particle
  //    is parked a frame-radius out from the middle and there is no mark on
  //    screen to speak of. Pulling the field in from every side is what makes
  //    the first logo feel gathered rather than switched on. uEntryRadius is
  //    solved from the camera on each resize, so "outside the frame" means
  //    outside the frame of the screen the page is actually open on, corners
  //    included.
  //
  //    Applied last, over the settled position, and staggered and spun per
  //    particle so it reads as a field converging rather than as one object
  //    being scaled up. At uAssemble = 1 every term below is multiplied by
  //    zero, which is what lets the same code sit in the path of every frame
  //    the section ever draws.
  float arriveLead = aRandom.y * 0.42;
  float arriveRaw = clamp((uAssemble - arriveLead) / 0.58, 0.0, 1.0);
  float arrive = arriveRaw * arriveRaw * arriveRaw *
    (arriveRaw * (arriveRaw * 6.0 - 15.0) + 10.0);
  float away = 1.0 - arrive;

  // Mostly straight out from where the particle lands, leaned by its own angle
  // so the incoming streams cross instead of running in parallel. The floored
  // length is what keeps a particle sitting near the centre from normalising a
  // zero vector.
  float entryAngle = aRandom.w * 6.283185307;
  vec2 outward = pos.xy + vec2(cos(entryAngle), sin(entryAngle)) * 1.1;
  outward /= max(length(outward), 0.001);

  pos.xy += outward * away * uEntryRadius * (0.85 + aRandom.x * 0.55);
  pos.z += away * (aRandom.z - 0.5) * 3.2;

  float entrySpin = away * 0.8 * (aRandom.w - 0.5) * 2.0;
  float ec = cos(entrySpin);
  float es = sin(entrySpin);
  pos.xy = mat2(ec, -es, es, ec) * pos.xy;

  pos += flightField * (away * uTurbulence * 0.9);

  // Parallax, not deformation: the shift is proportional to depth, so the
  // silhouette the camera sees stays the silhouette that was sampled.
  pos.xy += uMouse * pos.z * 0.55;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  // A tighter spread than the old 0.55..1.45. Variation still keeps the cloud
  // from looking machined, but the bottom of the old range produced particles
  // small enough to disappear on a white ground, which is most of what made the
  // field read as thin.
  float jitter = 0.78 + aRandom.z * 0.55;
  gl_PointSize = clamp(
    uSizePx * uPixelRatio * jitter * (uFitDistance / max(-mv.z, 0.001)),
    1.4,
    20.0
  );

  // Darkest on the outline, softer through the body. Inverted from the old
  // black-page reading, but the reasoning is identical: the silhouette is the
  // whole reason the mark is legible, so it gets the contrast.
  vTone = clamp(mix(0.32, 1.0, 1.0 - edge), 0.0, 1.0);

  // The cyan is carried by flight and nothing else, so it is a reading of
  // whether the mark is being moved rather than of where a particle happens to
  // be — and a particle still on its way in is as much in flight as one
  // crossing between two logos.
  vGlow = clamp(max(burst, away) * 0.85, 0.0, 1.0);

  // Nearer particles carry more weight, so the cloud has a front and a back
  // without any depth sorting.
  float depthCue = 0.78 + 0.22 * smoothstep(-0.55, 0.55, pos.z);
  float density = mix(uDensityFrom, uDensityTo, ease);
  // The per-particle spread is narrower than it was, for the same reason the
  // size jitter is: the faint end of a wide range vanishes against white. The
  // lift in flight covers the cyan being much lighter than the ink.
  // The last term fades a particle up as it crosses into the frame. Without it
  // the field would be at full strength the instant it entered, and the edges
  // of the stage would read as a hard boundary things pour through.
  vAlpha = uOpacity * density * depthCue * (0.78 + aRandom.x * 0.34) *
    (1.0 + burst * 0.3) * smoothstep(0.0, 0.3, arriveRaw);
}
`;

export const particleFragment = /* glsl */ `
precision highp float;

uniform vec3 uInkSoft;    // through the body of the mark
uniform vec3 uInkDeep;    // on the outline
uniform vec3 uInkGlow;    // energised, or lit by the emitter

varying float vAlpha;
varying float vTone;
varying float vGlow;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d2 = dot(uv, uv);
  if (d2 > 0.25) discard;

  float r = sqrt(d2) * 2.0;
  // A solid core with a soft rim on it. The core now holds its value out to
  // most of the radius and only falls away at the edge — a particle should read
  // as a small disc, not as a smudge that happens to be darkest in the middle —
  // and the rim is what keeps that disc from aliasing into a square.
  float core = smoothstep(1.0, 0.55, r);
  float halo = 1.0 - r;

  vec3 ink = mix(uInkSoft, uInkDeep, vTone);
  vec3 col = mix(ink, uInkGlow, vGlow * 0.8);

  // Premultiplied, because the renderer is. Over black it made no visible
  // difference — additive blending never consulted the alpha channel — but a
  // straight-alpha colour composited onto a white page comes out washed out and
  // milky, which is precisely the failure this section cannot afford.
  float alpha = clamp(vAlpha * (core * 0.94 + halo * halo * 0.22), 0.0, 1.0);
  gl_FragColor = vec4(col * alpha, alpha);
}
`;
