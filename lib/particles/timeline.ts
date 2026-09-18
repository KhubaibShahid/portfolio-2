/**
 * Turns one normalised scroll position into "which two logos, and how far
 * between them".
 *
 * The runway alternates holds and morphs:
 *
 *   hold(0) · morph(0>1) · hold(1) · morph(1>2) · ... · hold(n-1)
 *
 * so n logos produce n holds and n-1 morphs. Each gets a weight, the weights
 * are normalised to 0..1, and `resolve` walks them. The first and last holds
 * are given extra weight — the section needs a beat to arrive on and a beat to
 * leave on, and without it the first logo is already dissolving as it pins.
 *
 * The morphs carry roughly three times a hold's weight. That ratio is the
 * section's whole tempo: a transition is the thing worth watching, so it gets
 * most of the runway, and the holds are beats to read the name on rather than
 * destinations. Paired with the runway height in `globals.css` it puts about
 * two viewports of wheel behind every transformation — slow enough that a
 * particle can be followed from one silhouette to the next by eye.
 *
 * Everything is derived from `count`, so the mapping stays correct when a
 * technology is added or removed.
 */
export interface Segment {
  kind: "hold" | "morph";
  /** Logo shown (hold), or the logo being left (morph). */
  from: number;
  /** Same as `from` for a hold; the logo being formed for a morph. */
  to: number;
  /** Normalised scroll bounds, `start` inclusive. */
  start: number;
  end: number;
}

export interface MorphState {
  from: number;
  to: number;
  /** 0 while fully on `from`, 1 once fully on `to`. Linear — easing is the
   *  shader's job, which needs the raw value to shape its own curves. */
  t: number;
  /** Whichever logo currently has the majority — what the labels track. */
  current: number;
  /** The whole runway, for the progress readout. */
  progress: number;
}

export interface TimelineOptions {
  /** Scroll weight of a logo sitting still. */
  hold: number;
  /** Scroll weight of one logo becoming the next. */
  morph: number;
  /** Weight of the first and last holds, which bracket the section. */
  edgeHold: number;
}

export const DEFAULT_TIMELINE: TimelineOptions = {
  hold: 1,
  morph: 3,
  edgeHold: 1.7,
};

/**
 * Lay the holds and morphs out across 0..1.
 *
 * With seven logos and the defaults, two thirds of the runway is spent
 * morphing: ~6.6% to settle in, then alternating ~11.6% transitions and ~3.9%
 * holds, and a final 6.6% resting on the last mark before the section releases.
 * Against the ~1550vh the runway leaves after the intro, that is a shade under
 * two viewports per transformation — which is why the runway in `globals.css`
 * grew when the seventh logo landed rather than the transitions getting faster.
 */
export function buildTimeline(count: number, options: TimelineOptions = DEFAULT_TIMELINE): Segment[] {
  if (count < 1) return [];
  if (count === 1) return [{ kind: "hold", from: 0, to: 0, start: 0, end: 1 }];

  const weights: { kind: "hold" | "morph"; from: number; to: number; w: number }[] = [];

  for (let i = 0; i < count; i++) {
    const edge = i === 0 || i === count - 1;
    weights.push({ kind: "hold", from: i, to: i, w: edge ? options.edgeHold : options.hold });
    if (i < count - 1) {
      weights.push({ kind: "morph", from: i, to: i + 1, w: options.morph });
    }
  }

  const total = weights.reduce((sum, s) => sum + s.w, 0);

  let cursor = 0;
  return weights.map((s) => {
    const start = cursor;
    cursor += s.w / total;
    return { kind: s.kind, from: s.from, to: s.to, start, end: cursor };
  });
}

/**
 * Where `progress` (0..1) falls in the timeline.
 *
 * Pure lookup with no memory of previous calls, which is what makes scrolling
 * back up work for free: the state is a function of the scroll position, not of
 * how it was reached, so every transition plays in reverse without a second
 * code path.
 */
export function resolve(timeline: Segment[], progress: number): MorphState {
  const p = progress <= 0 ? 0 : progress >= 1 ? 1 : progress;

  // Small enough that a scan beats the branch-heavy binary search, and it runs
  // once a frame rather than once a particle.
  let segment = timeline[timeline.length - 1];
  for (let i = 0; i < timeline.length; i++) {
    if (p < timeline[i].end || i === timeline.length - 1) {
      segment = timeline[i];
      break;
    }
  }

  const span = segment.end - segment.start;
  const local = span > 0 ? (p - segment.start) / span : 0;
  const t = segment.kind === "hold" ? 0 : local <= 0 ? 0 : local >= 1 ? 1 : local;

  return {
    from: segment.from,
    to: segment.to,
    t,
    current: t < 0.5 ? segment.from : segment.to,
    progress: p,
  };
}
