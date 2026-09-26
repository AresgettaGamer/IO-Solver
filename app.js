'use strict';

(function initModuleLauncher() {
  const launcher = document.getElementById('launcher');
  const simplex = document.getElementById('simplex-module');
  const pert = document.getElementById('pert-module');
  if (!launcher || !simplex || !pert) return;

  const modules = { simplex, pert };
  function showModule(name) {
    launcher.classList.add('hidden');
    Object.entries(modules).forEach(([key, node]) => node.classList.toggle('hidden', key !== name));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function showLauncher() {
    Object.values(modules).forEach(node => node.classList.add('hidden'));
    launcher.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
