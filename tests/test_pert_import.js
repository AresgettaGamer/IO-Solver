'use strict';
const assert = require('node:assert/strict');
const { parseActivityText } = require('../pert-import-math.js');
let count=0; function test(name,fn){fn();count++;console.log(`✓ ${name}`)}
test('interpreta actividades CPM con precedencias y duración fija',()=>{
 const r=parseActivityText('Actividad | Predecesoras | Duración\nA | — | 3\nB | A | 4\nC | A | 2\nD | B, C | 5');
 assert.equal(r.rows.length,4); assert.equal(r.hasPertEstimates,false); assert.deepEqual(r.rows.map(x=>x.pred),['','A','A','B, C']); assert.deepEqual(r.rows.map(x=>Number(x.duration)),[3,4,2,5]);
});
test('interpreta estimaciones optimista, más probable y pesimista',()=>{
 const r=parseActivityText('Actividad;Predecesoras;Duración;O;M;P\nA;;3;2;3;5\nB;A;4;3;4;7');
 assert.equal(r.hasPertEstimates,true); assert.deepEqual(r.rows.map(x=>[x.name,Number(x.o),Number(x.m),Number(x.p)]),[['A',2,3,5],['B',3,4,7]]);
});
test('calcula duración esperada cuando el texto contiene solo O, M y P',()=>{
 const r=parseActivityText('Actividad | Predecesoras | O | M | P\nA | — | 2 | 3 | 5\nB | A | 3 | 4 | 7');
 assert.ok(Math.abs(Number(r.rows[0].duration)-19/6)<1e-8); assert.ok(Math.abs(Number(r.rows[1].duration)-26/6)<1e-8);
});
test('avisa cuando las predecesoras no aparecen entre las actividades',()=>{
 const r=parseActivityText('A | — | 2\nB | X | 3'); assert.ok(r.warnings.some(w=>w.includes('X')));
});
test('rechaza tablas con menos de dos actividades o nombres repetidos',()=>{
 assert.throws(()=>parseActivityText('A | — | 2'),/al menos dos actividades/);
 assert.throws(()=>parseActivityText('A | — | 2\nA | — | 3'),/repetido/);
});
test('separa descripción de actividad y predecesoras en filas extraídas de PDF',()=>{
 const r=parseActivityText('Actividad | Descripción | Predecesoras | Duración\nA | Elegir el tema | — | 2\nB | Investigar información | A | 3\nC | Elaborar diapositivas | B | 4\nD | Preparar la exposición | C | 2');
 assert.equal(r.rows.length,4); assert.deepEqual(r.rows.map(x=>x.pred),['','A','B','C']); assert.deepEqual(r.warnings,[]);
});
test('interpreta filas sin separadores con descripción y predecesora final',()=>{
 const r=parseActivityText('A Elegir el tema — 2\nB Investigar información A 3\nC Elaborar diapositivas B 4\nD Preparar la exposición C 2');
 assert.equal(r.rows.length,4); assert.deepEqual(r.rows.map(x=>x.pred),['','A','B','C']); assert.deepEqual(r.warnings,[]);
});
console.log(`\n${count}/7 pruebas Importación PERT/CPM aprobadas.`);
