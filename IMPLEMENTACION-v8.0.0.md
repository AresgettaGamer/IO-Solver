# IO Solver v8.0.0 — Registro de cierre

## Objetivo de la versión

Cerrar la beta funcional principal de IO Solver antes de iniciar el trabajo de IA visual y Lexa Mini previsto para la versión v8.1.0. Esta versión no incorpora un modelo generativo ni envía documentos a una API de IA.

## Módulos incluidos

1. **Simplex:** conserva el motor matemático existente y la importación con revisión previa.
2. **PERT / CPM:** conserva el flujo de proyectos JSON y añade un borrador editable de actividades desde texto pegado, PDF o imagen. La importación no calcula automáticamente.
3. **Modelos de transporte:** conserva Esquina Noroeste, Costo Mínimo, balanceo, rutas prohibidas y desempates. Admite archivos y texto pegado; el modelo se revisa antes de aplicarlo y aplicar no resuelve.
4. **Ruta más corta:** editor de redes, conexión por texto/documento, grafo, procedimiento de Dijkstra y ruta mínima. Dijkstra exige pesos no negativos.
5. **Optimización clásica:** análisis numérico de polinomios de una variable hasta grado 8, derivadas, candidatos críticos, extremos absolutos en un intervalo cerrado y puntos de inflexión confirmados por cambio de concavidad.

## Límites intencionales

- La importación de PDF con texto seleccionable es la ruta más fiable.
- El OCR de escaneos, fotos, tablas que son imágenes y escritura manuscrita continúa en **beta**. Todos los resultados importados deben revisarse.
- Ruta más corta usa Dijkstra y por eso rechaza pesos negativos.
- Optimización clásica no formula por sí sola funciones a partir de enunciados narrativos, no soporta todavía funciones no polinómicas, optimización multivariable ni multiplicadores de Lagrange.
- El intérprete de PERT/CPM es heurístico y no reemplaza la revisión de nombres, predecesoras y duraciones.
- IA visual y el asistente conversacional tipo Lexa Mini quedan para v8.1.0. No se han incluido claves API.

## Pruebas de lógica ejecutadas en esta revisión

| Prueba | Resultado |
|---|---:|
| `node tests/test_route_shortest.js` | 7/7 |
| `node tests/test_optimization_math.js` | 6/6 |
| `node tests/test_pert_import.js` | 5/5 |
| `node tests/test_transport_interpreter.js` | 11/11 |
| `node tests/test_teacher_transport_example.js` | Aprobada |
| `node --check` sobre los archivos JavaScript del proyecto (excluyendo `vendor/`) | Sin errores de sintaxis |

La prueba del ejemplo de la maestra comprueba la matriz de 3 fábricas × 5 distribuidores, la ruta prohibida y el déficit de oferta de 50 unidades (oferta 170, demanda 220). El balanceo efectivo sigue perteneciendo al módulo de Transporte.

## Pruebas de interfaz

Se incluye `tests/test_e2e_v800.py`, una suite portátil de Playwright/Chromium que inicia su propio servidor HTTP en un puerto libre. En este entorno de revisión no fue posible completar una ejecución independiente del navegador local debido a una restricción del entorno (`ERR_BLOCKED_BY_ADMINISTRATOR`); por lo tanto, la suite está preparada para ejecutarse por el desarrollador, pero no se declara como aprobada en este registro. Consultar `tests/README.md` para las instrucciones.

## Limpieza para el repositorio

Se eliminaron scripts de validación que contenían rutas absolutas al entorno privado de Claude y referencias a una copia de v7.10.3 que no forma parte de este paquete. Se conservaron los documentos sintéticos de `tests/fixtures/` y las pruebas reproducibles de lógica.
