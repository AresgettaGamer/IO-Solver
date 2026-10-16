'use strict';
/* IO Solver v8.0.0 · Intérprete de problemas de transporte (puro: sin DOM, sin motor matemático).
 *
 * Entrada: un bloque del lector compartido ({ text, lines:[{ text, tokens:[{text,x0,x1,y0,y1,conf,src}], page }] }) o texto plano.
 * Salida: un MODELO DE REVISIÓN editable (etiquetas, costos, oferta, demanda, rutas prohibidas) con marcas por celda y una lista de
 * incidencias clasificadas en tres categorías distintas: «lectura» (cifra/símbolo dudoso), «incompleto» (falta un dato) e «inviable»
 * (matemáticamente imposible). Nunca inventa datos: lo que no se pudo leer queda vacío y señalado.
 * Reconstruye la tabla con las COORDENADAS de las palabras (filas por línea, columnas por alineación horizontal) y no aplana el documento.
 */
(function initTransportImport(root) {
  const MIN_DIM = 2, MAX_DIM = 8, LOW = 75, VERY_LOW = 55;
  const NUM = /^\d+(?:[.,]\d+)?$/, THOUSANDS = /^\d{1,3}(?:,\d{3})+$/;
  const FORBID = /^[xX✗✕×∞]$/, DASH = /^[-–—]$/;
  const NUMBERISH = /^(?=.*\d)[\dOoIl|SsBbZz.,]{1,7}$/;
  const SUPPLY_HEAD = /^(oferta|ofer\.?|disponibilidad|disponible|producci[oó]n|capacidad|existencias?|suministro)s?$/i;
  const DEMAND_LABEL = /^(demanda|demandas|requerimientos?|requerido|necesidades?|pedidos?|dem\.?)$/i;
  const TOTAL_LABEL = /^(total|suma|σ)$/i;
  const HEADING = /^(?:(?:\d+|[A-Z])\s*[.)-]\s*)?(?:ejercicio|ejerc\.|problema|problem|modelo)\s*(?:n[°ºo.]?\s*)?\d+\b/i;
  const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const norm = s => String(s || '').trim().toLocaleLowerCase('es-MX');
  const OCR_DIGIT = { O: '0', o: '0', I: '1', l: '1', '|': '1', S: '5', s: '5', B: '8', b: '6', Z: '2', z: '2' };

  function classify(text) {
    if (NUM.test(text) || THOUSANDS.test(text)) return 'num';
    if (FORBID.test(text)) return 'forbid';
    if (DASH.test(text)) return 'dash';
    if (NUMBERISH.test(text)) return 'numberish';
    return 'text';
  }
  function parseNumber(raw) {
    const t = String(raw ?? '').trim(); if (!t) return null;
    if (THOUSANDS.test(t)) return Number(t.replace(/,/g, ''));
    if (NUM.test(t)) return Number(t.replace(',', '.'));
    return null;
  }
  const suggestDigits = raw => String(raw).replace(/[OoIl|SsBbZz]/g, c => OCR_DIGIT[c] ?? c);

  /* ───────── 1. Filas y tokens con geometría (o sintetizada a partir de texto plano) ───────── */
  function toRows(block) {
    let lines = block && block.lines && block.lines.length ? block.lines : null;
    if (!lines) {
      lines = String((block && block.text) || block || '').split('\n').map((text, i) => {
        const tokens = []; const re = /\S+/g; let m;
        while ((m = re.exec(text))) tokens.push({ text: m[0], x0: m.index * 7, x1: (m.index + m[0].length) * 7, y0: i * 20, y1: i * 20 + 14, conf: null, src: 'text' });
        return { text, tokens, x0: 0, x1: text.length * 7, y0: i * 20, y1: i * 20 + 14 };
      });
    }
    return lines.map((l, idx) => ({ idx, text: String(l.text || '').trim(), page: l.page, y: (l.y0 + l.y1) / 2,
      tokens: (l.tokens || []).map(t => ({ ...t, cx: (t.x0 + t.x1) / 2, kind: classify(t.text) })) })).filter(r => r.tokens.length);
  }
  const isCell = t => t.kind === 'num' || t.kind === 'forbid' || t.kind === 'dash' || t.kind === 'numberish';
  /* Fila tabular = [etiqueta…] + celdas, sin texto después de la primera celda. */
  function splitRow(row) {
    const first = row.tokens.findIndex(isCell);
    if (first < 0) return null;
    let label = row.tokens.slice(0, first), cells = row.tokens.slice(first);
    if (cells.some(t => !isCell(t))) return null;
    // «Planta 1 5 7 6 100»: un entero pegado a una etiqueta de texto (hueco menor que ~0.7 de la altura de letra) es parte del nombre, no una celda.
    while (label.length && cells.length > 2 && cells[0].kind === 'num' && /^\d{1,2}$/.test(cells[0].text) && label[label.length - 1].kind === 'text' && label[label.length - 1].src !== 'text') {
      const prev = label[label.length - 1], h = Math.max(4, (prev.y1 - prev.y0)), gap = cells[0].x0 - prev.x1;
      if (gap >= 0 && gap < h * 0.7) { label = label.concat(cells[0]); cells = cells.slice(1); } else break;
    }
    return { label, cells };
  }

  /* ───────── 2. Localizar la tabla ───────── */
  function findTable(rows) {
    const info = rows.map(r => ({ r, s: splitRow(r) }));
    // El primer token puede ser una etiqueta numérica o «X»: si la fila tiene un token más que sus vecinas se resuelve más abajo.
    const runs = []; let cur = [];
    info.forEach((x, i) => {
      const tabular = x.s && x.s.cells.length >= 2 && x.s.label.length <= 4;
      if (tabular) cur.push(i); else { if (cur.length) runs.push(cur); cur = []; }
    });
    if (cur.length) runs.push(cur);
    if (!runs.length) return null;
    runs.sort((a, b) => b.length - a.length || a[0] - b[0]);
    const run = runs[0]; if (run.length < 2) return null;
    let headerIdx = run[0] - 1; let header = null;
    while (headerIdx >= 0 && headerIdx >= run[0] - 3) {                      // cabecera: fila solo de texto corto inmediatamente encima
      const r = rows[headerIdx]; const textual = r.tokens.filter(t => t.kind === 'text' || t.kind === 'numberish' || t.kind === 'num');
      if (r.tokens.length >= 2 && r.tokens.length <= 14 && r.tokens.every(t => t.kind !== 'forbid') && !info[headerIdx].s && textual.length) { header = r; break; }
      if (info[headerIdx].s) break; headerIdx -= 1;
    }
    return { run: run.map(i => info[i]), header, firstIdx: run[0], lastIdx: run[run.length - 1], headerIdx: header ? header.idx : null };
  }

  /* ───────── 3. Columnas por alineación horizontal ───────── */
  function columnCenters(rows) {
    const ref = rows.reduce((best, x) => (x.s.cells.length > best.s.cells.length ? x : best), rows[0]);
    return ref.s.cells.map(t => t.cx);
  }
  function assign(tokens, centers, tolFactor = 0.6, alignRight = false) {
    if (tokens.length && tokens.every(t => t.src === 'text')) {      // texto plano sin geometría fiable: asignación posicional
      const out = new Array(centers.length).fill(null); const extra = [];
      const slice = alignRight && tokens.length > centers.length ? tokens.slice(tokens.length - centers.length) : tokens;
      if (alignRight && tokens.length > centers.length) extra.push(...tokens.slice(0, tokens.length - centers.length));
      slice.forEach((t, i) => { if (i < centers.length) out[i] = [t]; else extra.push(t); });
      return { cols: out, extra };
    }
    const spacing = centers.length > 1 ? Math.min(...centers.slice(1).map((c, i) => c - centers[i])) : 60;
    const tol = Math.max(8, spacing * tolFactor); const out = new Array(centers.length).fill(null); const extra = [];
    tokens.forEach(t => {
      let best = -1, dist = Infinity;
      centers.forEach((c, j) => { const d = Math.abs(t.cx - c); if (d < dist) { dist = d; best = j; } });
      if (best >= 0 && dist <= tol) { if (out[best]) out[best].push(t); else out[best] = [t]; } else extra.push(t);
    });
    return { cols: out, extra };
  }

  /* ───────── 4. Celdas ───────── */
  function mkCell(tok) {
    if (!tok) return { raw: '', forbidden: false, flags: ['missing'], conf: null };
    const flags = []; const raw = tok.text; const conf = tok.conf ?? null;
    let forbidden = false, suggestion = null;
    if (tok.kind === 'forbid') forbidden = true;
    else if (tok.kind === 'dash') flags.push('ambiguous-dash');
    else if (tok.kind === 'numberish') { flags.push('ocr-symbol'); suggestion = suggestDigits(raw); }
    else if (tok.kind === 'text') flags.push('invalid');
    if (conf != null) { if (conf < VERY_LOW) flags.push('very-low'); else if (conf < LOW) flags.push('low'); }
    const cell = { raw: tok.kind === 'dash' ? '' : raw, forbidden, flags, conf };
    if (suggestion) cell.suggestion = suggestion; if (tok.kind === 'dash') cell.rawRead = raw;
    return cell;
  }
  const joinTokens = toks => (toks || []).slice().sort((a, b) => a.x0 - b.x0).map(t => t.text).join(' ').trim();
  const minConf = toks => { const c = (toks || []).map(t => t.conf).filter(v => v != null); return c.length ? Math.min(...c) : null; };
  function mkLabel(toks, fallback) {
    const text = joinTokens(toks); const conf = minConf(toks);
    const flags = []; if (!text) flags.push('missing'); if (conf != null) { if (conf < VERY_LOW) flags.push('very-low'); else if (conf < LOW) flags.push('low'); }
    return { raw: text || fallback, flags: text ? flags : ['assumed'], conf, assumed: !text };
  }

  /* ───────── 5. Texto del enunciado: etiquetas, cantidades, rutas prohibidas ───────── */
  const NUMWORDS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8 };
  function expandLabels(str) {
    const range = str.match(/\b([A-Za-z]+)(\d+)\s+(?:a|hasta)\s+\1?([A-Za-z]*)(\d+)\b/);
    if (range) { const [, p, a, , b] = range; const out = []; for (let n = Number(a); n <= Number(b) && out.length < 20; n += 1) out.push(p + n); return out; }
    return str.split(/\s*,\s*|\s+y\s+|\s+e\s+|\s*;\s*/).map(s => s.trim()).filter(s => /^[A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]{1,12}$/.test(s));
  }
  function labelListsFromText(text) {
    const flat = String(text || '').replace(/\n/g, ' ');
    const grab = re => { const m = flat.match(re); return m ? expandLabels(m[1]) : []; };
    const list = '((?:[A-Za-z]+\\d*|\\d+)(?:\\s*(?:,|;|\\sy\\s|\\se\\s|\\sa\\s|\\shasta\\s)\\s*(?:[A-Za-z]+\\d*|\\d+))+)';
    return {
      sources: grab(new RegExp('(?:f[aá]bricas?|plantas?|or[ií]genes?|fuentes?|bodegas?|centros\\s+de\\s+producci[oó]n)\\s+' + list, 'i')),
      destinations: grab(new RegExp('(?:clientes?|destinos?|distribuidores?|mercados?|tiendas?|sucursales?)\\s+' + list, 'i')),
    };
  }
  function numbersIn(str) { return (str.match(/\d+(?:[.,]\d+)?/g) || []).map(s => s.replace(',', '.')); }
  function quantitiesFromText(text, labels, nouns, verbs) {
    const found = {}; const flat = String(text || '').replace(/\n/g, ' ');
    const sentences = flat.split(/(?<=[.;])\s+/);
    // «A, B y C producen 550, 300 y 260, respectivamente»
    for (const s of sentences) {
      if (!/respectivamente|en\s+ese\s+orden|en\s+el\s+mismo\s+orden/i.test(s)) continue;
      const nums = numbersIn(s.replace(/\b[A-Za-z]+\d+\b/g, ' ')); const present = labels.filter(l => new RegExp('(^|[^A-Za-z0-9])' + esc(l) + '(?![A-Za-z0-9])', 'i').test(s));
      if (present.length >= 2 && nums.length === present.length && present.every(l => labels.includes(l))) present.forEach((l, i) => { found[l] = nums[i]; });
    }
    // «La fábrica A produce 550 unidades», «A: 550», «capacidad de la planta B es de 300»
    for (const l of labels) {
      if (found[l]) continue; const L = esc(l);
      const patterns = [new RegExp('(?:' + nouns + ')\\s+' + L + '(?![A-Za-z0-9])[^.;]*?(?:' + verbs + ')[^.;\\d]{0,24}(\\d+(?:[.,]\\d+)?)', 'i'),
        new RegExp('(?:' + verbs + ')[^.;\\d]{0,30}(?:' + nouns + ')\\s+' + L + '(?![A-Za-z0-9])[^.;\\d]{0,24}(\\d+(?:[.,]\\d+)?)', 'i'),
        new RegExp('(?:^|[^A-Za-z0-9])' + L + '\\s*[:=]\\s*(\\d+(?:[.,]\\d+)?)', 'i')];
      const hits = new Set();
      for (const re of patterns) { const m = flat.match(re); if (m) hits.add(m[1].replace(',', '.')); }
      if (hits.size === 1) found[l] = [...hits][0];
    }
    return found;
  }
  function forbiddenFromText(text, sources, destinations) {
    const flat = String(text || '').replace(/\n/g, ' '); const out = [];
    const S = sources.map(esc).join('|'), D = destinations.map(esc).join('|'); if (!S || !D) return out;
    const sNoun = '(?:la\\s+|el\\s+)?(?:f[aá]brica|planta|or[ií]gen|fuente|bodega|centro)?\\s*', dNoun = '(?:la\\s+|el\\s+)?(?:cliente|destino|distribuidor|mercado|tienda|sucursal)?\\s*';
    const res = [
      new RegExp('no\\s+(?:es\\s+posible|se\\s+puede|puede|hay\\s+forma\\s+de)\\s+(?:transportar|enviar|embarcar|suministrar|distribuir|abastecer)[^.;]*?\\b(?:de|desde)\\s+' + sNoun + '(' + S + ')(?![A-Za-z0-9])[^.;]*?\\b(?:a|hacia|al|hasta)\\s+' + dNoun + '(' + D + ')(?![A-Za-z0-9])', 'gi'),
      new RegExp('(?:ruta|camino|env[ií]o)\\s+(?:prohibid[ao]|bloquead[ao]|imposible|no\\s+disponible)[^.;]*?\\b(?:de|desde|entre)\\s+' + sNoun + '(' + S + ')(?![A-Za-z0-9])[^.;]*?\\b(?:a|hacia|al|hasta|y)\\s+' + dNoun + '(' + D + ')(?![A-Za-z0-9])', 'gi'),
      new RegExp(sNoun + '(' + S + ')(?![A-Za-z0-9])\\s+no\\s+puede\\s+(?:abastecer|enviar|suministrar)\\s+(?:a\\s+)?' + dNoun + '(' + D + ')(?![A-Za-z0-9])', 'gi'),
    ];
    res.forEach(re => { let m; while ((m = re.exec(flat))) { const s = sources.find(x => norm(x) === norm(m[1])), d = destinations.find(x => norm(x) === norm(m[2])); if (s && d) out.push([s, d]); } });
    return out;
  }

  /* Nombres de fuentes/destinos que rompen el patrón de los demás (p. ej. «C1, C2, c3, ca»): el OCR confunde letras y dígitos con
     confianza alta, así que se señalan por coherencia. Solo se SUGIERE el valor probable; nunca se aplica solo. */
  function patternSuggestions(labels) {
    const out = new Map(); const n = labels.length; if (n < 3) return out;
    const parsed = labels.map(l => /^([A-Za-zÁÉÍÓÚÑáéíóúñ]+)\s?(\d+)$/.exec(String(l).trim()));
    const good = parsed.map((m, i) => (m ? { prefix: m[1], n: Number(m[2]), i } : null)).filter(x => x && x.n === x.i + 1);
    const goodIdx = new Set(good.map(x => x.i));
    const suspicious = l => /[^\wÁÉÍÓÚÑáéíóúñ\s.\-]/.test(l) || (good.length && String(l).toLowerCase().startsWith(good[0].prefix.toLowerCase()));
    if (good.length >= 1 && (good.length >= Math.ceil(n / 3) || labels.every((l, i) => goodIdx.has(i) || suspicious(l)))) {
      const pref = good[0].prefix[0].toUpperCase() + good[0].prefix.slice(1);
      labels.forEach((l, i) => { const m = parsed[i]; const ok = m && m[1].toLowerCase() === good[0].prefix.toLowerCase() && Number(m[2]) === i + 1; if (!ok) out.set(i, pref + (i + 1)); });
      return out;
    }
    const codes = labels.map(l => (/^[A-ZÑ]$/.test(String(l).trim()) ? String(l).trim().charCodeAt(0) : null));
    const idx = codes.map((c, i) => (c != null ? i : -1)).filter(i => i >= 0);
    if (idx.length >= 2 && idx.length >= Math.ceil(n / 2)) {
      const base = codes[idx[0]] - idx[0];
      if (idx.every(i => codes[i] === base + i)) labels.forEach((l, i) => { if (codes[i] !== base + i) out.set(i, String.fromCharCode(base + i)); });
    }
    return out;
  }
  function applyPatternFlags(items) {
    const sug = patternSuggestions(items.map(it => it.label.raw));
    sug.forEach((value, i) => { const lab = items[i].label; if (norm(lab.raw) !== norm(value)) { lab.flags = (lab.flags || []).concat('pattern'); lab.suggestion = value; } });
  }

  /* ───────── 6. Intérprete principal ───────── */
  function interpret(block, options = {}) {
    const text = String((block && block.text) || (typeof block === 'string' ? block : ''));
    const rows = toRows(block); const issues = []; const checks = {};
    const model = { name: '', sources: [], destinations: [], costs: [], sourceText: text, labelSuggestions: null, forbiddenFromText: [], checks };
    const titleLine = rows.find(r => HEADING.test(r.text)); model.name = (titleLine ? titleLine.text : rows[0] ? rows[0].text : 'Ejercicio de transporte').slice(0, 90);
    const table = findTable(rows);
    if (!table) {
      issues.push({ category: 'incompleto', level: 'error', code: 'no-table', message: 'No se encontró una tabla de costos. Introduce los datos manualmente o vuelve a leer el documento con OCR forzado.' });
      model.issues = issues; model.ok = false; return model;
    }
    const tableRows = table.run;
    const isDemandRow = x => DEMAND_LABEL.test(joinTokens(x.s.label).replace(/[:.]$/, '')) || x.s.label.some(t => DEMAND_LABEL.test(t.text.replace(/[:.]$/, '')));
    const isTotalRow = x => x.s.label.some(t => TOTAL_LABEL.test(t.text.replace(/[:.]$/, '')));
    // El primer token de una fila puede ser una etiqueta numérica (p. ej. «1 8 3 4 5 550»): si todas las filas de costos traen un token extra de más y sin etiqueta, se separa.
    const costCandidates = tableRows.filter(x => !isDemandRow(x) && !isTotalRow(x));
    const modal = (arr) => { const c = {}; arr.forEach(v => { c[v] = (c[v] || 0) + 1; }); return Number(Object.entries(c).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]); };
    if (costCandidates.length && costCandidates.every(x => x.s.label.length === 0 && x.s.cells.length >= 3)) {
      costCandidates.forEach(x => { const first = x.s.cells[0]; if (first.kind === 'num' || first.kind === 'numberish') { x.s.label = [first]; x.s.cells = x.s.cells.slice(1); x.s.labelWasNumeric = true; } });
    }
    const demandRow = tableRows.find(isDemandRow); const totalRow = tableRows.find(isTotalRow);
    const costRows = tableRows.filter(x => x !== demandRow && x !== totalRow);
    if (!costRows.length) { issues.push({ category: 'incompleto', level: 'error', code: 'no-rows', message: 'Se detectó una tabla pero no filas de costos.' }); model.issues = issues; model.ok = false; return model; }
    const widest = modal(costRows.map(x => x.s.cells.length));
    const regular = costRows.filter(x => x.s.cells.length === widest);
    const centers = columnCenters(regular.length ? regular : costRows);
    const k = centers.length;
    // Cabecera → etiquetas por columna
    let headerCols = null, cornerToks = [];
    if (table.header) {
      const toks = table.header.tokens; const firstCenter = centers[0]; const spacing = k > 1 ? centers[1] - centers[0] : 60;
      cornerToks = toks.filter(t => t.cx < firstCenter - spacing * 0.6);
      const a = assign(toks.filter(t => !cornerToks.includes(t)), centers, 0.62, true); headerCols = a.cols;
      if (toks.every(t => t.src === 'text')) { a.extra.forEach(t => { if (a.extra.indexOf(t) < a.extra.length) cornerToks.push(t); }); a.extra.length = 0; }
      if (a.extra.length) issues.push({ category: 'lectura', level: 'warning', code: 'header-extra', message: `Hay texto de cabecera que no se pudo asociar a una columna: «${joinTokens(a.extra)}».` });
    }
    // ¿La última columna es oferta?
    let supplyCol = false;
    const lastHeader = headerCols && headerCols[k - 1] ? joinTokens(headerCols[k - 1]) : '';
    if (SUPPLY_HEAD.test(lastHeader)) supplyCol = true;
    else if (demandRow) { const d = assign(demandRow.s.cells, centers); if (!d.cols[k - 1] && d.cols.slice(0, k - 1).every(Boolean)) supplyCol = true; }
    else if (headerCols && headerCols.slice(0, k - 1).every(Boolean) && !headerCols[k - 1]) supplyCol = true;
    let totalCol = false;
    if (headerCols && TOTAL_LABEL.test(joinTokens(headerCols[k - (supplyCol ? 2 : 1)] || [])) && k - (supplyCol ? 1 : 0) > 2) totalCol = true;
    const D = k - (supplyCol ? 1 : 0) - (totalCol ? 1 : 0);
    // Etiquetas de destinos
    const textLists = labelListsFromText(text);
    model.destinations = Array.from({ length: D }, (_, j) => {
      const lab = mkLabel(headerCols ? headerCols[j] : null, `Destino ${j + 1}`); return { label: lab, demand: { raw: '', flags: ['missing'], conf: null } };
    });
    // Filas de costos y oferta
    costRows.forEach((x, i) => {
      const a = assign(x.s.cells, centers); const lab = mkLabel(x.s.label, `Fuente ${i + 1}`);
      const cells = []; for (let j = 0; j < D; j += 1) { const toks = a.cols[j]; cells.push(mkCell(toks ? toks[0] : null)); if (toks && toks.length > 1) cells[j].flags.push('merged'); }
      if (a.extra.length) issues.push({ category: 'lectura', level: 'warning', code: 'row-extra', message: `En la fila «${lab.raw}» hay valores fuera de las columnas detectadas: ${a.extra.map(t => t.text).join(', ')}.` });
      let supply = { raw: '', flags: ['missing'], conf: null };
      if (supplyCol) { const toks = a.cols[k - 1]; const c = mkCell(toks ? toks[0] : null); supply = { raw: c.raw, flags: c.flags.filter(f => f !== 'missing' || true), conf: c.conf, suggestion: c.suggestion }; if (c.forbidden) supply.flags.push('invalid'); }
      if (totalCol) { const toks = a.cols[D]; if (toks) checks['rowTotal' + i] = parseNumber(toks[0].text); }
      model.sources.push({ label: lab, supply, origin: supplyCol ? 'tabla' : null }); model.costs.push(cells);
    });
    // Demanda
    if (demandRow) {
      const a = assign(demandRow.s.cells, centers);
      model.destinations.forEach((d, j) => { const toks = a.cols[j]; const c = mkCell(toks ? toks[0] : null); d.demand = { raw: c.raw, flags: c.flags, conf: c.conf, suggestion: c.suggestion, origin: 'tabla' }; if (c.forbidden) d.demand.flags.push('invalid'); });
      if (supplyCol && a.cols[k - 1]) checks.demandTotal = parseNumber(a.cols[k - 1][0].text);
      if (totalCol && a.cols[D]) checks.demandTotal = parseNumber(a.cols[D][0].text);
    }
    if (totalRow) { const a = assign(totalRow.s.cells, centers); if (supplyCol && a.cols[k - 1]) checks.supplyTotal = parseNumber(a.cols[k - 1][0].text); }
    // Complemento desde el enunciado: etiquetas / ofertas / demandas / rutas prohibidas
    const srcLabels = model.sources.map(s => s.label.raw), dstLabels = model.destinations.map(d => d.label.raw);
    const NOUN_S = 'f[aá]bricas?|plantas?|or[ií]genes?|fuentes?|bodegas?|centros?|almacenes?', NOUN_D = 'clientes?|destinos?|distribuidores?|mercados?|tiendas?|sucursales?|almacenes?';
    const VERB_S = 'produce|producen|producci[oó]n|oferta|ofrece|dispone|disponibles?|capacidad|puede\\s+suministrar|suministra|tiene|cuenta\\s+con|genera|fabrica';
    const VERB_D = 'demanda|demandan|requiere|requieren|necesita|necesitan|pide|piden|pedidos?|solicita|compra|consume|requerimientos?';
    const prose = rows.filter(r => !(r.idx >= table.firstIdx && r.idx <= table.lastIdx) && r.idx !== table.headerIdx && !HEADING.test(r.text) && !/^p[aá]gina\s+\d+/i.test(r.text)).map(r => r.text).join('\n');
    if (!supplyCol) {
      const q = quantitiesFromText(prose, srcLabels, NOUN_S, VERB_S);
      model.sources.forEach(s => { const v = q[s.label.raw]; if (v != null) { s.supply = { raw: String(v), flags: ['from-text'], conf: null, origin: 'enunciado' }; } });
    }
    if (!demandRow) {
      const q = quantitiesFromText(prose, dstLabels, NOUN_D, VERB_D);
      model.destinations.forEach(d => { const v = q[d.label.raw]; if (v != null) d.demand = { raw: String(v), flags: ['from-text'], conf: null, origin: 'enunciado' }; });
    }
    const forb = forbiddenFromText(prose, srcLabels, dstLabels); model.forbiddenFromText = forb;
    forb.forEach(([s, d]) => { const i = srcLabels.indexOf(s), j = dstLabels.indexOf(d); if (i >= 0 && j >= 0) { const c = model.costs[i][j]; c.forbidden = true; c.raw = ''; c.flags = c.flags.filter(f => f !== 'missing' && f !== 'ambiguous-dash'); c.flags.push('from-text'); } });
    applyPatternFlags(model.sources); applyPatternFlags(model.destinations);
    // Sugerencias de etiquetas desde el enunciado (el usuario decide; nunca se aplican solas)
    const sugg = { sources: null, destinations: null };
    if (textLists.sources.length === srcLabels.length && textLists.sources.some((l, i) => norm(l) !== norm(srcLabels[i]))) sugg.sources = textLists.sources;
    if (textLists.destinations.length === dstLabels.length && textLists.destinations.some((l, i) => norm(l) !== norm(dstLabels[i]))) sugg.destinations = textLists.destinations;
    if (sugg.sources || sugg.destinations) model.labelSuggestions = { ...sugg, origin: 'enunciado' };
    else {
      const ps = model.sources.map(s => (s.label.suggestion && s.label.flags.includes('pattern') ? s.label.suggestion : s.label.raw));
      const pd = model.destinations.map(d => (d.label.suggestion && d.label.flags.includes('pattern') ? d.label.suggestion : d.label.raw));
      const diffS = ps.some((v, i) => v !== model.sources[i].label.raw), diffD = pd.some((v, i) => v !== model.destinations[i].label.raw);
      if (diffS || diffD) model.labelSuggestions = { sources: diffS ? ps : null, destinations: diffD ? pd : null, origin: 'patrón' };
    }
    if (table.header === null) issues.push({ category: 'incompleto', level: 'warning', code: 'no-header', message: 'No se encontró una fila de encabezados: los destinos llevan nombres provisionales («Destino n»). Corrígelos.' });
    model.table = { rows: costRows.length, cols: D, supplyColumn: supplyCol, demandRow: Boolean(demandRow), page: rows[table.firstIdx] && rows[table.firstIdx].page };
    model.issues = issues; model.ok = true;
    return model;
  }

  /* ───────── 7. Validación de un modelo de revisión (se vuelve a ejecutar tras cada edición) ───────── */
  function maxFlow(supply, demand, forbidden) {
    const n = supply.length, m = demand.length, N = n + m + 2, S = n + m, T = n + m + 1; const cap = Array.from({ length: N }, () => new Array(N).fill(0));
    supply.forEach((v, i) => { cap[S][i] = v; }); demand.forEach((v, j) => { cap[n + j][T] = v; });
    for (let i = 0; i < n; i += 1) for (let j = 0; j < m; j += 1) if (!forbidden[i][j]) cap[i][n + j] = Infinity;
    let flow = 0;
    for (;;) {
      const prev = new Array(N).fill(-1); prev[S] = S; const q = [S];
      while (q.length && prev[T] < 0) { const u = q.shift(); for (let v = 0; v < N; v += 1) if (prev[v] < 0 && cap[u][v] > 1e-9) { prev[v] = u; q.push(v); } }
      if (prev[T] < 0) return flow;
      let b = Infinity; for (let v = T; v !== S; v = prev[v]) b = Math.min(b, cap[prev[v]][v]);
      for (let v = T; v !== S; v = prev[v]) { cap[prev[v]][v] -= b; cap[v][prev[v]] += b; } flow += b;
    }
  }
  function validate(model) {
    const issues = []; const add = (category, level, code, message, where) => issues.push({ category, level, code, message, where });
    const n = model.sources.length, m = model.destinations.length;
    if (n < MIN_DIM || m < MIN_DIM) add('incompleto', 'error', 'dims-min', `El modelo necesita al menos ${MIN_DIM} fuentes y ${MIN_DIM} destinos (se leyeron ${n} y ${m}).`);
    if (n > MAX_DIM || m > MAX_DIM) add('incompleto', 'error', 'dims-max', `IO Solver admite hasta ${MAX_DIM} fuentes y ${MAX_DIM} destinos (se leyeron ${n} y ${m}). Reduce el problema o divídelo.`);
    const seen = (items, noun) => { const set = new Set(); items.forEach((it, i) => { const l = norm(it.label.raw); if (!l) add('incompleto', 'error', 'label-empty', `Falta el nombre de la ${noun} ${i + 1}.`, { kind: noun, i }); else if (set.has(l)) add('incompleto', 'error', 'label-dup', `El nombre «${it.label.raw}» está repetido entre las ${noun === 'fuente' ? 'fuentes' : 'destinos'}.`, { kind: noun, i }); set.add(l); }); };
    seen(model.sources, 'fuente'); seen(model.destinations, 'destino');
    const num = (cell, noun, label, where) => {
      const raw = String(cell.raw ?? '').trim();
      if (!raw) { add('incompleto', 'error', 'missing', `Falta ${noun} de ${label}.`, where); return null; }
      const v = parseNumber(raw);
      if (v == null) { const hint = cell.suggestion && cell.suggestion !== raw ? ` ¿Quisiste escribir ${cell.suggestion}?` : ''; add('lectura', 'error', 'unreadable', `No se pudo leer ${noun} de ${label}: «${raw}».${hint}`, where); return null; }
      return v;
    };
    const supply = model.sources.map((s, i) => num(s.supply, 'la oferta', s.label.raw || `fuente ${i + 1}`, { kind: 'supply', i }));
    const demand = model.destinations.map((d, j) => num(d.demand, 'la demanda', d.label.raw || `destino ${j + 1}`, { kind: 'demand', j }));
    const forbidden = model.costs.map(row => row.map(c => Boolean(c.forbidden)));
    model.costs.forEach((row, i) => row.forEach((c, j) => { if (!c.forbidden) num(c, 'el costo', `${model.sources[i].label.raw || 'fuente ' + (i + 1)} → ${model.destinations[j].label.raw || 'destino ' + (j + 1)}`, { kind: 'cost', i, j }); }));
    // Celdas dudosas (no bloquean, pero deben revisarse)
    const flagged = [];
    const watch = (cell, where, text) => { const f = cell.flags || []; if (f.includes('pattern')) flagged.push({ where, text, level: 'pattern', suggestion: cell.suggestion }); if (f.includes('very-low') || f.includes('low')) flagged.push({ where, text, level: f.includes('very-low') ? 'very-low' : 'low', conf: cell.conf }); if (f.includes('from-text')) flagged.push({ where, text, level: 'from-text' }); if (f.includes('assumed')) flagged.push({ where, text, level: 'assumed' }); };
    model.sources.forEach((s, i) => { watch(s.label, { kind: 'srcLabel', i }, `nombre de la fuente ${s.label.raw}`); watch(s.supply, { kind: 'supply', i }, `oferta de ${s.label.raw}`); });
    model.destinations.forEach((d, j) => { watch(d.label, { kind: 'dstLabel', j }, `nombre del destino ${d.label.raw}`); watch(d.demand, { kind: 'demand', j }, `demanda de ${d.label.raw}`); });
    model.costs.forEach((row, i) => row.forEach((c, j) => watch(c, { kind: 'cost', i, j }, `costo ${model.sources[i].label.raw} → ${model.destinations[j].label.raw}`)));
    flagged.forEach(f => {
      if (f.level === 'pattern') add('lectura', 'warning', 'pattern', `El ${f.text} no sigue el patrón de los demás nombres${f.suggestion ? ` (¿${f.suggestion}?)` : ''}.`, f.where);
      else if (f.level === 'from-text') add('lectura', 'info', 'from-text', `El ${f.text} se tomó del enunciado: confírmalo.`, f.where);
      else if (f.level === 'assumed') add('incompleto', 'warning', 'assumed', `El ${f.text} es provisional.`, f.where);
      else if (f.level === 'very-low' && ['cost', 'supply', 'demand'].includes(f.where.kind)) add('lectura', 'error', 'confirm-needed', `Cifra con confianza muy baja${f.conf != null ? ` (OCR ${Math.round(f.conf)} %)` : ''}: ${f.text}. Confírmala o corrígela antes de aplicar.`, f.where);
      else add('lectura', 'warning', 'low-conf', `Lectura dudosa${f.conf != null ? ` (confianza OCR ${Math.round(f.conf)} %)` : ''}: ${f.text}.`, f.where);
    });
    const allNum = supply.every(v => v != null) && demand.every(v => v != null);
    const negative = [...supply, ...demand].some(v => v != null && v < 0);
    if (negative) add('lectura', 'error', 'negative', 'Hay cantidades negativas en oferta o demanda.');
    const totals = { supply: supply.reduce((a, v) => a + (v || 0), 0), demand: demand.reduce((a, v) => a + (v || 0), 0) }; totals.difference = totals.supply - totals.demand;
    if (allNum) {
      if (!(totals.supply > 0) || !(totals.demand > 0)) add('incompleto', 'error', 'zero-total', 'La oferta total y la demanda total deben ser mayores que cero.');
      const c = model.checks || {};
      if (c.demandTotal != null && Math.abs(c.demandTotal - totals.demand) > 1e-9) add('lectura', 'warning', 'total-mismatch', `El total de demanda impreso en el documento (${c.demandTotal}) no coincide con la suma leída (${totals.demand}): alguna cifra puede estar mal leída.`);
      if (c.supplyTotal != null && Math.abs(c.supplyTotal - totals.supply) > 1e-9) add('lectura', 'warning', 'total-mismatch', `El total de oferta impreso en el documento (${c.supplyTotal}) no coincide con la suma leída (${totals.supply}): alguna cifra puede estar mal leída.`);
      if (totals.difference > 1e-9) add('incompleto', 'info', 'balance', `La oferta (${totals.supply}) supera la demanda (${totals.demand}) por ${totals.difference}: al resolver, el módulo añadirá un destino ficticio. No se modifica nada aquí.`);
      else if (totals.difference < -1e-9) add('incompleto', 'info', 'balance', `La demanda (${totals.demand}) supera la oferta (${totals.supply}) por ${-totals.difference}: al resolver, el módulo añadirá una fuente ficticia. No se modifica nada aquí.`);
      else add('incompleto', 'info', 'balance', `Oferta y demanda están balanceadas (${totals.supply}).`);
      // Viabilidad con rutas prohibidas (solo si no falta oferta; con déficit la fuente ficticia absorbe la diferencia)
      if (totals.supply + 1e-9 >= totals.demand && n >= 1 && m >= 1) {
        const flow = maxFlow(supply, demand, forbidden);
        if (flow + 1e-9 < totals.demand) add('inviable', 'error', 'infeasible', `Con las rutas prohibidas actuales solo se pueden cubrir ${flow} de ${totals.demand} unidades de demanda: el modelo no tiene solución factible. Revisa las rutas marcadas con X o las ofertas.`);
      }
      model.destinations.forEach((d, j) => { if ((demand[j] || 0) > 0 && model.sources.every((_, i) => forbidden[i][j])) add('inviable', 'error', 'dest-blocked', `El destino ${d.label.raw} tiene demanda pero todas sus rutas están prohibidas.`, { kind: 'dstLabel', j }); });
    }
    const errors = issues.filter(i => i.level === 'error');
    return { issues, errors: errors.length, canApply: errors.length === 0, totals: allNum ? totals : null, forbidden, flagged: flagged.length };
  }

  /* Modelo de revisión → objeto aceptado por IOTransportAPI.applyImportedModel */
  function toEditorModel(model) {
    return { projectName: String(model.name || 'Ejercicio importado').slice(0, 100),
      sources: model.sources.map(s => ({ label: String(s.label.raw).trim(), supply: String(parseNumber(s.supply.raw) ?? s.supply.raw).trim() })),
      destinations: model.destinations.map(d => ({ label: String(d.label.raw).trim(), demand: String(parseNumber(d.demand.raw) ?? d.demand.raw).trim() })),
      costs: model.costs.map(row => row.map(c => (c.forbidden ? '' : String(parseNumber(c.raw) ?? c.raw).trim()))),
      forbidden: model.costs.map(row => row.map(c => Boolean(c.forbidden))) };
  }

  const api = { interpret, validate, toEditorModel, parseNumber, classify, labelListsFromText, LOW, VERY_LOW, MIN_DIM, MAX_DIM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IOTransportImport = api;
})(typeof window !== 'undefined' ? window : globalThis);
