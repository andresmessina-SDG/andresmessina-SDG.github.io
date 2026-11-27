// A tiny tween runner driven by the render loop.

export type Ease = (x: number) => number;

export const linear: Ease = (x) => x;
export const easeInOut: Ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
export const easeOut: Ease = (x) => 1 - Math.pow(1 - x, 3);
export const easeIn: Ease = (x) => x * x * x;
export const easeOutBack: Ease = (x) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

interface Tw {
  start: number;
  dur: number;
  fn: (k: number) => void;
  ease: Ease;
  done: () => void;
}

const list: Tw[] = [];
let now = performance.now();
let fast = false;

/** While a save is replayed, every tween jumps straight to its end. */
export const setFast = (on: boolean) => (fast = on);

export function tween(dur: number, fn: (k: number) => void, ease: Ease = easeInOut, delay = 0): Promise<void> {
  if (fast) {
    fn(ease(1));
    return Promise.resolve();
  }
  return new Promise((done) => {
    list.push({ start: now + delay, dur: Math.max(1, dur), fn, ease, done });
  });
}

export function updateTweens(t: number) {
  now = t;
  for (let i = list.length - 1; i >= 0; i--) {
    const tw = list[i];
    if (t < tw.start) continue;
    const k = Math.min(1, (t - tw.start) / tw.dur);
    tw.fn(tw.ease(k));
    if (k >= 1) {
      list.splice(i, 1);
      tw.done();
    }
  }
}

export const wait = (ms: number) =>
  new Promise<void>((r) => tween(ms, () => {}, linear).then(r));
