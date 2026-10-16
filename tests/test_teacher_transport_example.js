'use strict';
// Regresión del ejemplo de clase (texto pegado/transcrito) para el intérprete de Transporte.
const assert = require('node:assert/strict');
const TI = require('../transport-import.js');
const input = `Tres fábricas envían su producto a cinco distribuidores. Las disponibilidades, los requerimientos y costos unitarios de transporte se dan en la tabla.
NOTA: La X significa que desde la fábrica 3 es imposible enviar unidades al distribuidor 5.
FABRICAS 1 2 3 4 5 DISPONIBILIDADES
1 20 19 14 21 16 40
2 15 20 13 19 16 60
3 18 15 18 20 X 70
REQUERIMIENTOS 30 40 50 60 40`;
const model = TI.interpret(input);
assert.equal(model.ok, true, 'el ejemplo debe producir una matriz revisable');
assert.deepEqual(model.sources.map(x => x.label.raw), ['1', '2', '3']);
assert.deepEqual(model.sources.map(x => x.supply.raw), ['40', '60', '70']);
assert.deepEqual(model.destinations.map(x => x.label.raw), ['1', '2', '3', '4', '5']);
assert.deepEqual(model.destinations.map(x => x.demand.raw), ['30', '40', '50', '60', '40']);
assert.deepEqual(model.costs.map(r => r.map(c => c.forbidden ? 'X' : c.raw)), [
  ['20', '19', '14', '21', '16'],
  ['15', '20', '13', '19', '16'],
  ['18', '15', '18', '20', 'X'],
]);
const validation = TI.validate(model);
assert.equal(validation.canApply, true, 'un déficit de oferta se balancea después; no vuelve inválido el modelo');
assert.equal(validation.totals.supply, 170);
assert.equal(validation.totals.demand, 220);
assert.equal(validation.totals.difference, -50);
assert.ok(validation.issues.some(x => x.code === 'balance' && /fuente ficticia/.test(x.message)));
console.log('✔ Ejemplo de la maestra: 3 × 5 exacto, ruta prohibida y fuente ficticia de 50');
