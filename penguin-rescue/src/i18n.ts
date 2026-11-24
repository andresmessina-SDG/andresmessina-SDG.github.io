// English and Russian. Story text sits next to its translation as tr('English', 'Русский');
// the page's own labels are listed here by their data-i18n key.
export type Lang = 'en' | 'ru';

/** Phones and tablets: tap wording and on-screen buttons instead of keys. */
export const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

function detect(): Lang {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'ru') return q;
  try {
    const saved = localStorage.getItem('penguin-rescue-lang');
    if (saved === 'en' || saved === 'ru') return saved;
  } catch {
    /* storage blocked: fall through */
  }
  return (navigator.languages ?? [navigator.language]).some((l) => /^(ru|be|uk|kk)\b/i.test(l)) ? 'ru' : 'en';
}

export let lang: Lang = detect();

export const tr = (en: string, ru: string) => (lang === 'ru' ? ru : en);

/** Russian plural forms: 1 рыбка, 2 рыбки, 5 рыбок. */
export function pl(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

/** "6 hops" / "6 ходов". */
export const hops = (n: number) => tr(`${n} ${n === 1 ? 'hop' : 'hops'}`, `${n} ${pl(n, 'ход', 'хода', 'ходов')}`);
/** "3 fish" / "3 рыбки". */
export const fishes = (n: number) => tr(`${n} fish`, `${n} ${pl(n, 'рыбка', 'рыбки', 'рыбок')}`);

const T: Record<string, [string, string]> = {
  docTitle: ['The Penguin Rescue', 'Спасение пингвина'],
  kicker: ['A pop-up book adventure', 'Приключение в книжке-раскладушке'],
  title: ['The Penguin Rescue', 'Спасение пингвина'],
  blurb: [
    'Two penguins need your help. Their friend Tuck has been carried off by Grimfin, the meanest orca on the page.',
    'Двум пингвинам нужна твоя помощь. Их друга Тука утащил Гримфин — самая вредная косатка на всей странице.',
  ],
  gentle: ['Gentle mode', 'Добрый режим'],
  gentleNote: ['(a kinder Grimfin, for little readers)', '(Гримфин подобрее, для маленьких читателей)'],
  start: ['Open the book', 'Открыть книгу'],
  startOver: ['Start over', 'Начать сначала'],
  cont: ['Continue', 'Продолжить'],
  help: [
    'Click or tap to walk, talk or push · Arrow keys or WASD work too<br>Space to continue or wait a turn · L to cover the lantern · F to toss a fish · J for the journal · M for sound',
    'Нажимай, чтобы идти, говорить или толкать · Можно и стрелками или WASD<br>Пробел — дальше или пропустить ход · L — прикрыть фонарик · F — бросить рыбку · J — дневник · M — звук',
  ],
  helpTouch: [
    'Tap to walk, talk or push · Tap anywhere to read on · Tap the to-do list for your journal<br>⏳ waits a turn · 🏮 covers the lantern · 🐟 tosses a fish',
    'Нажимай, чтобы идти, говорить или толкать · Нажми куда угодно, чтобы читать дальше · Список дел открывает дневник<br>⏳ — пропустить ход · 🏮 — прикрыть фонарик · 🐟 — бросить рыбку',
  ],
  rotate: ['Tip: turn your phone sideways for a bigger book.', 'Совет: поверни телефон боком — книжка будет больше.'],
  endKicker: ['and they all waddled happily ever after', 'и жили-ковыляли они долго и счастливо'],
  end: ['The End', 'Конец'],
  endText: [
    'Tuck is home, Grimfin is somewhere far away being fierce, and the lantern is still glowing.',
    'Тук дома, Гримфин где-то далеко-далеко изображает грозу морей, а фонарик всё ещё светится.',
  ],
  again: ['Read it again', 'Прочитать ещё раз'],
  more: ['continue ▾', 'дальше ▾'],
  lantern: ['lantern', 'фонарик'],
  boat: ['boat', 'кораблик'],
  yarn: ['yarn', 'пряжа'],
  ball: ['ball', 'мячик'],
  fish: ['fish', 'рыба'],
  wait: ['Wait', 'Ждать'],
  lanternAct: ['Lantern', 'Фонарик'],
  fishAct: ['Fish', 'Рыбка'],
  // tooltips and screen-reader labels
  'a:todo': ['Journal (J)', 'Дневник (J)'],
  'a:close': ['Close (Esc)', 'Закрыть (Esc)'],
  specs: ['spectacles', 'очки'],
  bunting: ['bunting', 'флажки'],
  berries: ['berries', 'ягоды'],
  present: ['present', 'подарок'],
  journal: ['Journal', 'Дневник'],
  tabStory: ['Story', 'История'],
  tabSide: ['Side quests', 'Задания'],
  journalHint: ['Press J, or click the to-do list, to open the journal.', 'Дневник открывается клавишей J или нажатием на список дел.'],
  journalHintTouch: ['Tap the to-do list any time to open the journal.', 'Нажми на список дел, чтобы открыть дневник.'],
  questNew: ['New quest!', 'Новое задание!'],
  questDone: ['Quest complete!', 'Задание выполнено!'],
  stars: ['Paper stars', 'Звёздочки'],
  locked: ['Someone needs help…', 'Кому-то нужна помощь…'],
  lockedHint: ['Somebody on this page has a problem. Say hello to everyone you meet!', 'У кого-то на этой странице беда. Поздоровайся со всеми, кого встретишь!'],
  stampDone: ['Done!', 'Готово!'],
  stampMissed: ['Missed', 'Пропущено'],
  'a:inv': ['Inventory', 'Вещи'],
  'a:mute': ['Sound (M)', 'Звук (M)'],
  'a:fs': ['Fullscreen', 'Во весь экран'],
  'a:wait': ['Wait a turn (Space)', 'Пропустить ход (пробел)'],
  'a:lantern': ['Cover or uncover the lantern (L)', 'Прикрыть или открыть фонарик (L)'],
  'a:fish': ['Toss a fish (F)', 'Бросить рыбку (F)'],
  'a:lang': ['Language', 'Язык'],
};

export const t = (k: string) => {
  const p = T[k];
  return p ? (lang === 'ru' ? p[1] : p[0]) : k;
};

/** Fill in every element marked data-i18n (text), data-i18n-html, or data-i18n-label (title and aria-label). */
export function applyDom() {
  document.documentElement.lang = lang;
  document.title = t('docTitle');
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n!)));
  document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    const k = el.dataset.i18nHtml!;
    el.innerHTML = t(touch && T[k + 'Touch'] ? k + 'Touch' : k);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-label]').forEach((el) => {
    const v = t(el.dataset.i18nLabel!);
    el.title = v;
    el.setAttribute('aria-label', v);
  });
  document.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}

const listeners: (() => void)[] = [];
export const onLang = (fn: () => void) => listeners.push(fn);

export function setLang(l: Lang) {
  lang = l;
  try {
    localStorage.setItem('penguin-rescue-lang', l);
  } catch {
    /* fine: the choice just won't be remembered */
  }
  applyDom();
  listeners.forEach((fn) => fn());
}
