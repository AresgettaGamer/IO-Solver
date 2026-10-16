'use strict';
(function () {
  const M = window.IOOptimizationMath;
  const el = {
    expression: document.getElementById('optimization-expression'), min: document.getElementById('optimization-min'), max: document.getElementById('optimization-max'), objective: document.getElementById('optimization-objective'),
    analyze: document.getElementById('optimization-analyze'), example: document.getElementById('optimization-example'), status: document.getElementById('optimization-status'), output: document.getElementById('optimization-output'), graph: document.getElementById('optimization-graph'), tabButtons: [...document.querySelectorAll('[data-optimization-view]')]
  };
  if (!M || !el.expression || !el.output) return;
  let current = null, view = 'analysis';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = M.fmt;
  const mathHtml = (p, name) => `${name}(x) = ${esc(M.formatPolynomial(p))}`;
  function renderGraph(a) {
    const W = 760, H = 300, left = 46, right = 18, top = 18, bottom = 38, pw = W - left - right, ph = H - top - bottom;
    const values = []; const N = 220;
    for (let i = 0; i <= N; i++) { const x = a.min + (a.max - a.min) * i / N; const y = M.evaluate(a.f, x); if (Number.isFinite(y)) values.push({ x, y }); }
    if (values.length < 2) return '<p class="message error">No es posible representar gráficamente esta función en el intervalo.</p>';
    let ymin = Math.min(...values.map(p => p.y)), ymax = Math.max(...values.map(p => p.y));
    if (!Number.isFinite(ymin) || !Number.isFinite(ymax)) return '<p class="message error">La función produce valores demasiado grandes en ese intervalo.</p>';
    if (Math.abs(ymax - ymin) < 1e-9) { ymin -= 1; ymax += 1; } else { const pad = (ymax - ymin) * .09; ymin -= pad; ymax += pad; }
    const sx = x => left + (x - a.min) / (a.max - a.min) * pw, sy = y => top + (ymax - y) / (ymax - ymin) * ph;
    const path = values.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(2)} ${sy(p.y).toFixed(2)}`).join(' ');
    const yZero = ymin <= 0 && ymax >= 0 ? sy(0) : null, xZero = a.min <= 0 && a.max >= 0 ? sx(0) : null;
    const ticksX = Array.from({length:5},(_,i)=>a.min+(a.max-a.min)*i/4), ticksY = Array.from({length:5},(_,i)=>ymin+(ymax-ymin)*i/4);
    const grid = ticksX.map(x=>`<line x1="${sx(x)}" y1="${top}" x2="${sx(x)}" y2="${H-bottom}" stroke="var(--border)" stroke-dasharray="3 4"/><text class="axis-label" x="${sx(x)}" y="${H-14}" text-anchor="middle">${esc(fmt(x,3))}</text>`).join('') + ticksY.map(y=>`<line x1="${left}" y1="${sy(y)}" x2="${W-right}" y2="${sy(y)}" stroke="var(--border)" stroke-dasharray="3 4"/><text class="axis-label" x="${left-7}" y="${sy(y)+4}" text-anchor="end">${esc(fmt(y,3))}</text>`).join('');
    const points = [...a.critical.filter(p=>p.x>a.min+1e-8&&p.x<a.max-1e-8).map(p=>({ ...p, cls:'critical', label:p.kind })), ...a.inflections.map(p=>({...p,cls:'inflection',label:'Inflexión'}))];
    const pointSvg = points.map(p=>`<circle class="point ${p.cls}" cx="${sx(p.x)}" cy="${sy(p.y)}" r="5"><title>${esc(p.label)}: (${fmt(p.x)}, ${fmt(p.y)})</title></circle>`).join('');
    return `<div class="optimization-graph"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de la función polinómica y los puntos críticos e inflexiones detectados">${grid}${yZero!=null?`<line class="axis" x1="${left}" y1="${yZero}" x2="${W-right}" y2="${yZero}"/>`:''}${xZero!=null?`<line class="axis" x1="${xZero}" y1="${top}" x2="${xZero}" y2="${H-bottom}"/>`:''}<path class="function-line" d="${path}"/>${pointSvg}<text class="axis-label" x="${W-right}" y="${H-2}" text-anchor="end">x</text><text class="axis-label" x="9" y="${top+4}">f(x)</text></svg></div><p class="muted optimization-scope">Gráfica numérica de referencia; los resultados se calculan a partir de los coeficientes del polinomio.</p>`;
  }
  function resultCards(a) {
    const minPts = a.minimum.points.map(p=>`(${fmt(p.x)}, ${fmt(p.y)})`).join(', '), maxPts = a.maximum.points.map(p=>`(${fmt(p.x)}, ${fmt(p.y)})`).join(', ');
    return `<div class="optimization-result-grid"><div class="optimization-result-box"><span class="muted">Mínimo absoluto en el intervalo</span><br><strong>f(x) = ${fmt(a.minimum.value)}</strong><p class="muted">En ${esc(minPts)}</p></div><div class="optimization-result-box"><span class="muted">Máximo absoluto en el intervalo</span><br><strong>f(x) = ${fmt(a.maximum.value)}</strong><p class="muted">En ${esc(maxPts)}</p></div></div>`;
  }
  function renderAnalysis(a) {
    return `<h3>Función y derivadas</h3><div class="optimization-formula">${mathHtml(a.f,'f')}<br>${mathHtml(a.d1,"f′")}<br>${mathHtml(a.d2,"f′′")}</div><p>Intervalo analizado: <strong>[${fmt(a.min)}, ${fmt(a.max)}]</strong>. La función y sus derivadas se evaluaron numéricamente en ese intervalo.</p><h3>Vista gráfica</h3>${renderGraph(a)}<h3>Extremos absolutos del intervalo</h3>${resultCards(a)}`;
  }
  function renderMaxMin(a) {
    const rows = a.critical.length ? a.critical.map(p=>`<tr><td>${fmt(p.x)}</td><td>${fmt(p.y)}</td><td>${esc(p.kind)}</td><td>${fmt(M.evaluate(a.d2,p.x))}</td></tr>`).join('') : '<tr><td colspan="4">No se encontraron raíces de f′(x) en el intervalo.</td></tr>';
    return `<div class="optimization-steps"><div class="optimization-step"><span class="optimization-step-index">1</span><div><strong>Derivar la función</strong><p>${mathHtml(a.d1,"f′")}</p></div></div><div class="optimization-step"><span class="optimization-step-index">2</span><div><strong>Encontrar puntos críticos</strong><p>Se buscan las raíces de f′(x) dentro del intervalo: ${a.critical.map(p=>fmt(p.x)).join(', ') || 'no se encontraron'}.</p></div></div><div class="optimization-step"><span class="optimization-step-index">3</span><div><strong>Clasificar el comportamiento</strong><p>Se compara el signo de la primera derivada a ambos lados del punto. f′ positiva y luego negativa indica máximo local; negativa y luego positiva indica mínimo local.</p></div></div><div class="optimization-step"><span class="optimization-step-index">4</span><div><strong>Comparar extremos y límites del intervalo</strong><p>Para hallar el máximo y mínimo absolutos en un intervalo cerrado también se revisan sus extremos.</p></div></div></div><h3>Puntos críticos</h3><div class="table-wrap"><table class="optimization-calc-table"><thead><tr><th>x</th><th>f(x)</th><th>Clasificación local</th><th>f′′(x)</th></tr></thead><tbody>${rows}</tbody></table></div>${resultCards(a)}<p class="optimization-warning">La clasificación se apoya en cambios numéricos de signo de f′. Si hay raíces muy cercanas o multiplicidades altas, revisa el análisis con el método de clase.</p>`;
  }
  function renderInflections(a) {
    const rows = a.inflections.length ? a.inflections.map(p=>{
      const delta = Math.max(1e-5,Math.min((a.max-a.min)/1000,1e-3*Math.max(1,Math.abs(p.x))));
      const left = M.evaluate(a.d2, Math.max(a.min,p.x-delta)), right = M.evaluate(a.d2, Math.min(a.max,p.x+delta));
      const concL = left > 1e-7 ? 'Cóncava hacia arriba' : left < -1e-7 ? 'Cóncava hacia abajo' : 'No concluyente';
      const concR = right > 1e-7 ? 'Cóncava hacia arriba' : right < -1e-7 ? 'Cóncava hacia abajo' : 'No concluyente';
      return `<tr><td>${fmt(p.x)}</td><td>${fmt(p.y)}</td><td>${concL}</td><td>${concR}</td><td>${p.stationary?'Sí':'No'}</td></tr>`;
    }).join('') : '<tr><td colspan="5">No se detectó ningún cambio de concavidad en el intervalo.</td></tr>';
    return `<div class="optimization-formula">${mathHtml(a.d2,"f′′")}<br>${mathHtml(a.d3,"f′′′")}</div><div class="optimization-steps"><div class="optimization-step"><span class="optimization-step-index">1</span><div><strong>Calcular la segunda derivada</strong><p>Los posibles puntos de inflexión se buscan entre las raíces de f′′(x).</p></div></div><div class="optimization-step"><span class="optimization-step-index">2</span><div><strong>Comprobar el cambio de concavidad</strong><p>Se evalúa f′′ a la izquierda y a la derecha. Si el signo cambia, se identifica un punto de inflexión.</p></div></div></div><h3>Puntos de inflexión detectados</h3><div class="table-wrap"><table class="optimization-calc-table"><thead><tr><th>x</th><th>f(x)</th><th>Concavidad izquierda</th><th>Concavidad derecha</th><th>¿También estacionario?</th></tr></thead><tbody>${rows}</tbody></table></div><p class="optimization-warning">Resolver f′′(x)=0 es solo el primer paso: el sistema reporta un punto de inflexión únicamente si detecta un cambio de signo de la segunda derivada dentro del intervalo.</p>`;
  }
  function renderOptimization(a) {
    const objective = el.objective.value;
    const chosen = objective === 'max' ? a.maximum : a.minimum;
    const word = objective === 'max' ? 'maximizar' : 'minimizar';
    const pts = chosen.points.map(p=>`x = ${fmt(p.x)}, f(x) = ${fmt(p.y)}`).join('; ');
    const compare = [...new Map([...a.candidates].map(p=>[`${p.x.toFixed(7)}|${p.y.toFixed(7)}`,p])).values()].sort((p,q)=>p.x-q.x).map((p,i)=>`<tr><td>${i+1}</td><td>${fmt(p.x)}</td><td>${fmt(p.y)}</td><td>${Math.abs(p.x-a.min)<1e-7||Math.abs(p.x-a.max)<1e-7?'Extremo del intervalo':p.kind||'Punto crítico'}</td></tr>`).join('');
    return `<p>Se interpreta como un problema de optimización de una función polinómica continua en el intervalo cerrado indicado.</p><div class="optimization-result-box"><span class="muted">Objetivo: ${word}</span><br><strong>${esc(pts)}</strong><p>Valor óptimo calculado: <b>${fmt(chosen.value)}</b>.</p></div><div class="optimization-steps"><div class="optimization-step"><span class="optimization-step-index">1</span><div><strong>Definir la función objetivo</strong><p>f(x) = ${esc(M.formatPolynomial(a.f))}.</p></div></div><div class="optimization-step"><span class="optimization-step-index">2</span><div><strong>Definir el dominio permitido</strong><p>${fmt(a.min)} ≤ x ≤ ${fmt(a.max)}.</p></div></div><div class="optimization-step"><span class="optimization-step-index">3</span><div><strong>Buscar los puntos candidatos</strong><p>Se obtienen las raíces de f′(x) y se agregan los dos extremos del intervalo.</p></div></div><div class="optimization-step"><span class="optimization-step-index">4</span><div><strong>Evaluar y comparar</strong><p>Se calcula f(x) en cada candidato y se selecciona el valor más ${objective==='max'?'alto':'bajo'}.</p></div></div></div><h3>Tabla de comparación</h3><div class="table-wrap"><table class="optimization-calc-table"><thead><tr><th>Candidato</th><th>x</th><th>f(x)</th><th>Tipo</th></tr></thead><tbody>${compare}</tbody></table></div><p class="optimization-warning">Esta herramienta calcula el extremo de una función de una variable dentro de un intervalo. Todavía no formula automáticamente modelos desde problemas narrativos ni resuelve restricciones multivariables o multiplicadores de Lagrange.</p>`;
  }
  function render() {
    if (!current) return;
    const a = current;
    const heading = ({analysis:'Análisis de función',maxmin:'Máximos y mínimos',inflection:'Puntos de inflexión',optimization:'Optimización clásica'})[view];
    const body = ({analysis:renderAnalysis,maxmin:renderMaxMin,inflection:renderInflections,optimization:renderOptimization})[view](a);
    el.output.innerHTML = `<div class="section-title-row"><h2>${heading}</h2><p>Resultados calculados en el intervalo seleccionado.</p></div>${body}`;
    el.status.textContent = 'Análisis terminado. Revisa el intervalo y la interpretación antes de usar el resultado.'; el.status.className = 'message ok';
  }
  function calculate() {
    try {
      const a = M.analyze(el.expression.value, el.min.value, el.max.value);
      if (![...a.f,...a.d1,...a.d2].every(Number.isFinite) || ![a.minimum.value,a.maximum.value].every(Number.isFinite)) throw new Error('La función genera valores fuera del rango numérico en ese intervalo. Prueba con un intervalo más pequeño.');
      current = a; render();
    } catch(error) { current = null; el.output.innerHTML = ''; el.status.textContent = error.message || 'No se pudo analizar la función.'; el.status.className = 'message error'; }
  }
  el.analyze.addEventListener('click', calculate);
  el.example.addEventListener('click', () => { el.expression.value = 'x^3 - 6x^2 + 9x + 1'; el.min.value = '0'; el.max.value = '5'; el.objective.value='max'; calculate(); });
  el.tabButtons.forEach(btn => btn.addEventListener('click', () => { view = btn.dataset.optimizationView; el.tabButtons.forEach(b=>b.setAttribute('aria-pressed',String(b===btn))); render(); }));
  el.objective.addEventListener('change', () => { if (current && view === 'optimization') render(); });
  window.IOOptimizationUI = { calculate, getResult: () => current };
  // No calcular silenciosamente al entrar: invita a revisar la función y su intervalo.
})();
