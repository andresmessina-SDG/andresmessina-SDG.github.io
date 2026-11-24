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
  open = false;

  constructor(private sound: Sound) {
    this.talk.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.advance?.();
    });
    window.addEventListener('keydown', (e) => {
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
    this.sound.fold(0.6);
    this.choices.innerHTML = '';
    this.talk.hidden = true;
    this.open = false;
    return choice;
  }

  /** The journal: a short checklist of what to do next. */
  setQuests(quests: Quest[]) {
    this.objective.replaceChildren(
      ...quests.map((q) => {
        const li = document.createElement('li');
        li.textContent = q.text;
        if (q.done) li.classList.add('done');
        if (q.optional) li.classList.add('optional');
        return li;
      }),
    );
    this.objective.hidden = quests.length === 0;
  }

  toast(text: string) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 2600);
  }

  banner(text: string) {
    this.bannerEl.textContent = text;
    this.bannerEl.classList.add('show');
    window.setTimeout(() => this.bannerEl.classList.remove('show'), 3200);
  }

  setInventory(icons: Record<string, string>, have: Set<string>, counts: Record<string, number> = {}) {
    document.querySelectorAll<HTMLElement>('#inv .slot').forEach((s) => {
      const id = s.dataset.id!;
      const img = s.querySelector('img')!;
      if (!img.src && icons[id]) img.src = icons[id];
      s.classList.toggle('got', have.has(id));
      const b = s.querySelector('b');
      if (b) b.textContent = counts[id] ? `×${counts[id]}` : '';
    });
  }
}
