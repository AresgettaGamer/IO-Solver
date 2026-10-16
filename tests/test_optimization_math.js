'use strict';
const assert = require('node:assert/strict');
const M = require('../optimization-math.js');
let count = 0;
function test(name, fn) { fn(); count++; console.log(`✓ ${name}`); }
test('interpreta polinomios con multiplicación implícita y paréntesis', () => {
  assert.deepEqual(M.parsePolynomial('2x^2 - 3x + 4'),[4,-3,2]);
  assert.deepEqual(M.parsePolynomial('(x+1)(x-1)'),[-1,0,1]);
  assert.deepEqual(M.parsePolynomial('3(x+2)^2'),[12,12,3]);
});
test('deriva correctamente polinomios', () => {
  assert.deepEqual(M.derivative([1,9,-6,1]),[9,-12,3]);
  assert.equal(M.formatPolynomial(M.derivative([1,9,-6,1])),'3x^2 − 12x + 9');
});
test('encuentra raíces simples y raíces repetidas en un intervalo', () => {
  assert.ok(Math.abs(M.rootsInInterval([-1,0,1],-2,2)[0]+1)<1e-4);
  assert.ok(Math.abs(M.rootsInInterval([-1,0,1],-2,2)[1]-1)<1e-4);
  const repeated=M.rootsInInterval([0,0,1],-2,2); assert.equal(repeated.length,1); assert.ok(Math.abs(repeated[0])<1e-4);
});
test('obtiene máximos, mínimos e inflexión del ejemplo de validación', () => {
  const a=M.analyze('x^3 - 6x^2 + 9x + 1',0,5);
  assert.ok(a.critical.some(p=>p.kind==='Máximo local'&&Math.abs(p.x-1)<1e-4&&Math.abs(p.y-5)<1e-4));
  assert.ok(a.critical.some(p=>p.kind==='Mínimo local'&&Math.abs(p.x-3)<1e-4&&Math.abs(p.y-1)<1e-4));
  assert.ok(a.inflections.some(p=>Math.abs(p.x-2)<1e-4&&Math.abs(p.y-3)<1e-4));
  assert.equal(a.maximum.value,21); assert.ok(Math.abs(a.minimum.value-1)<1e-4);
});
test('usa el intervalo cerrado para extremos absolutos', () => {
  const a=M.analyze('x^2',-2,3); assert.equal(a.minimum.value,0); assert.equal(a.maximum.value,9);
});
test('rechaza expresiones no admitidas de forma segura', () => {
  assert.throws(()=>M.parsePolynomial('sin(x)'),/No reconozco/);
  assert.throws(()=>M.parsePolynomial('x^-2'),/exponentes enteros/);
  assert.throws(()=>M.parsePolynomial('x/0'),/dividir entre cero/);
  assert.throws(()=>M.analyze('x^2',4,4),/intervalo/);
});
console.log(`\n${count}/6 pruebas Optimización clásica aprobadas.`);
