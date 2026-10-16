# Pruebas de IO Solver v8.0.0

## Pruebas de lógica (Node.js)

Desde la raíz del proyecto, ejecuta:

```sh
node tests/test_route_shortest.js
node tests/test_optimization_math.js
node tests/test_pert_import.js
node tests/test_transport_interpreter.js
node tests/test_teacher_transport_example.js
```

También puedes comprobar la sintaxis de los archivos JavaScript de la aplicación:

```sh
find . -path './vendor' -prune -o -name '*.js' -type f -print0 | xargs -0 -n1 node --check
```

## Pruebas de interfaz (Playwright/Chromium)

Requieren Python, `playwright` y el navegador Chromium de Playwright:

```sh
python -m pip install playwright
python -m playwright install chromium
python tests/test_e2e_v800.py
```

La suite inicia un servidor HTTP en un puerto libre, comprueba el launcher y la navegación, la ruta más corta de ejemplo, el análisis de una función conocida y la revisión antes de aplicar importaciones de Transporte y PERT/CPM. No incluye una calificación de precisión del OCR con fotografías reales. Si un entorno bloquea el navegador o el acceso a `localhost`, la prueba de interfaz no se puede considerar ejecutada satisfactoriamente.

## Documentos de prueba

`fixtures/` contiene PDFs, PNG y JPEG sintéticos para probar extracción, OCR, tablas mixtas y errores. No representan todas las condiciones de cámaras reales, sombras, perspectiva ni escritura manuscrita. `make_fixtures.py` puede regenerarlos si están instalados Playwright para Python y Pillow.
