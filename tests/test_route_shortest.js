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
test('detecta columnas reordenadas según encabezados semánticos', () => {
  const r = parseEdgeText(`Peso | Destino | Origen
4 | B | A
3 | C | B`);
  assert.deepEqual(r.edges,[{from:'A',to:'B',weight:4},{from:'B',to:'C',weight:3}]);
  assert.deepEqual(r.warnings,[]);
});
test('reconoce sinónimos de columnas aunque cambie el orden', () => {
  const r = parseEdgeText(`Nodo final | Tiempo | Nodo inicial
B | 2,5 | A
C | 1 | B`);
  assert.deepEqual(r.edges,[{from:'A',to:'B',weight:2.5},{from:'B',to:'C',weight:1}]);
});

test('ignora texto de diapositivas, pies de página y rutas narradas sin inventar conexiones', () => {
  const noisy = `1 Gemini Notebook\nLugares, puntos numéricos asignados que deben revisarse\nRuta A -> B -> D -> E. Cálculo: 4 + 5 + 3 = 12\nSolución 1: A > C (2) > D (2) > E (1). Costo = 9.\nPágina 3 de 20\nVeredicto: costo total = 25`;
  assert.throws(() => parseEdgeText(noisy), /No encontré aristas claramente identificadas/);
});
test('extrae conexiones explícitas y no advierte por los párrafos cercanos', () => {
  const mixed = `Ejercicio: La ruta más corta\nA -> B: 4\nRuta A -> B -> D -> E. Cálculo: 4 + 5 + 3 = 12\n1 Gemini Notebook\nB -> C: 2\nPágina 1 de 2`;
  const r = parseEdgeText(mixed);
  assert.deepEqual(r.edges, [{from:'A',to:'B',weight:4},{from:'B',to:'C',weight:2}]);
  assert.deepEqual(r.warnings, []);
});

console.log(`\n${count}/11 pruebas Ruta más corta aprobadas.`);
