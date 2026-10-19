/* Intérprete tolerante de tablas y texto extraído para actividades CPM/PERT. */
(function (root) {
  'use strict';
  const clean = v => String(v ?? '').replace(/\u00a0/g, ' ').trim();
  const isNum = v => /^[-+]?\d+(?:[.,]\d+)?$/.test(clean(v));
  const num = v => Number(clean(v).replace(',', '.'));
  const isDash = v => !clean(v) || /^[-–—]$/.test(clean(v)) || /^(?:ninguna|ninguno|no aplica|n\/a|inicio)$/i.test(clean(v));
  const labelRE = /^[\p{L}\p{N}_-]{1,30}$/u;
  const shortLabelRE = /^[A-ZÁÉÍÓÚÜÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_-]{0,9}$/u;
  const proseStarts = new Set(['un','una','unos','unas','el','la','los','las','se','para','por','con','este','esta','estos','estas','los','las','investigación','investigacion','página','pagina','ejercicio','problema','fórmula','formula','tiempo','tiempos','parte','método','metodo','indicación','indicaciones','nota']);

  function splitColumns(line) {
    const s = clean(line);
    if (s.includes('|')) return s.split(/\s*\|\s*/).map(clean);
    if (s.includes('\t')) return s.split(/\t+/).map(clean);
    if (s.includes(';')) return s.split(/\s*;\s*/).map(clean);
    if (/\s{2,}/.test(s)) return s.split(/\s{2,}/).map(clean);
    return null;
  }
  function headerMap(cols) {
    if (!cols || cols.length < 3) return null;
    const find = re => cols.findIndex(c => re.test(clean(c)));
    const map = {
      name: find(/^(?:(?:id|clave|c[oó]digo)\s*)?(?:actividad|tarea|nombre)\b/i),
      pred: find(/predeces|anteces|dependenc|precedenc/i),
      duration: find(/duraci[oó]n|tiempo(?:\s+esperado)?\b|^te$/i),
      o: find(/optimista|^o$|^a$/i),
      m: find(/m[aá]s\s*probable|probable|^m$/i),
      p: find(/pesimista|^p$|^b$/i),
      description: find(/descripci[oó]n/i)
    };
    // A veces el encabezado de duración esperada y el encabezado O/M/P se mezclan;
    // se requieren actividad y predecesoras más duración u O/M/P.
    if (map.name < 0 || map.pred < 0 || (map.duration < 0 && !(map.o >= 0 && map.m >= 0 && map.p >= 0))) return null;
    return map;
  }
  function validName(v, allowLong = false) {
    const s = clean(v);
    if (!labelRE.test(s)) return false;
    if (allowLong) return true;
    return s.length <= 10 && !proseStarts.has(s.toLocaleLowerCase());
  }
  function normalizePred(v) {
    const s = clean(v);
    return isDash(s) ? '' : s.replace(/[，]/g, ',').replace(/\s*[,;/]\s*/g, ', ');
  }
  function rowFromMapped(cols, map) {
    const get = i => i >= 0 ? clean(cols[i] ?? '') : '';
    const name = get(map.name), pred = normalizePred(get(map.pred));
    if (!validName(name, true)) return null;
    if (map.o >= 0 && map.m >= 0 && map.p >= 0 && isNum(get(map.o)) && isNum(get(map.m)) && isNum(get(map.p))) {
      const o = num(get(map.o)), m = num(get(map.m)), p = num(get(map.p));
      return { row: { name, pred, duration: String((o + 4*m + p)/6), o: String(o), m: String(m), p: String(p) }, pert: true };
    }
    if (map.duration >= 0 && isNum(get(map.duration))) {
      const d = num(get(map.duration));
      // Si hay O/M/P explícitos, éstos mandan; en una tabla CPM la duración se repite.
      return { row: { name, pred, duration: String(d), o: String(d), m: String(d), p: String(d) }, pert: false };
    }
    return null;
  }
  function detectHeader(lines) {
    for (let i = 0; i < lines.length; i++) {
      const cols = splitColumns(lines[i].line);
      const map = headerMap(cols);
      if (map) return { index: i, map };
    }
    return null;
  }
  function isBoilerplate(line) {
    const s = clean(line);
    if (!s) return true;
    if (/^(?:actividad(?:es)?|activida|d|descripci[oó]n|predecesora?s?\b|duraci[oó]n\b|optimista\b|pesimista\b|probable\b|tarea\b|id\s+actividad)\s*$/i.test(s)) return true;
    if (/^(?:investigaci[oó]n\s+de\s+operaciones|universidad|instituto)\b.*\b(?:p[aá]gina|page)\s*\d+/i.test(s)) return true;
    if (/\b(?:p[aá]gina|page)\s*\d+\s*(?:de|\/|of)\s*\d+\s*$/i.test(s)) return true;
    if (/^(?:ejercicio|problema|proyecto|parte\s+[ivx]+|se\s+pide|indicaciones|f[oó]rmula|los tiempos|las duraciones|un equipo|una empresa|un grupo|un estudiante|para lograr|para completar|un peque|un estudiante|un grupo)\b/i.test(s)) return true;
    if (/^\d+[.)]\s/.test(s)) return true;
    return false;
  }
  function isCandidateLabel(token) {
    const t = clean(token);
    return shortLabelRE.test(t) && !proseStarts.has(t.toLocaleLowerCase());
  }
  function parseFallbackLine(line) {
    const cols = splitColumns(line);
    if (cols && cols.length >= 3) {
      const first = cols[0];
      if (!validName(first, false)) return null;
      // La descripción puede ocupar uno o varios campos intermedios. En tablas sin
      // encabezados, predecesoras es el campo anterior al bloque numérico final.
      if (cols.length >= 4 && cols.slice(-3).every(isNum)) {
        const [o,m,p] = cols.slice(-3).map(num);
        const pred = cols[cols.length - 4];
        return { row: { name: first, pred: normalizePred(pred), duration: String((o+4*m+p)/6), o:String(o), m:String(m), p:String(p) }, pert: true };
      }
      if (cols.length >= 3 && isNum(cols[cols.length - 1])) {
        const d = num(cols[cols.length - 1]);
        const pred = cols.length >= 3 ? cols[cols.length - 2] : '';
        return { row: { name: first, pred: normalizePred(pred), duration: String(d), o:String(d), m:String(d), p:String(d) }, pert: false };
      }
    }
    const tokens = clean(line).split(/\s+/).filter(Boolean);
    if (tokens.length < 2 || !isCandidateLabel(tokens[0])) return null;
    if (tokens.length >= 4 && tokens.slice(-3).every(isNum)) {
      const [o,m,p] = tokens.slice(-3).map(num);
      let predToken = tokens[tokens.length-4];
      if (tokens.length >= 5 && /[,;/]$/.test(tokens[tokens.length-5])) predToken = `${tokens[tokens.length-5].replace(/[,;/]+$/, '')}, ${predToken}`;
      // Para una línea sin columnas, el código inmediatamente anterior a O/M/P es
      // la predecesora; la descripción larga queda en medio.
      return { row: { name: tokens[0], pred: normalizePred(predToken), duration:String((o+4*m+p)/6), o:String(o), m:String(m), p:String(p) }, pert:true };
    }
    if (isNum(tokens[tokens.length-1])) {
      const d = num(tokens[tokens.length-1]);
      let pred = tokens.length >= 3 ? tokens[tokens.length-2] : '';
      if (tokens.length >= 4 && /[,;/]$/.test(tokens[tokens.length-3])) pred = `${tokens[tokens.length-3].replace(/[,;/]+$/, '')}, ${pred}`;
      // Si el último token textual no tiene pinta de etiqueta, no inventar dependencia.
      const predParts = pred.split(/[,;/]+/).map(x => clean(x));
      const predLooksValid = predParts.length > 1 ? predParts.every(isCandidateLabel) : isCandidateLabel(pred);
      return { row: { name: tokens[0], pred: isDash(pred) ? '' : (predLooksValid ? normalizePred(pred) : ''), duration:String(d), o:String(d), m:String(d), p:String(d) }, pert:false };
    }
    return null;
  }

  function parseActivityText(source) {
    const lines = String(source || '').replace(/\r/g, '').split('\n').map((line, index) => ({ line: clean(line), index })).filter(x => x.line);
    const rows = []; let hasPertEstimates = false; const warnings = [];
    const header = detectHeader(lines);
    for (const item of lines) {
      const line = item.line;
      if (header && item.index === header.index) continue;
      if (isBoilerplate(line)) continue;
      let parsed = null;
      const cols = splitColumns(line);
      if (header && cols && item.index > header.index) {
        parsed = rowFromMapped(cols, header.map);
        if (!parsed) {
          // Sólo avisar si esta línea tiene la forma de una fila, no por narración o pie.
          if (isCandidateLabel(cols[header.map.name]) && cols.some(isNum)) warnings.push(`Línea ${item.index+1}: se reconoció una posible fila, pero faltan datos en columnas detectadas.`);
          continue;
        }
      }
      if (!parsed) parsed = parseFallbackLine(line);
      if (parsed && parsed.row && Number.isFinite(Number(parsed.row.duration))) {
        rows.push(parsed.row); if (parsed.pert) hasPertEstimates = true;
      } else {
        // Evitar falsos positivos como narración, instrucciones, títulos, encabezados
        // partidos por la extracción del PDF o pies de página. Avisar sólo sobre una
        // fila que comienza con un identificador corto y contiene datos numéricos.
        const first = cols?.[0] ?? line.split(/\s+/)[0];
        const looksLikeData = isCandidateLabel(first) && /\d/.test(line) && (cols?.length >= 3 || /\s+[-–—A-Z0-9_,;/]+\s+[-+]?\d+(?:[.,]\d+)?(?:\s+[-+]?\d+(?:[.,]\d+)?){0,2}$/.test(line));
        if (looksLikeData) warnings.push(`Línea ${item.index+1}: parece una fila de actividad, pero no se pudieron asignar sus datos con seguridad.`);
      }
    }
    if (rows.length < 2) throw new Error('No encontré al menos dos actividades. Usa una actividad por fila con nombre, predecesoras y duración.');
    const seen = new Set();
    for (const row of rows) {
      const key = clean(row.name).toLocaleLowerCase();
      if (!key || seen.has(key)) throw new Error(`Hay un nombre de actividad vacío o repetido: «${row.name}».`);
      seen.add(key);
    }
    const names = new Set(rows.map(r => r.name.toLocaleLowerCase()));
    const missing = rows.flatMap(row => row.pred.split(/[,;\/]+/).map(v => v.trim()).filter(Boolean).filter(v => !names.has(v.toLocaleLowerCase())).map(v => `${row.name} → ${v}`));
    if (missing.length) warnings.push(`Predecesoras no encontradas (revisa las etiquetas): ${missing.join(', ')}.`);
    return { rows, hasPertEstimates, warnings };
  }
  const api = { parseActivityText };
  root.IOPertImportAPI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
