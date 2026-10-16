'use strict';
/* IO Solver v8.0.0 · Interfaz de importación y REVISIÓN de modelos de transporte.
 * Flujo: archivo → lector compartido (IODocumentImport) → candidatos → intérprete (IOTransportImport) → matriz editable → «Aplicar al modelo»
 * (IOTransportAPI.applyImportedModel). Aquí no se resuelve nada ni se escribe en los resultados. */
(function initTransportImportUI() {
  const DI = window.IODocumentImport, TI = window.IOTransportImport;
  const input = document.getElementById('transport-doc-input'), statusEl = document.getElementById('transport-doc-status');
  const results = document.getElementById('transport-import-results'), reuse = document.getElementById('transport-doc-reuse');
  const pasteInput = document.getElementById('transport-paste-text'), pasteButton = document.getElementById('transport-paste-btn');
  if (!input || !statusEl || !results) return;
  const esc = DI ? DI.escapeHtml : s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const progress = DI ? DI.createProgressUI(statusEl.parentElement) : null;
  const S = { file: null, doc: null, blocks: [], cands: [], sel: -1, model: null, dirty: false, applied: false, forced: false };
  const setStatus = (text, kind = '') => { statusEl.textContent = text; statusEl.className = `message ${kind}`.trim(); };
  const show = () => results.classList.remove('hidden'); const hideResults = () => { results.classList.add('hidden'); results.innerHTML = ''; };

  const CHIP = { missing: 'Falta', 'ocr-symbol': 'Símbolo dudoso', invalid: 'Ilegible', 'ambiguous-dash': 'Guion ambiguo', low: 'Lectura dudosa', 'very-low': 'Muy dudosa', 'from-text': 'Del enunciado', assumed: 'Provisional', merged: 'Valores juntos', pattern: 'Fuera de patrón' };
  const chipOf = cell => { const f = cell.flags || []; const order = ['very-low', 'ocr-symbol', 'invalid', 'ambiguous-dash', 'merged', 'low', 'pattern', 'missing', 'assumed', 'from-text']; const k = order.find(x => f.includes(x)); return k ? { key: k, text: CHIP[k] } : null; };
  const flagAttr = cell => { const c = chipOf(cell); return c ? ` data-flag="${c.key}"` : ''; };
  const chipHtml = (cell, id) => { const c = chipOf(cell); if (!c) return ''; const conf = cell.conf != null && (c.key === 'low' || c.key === 'very-low') ? ` (${Math.round(cell.conf)} %)` : ''; const hint = c.key === 'pattern' && cell.suggestion ? ` (¿${esc(cell.suggestion)}?)` : ''; return `<span class="flag-chip" id="${id}">⚠ ${esc(c.text)}${conf}${hint}</span>`; };

  /* ───────── Lectura del documento ───────── */
  async function loadFile(file, options = {}) {
    if (!DI || !TI || !progress) { setStatus('Faltan scripts del lector de documentos (document-import.js / transport-import.js).', 'error'); return; }
    S.file = file; S.forced = Boolean(options.forceOcr); hideResults(); setStatus('Leyendo documento…');
    const out = await progress.run(file, options);
    if (out.cancelled) { setStatus('Importación cancelada.'); return; }
    if (out.error) { setStatus(out.error.message || 'No se pudo leer el documento.', 'error'); return; }
    openDocument(out.doc);
  }
  function interpretBlocks(doc) {
    let blocks = DI.detectBlocks(doc); if (!blocks.some(b => b.kind.type === 'transport')) { const all = DI.detectBlocks(doc, { keepPreamble: true }); if (all.length) blocks = all; }
    return blocks.map(block => { const model = TI.interpret(block); return { block, model, validation: TI.validate(model) }; })
      .filter(c => c.block.kind.type === 'transport' || c.model.ok);
  }
  function openDocument(doc) {
    S.doc = doc; S.cands = interpretBlocks(doc); S.sel = -1; S.model = null; S.applied = false;
    const via = doc.ocr.used ? ` (con OCR${doc.ocr.avgConf != null ? `, confianza media ${doc.ocr.avgConf} %` : ''})` : '';
    if (!doc.text.trim()) { setStatus(doc.ocr.needed ? 'No se pudo recuperar texto: el documento parece escaneado y el OCR no encontró contenido legible. Prueba con una imagen más nítida.' : 'El documento no contiene texto legible.', 'error'); return; }
    if (!S.cands.length) {
      setStatus(`Se recuperó texto de ${doc.name}${via}, pero no se pudo construir una tabla de transporte revisable. Puede ser un problema de OCR, no necesariamente del ejercicio.`, 'error');
      results.innerHTML = `<div class="import-review"><p class="review-lead"><strong>Sin matriz revisable.</strong> La lectura no permitió reconocer suficientes filas y columnas de la tabla.</p><details><summary>Ver texto leído</summary><div class="ocr-text-body" tabindex="0">${DI.markupLowConfidence(doc.pages.flatMap(p => p.lines))}</div></details><div class="review-actions">${!S.forced ? `<button type="button" class="btn secondary" data-act="force-ocr">${doc.kind === 'pdf' ? 'Leer de nuevo con OCR forzado' : 'Releer con OCR alternativo'}</button>` : ''}<button type="button" class="btn secondary" data-act="cancel">Cancelar importación</button></div></div>`; show(); return;
    }
    setStatus(`${doc.kind === 'pdf' ? 'PDF' : 'Imagen'} leído: ${doc.name}${via}. Revisa el modelo detectado antes de aplicarlo.`, 'ok');
    if (doc.warnings.length) statusEl.textContent += ` Avisos: ${doc.warnings.slice(0, 2).join(' ')}`;
    if (S.cands.length === 1) selectCandidate(0); else renderCandidateList();
  }
  function renderCandidateList() {
    results.innerHTML = `<div class="import-review"><h3>Ejercicios de transporte detectados</h3><p class="muted">Elige cuál quieres revisar; puedes volver a esta lista sin cargar de nuevo el documento.</p><div class="import-candidates">${S.cands.map((c, i) => {
      const m = c.model, v = c.validation, pages = c.block.pages.length > 1 ? `Páginas ${c.block.pages[0]}–${c.block.pages[c.block.pages.length - 1]}` : `Página ${c.block.pages[0]}`;
      return `<article class="exercise-candidate"><h3>${esc(c.block.title)}</h3><div class="detected-meta"><span>${esc(pages)}</span>${m.ok ? `<span>${m.sources.length} fuente(s) × ${m.destinations.length} destino(s)</span>` : '<span class="meta-warn">⚠ sin tabla reconocida</span>'}${c.block.ocrWords ? '<span>OCR</span>' : ''}${v.errors ? `<span class="meta-warn">⚠ ${v.errors} problema(s) por resolver</span>` : '<span>✓ sin errores bloqueantes</span>'}</div><button type="button" class="btn primary" data-act="select" data-i="${i}">Revisar este ejercicio</button></article>`; }).join('')}</div><div class="review-actions"><button type="button" class="btn secondary" data-act="cancel">Cancelar importación</button></div></div>`; show();
  }
  function selectCandidate(i) { S.sel = i; S.model = JSON.parse(JSON.stringify(S.cands[i].model)); S.dirty = false; S.applied = false; renderReview(); }

  /* ───────── Revisión editable ───────── */
  const cellVal = (cell, raw) => { cell.raw = raw; };
  function renderReview() {
    const m = S.model, c = S.cands[S.sel]; const D = m.destinations.length, N = m.sources.length;
    const pageInfo = c.block.pages.length > 1 ? `páginas ${c.block.pages[0]}–${c.block.pages[c.block.pages.length - 1]}` : `página ${c.block.pages[0]}`;
    const head = `<tr><th scope="col" class="review-corner">Fuente \\ Destino</th>${m.destinations.map((d, j) => `<th scope="col" class="review-cell"${flagAttr(d.label)}><input type="text" data-k="dstLabel" data-j="${j}" value="${esc(d.label.raw)}" aria-label="Nombre del destino ${j + 1}" aria-describedby="fl-d${j}" maxlength="40">${chipHtml(d.label, 'fl-d' + j)}</th>`).join('')}<th scope="col">Oferta</th></tr>`;
    const rows = m.sources.map((s, i) => `<tr><th scope="row" class="review-cell"${flagAttr(s.label)}><input type="text" data-k="srcLabel" data-i="${i}" value="${esc(s.label.raw)}" aria-label="Nombre de la fuente ${i + 1}" aria-describedby="fl-s${i}" maxlength="40">${chipHtml(s.label, 'fl-s' + i)}</th>${m.costs[i].map((cell, j) => costCell(cell, i, j)).join('')}<td class="review-cell"${flagAttr(s.supply)}><input type="text" inputmode="decimal" data-k="supply" data-i="${i}" value="${esc(s.supply.raw)}" aria-label="Oferta de ${esc(s.label.raw)}" aria-describedby="fl-o${i}">${chipHtml(s.supply, 'fl-o' + i)}</td></tr>`).join('');
    const foot = `<tr><th scope="row">Demanda</th>${m.destinations.map((d, j) => `<td class="review-cell"${flagAttr(d.demand)}><input type="text" inputmode="decimal" data-k="demand" data-j="${j}" value="${esc(d.demand.raw)}" aria-label="Demanda de ${esc(d.label.raw)}" aria-describedby="fl-m${j}">${chipHtml(d.demand, 'fl-m' + j)}</td>`).join('')}<td class="review-total" id="review-totals" aria-live="polite"></td></tr>`;
    const sugg = m.labelSuggestions ? `<div class="semantic-note" role="status"><strong>${m.labelSuggestions.origin === 'patrón' ? 'Nombres sugeridos por el patrón de los demás:' : 'Nombres según el enunciado:'}</strong> ${m.labelSuggestions.sources ? `fuentes ${esc(m.labelSuggestions.sources.join(', '))}` : ''}${m.labelSuggestions.sources && m.labelSuggestions.destinations ? '; ' : ''}${m.labelSuggestions.destinations ? `destinos ${esc(m.labelSuggestions.destinations.join(', '))}` : ''}. <button type="button" class="btn secondary" data-act="use-labels">Usar estos nombres</button></div>` : '';
    results.innerHTML = `<div class="import-review" id="import-review" aria-label="Revisión del modelo importado">
      ${S.cands.length > 1 ? '<button type="button" class="btn secondary review-back" data-act="list">← Elegir otro ejercicio</button>' : ''}
      <div class="review-head"><label class="transport-project-name">Nombre del ejercicio<input type="text" id="review-name" value="${esc(m.name)}" maxlength="100"></label>
        <div class="detected-meta"><span>Tipo: modelo de transporte</span><span>${N} fuente(s) × ${D} destino(s)</span><span>Origen: ${esc(pageInfo)}${c.block.ocrWords ? ' · OCR' : ''}</span></div></div>
      ${c.block.ocrWords ? '<div class="candidate-warning" role="status"><strong>Algunas cifras vienen de OCR.</strong> Las celdas dudosas llevan una etiqueta de texto y borde punteado; no se corrigen solas.</div>' : ''}
      ${sugg}
      <div class="review-builder"><button type="button" class="btn secondary" data-act="add-src">+ Fuente</button><button type="button" class="btn secondary" data-act="del-src">− Fuente</button><button type="button" class="btn secondary" data-act="add-dst">+ Destino</button><button type="button" class="btn secondary" data-act="del-dst">− Destino</button><span class="muted">De ${TI.MIN_DIM} a ${TI.MAX_DIM}.</span></div>
      <div class="table-wrap review-wrap"><table class="review-matrix" aria-label="Matriz importada editable"><thead>${head}</thead><tbody>${rows}${foot}</tbody></table></div>
      <div id="review-issues" class="review-issues" aria-live="polite"></div>
      <details><summary>Ver texto leído</summary><div class="ocr-text-body" tabindex="0">${DI.markupLowConfidence(c.block.lines)}</div></details>
      <div class="review-actions" role="group" aria-label="Acciones de la importación">
        <button type="button" class="btn secondary" data-act="review">Revisar datos</button>
        <button type="button" class="btn primary" data-act="apply" id="review-apply">Aplicar al modelo</button>
        <button type="button" class="btn secondary" data-act="reinterpret">Volver a interpretar</button>
        ${!S.forced && S.doc.kind !== 'text' ? `<button type="button" class="btn secondary" data-act="force-ocr">${S.doc.kind === 'pdf' ? 'Releer con OCR forzado' : 'Releer con OCR alternativo'}</button>` : ''}
        <button type="button" class="btn secondary" data-act="cancel">Cancelar importación</button>
      </div></div>`;
    show(); refresh();
  }
  function costCell(cell, i, j) {
    const m = S.model; const lab = `${esc(m.sources[i].label.raw)} a ${esc(m.destinations[j].label.raw)}`;
    return `<td class="review-cell${cell.forbidden ? ' is-forbidden' : ''}"${flagAttr(cell)}><div class="cell-row"><input type="text" inputmode="decimal" data-k="cost" data-i="${i}" data-j="${j}" value="${cell.forbidden ? 'X' : esc(cell.raw)}" aria-label="Costo de ${lab}" aria-describedby="fl-c${i}-${j}"${cell.forbidden ? ' readonly' : ''}><button type="button" class="cell-x" data-act="toggle-x" data-i="${i}" data-j="${j}" aria-pressed="${cell.forbidden}" aria-label="Ruta prohibida de ${lab}" title="Ruta prohibida (X)">X</button></div>${chipHtml(cell, `fl-c${i}-${j}`)}</td>`;
  }
  /* Actualiza avisos y estado del botón sin volver a pintar la matriz (así no se pierde el foco al escribir). */
  function refresh() {
    const m = S.model; const v = TI.validate(m);
    document.getElementById('review-totals').innerHTML = v.totals ? `<small>Oferta ${v.totals.supply}<br>Demanda ${v.totals.demand}<br>Dif. ${v.totals.difference > 0 ? '+' : ''}${v.totals.difference}</small>` : '<small>Totales: faltan datos</small>';
    const groups = { lectura: 'Errores de lectura', incompleto: 'Modelo incompleto', inviable: 'Modelo matemáticamente inviable' };
    const icon = { error: '✖', warning: '⚠', info: 'ℹ' }; const levelName = { error: 'Error', warning: 'Aviso', info: 'Información' };
    const html = Object.keys(groups).map(cat => { const items = v.issues.filter(i => i.category === cat); if (!items.length) return '';
      return `<section class="issue-group"><h4>${groups[cat]}</h4><ul>${items.map(it => `<li class="issue is-${it.level}"><span class="issue-icon" aria-hidden="true">${icon[it.level]}</span><span><span class="sr-only">${levelName[it.level]}: </span>${esc(it.message)}</span>${it.where ? ` <button type="button" class="btn secondary issue-go" data-act="goto" data-w='${esc(JSON.stringify(it.where))}'>Ir a la celda</button>` : ''}${it.where && it.code === 'pattern' ? ` <button type="button" class="btn secondary issue-go" data-act="use-sugg" data-w='${esc(JSON.stringify(it.where))}'>Usar la sugerencia</button> <button type="button" class="btn secondary issue-go" data-act="confirm" data-w='${esc(JSON.stringify(it.where))}'>Dejar así</button>` : it.where && /low-conf|from-text|assumed|confirm-needed/.test(it.code) ? ` <button type="button" class="btn secondary issue-go" data-act="confirm" data-w='${esc(JSON.stringify(it.where))}'>Confirmar lectura</button>` : ''}</li>`).join('')}</ul></section>`; }).join('');
    document.getElementById('review-issues').innerHTML = html || '<p class="muted">Sin incidencias.</p>';
    const apply = document.getElementById('review-apply'); apply.disabled = !v.canApply;
    apply.setAttribute('aria-disabled', String(!v.canApply)); apply.title = v.canApply ? '' : 'Resuelve primero los errores marcados con ✖.';
    S.validation = v; return v;
  }
  const targetOf = w => { const m = S.model; if (!w) return null;
    if (w.kind === 'cost') return { cell: m.costs[w.i][w.j], sel: `[data-k=cost][data-i="${w.i}"][data-j="${w.j}"]` };
    if (w.kind === 'supply') return { cell: m.sources[w.i].supply, sel: `[data-k=supply][data-i="${w.i}"]` };
    if (w.kind === 'demand') return { cell: m.destinations[w.j].demand, sel: `[data-k=demand][data-j="${w.j}"]` };
    if (w.kind === 'srcLabel' || w.kind === 'fuente') return { cell: m.sources[w.i].label, sel: `[data-k=srcLabel][data-i="${w.i}"]` };
    if (w.kind === 'dstLabel' || w.kind === 'destino') return { cell: m.destinations[w.j != null ? w.j : w.i].label, sel: `[data-k=dstLabel][data-j="${w.j != null ? w.j : w.i}"]` };
    return null; };
  const focusTarget = w => { const t = targetOf(w); const el = t && results.querySelector(t.sel); if (el) { el.scrollIntoView({ block: 'center', behavior: window.ioScrollBehavior ? window.ioScrollBehavior() : 'auto' }); el.focus(); } };
  const clearFlags = cell => { cell.flags = (cell.flags || []).filter(f => f === 'merged' && false); cell.conf = null; };

  results.addEventListener('input', e => {
    const t = e.target; if (!S.model || !t.dataset || !t.dataset.k) { if (t.id === 'review-name' && S.model) { S.model.name = t.value; S.dirty = true; } return; }
    const k = t.dataset.k, i = Number(t.dataset.i), j = Number(t.dataset.j); const m = S.model; S.dirty = true; S.applied = false;
    let cell = null;
    if (k === 'cost') { cell = m.costs[i][j]; if (/^[xX✗✕×∞]$/.test(t.value.trim())) { cell.forbidden = true; cell.raw = ''; renderKeepFocus(`[data-k=cost][data-i="${i}"][data-j="${j}"]`); return; } cell.raw = t.value; delete cell.suggestion; }
    else if (k === 'supply') { cell = m.sources[i].supply; cell.raw = t.value; delete cell.suggestion; }
    else if (k === 'demand') { cell = m.destinations[j].demand; cell.raw = t.value; delete cell.suggestion; }
    else if (k === 'srcLabel') { cell = m.sources[i].label; cell.raw = t.value; cell.assumed = false; }
    else if (k === 'dstLabel') { cell = m.destinations[j].label; cell.raw = t.value; cell.assumed = false; }
    if (cell) { cell.flags = []; cell.conf = null; const td = t.closest('.review-cell'); if (td) { td.removeAttribute('data-flag'); const chip = td.querySelector('.flag-chip'); if (chip) chip.remove(); } }
    refresh();
  });
  function renderKeepFocus(sel) { renderReview(); const el = results.querySelector(sel); if (el) el.focus(); }
  function structural(fn) { fn(S.model); S.dirty = true; S.applied = false; renderReview(); }
  const emptyCell = () => ({ raw: '', forbidden: false, flags: [], conf: null });

  results.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return; const act = b.dataset.act;
    if (act === 'select') selectCandidate(Number(b.dataset.i));
    else if (act === 'list') renderCandidateList();
    else if (act === 'cancel') cancelImport();
    else if (act === 'force-ocr') { if (S.file) await loadFile(S.file, { ocr: 'auto', forceOcr: true }); }
    else if (act === 'review') { const flagged = results.querySelector('.review-cell[data-flag] input'); (flagged || results.querySelector('.review-matrix input')).focus(); (flagged || results.querySelector('.review-matrix input')).scrollIntoView({ block: 'center', behavior: window.ioScrollBehavior ? window.ioScrollBehavior() : 'auto' }); }
    else if (act === 'reinterpret') { if (S.dirty && !window.confirm('Volver a interpretar descartará las correcciones que hayas hecho en esta revisión. ¿Continuar?')) return; selectCandidate(S.sel); }
    else if (act === 'toggle-x') { const i = Number(b.dataset.i), j = Number(b.dataset.j); const c = S.model.costs[i][j]; c.forbidden = !c.forbidden; if (c.forbidden) c.raw = ''; c.flags = []; S.dirty = true; renderKeepFocus(`[data-act=toggle-x][data-i="${i}"][data-j="${j}"]`); }
    else if (act === 'add-src') { if (S.model.sources.length >= TI.MAX_DIM) return; structural(m => { m.sources.push({ label: { raw: `Fuente ${m.sources.length + 1}`, flags: ['assumed'], conf: null }, supply: { raw: '', flags: [], conf: null } }); m.costs.push(m.destinations.map(emptyCell)); }); }
    else if (act === 'del-src') { if (S.model.sources.length <= TI.MIN_DIM) return; structural(m => { m.sources.pop(); m.costs.pop(); }); }
    else if (act === 'add-dst') { if (S.model.destinations.length >= TI.MAX_DIM) return; structural(m => { m.destinations.push({ label: { raw: `Destino ${m.destinations.length + 1}`, flags: ['assumed'], conf: null }, demand: { raw: '', flags: [], conf: null } }); m.costs.forEach(r => r.push(emptyCell())); }); }
    else if (act === 'del-dst') { if (S.model.destinations.length <= TI.MIN_DIM) return; structural(m => { m.destinations.pop(); m.costs.forEach(r => r.pop()); }); }
    else if (act === 'use-labels') { structural(m => { const sg = m.labelSuggestions; if (sg.sources) sg.sources.forEach((l, i) => { m.sources[i].label = { raw: l, flags: [], conf: null }; }); if (sg.destinations) sg.destinations.forEach((l, j) => { m.destinations[j].label = { raw: l, flags: [], conf: null }; }); m.labelSuggestions = null; }); }
    else if (act === 'use-sugg') { const t = targetOf(JSON.parse(b.dataset.w)); if (t && t.cell.suggestion) { t.cell.raw = t.cell.suggestion; t.cell.flags = []; delete t.cell.suggestion; S.dirty = true; renderKeepFocus(t.sel); } }
    else if (act === 'goto') focusTarget(JSON.parse(b.dataset.w));
    else if (act === 'confirm') { const t = targetOf(JSON.parse(b.dataset.w)); if (t) { t.cell.flags = []; t.cell.conf = null; renderKeepFocus(t.sel); } }
    else if (act === 'apply') applyToModel();
  });
  function applyToModel() {
    const v = refresh(); if (!v.canApply) { setStatus('Aún hay errores que resolver antes de aplicar el modelo.', 'error'); return; }
    const res = window.IOTransportAPI && window.IOTransportAPI.applyImportedModel(TI.toEditorModel(S.model));
    if (!res || !res.ok) { setStatus(`No se pudo aplicar el modelo: ${res ? res.error : 'el módulo de Transporte no está disponible.'}`, 'error'); return; }
    S.applied = true; const pending = v.flagged;
    setStatus(`Modelo aplicado al editor de datos${pending ? ` (quedan ${pending} celda(s) con lectura sin confirmar)` : ''}. Revisa las tablas y resuelve cuando estés listo; no se ha resuelto nada.`, 'ok');
    const target = document.getElementById('transport-input-table'); if (target) target.scrollIntoView({ block: 'start', behavior: window.ioScrollBehavior ? window.ioScrollBehavior() : 'auto' });
  }
  function cancelImport() { if (progress) progress.hide(); if (DI) DI.terminateOcr(); S.file = null; S.doc = null; S.cands = []; S.model = null; S.dirty = false; input.value = ''; hideResults(); setStatus('Importación cancelada. El modelo del editor no se modificó.'); offerReuse(); }

  function importPastedText() {
    const text = String(pasteInput && pasteInput.value || '').trim();
    if (!text) { setStatus('Pega primero el enunciado o una tabla de costos.', 'error'); return; }
    if (!TI) { setStatus('Falta el intérprete de Transporte.', 'error'); return; }
    const model = TI.interpret(text);
    if (!model.ok) {
      const msg = (model.issues || []).map(x => x.message).join(' ');
      setStatus(`No pude reconocer una tabla en el texto pegado. ${msg || 'Prueba con filas y columnas separadas por espacios o tabulaciones.'}`, 'error');
      results.innerHTML = `<div class="import-review"><p class="review-lead"><strong>No se detectó una matriz.</strong> Asegúrate de incluir una fila por fuente, una columna por destino y la oferta/demanda.</p><details open><summary>Texto pegado</summary><pre class="ocr-text-body">${esc(text)}</pre></details></div>`; show(); return;
    }
    const lines = text.split(/\r?\n/).map((line, i) => ({ text: line, tokens: [], x0: 0, x1: line.length * 7, y0: i * 20, y1: i * 20 + 14, page: 1 }));
    const block = { id: 1, title: 'Texto pegado', text, lines, pages: [1], lowConf: 0, ocrWords: 0, kind: { type: 'transport' } };
    const validation = TI.validate(model);
    S.file = null; S.doc = { name: 'Texto pegado', kind: 'text', text, ocr: { used: false }, warnings: [], pages: [{ index: 1, lines }] }; S.forced = false;
    S.cands = [{ block, model, validation }]; S.sel = -1; S.model = null; S.applied = false;
    setStatus('Texto interpretado. Revisa y corrige la matriz antes de aplicarla al modelo.', 'ok'); selectCandidate(0);
  }
  if (pasteButton) pasteButton.addEventListener('click', importPastedText);

  input.addEventListener('change', async () => {
    const file = input.files && input.files[0]; if (!file) return;
    if (!/\.(pdf|png|jpe?g|webp)$/i.test(file.name) && !/^(application\/pdf|image\/(png|jpeg|webp))$/.test(file.type)) { setStatus('Selecciona un PDF o una imagen PNG, JPEG o WebP.', 'error'); return; }
    await loadFile(file);
    input.value = '';      // permite volver a elegir el mismo archivo (p. ej. tras cancelar o para releerlo)
  });
  /* Reutilizar un documento ya leído en otro módulo (p. ej. Simplex) sin volver a procesarlo. */
  function offerReuse() {
    if (!DI || !reuse) return; const last = DI.getLastDocument();
    if (!last || (S.doc && S.doc.name === last.doc.name)) { reuse.classList.add('hidden'); reuse.innerHTML = ''; return; }
    reuse.classList.remove('hidden'); reuse.innerHTML = `<button type="button" class="btn secondary" id="transport-reuse-btn">Usar el documento ya leído: ${esc(last.file.name)}</button>`;
    reuse.querySelector('button').onclick = () => { reuse.classList.add('hidden'); setStatus(`Usando el documento ya leído: ${last.file.name}.`); S.file = null; openDocument(last.doc); };
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-module=transportation]')) setTimeout(offerReuse, 0); });
  offerReuse();
  window.IOTransportImportUI = { getState: () => S, interpretBlocks };
})();
