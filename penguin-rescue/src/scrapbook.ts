// The scrapbook: a photo and stickers for every chapter you finish. It is kept apart from the
// saved game, so it survives Start over and the end of the book, and remembers your best.
import type { ChapterId } from './levels';

export interface Page {
  /** The snapshot taken as the chapter ended (a small JPEG data URL). */
  photo?: string;
  /** The most paper stars ever found on this page. */
  stars: number;
  /** Side quests ever finished on this page. */
  sides: string[];
}

const KEY = 'penguin-rescue-scrapbook';

export function loadScrapbook(): Partial<Record<ChapterId, Page>> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const out: Partial<Record<ChapterId, Page>> = {};
    for (const [id, p] of Object.entries(raw ?? {}) as [ChapterId, Page][]) {
      if (!p || typeof p !== 'object') continue;
      out[id] = {
        photo: typeof p.photo === 'string' && p.photo.startsWith('data:image/') ? p.photo : undefined,
        stars: Number.isInteger(p.stars) && p.stars >= 0 ? p.stars : 0,
        sides: Array.isArray(p.sides) ? p.sides.filter((s) => typeof s === 'string') : [],
      };
    }
    return out;
  } catch {
    return {};
  }
}

/** Paste a finished chapter into the scrapbook, keeping the best stars and every quest ever done. */
export function recordPage(id: ChapterId, page: Page) {
  const book = loadScrapbook();
  const old = book[id];
  book[id] = {
    photo: page.photo ?? old?.photo,
    stars: Math.max(page.stars, old?.stars ?? 0),
    sides: [...new Set([...(old?.sides ?? []), ...page.sides])],
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(book));
  } catch {
    // storage full or blocked: try again without the photo, so the stickers are still kept
    try {
      book[id]!.photo = old?.photo;
      localStorage.setItem(KEY, JSON.stringify(book));
    } catch {
      /* the scrapbook simply won't remember */
    }
  }
}
