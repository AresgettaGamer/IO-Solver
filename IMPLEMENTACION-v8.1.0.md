# IO Solver v8.1.0 — Parche del lector PERT/CPM

## Alcance

Esta versión corrige el flujo de importación de PERT/CPM para documentos que contienen varios ejercicios. No incorpora el trabajo de IA previsto para v8.2.0.

## Cambio principal

`pert.js` detecta encabezados explícitos del tipo `Ejercicio 1. ...` o `Problema 1: ...`, separa los bloques y trata de interpretar cada bloque por separado. Si al menos dos bloques contienen actividades válidas, aparece un selector de ejercicios con título, cantidad de actividades y clasificación estimada (PERT con O/M/P o CPM/duración fija). Al elegir uno, se muestra la vista de revisión editable existente.

## Seguridad de datos y cálculo

- La selección no aplica datos al proyecto.
- «Aplicar actividades» sigue siendo una acción explícita y validada.
- No se ejecuta el cálculo automáticamente.
- Los flujos de texto, imagen, PDF y proyectos JSON existentes se conservan.

## Límites conocidos

La segmentación depende de encabezados de ejercicio explícitos en el texto extraído. No es un detector semántico general: documentos con encabezados atípicos, tablas fragmentadas o escaneos con OCR deficiente pueden no segmentarse correctamente. En esos casos permanece disponible el texto pegado y la revisión manual.

## Validación ejecutada

- `node --check pert.js`: correcto.
- `node tests/test_pert_import.js`: 5/5.
- `node tests/test_route_shortest.js`: 7/7.
- `node tests/test_optimization_math.js`: 6/6.
- `node tests/test_transport_interpreter.js`: 11/11.

No se declara validación visual completa en navegador en esta ejecución. La lista de selección debe verificarse manualmente en el navegador al probar los dos PDFs de referencia.
