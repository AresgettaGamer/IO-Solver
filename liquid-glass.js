/* IO Solver — ajustes de cristal/movimiento + reflejo especular. Todo se guarda en localStorage (con try/catch). */
(function () {
  var root = document.documentElement, KEY = 'io-solver-lg';
  var DEF = { glass: 'normal', lens: true, bg: true, spec: true, motion: 'full' };
  var lensOK = root.classList.contains('lg-lens');            // la clase la pone el script de <head> solo en Chromium
  var S = Object.assign({}, DEF);
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function apply() {
    root.dataset.lgGlass = S.glass; root.dataset.lgBg = S.bg ? 'on' : 'off'; root.dataset.lgMotion = S.motion;
    root.classList.toggle('lg-lens', lensOK && !!S.lens);
  }
  apply();

  var pop = document.getElementById('settings-pop');
  if (pop) {
    var q = function (s) { return pop.querySelector(s); };
    function sync() {
      var g = q('input[name="lg-glass"][value="' + S.glass + '"]'); if (g) g.checked = true;
      var st = q('input[name="lg-style"][value="' + (root.dataset.style || 'neon') + '"]'); if (st) st.checked = true;
      var m = q('input[name="lg-motion"][value="' + S.motion + '"]'); if (m) m.checked = true;
      ['lens', 'bg', 'spec'].forEach(function (k) { var c = q('#lg-opt-' + k); if (c) c.checked = !!S[k]; });
    }
    sync();
    var lensBox = q('#lg-opt-lens');
    if (!lensOK && lensBox) {                                  // navegador sin soporte: se deshabilita con aviso
      lensBox.disabled = true; lensBox.checked = false;
      var lab = lensBox.closest('label'); if (lab) lab.setAttribute('aria-disabled', 'true');
      var note = q('#lg-lens-note'); if (note) note.textContent = 'No disponible en este navegador (requiere Chromium: Chrome, Opera GX, Edge).';
    }
    pop.addEventListener('change', function (e) {
      var t = e.target;
      if (t.name === 'lg-style') { root.dataset.style = t.value; try { localStorage.setItem('io-solver-style', t.value); } catch (e) {} return; }
      if (t.name === 'lg-glass') S.glass = t.value;
      else if (t.name === 'lg-motion') S.motion = t.value;
      else if (t.id === 'lg-opt-lens') S.lens = t.checked;
      else if (t.id === 'lg-opt-bg') S.bg = t.checked;
      else if (t.id === 'lg-opt-spec') S.spec = t.checked;
      else return;
      save(); apply();
    });
    var reset = q('#lg-reset');
    if (reset) reset.addEventListener('click', function () { S = Object.assign({}, DEF); save(); apply(); sync(); });

    // Posición adaptable: bajo el botón pulsado, siempre dentro de la pantalla; en móvil es una hoja inferior (CSS)
    var lastBtn = null;
    function isOpen() { return pop.classList.contains('is-open') || (pop.matches && pop.matches(':popover-open')); }
    function place() {
      if (!lastBtn || window.innerWidth <= 560) return;
      var vw = window.innerWidth, vh = window.innerHeight, r = lastBtn.getBoundingClientRect(), w = Math.min(392, vw - 24);
      var x = Math.max(12, Math.min(r.right - w, vw - w - 12));
      var y = Math.max(12, Math.min(r.bottom + 10, vh - 300));          // deja al menos ~300px de alto visibles
      pop.style.setProperty('--lg-pop-x', x + 'px'); pop.style.setProperty('--lg-pop-y', y + 'px');
    }
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.settings-btn'); if (!b) return;
      lastBtn = b; place();
      if (!('popover' in HTMLElement.prototype)) { pop.classList.toggle('is-open'); }   // fallback sin Popover API
    }, true);
    window.addEventListener('resize', function () { if (isOpen()) place(); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', function () { if (isOpen()) place(); });
    if (!('popover' in HTMLElement.prototype)) {
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') pop.classList.remove('is-open'); });
      document.addEventListener('click', function (e) { if (!e.target.closest('#settings-pop, .settings-btn')) pop.classList.remove('is-open'); });
    }
  }

  // Gráfica: entra/sale con fundido + altura animada. Opacidad y altura se mueven en el MISMO cuadro (rAF), así nunca queda
  // una caja vacía y grande a medio retraer aunque el navegador vaya lento. El deslizador de Z aparece/desaparece con ella.
  (function () {
    var out = document.getElementById('graph-output'); if (!out || !window.MutationObserver) return;
    var sec = document.getElementById('graph-section'), ctr = document.getElementById('graph-controls');
    var ghost = null, timer = 0, had = out.children.length > 0, rafId = 0, running = false, token = 0;
    var easeOut = function (t) { return 1 - Math.pow(1 - t, 4); };
    var easeIO = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    function reset() {
      out.style.height = out.style.overflow = '';
      if (ghost && ghost.parentNode === out) { mo.disconnect(); out.removeChild(ghost); mo.observe(out, { childList: true }); }
      ghost = null;
    }
    function stop() { if (running) { token++; cancelAnimationFrame(rafId); running = false; reset(); } }
    // Un solo bucle rAF por animación; "token" invalida cualquier bucle anterior (antes se creaban dos y uno quedaba sin poder cancelarse)
    function run(dur, step) {
      var t0 = performance.now(), my = ++token; running = true; step(0);
      function loop(now) {
        if (my !== token) return;
        var t = Math.max(0, Math.min(1, (now - t0) / dur)); step(t);
        if (t < 1) rafId = requestAnimationFrame(loop); else { running = false; reset(); }
      }
      rafId = requestAnimationFrame(loop);
    }
    function canAnimate() { var m = window.ioMotion ? window.ioMotion() : { reduce: false, off: false }; return !m.reduce && !m.off; }
    var mo = new MutationObserver(function (recs) {
      if (ghost && !ghost.isConnected) ghost = null;
      var removed = [];
      recs.forEach(function (r) { r.removedNodes.forEach(function (n) { if (n !== ghost && n.nodeType === 1) removed.push(n); }); });
      var now = Array.prototype.some.call(out.children, function (c) { return c !== ghost; });
      var animate = canAnimate();
      if (ctr && had !== now) ctr.classList.toggle('hidden', !now);                      // el deslizador sigue a la gráfica
      if (had && now) { stop(); out.classList.remove('lg-enter'); }                      // re-render (deslizador): sin animación
      else if (!had && now && animate) {
        stop(); out.classList.add('lg-enter'); clearTimeout(timer); timer = setTimeout(function () { out.classList.remove('lg-enter'); }, 1400);
        var secBusy = sec && sec.getAnimations && sec.getAnimations().length > 0;       // si la sección ya anima su altura, no duplicar
        var to = out.getBoundingClientRect().height;
        if (!secBusy && to > 0) { out.style.overflow = 'hidden'; out.style.height = '0px'; run(520, function (t) { out.style.height = (to * easeOut(t)) + 'px'; }); }
      }
      else if (had && !now && removed.length && animate) {
        stop(); mo.disconnect(); ghost = document.createElement('div'); ghost.className = 'lg-ghost';
        removed.forEach(function (n) { ghost.appendChild(n); }); out.appendChild(ghost);
        var from = out.getBoundingClientRect().height; mo.observe(out, { childList: true });
        if (from > 0) {
          out.style.overflow = 'hidden'; out.style.height = from + 'px';
          var g = ghost;
          run(480, function (t) { out.style.height = (from * (1 - easeIO(t))) + 'px'; g.style.opacity = String(1 - t * t); g.style.transform = 'translateY(' + (-8 * t) + 'px)'; });
        } else { reset(); }
      }
      had = now;
    });
    mo.observe(out, { childList: true });
  })();

  // Reflejo especular que sigue al puntero (solo ratón/lápiz; respeta el ajuste y reduced-motion)
  if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var SEL = '.module-card, .launcher-hero, .hero, .btn, .icon-btn, .back-button', raf = 0, ev = null;
    document.addEventListener('pointermove', function (e) {
      if (!S.spec || (window.ioMotion && window.ioMotion().reduce)) return; ev = e; if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0; var t = ev.target && ev.target.closest && ev.target.closest(SEL); if (!t) return;
        var r = t.getBoundingClientRect(); if (!r.width || !r.height) return;
        t.style.setProperty('--lg-x', ((ev.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        t.style.setProperty('--lg-y', ((ev.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      });
    }, { passive: true });
  }
})();
