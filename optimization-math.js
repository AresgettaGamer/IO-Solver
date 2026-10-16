/* Motor numérico educativo para funciones polinómicas de una variable.
 * No evalúa JavaScript ni usa Function/eval. Soporta polinomios hasta grado 8.
 */
(function (root) {
  'use strict';
  const EPS = 1e-10;
  const MAX_DEGREE = 8;
  const trim = p => {
    const a = (p || [0]).map(Number);
    while (a.length > 1 && Math.abs(a[a.length - 1]) < EPS) a.pop();
    return a.length ? a : [0];
  };
  const add = (a, b, sign = 1) => {
    const out = Array(Math.max(a.length, b.length)).fill(0);
    for (let i = 0; i < out.length; i++) out[i] = (a[i] || 0) + sign * (b[i] || 0);
    return trim(out);
  };
  const multiply = (a, b) => {
    if (a.length + b.length - 2 > MAX_DEGREE) throw new Error(`El polinomio excede el grado máximo ${MAX_DEGREE}.`);
    const out = Array(a.length + b.length - 1).fill(0);
    a.forEach((v, i) => b.forEach((w, j) => { out[i + j] += v * w; }));
    return trim(out);
  };
  const divideConstant = (a, n) => {
    if (Math.abs(n) < EPS) throw new Error('No se puede dividir entre cero.');
    return trim(a.map(v => v / n));
  };
  function tokenize(source) {
    let s = String(source || '').trim().toLowerCase()
      .replace(/[−–—]/g, '-') .replace(/[×·]/g, '*').replace(/÷/g, '/')
      .replace(/²/g, '^2').replace(/³/g, '^3').replace(/⁴/g, '^4')
      .replace(/,/g, '.').replace(/\b(?:f\s*\(\s*x\s*\)|y)\s*=/i, '');
    if (!s) throw new Error('Escribe una función, por ejemplo: x^3 - 3x^2 + 2.');
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      if (/\s/.test(s[i])) { i++; continue; }
      const rest = s.slice(i);
      const num = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
      if (num) { const n = Number(num[0]); if (!Number.isFinite(n)) throw new Error('Hay un número no válido en la función.'); tokens.push({ type: 'num', value: n }); i += num[0].length; continue; }
      if (s[i] === 'x') { tokens.push({ type: 'x' }); i++; continue; }
      if ('+-*/^()'.includes(s[i])) { tokens.push({ type: s[i] }); i++; continue; }
      throw new Error(`No reconozco el símbolo «${s[i]}». Usa x, números y operaciones + − × ÷ ^ y paréntesis.`);
    }
    // Multiplicación implícita en 2x, 3(x+1), x(x-1), (x+1)(x-1).
    const out = [];
    for (let k = 0; k < tokens.length; k++) {
      const current = tokens[k], previous = out[out.length - 1];
      if (previous && (previous.type === 'num' || previous.type === 'x' || previous.type === ')') &&
          (current.type === 'x' || current.type === '(' || (previous.type === ')' && current.type === 'num'))) out.push({ type: '*' });
      out.push(current);
    }
    return out;
  }
  function parsePolynomial(source) {
    const t = tokenize(source); let pos = 0;
    const peek = () => t[pos];
    const take = type => { if (!peek() || peek().type !== type) return false; pos++; return true; };
    function primary() {
      if (take('num')) return [t[pos - 1].value];
      if (take('x')) return [0, 1];
      if (take('(')) { const p = expression(); if (!take(')')) throw new Error('Falta cerrar un paréntesis.'); return p; }
      throw new Error('La función tiene una operación incompleta o un término no reconocido.');
    }
    function power() {
      let base = primary();
      while (take('^')) {
        const exponent = peek();
        if (!exponent || exponent.type !== 'num' || !Number.isInteger(exponent.value) || exponent.value < 0 || exponent.value > MAX_DEGREE) {
          throw new Error(`Usa exponentes enteros entre 0 y ${MAX_DEGREE}.`);
        }
        pos++;
        let result = [1], n = exponent.value;
        while (n > 0) { if (n % 2) result = multiply(result, base); n = Math.floor(n / 2); if (n) base = multiply(base, base); }
        base = result;
      }
      return base;
    }
    function unary() { if (take('+')) return unary(); if (take('-')) return unary().map(v => -v); return power(); }
    function term() {
      let left = unary();
      while (peek() && ['*', '/'].includes(peek().type)) {
        const op = t[pos++].type, right = unary();
        if (op === '*') left = multiply(left, right);
        else { const d = trim(right); if (d.length !== 1) throw new Error('Solo se permite dividir entre una constante distinta de cero.'); left = divideConstant(left, d[0]); }
      }
      return left;
    }
    function expression() {
      let left = term();
      while (peek() && ['+', '-'].includes(peek().type)) { const op = t[pos++].type; left = add(left, term(), op === '+' ? 1 : -1); }
      return left;
    }
    const p = trim(expression());
    if (pos !== t.length) throw new Error('No se pudo interpretar toda la función. Revisa operadores, paréntesis y exponentes.');
    if (p.length - 1 > MAX_DEGREE) throw new Error(`Solo se admiten polinomios de grado máximo ${MAX_DEGREE}.`);
    return p;
  }
  function derivative(p) { const a = trim(p); if (a.length <= 1) return [0]; return trim(a.slice(1).map((v, i) => v * (i + 1))); }
  function evaluate(p, x) { let y = 0; for (let i = p.length - 1; i >= 0; i--) y = y * x + p[i]; return y; }
  function polyScale(p, x) { const ax = Math.max(1, Math.abs(x)); return 1 + p.reduce((s, c, i) => s + Math.abs(c) * Math.pow(ax, i), 0); }
  function rootsInInterval(poly, lo, hi) {
    const p = trim(poly); const degree = p.length - 1;
    if (!(Number.isFinite(lo) && Number.isFinite(hi)) || lo >= hi) return [];
    if (degree <= 0) return [];
    if (degree === 1) { const r = -p[0] / p[1]; return r >= lo - 1e-9 && r <= hi + 1e-9 ? [Math.max(lo, Math.min(hi, r))] : []; }
    const critical = rootsInInterval(derivative(p), lo, hi).filter(x => x > lo + 1e-8 && x < hi - 1e-8);
    const points = [lo, ...critical, hi].sort((a, b) => a - b);
    const roots = [];
    const nearZero = x => Math.abs(evaluate(p, x)) <= 1e-8 * polyScale(p, x);
    points.forEach(x => { if (nearZero(x)) roots.push(x); });
    for (let i = 0; i < points.length - 1; i++) {
      let a = points[i], b = points[i + 1], fa = evaluate(p, a), fb = evaluate(p, b);
      if (nearZero(a) || nearZero(b) || fa * fb > 0) continue;
      for (let n = 0; n < 90 && b - a > 1e-10 * Math.max(1, Math.abs(a), Math.abs(b)); n++) {
        const m = (a + b) / 2, fm = evaluate(p, m);
        if (nearZero(m)) { a = b = m; break; }
        if (fa * fm <= 0) { b = m; fb = fm; } else { a = m; fa = fm; }
      }
      roots.push((a + b) / 2);
    }
    return roots.sort((a, b) => a - b).filter((x, i, arr) => i === 0 || Math.abs(x - arr[i - 1]) > 1e-5 * Math.max(1, Math.abs(x)));
  }
  function fmt(n, places = 5) {
    if (!Number.isFinite(n)) return '—';
    if (Math.abs(n) < 1e-9) return '0';
    return Number(n.toFixed(places)).toLocaleString('es-MX', { maximumFractionDigits: places, useGrouping: false });
  }
  function formatPolynomial(p) {
    p = trim(p); const parts = [];
    for (let i = p.length - 1; i >= 0; i--) {
      const c = p[i]; if (Math.abs(c) < EPS) continue;
      const abs = Math.abs(c), term = i === 0 ? fmt(abs, 6) : `${Math.abs(abs - 1) < EPS ? '' : fmt(abs, 6)}x${i > 1 ? `^${i}` : ''}`;
      if (!parts.length) parts.push((c < 0 ? '−' : '') + term);
      else parts.push((c < 0 ? ' − ' : ' + ') + term);
    }
    return parts.join('') || '0';
  }
  function analyze(source, min, max) {
    const lo = Number(min), hi = Number(max);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo >= hi) throw new Error('El intervalo debe tener un mínimo y un máximo numéricos, con mínimo menor que máximo.');
    if (hi - lo > 1e5 || Math.abs(lo) > 1e6 || Math.abs(hi) > 1e6) throw new Error('Usa un intervalo más acotado (ancho máximo 100 000 y |x| ≤ 1 000 000).');
    const f = parsePolynomial(source), d1 = derivative(f), d2 = derivative(d1), d3 = derivative(d2);
    const critical = rootsInInterval(d1, lo, hi).filter(x => x >= lo - 1e-8 && x <= hi + 1e-8);
    const span = hi - lo, delta = Math.max(1e-5, Math.min(span / 1000, 1e-3 * Math.max(1, Math.abs(lo), Math.abs(hi))));
    const points = critical.map(x => {
      const leftX = Math.max(lo, x - delta), rightX = Math.min(hi, x + delta);
      const l = evaluate(d1, leftX), r = evaluate(d1, rightX);
      let kind = 'Punto crítico estacionario';
      if (l > 1e-7 && r < -1e-7) kind = 'Máximo local';
      else if (l < -1e-7 && r > 1e-7) kind = 'Mínimo local';
      return { x, y: evaluate(f, x), kind, boundary: Math.abs(x - lo) < 1e-7 || Math.abs(x - hi) < 1e-7 };
    });
    const candidates = [{ x: lo, y: evaluate(f, lo), kind: 'Extremo del intervalo' }, { x: hi, y: evaluate(f, hi), kind: 'Extremo del intervalo' }, ...points.filter(p => p.x > lo + 1e-8 && p.x < hi - 1e-8)];
    const bestMin = Math.min(...candidates.map(p => p.y)), bestMax = Math.max(...candidates.map(p => p.y));
    const ties = (val) => candidates.filter(p => Math.abs(p.y - val) <= 1e-7 * Math.max(1, Math.abs(val)));
    const inflectionRoots = rootsInInterval(d2, lo, hi).filter(x => x > lo + 1e-7 && x < hi - 1e-7);
    const inflections = inflectionRoots.filter(x => {
      const d = Math.min(delta, (x - lo) / 2, (hi - x) / 2);
      const left = evaluate(d2, x - d), right = evaluate(d2, x + d);
      return (left < -1e-8 && right > 1e-8) || (left > 1e-8 && right < -1e-8);
    }).map(x => ({ x, y: evaluate(f, x), stationary: Math.abs(evaluate(d1, x)) < 1e-6 }));
    return { f, d1, d2, d3, min: lo, max: hi, critical: points, candidates, minimum: { value: bestMin, points: ties(bestMin) }, maximum: { value: bestMax, points: ties(bestMax) }, inflections };
  }
  const api = { parsePolynomial, derivative, evaluate, rootsInInterval, formatPolynomial, analyze, fmt, MAX_DEGREE };
  root.IOOptimizationMath = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
