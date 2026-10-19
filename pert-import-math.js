/* Parser heurístico, sin DOM, para filas de actividades CPM/PERT. */
(function (root) {
  'use strict';
  const clean = v => String(v ?? '').trim();
  const isNum = v => /^[-+]?\d+(?:[.,]\d+)?$/.test(String(v || '').trim());
  const num = v => Number(String(v).replace(',', '.'));
  const isDash = v => !clean(v) || /^[-–—]$/.test(clean(v));
  function parseActivityText(source) {
    const lines = String(source || '').replace(/\r/g, '').split('\n').map((line, index) => ({ line: line.trim(), index })).filter(x => x.line);
    const rows = []; let hasPertEstimates = false; const warnings = [];
    for (const item of lines) {
      const line = item.line;
      if (/^(?:actividad(?:es)?|id\s+actividad|tarea)\b/i.test(line) || (/predecesor/i.test(line) && /duraci[oó]n/i.test(line))) continue;
      if (/^(?:ejercicio|problema|proyecto|actividades del proyecto)\b/i.test(line) && !/[|;\t]/.test(line)) continue;
      let fields = null;
      if (/[|;\t]/.test(line)) fields = line.split(/\s*(?:\||;|\t)\s*/).map(s => s.trim());
      else if (/\s{2,}/.test(line)) fields = line.split(/\s{2,}/).map(s => s.trim());
      let row = null;
      if (fields && fields.length >= 3) {
        const name = fields[0], pred = fields[1];
        // Algunas tablas incluyen una columna descriptiva: Actividad | Descripción | Predecesoras | Duración.
        // En ese formato, la descripción no debe confundirse con las predecesoras.
        if (fields.length === 4 && isNum(fields[3]) && !isNum(fields[2])) {
          const predWithDescription = fields[2];
          row = { name, pred: isDash(predWithDescription) ? '' : predWithDescription, duration: String(num(fields[3])), o: fields[4] || fields[3], m: fields[5] || fields[3], p: fields[6] || fields[3] };
        }
        if (!row && fields.length >= 7 && fields.slice(-3).every(isNum) && !isNum(fields[2])) {
          const o=num(fields[fields.length-3]),m=num(fields[fields.length-2]),p=num(fields[fields.length-1]);
          const predecessor = fields[fields.length-4];
          row = { name, pred: isDash(predecessor) ? '' : predecessor, duration: String((o+4*m+p)/6), o:String(o), m:String(m), p:String(p) }; hasPertEstimates = true;
        }
        if (!row && fields.length >= 6 && fields.slice(-4).every(isNum)) {
          row = { name, pred: isDash(pred) ? '' : pred, duration: String(num(fields[2])), o: String(num(fields[3])), m: String(num(fields[4])), p: String(num(fields[5])) }; hasPertEstimates = true;
        } else if (fields.length === 5 && fields.slice(-3).every(isNum)) {
          const o=num(fields[2]),m=num(fields[3]),p=num(fields[4]);
          row = { name, pred: isDash(pred) ? '' : pred, duration: String((o+4*m+p)/6), o:String(o), m:String(m), p:String(p) }; hasPertEstimates = true;
        } else if (isNum(fields[2])) {
          row = { name, pred: isDash(pred) ? '' : pred, duration: String(num(fields[2])), o: fields[3] || fields[2], m: fields[4] || fields[2], p: fields[5] || fields[2] };
        }
      }
      if (!row) {
        const tokens = line.split(/\s+/).filter(Boolean);
        // PDF.js puede extraer las columnas de una tabla sin separadores. Si la fila
        // contiene nombre + descripción + predecesora + duración, la predecesora
        // suele ser el último token textual antes de la duración (o de O/M/P).
        const knownLabel = value => /^[\p{L}\p{N}_-]{1,30}$/u.test(clean(value));
        if (tokens.length >= 5 && tokens.slice(-3).every(isNum)) {
          const o=num(tokens[tokens.length-3]),m=num(tokens[tokens.length-2]),p=num(tokens[tokens.length-1]);
          const predecessor = tokens[tokens.length-4];
          row = { name: tokens[0], pred: isDash(predecessor) ? '' : predecessor, duration: String((o+4*m+p)/6), o:String(o), m:String(m), p:String(p) };
          if (!knownLabel(predecessor) && !isDash(predecessor)) row.pred = tokens.slice(1,-3).join(' ').replace(/[,;]+$/, '');
          if (isDash(row.pred)) row.pred=''; hasPertEstimates = true;
        } else if (tokens.length >= 2 && isNum(tokens[tokens.length-1])) {
          const predecessorToken = tokens.length > 2 ? tokens[tokens.length-2] : '';
          const pred = isDash(predecessorToken) ? '' : (knownLabel(predecessorToken) ? predecessorToken : (tokens.length === 2 ? '' : tokens.slice(1,-1).join(' ').replace(/[,;]+$/, '')));
          row = { name: tokens[0], pred, duration: String(num(tokens[tokens.length-1])), o:String(num(tokens[tokens.length-1])), m:String(num(tokens[tokens.length-1])), p:String(num(tokens[tokens.length-1])) };
        }
      }
      if (row && /^[\p{L}\p{N}_-]{1,30}$/u.test(clean(row.name)) && Number.isFinite(Number(row.duration))) rows.push(row);
      else warnings.push(`Línea ${item.index+1}: no se interpretó como una actividad completa.`);
    }
    if (rows.length < 2) throw new Error('No encontré al menos dos actividades. Usa una actividad por fila con nombre, predecesoras y duración.');
    const seen = new Set();
    for (const row of rows) { const key = clean(row.name).toLocaleLowerCase(); if (!key || seen.has(key)) throw new Error(`Hay un nombre de actividad vacío o repetido: «${row.name}».`); seen.add(key); }
    const names = new Set(rows.map(r => r.name.toLocaleLowerCase()));
    const missing = rows.flatMap(row => row.pred.split(/[,;]+/).map(v => v.trim()).filter(Boolean).filter(v => !names.has(v.toLocaleLowerCase())).map(v => `${row.name} → ${v}`));
    if (missing.length) warnings.push(`Predecesoras no encontradas (revisa las etiquetas): ${missing.join(', ')}.`);
    return { rows, hasPertEstimates, warnings };
  }
  const api = { parseActivityText };
  root.IOPertImportAPI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
