// One sweep of light across the gold leaf of the initial, once the letter is set,
// and again when a pointer rests on it. Nothing moves for readers who ask for stillness.
(() => {
  const sweep = document.getElementById('sweep');
  const initial = document.querySelector('.initial');
  if (!sweep || !initial || !sweep.beginElement) return;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const shine = () => { if (!still.matches) { try { sweep.beginElement(); } catch (e) {} } };
  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(() => setTimeout(shine, 350));
  initial.addEventListener('mouseenter', shine);
})();
