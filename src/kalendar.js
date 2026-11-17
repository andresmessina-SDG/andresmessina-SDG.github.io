// The kalendar: today's date as a book of hours sets it, in red on the Lord's Day and on the
// feasts the Reformed churches kept, and the day's verse. Run where it stands, in the reader's
// own browser and by their own calendar, before the page is painted. tools/build.py wraps it
// with V (the verses as [text, reference]), F (the feasts' names) and L (the language).
const d = new Date();
const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
const box = document.currentScript.closest('.kalendar');
const today = Date.UTC(y, m, day);

// the day's verse: day 0 is 1 January 2026, and the days go round the list in order
const n = Math.round((today - Date.UTC(2026, 0, 1)) / 864e5);
const [t, r] = V[((n % V.length) + V.length) % V.length];
const p = box.querySelector('.verse p');
p.textContent = '';
t.split('LORD').forEach((s, i) => {
  if (i) { const l = document.createElement('span'); l.className = 'lord'; l.textContent = 'Lord'; p.append(l); }
  p.append(s);
});
box.querySelector('.verse cite').textContent = r;

// Easter, by the Gregorian reckoning (the anonymous algorithm of 1876)
const ea = y % 19, eb = Math.floor(y / 100), ec = y % 100, ed = Math.floor(eb / 4), ee = eb % 4;
const ef = Math.floor((eb + 8) / 25), eg = Math.floor((eb - ef + 1) / 3), eh = (19 * ea + eb - ed - eg + 15) % 30;
const ei = Math.floor(ec / 4), ek = ec % 4, el = (32 + 2 * ee + 2 * ei - eh - ek) % 7;
const em = Math.floor((ea + 11 * eh + 22 * el) / 451), en = eh + el - 7 * em + 114;
const easter = Date.UTC(y, Math.floor(en / 31) - 1, (en % 31) + 1);
const after = (days) => easter + days * 864e5;
const feast =
  today === Date.UTC(y, 11, 25) ? F.christmas :
  today === after(-2) ? F.good_friday :
  today === easter ? F.easter :
  today === after(39) ? F.ascension :
  today === after(49) ? F.pentecost :
  today === Date.UTC(y, 9, 31) ? F.reformation :
  d.getDay() === 0 ? F.lords_day : '';

const roman = (x) => [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].reduce((s, [v, sym]) => { while (x >= v) { s += sym; x -= v; } return s; }, '');
const date = box.querySelector('.kal-date');
const fmt = (o) => new Intl.DateTimeFormat(L, o).format(d);
date.querySelector('.kal-num').textContent = day;
date.querySelector('.kal-wd').textContent = fmt({ weekday: 'long' });
date.querySelector('.kal-mo').textContent = fmt({ month: 'long' });
date.querySelector('.kal-ad').textContent = 'A.D. ' + roman(y);
date.classList.toggle('red', !!feast);
date.hidden = false;
if (feast) { const fe = box.querySelector('.kal-feast'); fe.textContent = feast; fe.hidden = false; }
