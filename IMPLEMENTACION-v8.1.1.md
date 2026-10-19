# IO Solver v8.1.1 — Corrección del lector PERT/CPM

## Problema corregido
El intérprete podía confundir la descripción de una actividad con sus predecesoras al recibir filas extraídas de PDF, por ejemplo `A Elegir el tema — 2` o tablas con columnas `Actividad | Descripción | Predecesoras | Duración`.

## Cambio
- El parser ahora reconoce la columna de descripción y obtiene las predecesoras de la columna correspondiente.
- Para filas de texto sin separadores, usa la etiqueta final antes de la duración como predecesora cuando corresponde y trata una raya como ausencia de predecesoras.
- Se añadieron pruebas de regresión para ambos formatos.
- No se modificaron los motores de cálculo PERT/CPM ni se incorporó IA.

## Verificación ejecutada
- `tests/test_pert_import.js`: 7/7.
- `tests/test_route_shortest.js`: 7/7.
- `tests/test_optimization_math.js`: 6/6.
- `tests/test_transport_interpreter.js`: 11/11.
- `tests/test_teacher_transport_example.js`: aprobado.

Estas son pruebas automatizadas de lógica; no equivalen a una prueba visual end-to-end en navegador con los PDF originales.
