'use strict';
const assert = require('node:assert/strict');
const { computeShortestPath, parseEdgeText } = require('../route-shortest-math.js');
let count = 0;
function test(name, fn) { fn(); count++; console.log(`✓ ${name}`); }
test('encuentra el camino de menor peso y conserva el procedimiento', () => {
  const edges = [ ['A','B',4],['A','C',2],['C','B',1],['B','D',5],['C','D',8],['C','E',10],['D','E',2] ].map(([from,to,weight])=>({from,to,weight}));
  const r = computeShortestPath(edges,'A','E',false);
  assert.deepEqual(r.path,['A','C','B','D','E']); assert.equal(r.distance,10); assert.ok(r.steps.length >= 4);
});
test('respeta una red dirigida', () => {
  const r=computeShortestPath([{from:'A',to:'B',weight:2}], 'B','A',true);
  assert.equal(r.reachable,false); assert.equal(r.distance,Infinity);
});
test('permite peso cero y normaliza etiquetas que solo difieren en mayúsculas', () => {
  const r=computeShortestPath([{from:'a',to:'B',weight:0},{from:'B',to:'C',weight:2}], 'A','c',false);
  assert.equal(r.distance,2); assert.deepEqual(r.path,['a','B','C']);
});
test('rechaza pesos negativos', () => assert.throws(()=>computeShortestPath([{from:'A',to:'B',weight:-1}],'A','B'),/no negativos/));
test('diagnostica origen o destino inexistente', () => assert.throws(()=>computeShortestPath([{from:'A',to:'B',weight:1}],'Z','B'),/nodos detectados/i));
test('interpreta conexiones tabuladas, flechas y lenguaje breve', () => {
  const r=parseEdgeText('Origen Destino Peso\nA -> B: 4\nDesde B hasta C costo 3\nC;D;2');
  assert.deepEqual(r.edges,[{from:'A',to:'B',weight:4},{from:'B',to:'C',weight:3},{from:'C',to:'D',weight:2}]);
});
test('informa cuando no se detectan conexiones', () => assert.throws(()=>parseEdgeText('Solo una descripción sin pesos'),/No encontré aristas/));
console.log(`\n${count}/7 pruebas Ruta más corta aprobadas.`);
