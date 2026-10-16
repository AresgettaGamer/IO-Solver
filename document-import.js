'use strict';
/* IO Solver v8.0.0 · Lector compartido de documentos (PDF con texto, PDF escaneado, PDF mixto e imágenes).
 *
 * Responsabilidades (y SOLO estas): cargar el archivo, extraer texto nativo con su geometría, detectar páginas escaneadas o con
 * imágenes relevantes, ejecutar OCR local cuando hace falta, fusionar texto nativo + OCR sin duplicados, detectar bloques/ejercicios
 * candidatos y mostrar progreso/errores. NO interpreta matemáticamente ningún número: eso lo hacen los intérpretes de cada módulo
 * (Simplex: extractModelFromText; Transporte: transport-import.js).
 *
 * Privacidad: los documentos NUNCA salen del dispositivo. Solo se descargan librerías (PDF.js, Tesseract.js) y datos de idioma.
 * Dependencias con versión fija. Si la app se sirve por http(s) se usan las copias locales de /vendor; abierta con file:// el navegador
 * bloquea los workers locales y se descargan de jsDelivr (el contenido del usuario no se envía).
 */
(function initDocumentImport(root) {
  const VERSIONS = { pdfjs: '4.10.38', tesseract: '5.1.1', tesseractCore: '5.1.1', langData: '1.0.0' };
  const CDN = 'https://cdn.jsdelivr.net/npm/';
  const OCR_LANGS = ['spa'];          // español por defecto; ['spa','eng'] se admite cuando la app se sirve con las copias locales de /vendor
  const LOW_CONF = 75;          // palabras OCR por debajo de este valor se marcan para revisión
  const VERY_LOW_CONF = 55;
  const SCRIPT_BASE = (() => { try { return new URL('.', document.currentScript.src).href; } catch (_) { return new URL('.', location.href).href; } })();

  class ImportError extends Error {
    constructor(code, message, detail) { super(message); this.name = 'ImportError'; this.code = code; this.detail = detail; }
  }
  const throwIfAborted = signal => { if (signal && signal.aborted) throw new ImportError('cancelled', 'Procesamiento cancelado.'); };
  const median = arr => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  /* ───────────── Resolución de recursos: local (/vendor, solo http/https) o CDN con versión fija ───────────── */
  const sources = { checked: null };
  async function resolveSources() {
    if (sources.checked) return sources.checked;
    const cdn = {
      origin: 'cdn',
      pdfMain: `${CDN}pdfjs-dist@${VERSIONS.pdfjs}/build/pdf.min.mjs`,
      pdfWorker: `${CDN}pdfjs-dist@${VERSIONS.pdfjs}/build/pdf.worker.min.mjs`,
      tessScript: `${CDN}tesseract.js@${VERSIONS.tesseract}/dist/tesseract.min.js`,
      tessWorker: `${CDN}tesseract.js@${VERSIONS.tesseract}/dist/worker.min.js`,
      tessCore: `${CDN}tesseract.js-core@${VERSIONS.tesseractCore}`,
      tessLang: `${CDN}@tesseract.js-data/{lang}@${VERSIONS.langData}/4.0.0_best_int`,
    };
    let local = null;
    if (/^https?:$/.test(location.protocol)) {
      const base = new URL('vendor/', SCRIPT_BASE).href;
      try {
        const res = await fetch(base + 'pdfjs/pdf.min.mjs', { method: 'HEAD' });
        if (res.ok) local = {
          origin: 'local',
          pdfMain: base + 'pdfjs/pdf.min.mjs', pdfWorker: base + 'pdfjs/pdf.worker.min.mjs',
          tessScript: base + 'tesseract/tesseract.min.js', tessWorker: base + 'tesseract/worker.min.js',
          tessCore: base + 'tesseract/core', tessLang: base + 'tesseract/lang',
        };
      } catch (_) { /* sin copia local */ }
    }
    sources.checked = local || cdn; sources.cdn = cdn; sources.local = local;
    return sources.checked;
  }
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = () => resolve(); s.onerror = () => reject(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }

  /* ───────────── PDF.js ───────────── */
  let pdfjsPromise = null;
  async function loadPdfJs() {
    if (root.__simplexPdfJs) return root.__simplexPdfJs;
    if (!pdfjsPromise) {
      pdfjsPromise = (async () => {
        const attempts = []; const src = await resolveSources();
        attempts.push(src); if (src.origin === 'local') attempts.push(sources.cdn);
        let lastError = null;
        for (const s of attempts) {
          try {
            const mod = await import(s.pdfMain);
            mod.GlobalWorkerOptions.workerSrc = s.pdfWorker;
            root.__simplexPdfJs = mod; return mod;
          } catch (e) { lastError = e; }
        }
        throw new ImportError('lib-load', 'No se pudo cargar PDF.js. Comprueba la conexión (o sirve la carpeta con un servidor local para usar las copias de /vendor).', String(lastError));
      })().catch(e => { pdfjsPromise = null; throw e; });
    }
    return pdfjsPromise;
  }

  /* ───────────── Texto nativo con geometría ───────────── */
  function pdfTextItemGeometry(item) {
    const t = item?.transform || [];
    return { text: String(item?.str || ''), x: Number(t[4]) || 0, y: Number(t[5]) || 0, width: Number(item?.width) || 0,
      height: Number(item?.height) || Math.hypot(Number(t[2]) || 0, Number(t[3]) || 0) || 10, hasEOL: Boolean(item?.hasEOL) };
  }
  /* Misma lógica que usaba Simplex (agrupar por Y con tolerancia 3.5 y ordenar por X); ahora devuelve líneas con geometría. */
  function groupPdfItemsIntoLineObjects(items, pageHeight = 0) {
    const usable = (items || []).map(pdfTextItemGeometry).filter(item => item.text.trim());
    if (!usable.length) return [];
    usable.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = []; const tolerance = 3.5;
    for (const item of usable) {
      let line = lines.find(candidate => Math.abs(candidate.y - item.y) <= tolerance);
      if (!line) { line = { y: item.y, items: [] }; lines.push(line); }
      line.items.push(item);
    }
    lines.sort((a, b) => b.y - a.y);
    return lines.map(line => {
      line.items.sort((a, b) => a.x - b.x);
      let text = ''; let previous = null; const tokens = [];
      for (const item of line.items) {
        const gap = previous ? item.x - (previous.x + previous.width) : 0;
        const startsWithOperator = /^[+\-*/=<>≤≥]/.test(item.text.trim());
        const endsWithOperator = /[+\-*/=<>≤≥]$/.test(text.trim());
        if (text && !startsWithOperator && !endsWithOperator && gap > 1.5) text += ' ';
        text += item.text; previous = item;
        // tokens (palabras) con bbox proporcional dentro del fragmento
        const len = item.text.length || 1; const re = /\S+/g; let m;
        while ((m = re.exec(item.text))) {
          const x0 = item.x + item.width * (m.index / len), x1 = item.x + item.width * ((m.index + m[0].length) / len);
          const yb = pageHeight ? pageHeight - item.y : -item.y;
          tokens.push({ text: m[0], x0, x1, y0: yb - item.height, y1: yb, conf: null, src: 'native' });
        }
      }
      const ys0 = Math.min(...tokens.map(t => t.y0)), ys1 = Math.max(...tokens.map(t => t.y1));
      return { text: text.trim(), tokens, x0: Math.min(...tokens.map(t => t.x0)), x1: Math.max(...tokens.map(t => t.x1)), y0: ys0, y1: ys1, src: 'native' };
    }).filter(l => l.text);
  }
  /* API retro-compatible: devuelve solo los textos de línea (como la función original de Simplex). */
  function groupPdfItemsIntoLines(items) { return groupPdfItemsIntoLineObjects(items).map(l => l.text); }

  /* ───────────── Regiones de imagen de una página PDF (CTM sobre la lista de operadores) ───────────── */
  async function pdfImageRegions(page, pdfjs, viewport) {
    const ops = await page.getOperatorList(); const OPS = pdfjs.OPS; const U = pdfjs.Util;
    let ctm = [1, 0, 0, 1, 0, 0]; const stack = []; const regions = [];
    const IMG = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintImageXObjectRepeat, OPS.paintImageMaskXObjectRepeat].filter(v => v !== undefined));
    for (let i = 0; i < ops.fnArray.length; i += 1) {
      const fn = ops.fnArray[i], args = ops.argsArray[i];
      if (fn === OPS.save) stack.push(ctm.slice());
      else if (fn === OPS.restore) { if (stack.length) ctm = stack.pop(); }
      else if (fn === OPS.transform && args && args.length >= 6) ctm = U.transform(ctm, args);
      else if (fn === OPS.paintFormXObjectBegin) { stack.push(ctm.slice()); if (args && args[0]) ctm = U.transform(ctm, args[0]); }
      else if (fn === OPS.paintFormXObjectEnd) { if (stack.length) ctm = stack.pop(); }
      else if (IMG.has(fn)) {
        const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(p => U.applyTransform(U.applyTransform(p, ctm), viewport.transform));
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        regions.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
      }
    }
    return regions;
  }

  /* ───────────── Render y preprocesado de imagen ───────────── */
  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function releaseCanvas(c) { if (c) { c.width = 0; c.height = 0; } }
  function cropCanvas(src, x0, y0, x1, y1) {
    const x = Math.max(0, Math.floor(x0)), y = Math.max(0, Math.floor(y0));
    const w = Math.min(src.width - x, Math.ceil(x1 - x)), h = Math.min(src.height - y, Math.ceil(y1 - y));
    const c = makeCanvas(w, h); c.getContext('2d').drawImage(src, x, y, w, h, 0, 0, w, h); return { canvas: c, ox: x, oy: y };
  }
  /* Escala de grises + estiramiento de contraste (percentiles 2–98). Mejora fotos con poca luz sin binarizar (no destruye trazos finos). */
  function enhanceCanvas(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height); const d = img.data; const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) { const g = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0; d[i] = g; hist[g] += 1; }
    const total = canvas.width * canvas.height; let acc = 0, lo = 0, hi = 255;
    for (let v = 0; v < 256; v += 1) { acc += hist[v]; if (acc >= total * 0.02) { lo = v; break; } }
    acc = 0; for (let v = 255; v >= 0; v -= 1) { acc += hist[v]; if (acc >= total * 0.02) { hi = v; break; } }
    const span = Math.max(40, hi - lo);
    for (let i = 0; i < d.length; i += 4) { const g = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / span)) | 0; d[i] = d[i + 1] = d[i + 2] = g; }
    ctx.putImageData(img, 0, 0); return canvas;
  }
  /* Elimina solo reglas claramente largas. Umbrales muy pequeños borran trazos de letras o sombras horizontales de fotografías.
     Las reglas de tablas suelen recorrer una fracción grande del lienzo; las palabras no deben confundirse con líneas completas. */
  function removeRuledLines(canvas) {
    const w = canvas.width, h = canvas.height; if (w < 200 || h < 100) return canvas;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); const img = ctx.getImageData(0, 0, w, h); const d = img.data;
    const DARK = 110, minH = Math.max(120, Math.round(w * 0.30)), minV = Math.max(160, Math.round(h * 0.25));
    const dark = (x, y) => d[(y * w + x) * 4] < DARK;
    const kill = new Uint8Array(w * h);
    for (let y = 0; y < h; y += 1) {                       // horizontales
      let run = 0;
      for (let x = 0; x <= w; x += 1) {
        if (x < w && dark(x, y)) run += 1;
        else { if (run >= minH) for (let k = x - run; k < x; k += 1) kill[y * w + k] = 1; run = 0; }
      }
    }
    for (let x = 0; x < w; x += 1) {                       // verticales
      let run = 0;
      for (let y = 0; y <= h; y += 1) {
        if (y < h && dark(x, y)) run += 1;
        else { if (run >= minV) for (let k = y - run; k < y; k += 1) kill[k * w + x] = 1; run = 0; }
      }
    }
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      if (kill[y * w + x] || (x > 0 && kill[y * w + x - 1] && d[(y * w + x) * 4] < 215) || (x < w - 1 && kill[y * w + x + 1] && d[(y * w + x) * 4] < 215)
        || (y > 0 && kill[(y - 1) * w + x] && d[(y * w + x) * 4] < 215) || (y < h - 1 && kill[(y + 1) * w + x] && d[(y * w + x) * 4] < 215)) { const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; }
    }
    ctx.putImageData(img, 0, 0); return canvas;
  }
  /* Devuelve { canvas, factor }: factor = (px del lienzo OCR) / (px del recorte original). */
  function prepareForOcr(source) {
    const MAX = 3600, TARGET = 2400; let factor = 1;
    const long = Math.max(source.width, source.height);
    // Un lienzo de solo ~1600 px suele quedarse corto en capturas/fotos de tablas; escalar ayuda al OCR sin superar 3600 px.
    if (long > MAX) factor = MAX / long; else if (long < TARGET) factor = Math.min(2, TARGET / long);
    let c = source;
    if (factor !== 1) { c = makeCanvas(source.width * factor, source.height * factor); const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(source, 0, 0, c.width, c.height); }
    else { c = makeCanvas(source.width, source.height); c.getContext('2d').drawImage(source, 0, 0); }
    return { canvas: removeRuledLines(enhanceCanvas(c)), factor };
  }
  async function renderPdfPage(page, scale) {
    const vp = page.getViewport({ scale }); const canvas = makeCanvas(vp.width, vp.height);
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise; return canvas;
  }

  /* ───────────── Motor OCR (Tesseract.js, worker reutilizable y cancelable) ───────────── */
  const ocr = { worker: null, pending: null, key: '', idle: 0, logger: null, params: '' };
  function terminateOcr() {
    clearTimeout(ocr.idle);
    const w = ocr.worker; ocr.worker = null; ocr.pending = null; ocr.key = ''; ocr.params = '';
    if (w) { try { w.terminate(); } catch (_) {} }
  }
  function scheduleIdleTerminate() { clearTimeout(ocr.idle); ocr.idle = setTimeout(terminateOcr, 120000); }
  /* Tesseract.js 5.1.1 descarga <langPath>/<idioma>.traineddata.gz. En local hay una sola carpeta con spa y eng (se admiten ambos a la vez);
     en CDN cada idioma es un paquete npm distinto, así que allí se usa un idioma por trabajador (el primero de la lista). */
  async function createWorkerFrom(src, langs, signal, report) {
    if (!root.Tesseract) await loadScript(src.tessScript);
    if (!root.Tesseract) throw new Error('Tesseract.js no quedó disponible tras cargar el script.');
    const useLangs = src.origin === 'local' ? langs : langs.slice(0, 1);
    report({ phase: 'ocr-setup', message: 'Preparando el motor de OCR (' + useLangs.join(' + ') + ')…', fraction: null });
    const options = {
      workerPath: src.tessWorker, corePath: src.tessCore, workerBlobURL: true,
      langPath: src.tessLang.replace('{lang}', useLangs[0]),
      logger: m => { if (ocr.logger) ocr.logger(m); },
    };
    if (src.origin === 'local') options.cacheMethod = 'none';       // en CDN se deja la caché del navegador (IndexedDB) para las siguientes sesiones
    return root.Tesseract.createWorker(useLangs.join('+'), 1, options);
  }
  async function getOcrWorker(langs, signal, report) {
    const key = langs.join('+');
    if (ocr.worker && ocr.key === key) return ocr.worker;
    if (ocr.pending && ocr.key === key) return ocr.pending;
    terminateOcr(); ocr.key = key;
    const job = (async () => {
      const first = await resolveSources(); const attempts = [first]; if (first.origin === 'local') attempts.push(sources.cdn);
      let last = null;
      for (const s of attempts) {
        try { const w = await createWorkerFrom(s, langs, signal, report); ocr.worker = w; return w; }
        catch (e) { last = e; if (signal && signal.aborted) throw new ImportError('cancelled', 'Procesamiento cancelado.'); }
      }
      throw new ImportError('lib-load', 'No se pudo preparar el OCR. Comprueba la conexión (se descargan la librería y los datos de idioma; el documento no se envía) o sirve la carpeta con un servidor local.', String(last));
    })();
    ocr.pending = job; job.catch(() => { if (ocr.pending === job) { ocr.pending = null; ocr.key = ''; } });
    return job;
  }
  function wordsFromResult(data) {
    if (Array.isArray(data.words) && data.words.length) return data.words;
    const out = [];
    (data.blocks || []).forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => (l.words || []).forEach(w => out.push(w)))));
    return out;
  }
  /* Reconoce un lienzo; si la señal se cancela, el worker se termina (Tesseract no puede interrumpir una pasada en curso). */
  async function recognizeCanvas(canvas, { langs, signal, report, mode }) {
    throwIfAborted(signal);
    const worker = await getOcrWorker(langs, signal, report); throwIfAborted(signal);
    const psm = mode === 'region' ? '6' : '3';          // regiones de imagen (tablas): bloque uniforme; páginas completas: automático
    if (ocr.params !== psm) { await worker.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: '1' }); ocr.params = psm; }
    let onAbort; const aborted = new Promise((_, reject) => { onAbort = () => { terminateOcr(); reject(new ImportError('cancelled', 'Procesamiento cancelado.')); }; if (signal) signal.addEventListener('abort', onAbort, { once: true }); });
    try { const result = await Promise.race([worker.recognize(canvas), aborted]); return wordsFromResult(result.data || result); }
    finally { if (signal && onAbort) signal.removeEventListener('abort', onAbort); scheduleIdleTerminate(); }
  }

  /* ───────────── Fusión nativo + OCR ───────────── */
  const area = t => Math.max(0, t.x1 - t.x0) * Math.max(0, t.y1 - t.y0);
  function overlapRatio(a, b) {
    const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (w <= 0 || h <= 0) return 0; return (w * h) / Math.max(1e-6, Math.min(area(a), area(b)));
  }
  function buildOcrLines(tokens) {
    if (!tokens.length) return [];
    const hMed = median(tokens.map(t => t.y1 - t.y0)) || 10;
    const sorted = [...tokens].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
    const lines = [];
    for (const t of sorted) {
      const cy = (t.y0 + t.y1) / 2; let line = null;
      for (let i = lines.length - 1; i >= 0 && i >= lines.length - 4; i -= 1) { if (Math.abs(lines[i].cy - cy) <= hMed * 0.6) { line = lines[i]; break; } }
      if (!line) { line = { cy, tokens: [] }; lines.push(line); }
      line.tokens.push(t); line.cy = line.tokens.reduce((s, x) => s + (x.y0 + x.y1) / 2, 0) / line.tokens.length;
    }
    return lines.map(l => {
      l.tokens.sort((a, b) => a.x0 - b.x0);
      const confs = l.tokens.map(t => t.conf).filter(c => c != null);
      return { text: l.tokens.map(t => t.text).join(' ').trim(), tokens: l.tokens,
        x0: Math.min(...l.tokens.map(t => t.x0)), x1: Math.max(...l.tokens.map(t => t.x1)), y0: Math.min(...l.tokens.map(t => t.y0)), y1: Math.max(...l.tokens.map(t => t.y1)),
        src: 'ocr', avgConf: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null };
    }).filter(l => l.text).sort((a, b) => a.y0 - b.y0);
  }
  function composePageLines(nativeLines, ocrTokens) {
    const nativeTokens = nativeLines.flatMap(l => l.tokens);
    const kept = ocrTokens.filter(t => !nativeTokens.some(n => overlapRatio(t, n) > 0.35));   // deduplicación por posición
    const ocrLines = buildOcrLines(kept);
    const norm = s => s.toLowerCase().replace(/[^a-z0-9áéíóúñ]/g, '');
    const uniqueOcr = ocrLines.filter(ol => !nativeLines.some(nl => Math.abs((nl.y0 + nl.y1) / 2 - (ol.y0 + ol.y1) / 2) < (nl.y1 - nl.y0) && norm(nl.text) === norm(ol.text)));  // y por contenido
    const lines = nativeLines.concat(uniqueOcr).sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2 || a.x0 - b.x0);
    return { lines, droppedOcrTokens: ocrTokens.length - kept.length };
  }
  function pageStats(page, ocrWords) {
    const confs = ocrWords.map(w => w.conf).filter(c => c != null);
    page.ocr = { words: ocrWords.length, avgConf: confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : null,
      lowConf: ocrWords.filter(w => w.conf != null && w.conf < LOW_CONF).length };
  }

  /* ───────────── Lectura de documentos ───────────── */
  const IMAGE_RE = /\.(png|jpe?g|webp)$/i;
  function detectKind(file) {
    const type = (file.type || '').toLowerCase(), name = file.name || '';
    if (type === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
    if (/^image\/(png|jpeg|webp)$/.test(type) || IMAGE_RE.test(name)) return 'image';
    return null;
  }
  const mkReport = onProgress => info => { try { onProgress && onProgress(info); } catch (_) {} };

  async function runOcrUnits(units, ctx) {      // units: [{ page, canvasFor(), mapBack(...)}]
    let done = 0; const total = units.length;
    for (const u of units) {
      throwIfAborted(ctx.signal);
      ctx.report({ phase: 'ocr', message: `Reconociendo texto (${u.label})…`, fraction: 0.1 + 0.9 * (done / total), done, total });
      ocr.logger = m => { if (m.status === 'recognizing text') ctx.report({ phase: 'ocr', message: `Reconociendo texto (${u.label})… ${Math.round(m.progress * 100)} %`, fraction: 0.1 + 0.9 * ((done + m.progress) / total), done, total }); else if (/loading/.test(m.status || '')) ctx.report({ phase: 'ocr-setup', message: 'Preparando el motor de OCR…', fraction: null }); };
      const prepared = await u.prepare();
      try {
        const words = await recognizeCanvas(prepared.canvas, { langs: ctx.langs, signal: ctx.signal, report: ctx.report, mode: u.mode });
        u.collect(words, prepared.factor);
      } finally { releaseCanvas(prepared.canvas); u.release && u.release(); }
      done += 1;
    }
    ocr.logger = null;
  }
  const toTokens = (words, mapPoint) => words.map(w => {
    const text = String(w.text || '').trim(); if (!text || /^[|¦_~·]+$/.test(text)) return null; const b = w.bbox || {};   // descarta restos de bordes de tabla
    const p0 = mapPoint(b.x0, b.y0), p1 = mapPoint(b.x1, b.y1);
    return { text, x0: p0[0], y0: p0[1], x1: p1[0], y1: p1[1], conf: Number.isFinite(w.confidence) ? w.confidence : null, src: 'ocr' };
  }).filter(Boolean);

  async function readImage(file, ctx) {
    ctx.report({ phase: 'read', message: 'Cargando la imagen…', fraction: 0.02 });
    let bitmap;
    try { bitmap = await createImageBitmap(file); } catch (e) { throw new ImportError('corrupt', 'No se pudo abrir la imagen. Comprueba que sea PNG, JPEG o WebP válida.', String(e)); }
    const base = makeCanvas(bitmap.width, bitmap.height); const g = base.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, base.width, base.height); g.drawImage(bitmap, 0, 0); const W = bitmap.width, H = bitmap.height; bitmap.close && bitmap.close();
    const page = { index: 1, width: W, height: H, mode: 'ocr', lines: [], regions: [{ x0: 0, y0: 0, x1: W, y1: H, ocr: true }], warnings: [], unit: 'px' };
    if (ctx.ocrMode === 'never') { releaseCanvas(base); page.mode = 'empty'; page.needsOcr = true; page.text = ''; return { pages: [page] }; }
    let tokens = [];
    await runOcrUnits([{ label: 'imagen', mode: ctx.forceOcr ? 'region' : 'page', prepare: async () => prepareForOcr(base),
      collect: (words, f) => { tokens = toTokens(words, (x, y) => [x / f, y / f]); }, release: () => releaseCanvas(base) }], ctx);
    page.lines = buildOcrLines(tokens); page.text = page.lines.map(l => l.text).join('\n'); pageStats(page, tokens);
    if (!page.lines.length) page.warnings.push('El OCR no encontró texto en la imagen.');
    return { pages: [page] };
  }

  async function readPdf(file, ctx) {
    const pdfjs = await loadPdfJs(); throwIfAborted(ctx.signal);
    ctx.report({ phase: 'read', message: 'Abriendo el PDF…', fraction: 0.02 });
    const buffer = await file.arrayBuffer(); let pdf;
    try { pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise; }
    catch (e) {
      if (e && e.name === 'PasswordException') throw new ImportError('password', 'El PDF está protegido con contraseña. Quita la protección y vuelve a intentarlo.', String(e));
      throw new ImportError('corrupt', 'El archivo no es un PDF válido o está dañado.', String(e));
    }
    const pages = []; const units = [];
    try {
      for (let i = 1; i <= pdf.numPages; i += 1) {
        throwIfAborted(ctx.signal);
        ctx.report({ phase: 'analyze', message: `Analizando página ${i} de ${pdf.numPages}…`, fraction: 0.02 + 0.08 * (i / pdf.numPages), page: i, pages: pdf.numPages });
        const pg = await pdf.getPage(i); const vp = pg.getViewport({ scale: 1 });
        const content = await pg.getTextContent({ disableCombineTextItems: false });
        const nativeLines = groupPdfItemsIntoLineObjects(content.items || [], vp.height);
        const tokens = nativeLines.flatMap(l => l.tokens);
        let regions = []; try { regions = await pdfImageRegions(pg, pdfjs, vp); } catch (_) { /* sin información de imágenes */ }
        const pageArea = vp.width * vp.height;
        const sig = regions.filter(r => { const w = r.x1 - r.x0, h = r.y1 - r.y0; return w * h >= 0.03 * pageArea && Math.min(w, h) >= 40; });
        const page = { index: i, width: vp.width, height: vp.height, mode: 'native', lines: nativeLines, regions: [], warnings: [], unit: 'pt', _nativeLines: nativeLines, _ocrTokens: [], nativeWords: tokens.length };
        const wantFull = ctx.forceOcr;
        const needs = [];
        if (wantFull) needs.push({ x0: 0, y0: 0, x1: vp.width, y1: vp.height, full: true });
        else for (const r of sig) {
          const inside = tokens.filter(t => { const cx = (t.x0 + t.x1) / 2, cy = (t.y0 + t.y1) / 2; return cx >= r.x0 - 4 && cx <= r.x1 + 4 && cy >= r.y0 - 4 && cy <= r.y1 + 4; }).length;
          const frac = ((r.x1 - r.x0) * (r.y1 - r.y0)) / pageArea; const need = inside < Math.max(4, frac * 40);
          page.regions.push({ ...r, nativeTokens: inside, ocr: need }); if (need) needs.push(r);
        }
        if (!wantFull && !tokens.length && !sig.length) {            // sin texto ni imágenes: ¿página en blanco o dibujo vectorial?
          const probe = await renderPdfPage(pg, 0.5); const d = probe.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, probe.width, probe.height).data; let ink = 0;
          for (let k = 0; k < d.length; k += 4) if (d[k] < 200) ink += 1; releaseCanvas(probe);
          if (ink / (d.length / 4) > 0.002) needs.push({ x0: 0, y0: 0, x1: vp.width, y1: vp.height, full: true }); else { page.mode = 'empty'; page.warnings.push('Página sin contenido legible.'); }
        }
        // páginas con una sola región que cubre casi toda la página => modo página completa (más contexto para el OCR)
        needs.forEach((r, k) => units.push({ pageIndex: i, region: r, label: `p. ${i}${needs.length > 1 ? ', región ' + (k + 1) : ''}` }));
        page.needsOcr = needs.length > 0; pages.push(page); pg.cleanup && pg.cleanup();
      }
      if (ctx.ocrMode !== 'never' && units.length) {
        const runUnits = units.map(u => {
          const page = pages[u.pageIndex - 1]; const full = u.region.full || ((u.region.x1 - u.region.x0) * (u.region.y1 - u.region.y0) > 0.6 * page.width * page.height);
          let pageCanvas = null, scale = 1, crop = null;
          return {
            label: u.label, mode: full ? 'page' : 'region',
            prepare: async () => {
              const pg = await pdf.getPage(u.pageIndex); const maxDim = Math.max(page.width, page.height); scale = Math.max(1.5, Math.min(3.2, 2400 / maxDim));
              pageCanvas = await renderPdfPage(pg, scale); pg.cleanup && pg.cleanup();
              const m = 8; crop = cropCanvas(pageCanvas, u.region.x0 * scale - m, u.region.y0 * scale - m, u.region.x1 * scale + m, u.region.y1 * scale + m);
              releaseCanvas(pageCanvas); pageCanvas = null; return prepareForOcr(crop.canvas);
            },
            collect: (words, f) => { page._ocrTokens.push(...toTokens(words, (x, y) => [(crop.ox + x / f) / scale, (crop.oy + y / f) / scale])); },
            release: () => { releaseCanvas(pageCanvas); releaseCanvas(crop && crop.canvas); },
          };
        });
        await runOcrUnits(runUnits, ctx);
      }
      for (const page of pages) {
        if (page._ocrTokens.length) { const { lines } = composePageLines(page._nativeLines, page._ocrTokens); page.lines = lines; page.mode = page.nativeWords ? 'mixed' : 'ocr'; pageStats(page, page._ocrTokens); }
        else if (page.needsOcr && ctx.ocrMode === 'never') page.warnings.push('Esta página contiene imágenes o texto escaneado; el OCR está desactivado.');
        else if (page.needsOcr && !page._ocrTokens.length) page.warnings.push('El OCR no encontró texto en las imágenes de esta página.');
        page.text = page.lines.map(l => l.text).join('\n'); delete page._nativeLines; delete page._ocrTokens;
      }
    } finally { try { pdf.destroy(); } catch (_) {} }
    return { pages };
  }

  let lastDocument = null;
  async function readDocument(file, opts = {}) {
    const o = Object.assign({ ocr: 'auto', langs: OCR_LANGS, signal: null, onProgress: null, forceOcr: false }, opts);
    const kind = file && detectKind(file);
    if (!kind) throw new ImportError('invalid-type', 'Formato no compatible. Usa un PDF, o una imagen PNG, JPEG o WebP.');
    if (file.size === 0) throw new ImportError('corrupt', 'El archivo está vacío.');
    const ctx = { signal: o.signal, report: mkReport(o.onProgress), langs: o.langs, ocrMode: o.ocr, forceOcr: o.forceOcr };
    throwIfAborted(ctx.signal);
    const body = kind === 'pdf' ? await readPdf(file, ctx) : await readImage(file, ctx);
    const pages = body.pages; const text = pages.map(p => p.text || '').join('\n\f\n');
    const ocrPages = pages.filter(p => p.ocr); const confs = ocrPages.map(p => p.ocr.avgConf).filter(c => c != null);
    const doc = { name: file.name, kind, size: file.size, pages, text, warnings: pages.flatMap(p => p.warnings.map(w => `Página ${p.index}: ${w}`)),
      ocr: { used: ocrPages.length > 0, pages: ocrPages.map(p => p.index), avgConf: confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : null,
        lowConfWords: ocrPages.reduce((s, p) => s + p.ocr.lowConf, 0), needed: pages.some(p => p.needsOcr) }, versions: VERSIONS, source: sources.checked ? sources.checked.origin : null };
    ctx.report({ phase: 'done', message: 'Lectura terminada.', fraction: 1 });
    lastDocument = { file: { name: file.name, size: file.size, lastModified: file.lastModified }, doc };
    return doc;
  }

  /* ───────────── Bloques / ejercicios candidatos ───────────── */
  const HEADING = /^(?:(?:\d+|[A-Z])\s*[.)-]\s*)?(?:ejercicio|ejerc\.|problema|problem|modelo)\s*(?:n[°ºo.]?\s*)?\d+\b/i;
  function classifyText(text) {
    const t = String(text || '');
    const count = re => (t.match(re) || []).length;
    const transport = count(/\b(f[aá]bricas?|plantas?|or[ií]genes?|fuentes?|destinos?|clientes?|distribuidores?|almac[eé]n(?:es)?|bodegas?)\b/gi) + count(/\b(oferta|demanda|costo\s+unitario|costo\s+por\s+unidad|transporte|env[ií]o|disponibilidad|requerimientos?)\b/gi);
    const simplex = count(/\b(maximizar|minimizar|maximize|minimize)\b/gi) * 2 + count(/\bZ\s*=/g) * 2 + count(/\bX\s*[_\[]?\d/gi) + count(/\b(restricci[oó]n|restricciones|sujeto\s+a)\b/gi);
    const type = transport >= 3 && transport > simplex ? 'transport' : simplex >= 2 && simplex >= transport ? 'simplex' : 'unknown';
    return { type, transport, simplex };
  }
  /* Misma regla que splitPdfExercises de Simplex (solo encabezados explícitos; el preámbulo anterior al primer ejercicio se descarta),
     pero conservando líneas, páginas de origen y marcas de baja confianza para cada bloque. */
  function detectBlocks(doc, { keepPreamble = false } = {}) {
    const flat = [];
    doc.pages.forEach(p => p.lines.forEach(l => flat.push({ ...l, page: p.index })));
    if (!flat.length) return [];
    let blocks = []; let current = [];
    for (const line of flat) {
      if (HEADING.test(line.text.trim()) && current.length) { blocks.push(current); current = []; }
      current.push(line);
    }
    if (current.length) blocks.push(current);
    if (!keepPreamble && blocks.length > 1 && !HEADING.test(blocks[0][0].text.trim())) blocks.shift();
    return blocks.map((lines, i) => {
      const text = lines.map(l => l.text).join('\n'); const first = lines[0].text.trim();
      const toks = lines.flatMap(l => l.tokens || []);
      return { id: i + 1, title: HEADING.test(first) ? first : `Bloque ${i + 1}`, text, lines, pages: [...new Set(lines.map(l => l.page))],
        lowConf: toks.filter(t => t.conf != null && t.conf < LOW_CONF).length, ocrWords: toks.filter(t => t.src === 'ocr').length, kind: classifyText(text) };
    });
  }
  /* Asocia bloques de texto (p. ej. los de splitPdfExercises) con sus líneas/páginas de origen. */
  function locateBlocks(blockTexts, doc) {
    const flat = []; doc.pages.forEach(p => p.lines.forEach(l => flat.push({ ...l, page: p.index })));
    let cursor = 0;
    return blockTexts.map(text => {
      const wanted = String(text).split('\n').map(s => s.trim()).filter(Boolean); const lines = [];
      for (const w of wanted) { let k = cursor; while (k < flat.length && flat[k].text.trim() !== w) k += 1; if (k < flat.length) { lines.push(flat[k]); cursor = k + 1; } }
      const toks = lines.flatMap(l => l.tokens || []);
      return { lines, pages: [...new Set(lines.map(l => l.page))], lowConf: toks.filter(t => t.conf != null && t.conf < LOW_CONF).length, ocrWords: toks.filter(t => t.src === 'ocr').length };
    });
  }
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* HTML del "texto leído": las palabras de baja confianza se subrayan, llevan «?» y título con el porcentaje (no solo color). */
  function markupLowConfidence(lines) {
    return (lines || []).map(l => {
      if (!l.tokens || !l.tokens.length) return escapeHtml(l.text);
      return l.tokens.map(t => (t.conf != null && t.conf < LOW_CONF)
        ? `<mark class="ocr-low${t.conf < VERY_LOW_CONF ? ' is-very-low' : ''}" title="Confianza OCR ${Math.round(t.conf)} %" data-conf="${Math.round(t.conf)}">${escapeHtml(t.text)}<sup aria-label="lectura dudosa">?</sup></mark>`
        : escapeHtml(t.text)).join(' ');
    }).join('<br>');
  }

  /* ───────────── Interfaz de progreso (reutilizable por Simplex y Transporte) ───────────── */
  function createProgressUI(host) {
    const box = document.createElement('div');
    box.className = 'doc-progress hidden'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Procesamiento del documento');
    box.innerHTML = `<div class="doc-progress-head"><strong class="doc-progress-title"></strong><span class="doc-progress-phase" aria-live="polite"></span></div>
      <div class="doc-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso de la lectura"><span></span></div>
      <div class="doc-progress-actions"><button type="button" class="btn secondary doc-cancel">Cancelar</button><button type="button" class="btn secondary doc-retry hidden">Reintentar</button></div>`;
    host.appendChild(box);
    const title = box.querySelector('.doc-progress-title'), phase = box.querySelector('.doc-progress-phase'), bar = box.querySelector('.doc-progress-bar'), fill = bar.firstElementChild;
    const cancel = box.querySelector('.doc-cancel'), retry = box.querySelector('.doc-retry');
    let controller = null; let lastArgs = null;
    const show = () => box.classList.remove('hidden'); const hide = () => box.classList.add('hidden');
    function set(info) {
      phase.textContent = info.message || '';
      if (info.fraction == null) { bar.classList.add('is-indeterminate'); bar.removeAttribute('aria-valuenow'); fill.style.width = '100%'; }
      else { const pct = Math.max(0, Math.min(100, Math.round(info.fraction * 100))); bar.classList.remove('is-indeterminate'); bar.setAttribute('aria-valuenow', String(pct)); fill.style.width = pct + '%'; }
    }
    cancel.addEventListener('click', () => { if (controller) controller.abort(); terminateOcr(); });
    retry.addEventListener('click', () => { if (lastArgs) run(...lastArgs); });
    async function run(file, options = {}) {
      lastArgs = [file, options]; controller = new AbortController();
      title.textContent = file.name; retry.classList.add('hidden'); cancel.classList.remove('hidden'); box.classList.remove('is-error'); show(); set({ message: 'Preparando…', fraction: 0 });
      try {
        const doc = await readDocument(file, { ...options, signal: controller.signal, onProgress: set });
        hide(); return { doc };
      } catch (error) {
        if (error && error.code === 'cancelled') { hide(); return { cancelled: true }; }
        const msg = error instanceof ImportError ? error.message : `Error inesperado al leer el documento: ${error && error.message ? error.message : error}`;
        box.classList.add('is-error'); phase.textContent = msg; bar.classList.remove('is-indeterminate'); fill.style.width = '0%'; bar.setAttribute('aria-valuenow', '0');
        cancel.classList.add('hidden'); if (!(error instanceof ImportError) || ['lib-load', 'unknown', 'ocr-failed'].includes(error.code)) retry.classList.remove('hidden');
        return { error };
      } finally { controller = null; }
    }
    return { run, hide, element: box };
  }

  root.IODocumentImport = {
    VERSIONS, ImportError, LOW_CONF, VERY_LOW_CONF, loadPdfJs, readDocument, detectBlocks, locateBlocks, classifyText, markupLowConfidence,
    groupPdfItemsIntoLines, groupPdfItemsIntoLineObjects, createProgressUI, terminateOcr, resolveSources,
    getLastDocument: () => lastDocument, escapeHtml,
  };
})(typeof window !== 'undefined' ? window : globalThis);
