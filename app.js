'use strict';

(function initModuleLauncher() {
  const launcher = document.getElementById('launcher');
  const simplex = document.getElementById('simplex-module');
  const pert = document.getElementById('pert-module');
  const transportation = document.getElementById('transportation-module');
  const routeShortest = document.getElementById('route-shortest-module');
  const optimization = document.getElementById('optimization-module');
  if (!launcher || !simplex || !pert || !transportation || !routeShortest || !optimization) return;

  const modules = { simplex, pert, transportation, 'route-shortest': routeShortest, optimization };
  // Cambio de vista con transición breve (View Transitions): responde de inmediato, no bloquea la interacción y la cabecera
  // conserva continuidad espacial. Con reduced-motion se reduce a un fundido corto; sin soporte, el cambio es inmediato.
  function swapView(update) {
    const root = document.documentElement;
    const motion = window.ioMotion ? window.ioMotion() : { reduce: false, off: false };
    const run = () => { update(); window.scrollTo({ top: 0, behavior: 'auto' }); };
    if (motion.off || typeof document.startViewTransition !== 'function') { run(); return; }
    root.classList.add('lg-vt');
    const done = () => root.classList.remove('lg-vt');
    // Si el navegador tarda en capturar la vista anterior (equipos lentos o con mucho desenfoque), no se retrasa la navegación:
    // pasados 200 ms el cambio se aplica igualmente (la transición solo es un efecto, nunca una condición).
    let applied = false; const once = () => { if (applied) return; applied = true; run(); };
    try { document.startViewTransition(once).finished.then(done, done); setTimeout(once, 200); } catch (_) { done(); once(); }
  }
  function showModule(name) {
    swapView(() => {
      launcher.classList.add('hidden');
      Object.entries(modules).forEach(([key, node]) => node.classList.toggle('hidden', key !== name));
    });
  }
  function showLauncher() {
    swapView(() => {
      Object.values(modules).forEach(node => node.classList.add('hidden'));
      launcher.classList.remove('hidden');
    });
  }
  document.querySelectorAll('[data-module]').forEach(button => button.addEventListener('click', () => showModule(button.dataset.module)));
  document.querySelectorAll('[data-back-launcher]').forEach(button => button.addEventListener('click', showLauncher));

  // Appearance controls live on the launcher so the same preference applies to both modules.
  const theme = document.getElementById('theme-select');
  const accent = document.getElementById('accent-select');
  const root = document.documentElement;
  if (theme && accent) {
    let savedTheme = 'system', savedAccent = 'blue';
    try { savedTheme = localStorage.getItem('io-solver-theme') || 'system'; savedAccent = localStorage.getItem('io-solver-accent') || 'blue'; } catch (_) {}
    theme.value = ['system','light','dark'].includes(savedTheme) ? savedTheme : 'system';
    accent.value = ['blue','teal','violet','pink','magenta','indigo','green'].includes(savedAccent) ? savedAccent : 'blue';
    const apply = () => {
      if (theme.value === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', theme.value);
      root.setAttribute('data-accent', accent.value);
      try { localStorage.setItem('io-solver-theme', theme.value); localStorage.setItem('io-solver-accent', accent.value); } catch (_) {}
    };
    theme.addEventListener('change', apply);
    accent.addEventListener('change', apply);
    apply();
  }
})();
