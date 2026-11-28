// HTML overlay: dialogue, choices, objective label, inventory, toasts, title cards.
import type { Sound } from './audio';

export interface Speaker {
  name: string;
  portrait?: string;
  voice: number;
}
export type Line = [Speaker, string];
export interface Quest {
  text: string;
  done?: boolean;
  optional?: boolean;
  /** Stable id, so the page can tell when a quest is new or just finished. */
  id?: string;
  kind?: 'main' | 'side' | 'stars';
  /** Portrait of whoever asked. */
  icon?: string;
  /** Short name for the pop-ups and the journal. */
  title?: string;
  progress?: [number, number];
}

export interface JournalSide {
  id: string;
  title: string;
  desc: string;
  reward: string;
  icon?: string;
  chapter: string;
  state: 'locked' | 'active' | 'done' | 'missed';
  progress?: [number, number];
}
export interface JournalChapter {
  title: string;
  state: 'done' | 'current';
  summary: string;
  steps: Quest[];
}
/** One scrapbook page: a chapter's photo and stickers. */
export interface JournalPage {
  title: string;
  photo?: string;
  stars: [number, number];
  sides: { icon?: string; title: string; done: boolean }[];
  /** False for chapters not reached yet: their page is still blank. */
  visited: boolean;
}
export interface Journal {
  chapters: JournalChapter[];
  side: JournalSide[];
  book: JournalPage[];
  stars: [number, number];
  labels: Record<string, string>;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export class UI {
  private talk = $('talk');
  private portrait = $<HTMLImageElement>('portrait');
  private speaker = $('speaker');
  private line = $('line');
  private choices = $('choices');
  private more = $('more');
  private objective = $('objective');
  private toastEl = $('toast');
  private bannerEl = $('banner');
  private advance: (() => void) | null = null;
  private toastTimer = 0;
  private isOpen = false;
  private journalEl = $('journal');
  private journalOpen = false;
  private popEl = $('questPop');
  private popQueue: (() => Promise<void>)[] = [];
  private popping = false;
  private seen = new Map<string, boolean>();
  /** While a saved chapter is replayed: the answers to give. Nothing is shown meanwhile. */
  replay: number[] | null = null;
  /** Called when a replay runs out of answers, so the game can go back to normal play. */
  onReplayDone: () => void = () => {};
  /** Every answer given this chapter, in order, for the save. */
  answers: number[] = [];
  /** Opened from the title card: the scrapbook alone, with a way to play a finished page again. */
  private canPlay = false;
  /** Called with a chapter's index when its scrapbook page is chosen to play again. */
  onPlay: (chapter: number) => void = () => {};
  /** Supplies the journal's contents when it opens. */
  journalSource: (() => Journal) | null = null;
  private tab: 'story' | 'side' | 'book' = 'story';

  /** True while a line, a question or the journal is showing: the game waits meanwhile. */
  get open() {
    return this.isOpen || this.journalOpen;
  }
  set open(v: boolean) {
    this.isOpen = v;
    this.syncBody();
  }
  private syncBody() {
    document.body.classList.toggle('talking', this.isOpen || this.journalOpen);
  }

  /** A tap anywhere on the page moves the story on (but never picks a choice). */
  tapAdvance() {
    if (this.open && this.choices.childElementCount === 0) this.advance?.();
  }

  constructor(private sound: Sound) {
    this.talk.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.advance?.();
    });
    this.journalEl.addEventListener('click', (e) => {
      if (e.target === this.journalEl) this.closeJournal();
    });
    $('journalClose').addEventListener('click', () => this.closeJournal());
    this.journalEl.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        this.tab = b.dataset.tab as 'story' | 'side' | 'book';
        this.renderJournal();
      }),
    );
    window.addEventListener('keydown', (e) => {
      if (this.journalOpen) {
        if (e.key === 'Escape' || e.key === 'j' || e.key === 'J') {
          e.preventDefault();
          this.closeJournal();
        }
        return;
      }
      if (!this.open) return;
      // With choice buttons showing, let the focused button take Space/Enter itself.
      if (this.choices.childElementCount > 0) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.advance?.();
      }
    });
  }

  /** Show a sequence of lines; each waits for a click, tap, Space or Enter. */
  async say(lines: Line[]) {
    if (this.replay) return;
    this.open = true;
    this.talk.hidden = false;
    this.choices.innerHTML = '';
    for (const [who, text] of lines) await this.showLine(who, text, true);
    this.talk.hidden = true;
    this.open = false;
  }

  private showLine(who: Speaker, text: string, wait: boolean) {
    return new Promise<void>((resolve) => {
      this.speaker.textContent = who.name;
      this.talk.classList.toggle('narrator', !who.portrait);
      if (who.portrait) this.portrait.src = who.portrait;
      this.portrait.hidden = !who.portrait;
      this.line.textContent = '';
      this.more.hidden = true;
      let i = 0;
      let typing = true;
      const finish = () => {
        typing = false;
        clearInterval(timer);
        this.line.textContent = text;
        this.more.hidden = !wait;
        if (!wait) resolve();
      };
      const timer = window.setInterval(() => {
        i++;
        this.line.textContent = text.slice(0, i);
        if (i % 3 === 0 && /\w/.test(text[i - 1] ?? '')) this.sound.blip(who.voice);
        if (i >= text.length) finish();
      }, 24);
      this.advance = () => {
        if (typing) return finish();
        this.advance = null;
        resolve();
      };
    });
  }

  /** A question with buttons; resolves with the chosen index. */
  async ask(who: Speaker, text: string, options: string[]) {
    if (this.replay) {
      if (this.replay.length) {
        const c = this.replay.shift()!;
        this.answers.push(c);
        return c;
      }
      // saved while this question was waiting: stop replaying and ask it for real
      this.onReplayDone();
    }
    this.open = true;
    this.talk.hidden = false;
    this.choices.innerHTML = '';
    await this.showLine(who, text, false);
    this.advance = null;
    const choice = await new Promise<number>((resolve) => {
      options.forEach((o, i) => {
        const b = document.createElement('button');
        b.className = 'btn small';
        b.textContent = o;
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          resolve(i);
        });
        this.choices.appendChild(b);
      });
      (this.choices.firstElementChild as HTMLButtonElement | null)?.focus();
    });
    this.answers.push(choice);
    this.sound.fold(0.6);
    this.choices.innerHTML = '';
    this.talk.hidden = true;
    this.open = false;
    return choice;
  }

  /** The tracker: what to do next on this page. New and finished side quests get a pop-up. */
  setQuests(quests: Quest[], header = '') {
    const items: HTMLElement[] = [];
    if (header) {
      const h = document.createElement('li');
      h.className = 'head';
      h.innerHTML = `<span></span><b aria-hidden="true">📖</b>`;
      h.querySelector('span')!.textContent = header;
      items.push(h);
    }
    for (const q of quests) {
      const li = document.createElement('li');
      li.className = `q ${q.kind ?? (q.optional ? 'side' : 'main')}`;
      if (q.done) li.classList.add('done');
      if (q.optional) li.classList.add('optional');
      if (q.icon) {
        const img = document.createElement('img');
        img.src = q.icon;
        img.alt = '';
        li.appendChild(img);
      }
      const t = document.createElement('span');
      t.className = 't';
      t.textContent = q.text;
      li.appendChild(t);
      if (q.progress && q.progress[1] > 1 && q.progress[1] <= 8) {
        const pips = document.createElement('span');
        pips.className = 'pips';
        pips.setAttribute('aria-label', `${q.progress[0]}/${q.progress[1]}`);
        for (let i = 0; i < q.progress[1]; i++) {
          const d = document.createElement('i');
          if (i < q.progress[0]) d.className = 'on';
          pips.appendChild(d);
        }
        li.appendChild(pips);
      }
      items.push(li);
      // pop-ups for side quests that just appeared or were just finished
      if (q.id && q.kind === 'side') {
        const was = this.seen.get(q.id);
        if (was === undefined && !q.done) this.pop(q, false);
        if (was === false && q.done) this.pop(q, true);
      }
      if (q.id) this.seen.set(q.id, !!q.done);
    }
    this.objective.replaceChildren(...items);
    this.objective.hidden = quests.length === 0;
  }

  private pop(q: Quest, done: boolean) {
    if (this.replay) return;
    this.popQueue.push(async () => {
      const el = this.popEl;
      el.classList.toggle('done', done);
      (el.querySelector('img') as HTMLImageElement).src = q.icon ?? '';
      (el.querySelector('img') as HTMLImageElement).hidden = !q.icon;
      el.querySelector('.k')!.textContent = done ? this.label('questDone') : this.label('questNew');
      el.querySelector('.n')!.textContent = q.title ?? q.text;
      el.hidden = false;
      this.sound.chime(done ? [0, 4, 7, 12] : [7, 12]);
      await new Promise((r) => requestAnimationFrame(r));
      el.classList.add('show');
      await new Promise((r) => setTimeout(r, done ? 2600 : 2200));
      el.classList.remove('show');
      await new Promise((r) => setTimeout(r, 400));
      el.hidden = true;
    });
    if (!this.popping) this.runPops();
  }
  private async runPops() {
    this.popping = true;
    while (this.popQueue.length) await this.popQueue.shift()!();
    this.popping = false;
  }
  /** Labels come from the page's translations (set by main). */
  label: (k: string) => string = (k) => k;

  // ---------------------------------------------------------------- the journal

  openJournal(tab?: 'story' | 'side' | 'book', playable = false) {
    if (this.isOpen || !this.journalSource) return;
    if (tab) this.tab = tab;
    this.canPlay = playable;
    this.journalEl.classList.toggle('bookOnly', playable);
    this.journalOpen = true;
    this.syncBody();
    this.renderJournal();
    this.journalEl.hidden = false;
    this.sound.rustle(0.5);
    requestAnimationFrame(() => this.journalEl.classList.add('show'));
    ($('journalClose') as HTMLButtonElement).focus();
  }
  closeJournal() {
    if (!this.journalOpen) return;
    this.journalOpen = false;
    this.syncBody();
    this.journalEl.classList.remove('show');
    this.journalEl.hidden = true;
    this.sound.fold(0.5);
  }
  toggleJournal() {
    if (this.journalOpen) this.closeJournal();
    else this.openJournal();
  }

  private renderJournal() {
    const J = this.journalSource!();
    const L = J.labels;
    const el = (tag: string, cls = '', text = '') => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text) e.textContent = text;
      return e;
    };
    this.journalEl.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.tab === this.tab));
      if (b.dataset.tab === 'side') {
        const done = J.side.filter((s) => s.state === 'done').length;
        b.querySelector('small')!.textContent = `${done}/${J.side.length}`;
      }
    });
    $('journalStars').textContent = `★ ${L.stars} ${J.stars[0]}/${J.stars[1]}`;
    const body = $('journalBody');
    const out: HTMLElement[] = [];
    if (this.tab === 'story') {
      for (const ch of J.chapters) {
        const card = el('section', `chap ${ch.state}`);
        const h = el('h3', '', ch.title);
        if (ch.state === 'done') h.appendChild(el('span', 'tick', '✓'));
        card.appendChild(h);
        if (ch.state === 'done') card.appendChild(el('p', 'sum', ch.summary));
        else {
          const ul = el('ul');
          for (const q of ch.steps) {
            const li = el('li', q.done ? 'done' : '');
            if (q.icon) {
              const img = el('img') as HTMLImageElement;
              img.src = q.icon;
              img.alt = '';
              li.appendChild(img);
            }
            li.appendChild(el('span', '', q.text));
            ul.appendChild(li);
          }
          card.appendChild(ul);
        }
        out.push(card);
      }
    } else if (this.tab === 'book') {
      // the scrapbook: a taped-in photo and stickers for every chapter
      J.book.forEach((pg, i) => {
        const page = el('section', `page${pg.visited ? '' : ' blank'}`);
        const photo = el('figure', 'photo');
        if (pg.photo) {
          const img = el('img') as HTMLImageElement;
          img.src = pg.photo;
          img.alt = pg.title;
          photo.appendChild(img);
        } else photo.appendChild(el('span', 'nophoto', pg.visited ? '📷' : '?'));
        photo.appendChild(el('figcaption', '', pg.title));
        page.appendChild(photo);
        const st = el('div', 'stickers');
        if (pg.visited) {
          const stars = el('div', 'stars');
          stars.setAttribute('aria-label', `${L.stars} ${pg.stars[0]}/${pg.stars[1]}`);
          for (let i = 0; i < pg.stars[1]; i++) stars.appendChild(el('i', i < pg.stars[0] ? 'got' : '', '★'));
          st.appendChild(stars);
          const sides = el('div', 'sides');
          for (const s of pg.sides) {
            const b = el('span', `sticker${s.done ? ' got' : ''}`);
            b.title = s.title;
            if (s.done && s.icon) {
              const img = el('img') as HTMLImageElement;
              img.src = s.icon;
              img.alt = s.title;
              b.appendChild(img);
            } else b.textContent = '?';
            sides.appendChild(b);
          }
          st.appendChild(sides);
          if (!pg.photo) st.appendChild(el('p', 'note', L.bookNoPhoto));
        } else st.appendChild(el('p', 'note', L.bookBlank));
        if (this.canPlay && pg.photo) {
          const play = el('button', 'btn small play', `▶ ${L.playPage}`);
          play.addEventListener('click', () => this.onPlay(i));
          st.appendChild(play);
        }
        page.appendChild(st);
        out.push(page);
      });
    } else {
      let lastChapter = '';
      for (const s of J.side) {
        if (s.chapter !== lastChapter) {
          out.push(el('h4', 'chapHead', s.chapter));
          lastChapter = s.chapter;
        }
        const card = el('article', `side ${s.state}`);
        if (s.state === 'locked') {
          card.appendChild(el('div', 'who q', '?'));
          const b = el('div', 'b');
          b.appendChild(el('h5', '', L.locked));
          b.appendChild(el('p', '', L.lockedHint));
          card.appendChild(b);
        } else {
          const who = el('div', 'who');
          if (s.icon) {
            const img = el('img') as HTMLImageElement;
            img.src = s.icon;
            img.alt = '';
            who.appendChild(img);
          }
          card.appendChild(who);
          const b = el('div', 'b');
          b.appendChild(el('h5', '', s.title));
          b.appendChild(el('p', '', s.desc));
          if (s.progress && s.state === 'active') {
            const bar = el('div', 'bar');
            const fill = el('i');
            fill.style.width = `${Math.round((100 * s.progress[0]) / s.progress[1])}%`;
            bar.appendChild(fill);
            bar.appendChild(el('span', '', `${s.progress[0]}/${s.progress[1]}`));
            b.appendChild(bar);
          }
          b.appendChild(el('p', 'reward', `🎁 ${s.reward}`));
          card.appendChild(b);
          if (s.state === 'done') card.appendChild(el('div', 'stamp', L.stampDone));
          if (s.state === 'missed') card.appendChild(el('div', 'stamp missed', L.stampMissed));
        }
        out.push(card);
      }
    }
    body.replaceChildren(...out);
    body.scrollTop = 0;
  }

  toast(text: string) {
    if (this.replay) return;
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 2600);
  }

  banner(text: string) {
    if (this.replay) return;
    this.bannerEl.textContent = text;
    this.bannerEl.classList.add('show');
    window.setTimeout(() => this.bannerEl.classList.remove('show'), 3200);
  }

  /** The tide wheel in the corner: turned `turn` notches (null hides it). */
  setTide(turn: number | null, art?: string, label = '') {
    const el = $('tide');
    el.hidden = turn === null;
    if (turn === null) return;
    const img = el.querySelector('img')!;
    if (art && !img.getAttribute('src')) img.src = art;
    img.style.transform = `rotate(${-turn * 45}deg)`;
    el.querySelector('span')!.textContent = label;
  }

    setInventory(icons: Record<string, string>, have: Set<string>, counts: Record<string, number> = {}) {
    // the inventory card only shows what you're carrying, and hides when your mittens are empty
    $('inv').hidden = ![...have].some((id) => document.querySelector(`#inv .slot[data-id="${id}"]`));
    document.querySelectorAll<HTMLElement>('#inv .slot').forEach((s) => {
      const id = s.dataset.id!;
      const img = s.querySelector('img')!;
      if (icons[id] && img.getAttribute('src') !== icons[id]) img.src = icons[id];
      s.classList.toggle('got', have.has(id));
      const b = s.querySelector('b');
      if (b) b.textContent = counts[id] ? `×${counts[id]}` : '';
    });
  }
}
