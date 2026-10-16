'use strict';
(function () {
  const el = {
    body: document.getElementById('route-edge-body'), add: document.getElementById('route-add-edge'), example: document.getElementById('route-example'), solve: document.getElementById('route-solve'),
    source: document.getElementById('route-source'), target: document.getElementById('route-target'), directed: document.getElementById('route-directed'), status: document.getElementById('route-status'), result: document.getElementById('route-result'), graph: document.getElementById('route-graph'), steps: document.getElementById('route-steps'), summary: document.getElementById('route-summary'),
    file: document.getElementById('route-file'), fileStatus: document.getElementById('route-file-status'), text: document.getElementById('route-paste-text'), parseText: document.getElementById('route-parse-text'), progressHost: document.getElementById('route-file-status'),
  };
  if (!el.body || !el.solve || !window.IORouteShortestAPI) return;
  const { parseEdgeText, computeShortestPath } = window.IORouteShortestAPI;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => Number.isInteger(n) ? String(n) : Number(n.toFixed(4)).toString();
  let rows = []; let fileProgress = null;
  function readRows() {
    rows = [...el.body.querySelectorAll('tr')].map(tr => ({ from: tr.querySelector('.route-edge-from').value.trim(), to: tr.querySelector('.route-edge-to').value.trim(), weight: tr.querySelector('.route-edge-weight').value.trim() }));
    return rows.filter(r => r.from || r.to || r.weight).map((r, i) => {
      if (!r.from || !r.to || r.weight === '') throw new Error(`Completa origen, destino y peso en la conexión ${i + 1}.`);
      const weight = Number(r.weight); if (!Number.isFinite(weight) || weight < 0) throw new Error(`El peso de la conexión ${i + 1} debe ser numérico y no negativo.`);
      return { from: r.from, to: r.to, weight };
    });
  }
  function renderRows() {
    el.body.innerHTML = rows.map((r, i) => `<tr data-row="${i}"><td><input class="route-edge-from" aria-label="Origen de conexión ${i + 1}" value="${esc(r.from)}" placeholder="A"></td><td><input class="route-edge-to" aria-label="Destino de conexión ${i + 1}" value="${esc(r.to)}" placeholder="B"></td><td><input class="route-edge-weight" aria-label="Peso de conexión ${i + 1}" type="number" min="0" step="any" value="${esc(r.weight)}" placeholder="4"></td><td><button class="icon-btn route-edge-remove" type="button" data-index="${i}" aria-label="Eliminar conexión ${i + 1}" title="Eliminar">×</button></td></tr>`).join('');
    el.body.querySelectorAll('input').forEach(input => input.addEventListener('input', () => { try { const es = readRows(); const nodes = [...new Set(es.flatMap(e => [e.from, e.to]))]; syncNodeChoices(nodes); } catch (_) {} }));
  }
  function syncNodeChoices(nodes) {
    const update = (select, defaultValue) => { const old = select.value; const found = nodes.find(n => n.toLowerCase() === old.toLowerCase()); select.innerHTML = nodes.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join(''); if (found) select.value = found; else if (nodes.length) select.value = defaultValue === 'first' ? nodes[0] : nodes[nodes.length - 1]; };
    if (nodes.length) { update(el.source, 'first'); update(el.target, 'last'); }
  }
  function loadExample() {
    rows = [
      { from: 'A', to: 'B', weight: '4' }, { from: 'A', to: 'C', weight: '2' }, { from: 'C', to: 'B', weight: '1' },
      { from: 'B', to: 'D', weight: '5' }, { from: 'C', to: 'D', weight: '8' }, { from: 'C', to: 'E', weight: '10' }, { from: 'D', to: 'E', weight: '2' },
    ];
    renderRows(); syncNodeChoices(['A', 'B', 'C', 'D', 'E']); el.source.value = 'A'; el.target.value = 'E'; el.status.textContent = 'Ejemplo cargado. Analiza la red para ver las iteraciones.'; el.status.className = 'message'; el.result.classList.add('hidden');
  }
  function renderGraph(result) {
    const W = 740, H = 300, cx = W / 2, cy = H / 2, rx = 260, ry = 100;
    const positions = new Map(result.nodes.map((n, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI / result.nodes.length); return [n, { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }]; }));
    const pathPairs = new Set(result.path.slice(1).map((n, i) => `${result.path[i]}\u0000${n}`));
    const isOnPath = (a, b) => pathPairs.has(`${a}\u0000${b}`) || (!result.directed && pathPairs.has(`${b}\u0000${a}`));
    const defs = result.directed ? '<defs><marker id="route-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="currentColor"/></marker></defs>' : '';
    const links = result.edges.map(e => {
      const a = positions.get(e.from), b = positions.get(e.to), highlight = isOnPath(e.from, e.to), dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, ox = (dx / d) * 23, oy = (dy / d) * 23;
      const mx = (a.x + b.x) / 2 + (Math.abs(dy) < 3 ? 0 : (dy > 0 ? 10 : -10)), my = (a.y + b.y) / 2 - (Math.abs(dx) < 3 ? 10 : 0);
      return `<g class="route-graph-edge ${highlight ? 'is-route' : ''}"><line x1="${a.x + ox}" y1="${a.y + oy}" x2="${b.x - ox}" y2="${b.y - oy}" ${result.directed ? 'marker-end="url(#route-arrow)"' : ''}/><rect x="${mx - 16}" y="${my - 11}" width="32" height="21" rx="7"/><text x="${mx}" y="${my + 4}" text-anchor="middle">${esc(fmt(e.weight))}</text></g>`;
    }).join('');
    const nodes = result.nodes.map(n => { const p = positions.get(n), selected = n === result.source || n === result.target, onPath = result.path.includes(n); return `<g class="route-graph-node ${onPath ? 'is-route' : ''} ${selected ? 'is-endpoint' : ''}"><circle cx="${p.x}" cy="${p.y}" r="22"/><text x="${p.x}" y="${p.y + 5}" text-anchor="middle">${esc(n.length > 7 ? `${n.slice(0, 6)}…` : n)}</text><text class="route-node-distance" x="${p.x}" y="${p.y + 39}" text-anchor="middle">d=${Number.isFinite(result.distances[n]) ? esc(fmt(result.distances[n])) : '∞'}</text></g>`; }).join('');
    return `<div class="route-graph-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Red de conexiones con la ruta más corta resaltada">${defs}${links}${nodes}</svg></div><p class="muted route-graph-legend">Las conexiones destacadas forman la ruta seleccionada; las etiquetas junto a los nodos muestran la distancia acumulada desde el origen.</p>`;
  }
  function renderSteps(result) {
    const nodes = result.nodes;
    const head = `<thead><tr><th>Paso</th><th>Nodo elegido</th><th>Distancia actual</th>${nodes.map(n => `<th>d(${esc(n)})</th>`).join('')}</tr></thead>`;
    const body = result.steps.map((s, i) => `<tr><td>${i + 1}</td><td>${s.node ? esc(s.node) : '—'}</td><td>${Number.isFinite(s.distance) ? fmt(s.distance) : '∞'}</td>${nodes.map(n => `<td>${Number.isFinite(s.distances[n]) ? fmt(s.distances[n]) : '∞'}${s.previous[n] ? `<small class="route-predecessor">← ${esc(s.previous[n])}</small>` : ''}</td>`).join('')}</tr>`).join('');
    const relax = result.steps.map((s, i) => {
      if (!s.node) return `<div class="route-step-note"><strong>Paso ${i + 1}.</strong> ${esc(s.note || 'No hay más nodos alcanzables.')}</div>`;
      const updates = s.relaxations.length ? s.relaxations.map(r => `${esc(r.to)}: ${Number.isFinite(r.old) ? fmt(r.old) : '∞'} → ${fmt(r.next)} (por ${esc(r.via)} + ${fmt(r.weight)})`).join('; ') : 'No se mejoró ninguna distancia.';
      return `<div class="route-step-note"><strong>Paso ${i + 1} · nodo ${esc(s.node)}.</strong> Se fija d(${esc(s.node)}) = ${fmt(s.distance)}. ${esc(updates)}</div>`;
    }).join('');
    return `<div class="table-wrap"><table class="route-distance-table">${head}<tbody>${body}</tbody></table></div><h3 class="route-subhead">Qué ocurrió en cada iteración</h3><div class="route-step-list">${relax}</div>`;
  }
  function solve() {
    try {
      const edges = readRows();
      const result = computeShortestPath(edges, el.source.value, el.target.value, el.directed.checked);
      el.result.classList.remove('hidden');
      if (result.reachable) {
        el.summary.innerHTML = `<div class="solution-cards"><div class="solution-card"><div class="label">Origen</div><div class="value">${esc(result.source)}</div></div><div class="solution-card"><div class="label">Destino</div><div class="value">${esc(result.target)}</div></div><div class="solution-card"><div class="label">Peso total mínimo</div><div class="value">${fmt(result.distance)}</div></div><div class="solution-card"><div class="label">Ruta más corta</div><div class="value small-value">${result.path.map(esc).join(' → ')}</div></div></div><p class="route-solution-note">Ruta encontrada con Dijkstra. Los pesos de todas las conexiones son no negativos.</p>`;
      } else el.summary.innerHTML = `<p class="message error">No existe una ruta desde ${esc(result.source)} hasta ${esc(result.target)} con las conexiones disponibles.</p>`;
      el.graph.innerHTML = renderGraph(result); el.steps.innerHTML = renderSteps(result);
      el.status.textContent = 'Cálculo terminado'; el.status.className = 'message ok';
    } catch (error) { el.status.textContent = error.message || 'No se pudo analizar la red.'; el.status.className = 'message error'; el.result.classList.add('hidden'); }
  }
  function loadParsed(edges, warnings = []) {
    rows = edges.map(e => ({ from: e.from, to: e.to, weight: String(e.weight) })); renderRows(); syncNodeChoices([...new Set(edges.flatMap(e => [e.from, e.to]))]);
    el.status.textContent = `${edges.length} conexión(es) detectadas. Revisa los datos y el origen/destino antes de calcular.${warnings.length ? ` Avisos: ${warnings.join(' ')}` : ''}`;
    el.status.className = warnings.length ? 'message' : 'message ok'; el.result.classList.add('hidden');
  }
  el.body.addEventListener('click', e => { const btn = e.target.closest('.route-edge-remove'); if (!btn) return; rows = readRowsSafe().filter((_, i) => i !== Number(btn.dataset.index)); if (!rows.length) rows = [{ from: '', to: '', weight: '' }]; renderRows(); });
  function readRowsSafe() { return [...el.body.querySelectorAll('tr')].map(tr => ({ from: tr.querySelector('.route-edge-from').value, to: tr.querySelector('.route-edge-to').value, weight: tr.querySelector('.route-edge-weight').value })); }
  el.add.addEventListener('click', () => { rows = readRowsSafe(); rows.push({ from: '', to: '', weight: '' }); renderRows(); });
  el.example.addEventListener('click', loadExample); el.solve.addEventListener('click', solve);
  el.parseText.addEventListener('click', () => { try { const parsed = parseEdgeText(el.text.value); loadParsed(parsed.edges, parsed.warnings); } catch (error) { el.status.textContent = error.message; el.status.className = 'message error'; } });
  if (el.file) el.file.addEventListener('change', async () => {
    const file = el.file.files?.[0]; if (!file) return;
    if (!window.IODocumentImport) { el.fileStatus.textContent = 'El lector compartido no está disponible.'; el.fileStatus.className = 'message error'; return; }
    try {
      if (!fileProgress) fileProgress = window.IODocumentImport.createProgressUI(el.progressHost.parentElement || el.progressHost);
      const response = await fileProgress.run(file, { ocr: 'auto' });
      if (response.cancelled) return;
      if (response.error) throw response.error;
      const doc = response.doc, content = (doc.text || (doc.pages || []).map(p => (p.lines || []).map(l => l.text || '').join('\n')).join('\n')).trim();
      el.text.value = content;
      const parsed = parseEdgeText(content); loadParsed(parsed.edges, parsed.warnings);
      el.fileStatus.textContent = `Se extrajo texto de ${file.name}. La interpretación es preliminar: revisa las conexiones detectadas.${doc.ocr?.used ? ' El OCR se encuentra en beta y puede equivocarse.' : ''}`;
      el.fileStatus.className = 'message';
    } catch (error) { el.fileStatus.textContent = `No pude reconstruir las conexiones de ese archivo. Puedes revisar el texto extraído y corregirlo en el campo de texto. ${error.message || ''}`; el.fileStatus.className = 'message error'; }
    finally { el.file.value = ''; }
  });
  loadExample();
  // La API pura vive en route-shortest-math.js para permitir pruebas sin interfaz.
})();
