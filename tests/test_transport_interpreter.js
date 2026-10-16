// Pruebas unitarias del intérprete de transporte (texto plano, sin geometría): node tests/test_transport_interpreter.js
const TI = require('../transport-import.js'); const assert = require('assert'); let n = 0, pass = 0;
const t = (name, fn) => { n++; try { fn(); pass++; console.log('  ✔', name); } catch (e) { console.log('  ✘', name, '→', e.message); process.exitCode = 1; } };
const raw = m => ({ src: m.sources.map(s => s.label.raw), dst: m.destinations.map(d => d.label.raw), supply: m.sources.map(s => s.supply.raw), demand: m.destinations.map(d => d.demand.raw), costs: m.costs.map(r => r.map(c => c.forbidden ? 'X' : c.raw)) });
t('1. tabla con columna de oferta y fila de demanda', () => {
  const m = TI.interpret('Ejercicio 3: Transporte\nProblema de transporte.\nOrigen / Destino C1 C2 C3 C4 Oferta\nA 8 3 4 5 550\nB 7 6 5 2 300\nC 2 4 3 3 260\nDemanda 250 300 200 160\nPágina 1 · ref. 550');
  assert.deepStrictEqual(raw(m), { src: ['A', 'B', 'C'], dst: ['C1', 'C2', 'C3', 'C4'], supply: ['550', '300', '260'], demand: ['250', '300', '200', '160'], costs: [['8', '3', '4', '5'], ['7', '6', '5', '2'], ['2', '4', '3', '3']] });
  const v = TI.validate(m); assert.strictEqual(v.errors, 0); assert.deepStrictEqual(v.totals, { supply: 1110, demand: 910, difference: 200 });
  assert.strictEqual(m.name, 'Ejercicio 3: Transporte');
});
t('2. ofertas en el enunciado («respectivamente»), X en la tabla y ruta prohibida en el texto', () => {
  const m = TI.interpret('Ejercicio 6: Rutas imposibles\nUna compañía tiene tres fábricas A, B y C que producen 550, 300 y 260 unidades, respectivamente. Los cuatro clientes C1, C2, C3 y C4 demandan lo indicado en la tabla. No es posible transportar desde la fábrica B hasta el cliente C1.\nOrigen / Destino C1 C2 C3 C4\nA 8 3 4 5\nB X 6 5 2\nC 2 4 3 3\nDemanda 250 300 200 160');
  const r = raw(m); assert.deepStrictEqual(r.supply, ['550', '300', '260']); assert.deepStrictEqual(r.demand, ['250', '300', '200', '160']); assert.strictEqual(r.costs[1][0], 'X');
  assert.ok(m.sources.every(s => s.supply.flags.includes('from-text')), 'ofertas del enunciado deben quedar marcadas para confirmar');
  assert.strictEqual(m.forbiddenFromText.length, 1);
});
t('3. filas con etiqueta numérica', () => {
  const m = TI.interpret('Problema 1\nDestino D1 D2 D3 Oferta\n1 4 6 8 40\n2 5 3 7 60\nDemanda 30 40 30');
  const r = raw(m); assert.deepStrictEqual(r.src, ['1', '2']); assert.deepStrictEqual(r.costs, [['4', '6', '8'], ['5', '3', '7']]); assert.deepStrictEqual(r.supply, ['40', '60']);
});
t('4. celda vacía → incompleto (no se inventa)', () => {
  const m = TI.interpret('Ejercicio 1\nOrigen D1 D2 D3 Oferta\nA 4 6 8 40\nB 5 3 60\nDemanda 30 40 30');
  const v = TI.validate(m); assert.ok(v.errors > 0); assert.ok(v.issues.some(i => i.category === 'incompleto' && i.code === 'missing'), JSON.stringify(v.issues.map(i => i.code)));
});
t('5. símbolo mal reconocido («5O») → lectura, con sugerencia pero sin aplicarla', () => {
  const m = TI.interpret('Ejercicio 1\nOrigen D1 D2 Oferta\nA 4 6 5O\nB 5 3 60\nDemanda 50 60');
  assert.strictEqual(m.sources[0].supply.raw, '5O'); assert.strictEqual(m.sources[0].supply.suggestion, '50');
  const v = TI.validate(m); assert.ok(v.issues.some(i => i.category === 'lectura' && i.code === 'unreadable')); assert.strictEqual(v.canApply, false);
});
t('6. total impreso que no coincide → advertencia de lectura', () => {
  const m = TI.interpret('Ejercicio 2\nOrigen D1 D2 Oferta\nA 4 6 50\nB 5 3 60\nDemanda 50 70 130');
  const v = TI.validate(m); assert.ok(v.issues.some(i => i.code === 'total-mismatch'), JSON.stringify(v.issues));
});
t('7. sin tabla → error de modelo incompleto', () => { const m = TI.interpret('Ejercicio 1\nUna empresa envía productos desde dos fábricas a tres clientes.'); assert.strictEqual(m.ok, false); assert.strictEqual(m.issues[0].category, 'incompleto'); });
t('8. modelo inviable por rutas prohibidas → categoría «inviable»', () => {
  const m = TI.interpret('Ejercicio 4\nOrigen D1 D2 Oferta\nA X 6 50\nB X 3 60\nDemanda 50 60');
  const v = TI.validate(m); assert.ok(v.issues.some(i => i.category === 'inviable'), JSON.stringify(v.issues.map(i => i.code))); assert.strictEqual(v.canApply, false);
});
t('9. costo 0 válido y distinto de ruta prohibida', () => {
  const m = TI.interpret('Ejercicio 5\nOrigen D1 D2 Oferta\nA 0 6 50\nB 5 0 60\nDemanda 50 60');
  const e = TI.toEditorModel(m); assert.deepStrictEqual(e.forbidden, [[false, false], [false, false]]); assert.deepStrictEqual(e.costs, [['0', '6'], ['5', '0']]);
});
t('10. demanda mayor que oferta → solo informa (el módulo balancea)', () => {
  const m = TI.interpret('Ejercicio 5\nOrigen D1 D2 Oferta\nA 1 2 40\nB 3 4 40\nDemanda 50 60');
  const v = TI.validate(m); assert.ok(v.canApply); assert.ok(v.issues.some(i => i.code === 'balance' && /fuente ficticia/.test(i.message)));
});
t('11. cifra OCR de confianza muy baja bloquea hasta confirmarla (geometría + confianza)', () => {
  const mk = (text, x, y, conf) => ({ text, x0: x, x1: x + 20, y0: y, y1: y + 12, conf, src: 'ocr' });
  const row = (y, items) => ({ text: items.map(i => i[0]).join(' '), tokens: items.map(([tx, x, c]) => mk(tx, x, y, c)), y0: y, y1: y + 12 });
  const block = { text: 'Ejercicio 1', lines: [row(0, [['Ejercicio', 0, 95], ['1', 60, 95]]), row(30, [['O', 0, 90], ['D1', 80, 90], ['D2', 140, 90], ['Oferta', 200, 90]]), row(60, [['A', 0, 90], ['4', 80, 90], ['6', 140, 40], ['50', 200, 90]]), row(90, [['B', 0, 90], ['5', 80, 90], ['3', 140, 90], ['60', 200, 90]]), row(120, [['Demanda', 0, 90], ['50', 80, 90], ['60', 140, 90]])] };
  const m = TI.interpret(block); const v = TI.validate(m);
  assert.strictEqual(m.costs[0][1].raw, '6'); assert.ok(v.issues.some(i => i.code === 'confirm-needed'), JSON.stringify(v.issues.map(i => i.code))); assert.strictEqual(v.canApply, false);
  m.costs[0][1].flags = []; assert.strictEqual(TI.validate(m).canApply, true);
});
console.log(`\n${pass}/${n} pruebas del intérprete OK`);
