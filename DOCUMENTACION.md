# IO Solver v4.0 — Documentación técnica y guía de explicación

## 1. ¿Qué es el programa?

IO Solver es una aplicación web educativa para Investigación de Operaciones organizada en dos módulos independientes: Simplex y PERT / CPM. El módulo Simplex conserva el flujo de resolución y explicación de programación lineal desarrollado para el proyecto principal; el módulo PERT / CPM funciona como un complemento para la exposición, orientado a la planeación de proyectos y el análisis de redes de actividades.

El flujo general es:

1. Introducir o importar un problema.
2. Construir o interpretar el modelo matemático.
3. Estandarizar las restricciones.
4. Construir el tableau inicial.
5. Seleccionar variable entrante y variable saliente.
6. Identificar el pivote.
7. Normalizar la fila pivote.
8. Hacer cero el resto de la columna pivote mediante operaciones de fila.
9. Repetir las iteraciones hasta alcanzar el criterio de optimalidad o detectar una condición especial.
10. Extraer y comprobar la solución.
11. Cuando el problema es apto, comparar con el método gráfico.

---

## 2. Archivos del proyecto

### index.html

Es la estructura visual de la aplicación. Define los controles, formularios, secciones, botones, áreas de texto, paneles de resultados y contenedores donde JavaScript inserta las tablas y gráficos.

Partes importantes:

- Cabecera principal y controles de apariencia.
- Guía rápida del procedimiento.
- Formulario para crear el modelo manualmente.
- Sección para importar PDF.
- Área para pegar texto y analizarlo.
- Sección de resultados.
- Sección opcional del método gráfico.
- Sección del procedimiento paso a paso.

No contiene la matemática principal del Simplex; esa responsabilidad está en `simplex.js`.

### style.css

Contiene toda la presentación visual: distribución, tamaños, tipografías, tarjetas, tablas, botones, formularios, estados, gráficos y temas claro/oscuro.

Usa variables CSS para que un mismo componente pueda cambiar de aspecto sin modificar el código matemático.

Ejemplos de variables visuales:

- `--panel`
- `--panel-soft`
- `--input-bg`
- `--text`
- `--muted`
- `--border`
- `--accent`
- `--accent-soft`

El tema oscuro se activa mediante `data-theme="dark"`. Los colores de acento se controlan con `data-accent`.

### simplex.js

Es el archivo principal del módulo Simplex. Se encarga de la entrada de datos, formulación, estandarización, algoritmo Simplex, dos fases, verificación, método gráfico, interpretación semántica, lectura de PDF y conexión de los controles de la interfaz.

### app.js

Controla la experiencia común de IO Solver: launcher, selección entre módulos, navegación de regreso y preferencias de apariencia. También conserva en `localStorage` el tema (Sistema, Claro u Oscuro) y el color de acento (Azul, Turquesa o Violeta).

### pert.js

Contiene la lógica del módulo PERT / CPM: edición de actividades, validación de precedencias, cálculo de tiempos tempranos y tardíos, holguras, rutas críticas, red, Gantt, Modo PERT, análisis estadístico, modo aprendizaje, gestión de proyectos y generación de reportes.

---

## 3. Estado general del programa

Al inicio se define un objeto `state` con valores como:

- número de variables;
- número de restricciones;
- maximización/minimización;
- condición de no negatividad.

También se guardan temporalmente el último problema y el último resultado para poder reutilizarlos, especialmente para el gráfico y la interfaz de resultados.

---

## 4. Generación del editor

### `clampInt()`

Limita valores enteros dentro de un rango permitido y usa un valor de respaldo si la entrada no es válida.

Se usa para evitar cantidades imposibles de variables o restricciones.

### `setCounts()`

Actualiza el número de variables y restricciones seleccionado por el usuario y vuelve a construir el editor.

### `makeInput()`

Genera controles de entrada reutilizables para coeficientes, variables y otros valores del modelo.

### `renderEditor()`

Construye dinámicamente el formulario matemático. Esto permite que el programa pase, por ejemplo, de 2 variables y 3 restricciones a otra cantidad sin escribir manualmente cada campo.

---

## 5. Lectura y limpieza numérica

### `parseFinite()`

Convierte una entrada a número y evita valores no finitos.

### `clean()` y `nearlyZero()`

Ayudan a trabajar con errores pequeños de coma flotante. Por ejemplo, un resultado como `0.00000000001` puede tratarse como cero cuando matemáticamente debería ser cero.

### `formatDecimal()`, `decimalToFraction()` y `formatNumber()`

Se utilizan para mostrar resultados de manera legible. El programa intenta representar fracciones exactas o aproximadas cuando esto mejora la lectura de las tablas.

### `gcd()`

Calcula un máximo común divisor aproximado para ayudar a simplificar fracciones.

---

## 6. Construcción del modelo matemático

### `buildObjectiveEquation()`

Genera visualmente la función objetivo.

Ejemplo:

`Max Z = 40X1 + 30X2`

### `buildConstraintEquation()`

Genera la representación legible de cada restricción original.

### `buildStandardizedConstraint()`

Genera la forma estándar de una restricción al incorporar variables de holgura, exceso o artificiales según sea necesario.

### `buildDomainStatement()`

Explica las condiciones de dominio, especialmente la no negatividad.

### `buildPreparationNotes()`

Construye el texto educativo que aparece antes del tableau para explicar qué preparó el programa y por qué.

---

## 7. Estandarización

### `standardize()`

Es una de las funciones matemáticas más importantes.

Transforma las restricciones a una forma que pueda ser procesada por el tableau. Dependiendo del operador:

- `<=` puede requerir una variable de holgura `S`.
- `>=` puede requerir una variable de exceso `E` y una artificial `A`.
- `=` puede requerir una variable artificial `A` para formar una base inicial.

También considera el signo del lado derecho.

La idea fundamental es que el método Simplex trabaja con ecuaciones y una estructura tabular donde se identifica una base.

---

## 8. Tableau y objetivo

### `setObjectiveFromCoefficients()`

Coloca los coeficientes de la función objetivo en la fila correspondiente del tableau según la etapa actual.

### `runSimplex()`

Ejecuta el ciclo principal del algoritmo Simplex:

1. Revisar la fila objetivo.
2. Buscar una variable entrante.
3. Buscar la variable saliente mediante la prueba de razón.
4. Hacer el pivote.
5. Guardar la iteración y sus pasos.
6. Repetir hasta obtener solución óptima o una condición especial.

---

## 9. Explicación de una iteración

### `chooseEnteringColumn()`

Selecciona la columna pivote.

Para la convención de maximización utilizada en clase, se busca el coeficiente negativo de la fila objetivo que determina la mejora de la función objetivo.

Si no existen coeficientes negativos en la fila objetivo, se alcanza el criterio de optimalidad usado por esta convención.

### `chooseLeavingRow()`

Aplica la prueba de razón utilizando solamente coeficientes positivos de la columna pivote.

Se calcula, para las filas válidas:

`RHS / coeficiente de la columna pivote`

La menor razón positiva determina la fila pivote.

Si no existe una razón positiva válida, el problema puede ser no acotado en esa dirección.

### `pivot()`

Realiza la operación algebraica del pivote:

1. Divide toda la fila pivote entre el elemento pivote para convertirlo en `1`.
2. Utiliza operaciones de fila para convertir en `0` los demás elementos de la columna pivote.

---

## 10. Visualización matemática de las operaciones

### `buildPivotSteps()`

Genera los pasos educativos de una iteración.

Muestra:

- fila pivote;
- columna pivote;
- elemento pivote;
- normalización;
- operaciones de eliminación sobre otras filas.

### `formatOperationFactor()`

Convierte el factor numérico de una operación a una forma comprensible para el usuario.

### `rowVectorLabel()`

Genera una representación de la fila utilizada para explicar la transformación.

### `renderArithmeticDetails()`

Construye la sección desplegable donde se muestran las operaciones aritméticas columna por columna.

Por ejemplo, en lugar de mostrar solamente una transformación final, puede enseñar operaciones del tipo:

`1/2 - (1/2)(1) = 0`

`6 - (1/2)(4) = 4`

La finalidad es que el usuario pueda comprobar cómo se obtuvo cada número de la nueva fila.

---

## 11. Explicación de por qué se toma una variable

### `buildEnteringReason()`

Genera la explicación textual de la elección de la variable entrante.

Ejemplo conceptual:

`X1 = -1` y `X2 = -3/2`.

Como `-3/2` es menor que `-1`, X2 es el coeficiente más negativo y se selecciona como variable entrante dentro de esta convención.

Esta función evita que el programa solamente diga qué variable eligió; también explica por qué.

---

## 12. Método de dos fases

### `initializePhaseOne()`

Prepara la primera fase cuando existen variables artificiales.

### `cleanupArtificialBasis()`

Elimina de la base las artificiales que ya no deben permanecer en el modelo original cuando esto es posible.

### `solveTwoPhase()`

Coordina la resolución completa:

- si no existen artificiales, resuelve directamente;
- si existen artificiales, ejecuta Fase I y después Fase II cuando procede;
- si la Fase I demuestra que no existe una solución factible, devuelve el diagnóstico de problema infactible.

### ¿Qué es una variable artificial?

No representa una cantidad real del problema. Se introduce temporalmente para construir una base inicial cuando una restricción `>=` o `=` no proporciona por sí misma una variable básica apropiada.

En la Fase I se intenta llevar la suma de artificiales a cero. Si no se puede, el modelo original es infactible.

---

## 13. Extracción y comprobación de la solución

### `extractOriginalSolution()`

Lee el tableau final y reconstruye los valores de las variables originales.

### `evaluateOriginalObjective()`

Evalúa la función objetivo original con la solución calculada.

### `feasibilityCheck()`

Comprueba cada restricción original con la solución obtenida y verifica la condición de no negatividad cuando está activa.

Esta etapa es importante porque la respuesta final no se acepta sin revisar el modelo original.

---

## 14. Método gráfico

El método gráfico está pensado para problemas con exactamente dos variables y no negatividad activada.

### `isFeasiblePoint()`

Determina si un punto satisface todas las restricciones.

### `lineIntersection()`

Calcula la intersección de dos rectas.

### `graphVertices()`

Obtiene los puntos candidatos de la región factible a partir de las intersecciones de las restricciones y los ejes.

### `graphBounds()`

Determina los límites visibles del gráfico.

### `svgPoint()`

Convierte coordenadas matemáticas en coordenadas del SVG.

### `objectiveSegment()`

Construye la recta correspondiente a un valor concreto de Z.

### `graphZRange()`

Calcula un rango útil para el control de la recta de Z.

### `renderGraph()`

Dibuja:

- región factible;
- restricciones;
- ejes;
- recta de Z;
- punto óptimo;
- leyenda.

La recta de Z puede moverse mediante el control deslizante para visualizar cómo se desplaza la función objetivo.

---

## 15. Interpretación de lenguaje natural

### `normalizeProblemText()`

Normaliza el texto extraído para facilitar el reconocimiento de patrones.

### `splitPdfExercises()`

Separa el texto de un documento en ejercicios. Se diseñó para detectar encabezados reales del tipo `Ejercicio 1`, `Ejercicio 2`, etc., y evitar que números dentro del enunciado sean confundidos con nuevos ejercicios.

### `parseVariableToken()`

Reconoce tokens que representan variables.

### `normalizeEquationLine()`

Limpia y normaliza expresiones matemáticas extraídas como texto.

### `parseLinearExpression()`

Intenta obtener coeficientes y variables de expresiones lineales explícitas.

### `parseConstraintFromLine()`

Interpreta una restricción matemática y separa coeficientes, operador y lado derecho.

### `parseObjectiveFromLine()`

Detecta la función objetivo y su tipo.

### `parseMoney()` y `parseNumberLoose()`

Ayudan a reconocer cantidades monetarias y números que pueden venir con distintos formatos de texto.

### `pairNamesFromText()`

Relaciona variables con descripciones del enunciado, por ejemplo `X1 = Video 4K` y `X2 = Música HD`.

### `naturalLanguageModel()`

Aplica reglas semánticas para intentar construir un modelo desde lenguaje natural.

Entre los patrones considerados están:

- costos y utilidades;
- presupuestos;
- capacidades;
- porcentajes;
- proporciones;
- expresiones como “al menos” y “no superar”;
- conversiones de unidades;
- recursos y cantidades disponibles.

### `extractModelFromText()`

Decide qué ruta utilizar: ecuaciones explícitas o interpretación semántica.

### `makeSemanticModel()`

Construye una estructura interna común para que el motor Simplex no necesite saber si el modelo vino de un formulario, un PDF o lenguaje natural.

---

## 16. Importación de PDF

### `ensurePdfJs()`

Prepara la librería usada para leer texto de PDF cuando se requiere.

### `extractPdfText()`

Extrae el texto seleccionable del PDF.

Importante: un PDF escaneado como imagen puede no contener texto seleccionable. En ese caso el programa informa que no puede extraer el contenido automáticamente.

### `analyzeTextInput()`

Procesa el texto extraído y presenta los ejercicios candidatos.

---

## 17. Revisión manual y asistencia

### `modelPreviewHtml()`

Construye la vista previa del modelo detectado para que el usuario pueda revisarlo antes de resolverlo.

### `importModelIntoEditor()`

Pasa un modelo validado al editor manual.

### `renderCandidates()`

Muestra los ejercicios que el parser logró detectar.

### `openManualInterpretation()`

Abre un formulario para revisar o editar manualmente el texto/modelo cuando la interpretación automática no es suficientemente segura.

### `prepareAiPrompt()`

Prepara un texto de contexto para solicitar una interpretación asistida. No sustituye la revisión humana y, en esta versión, funciona como generador de contexto/prompt; no implementa por sí solo un modelo de IA externo.

---

## 18. Eventos de la interfaz

Al final de `simplex.js` se conectan los controles con sus acciones.

Ejemplos:

- cambiar número de variables → reconstruye el editor;
- cambiar número de restricciones → reconstruye el editor;
- cambiar maximización/minimización → actualiza el editor;
- activar/desactivar no negatividad → actualiza el estado;
- cargar ejemplo → rellena un problema de prueba;
- analizar texto → ejecuta el parser;
- seleccionar PDF → extrae y analiza el documento;
- resolver → lee el modelo, ejecuta Simplex y renderiza el resultado;
- activar el gráfico → genera la vista gráfica;
- mover la barra de Z → actualiza la recta de la función objetivo;
- activar/desactivar modo aprendizaje → muestra u oculta detalles educativos.

---

## 19. Apariencia y temas

La función `initAppearance()` mantiene la lógica de interfaz separada del motor matemático.

Permite elegir:

- Sistema;
- Claro;
- Oscuro.

También permite elegir un color de acento:

- Azul;
- Turquesa;
- Violeta.

La selección se guarda en `localStorage` para conservar la preferencia al volver a abrir la aplicación.

Separar esta lógica del motor matemático evita mezclar cálculos con presentación.

---

## 20. ¿Cómo se ve el flujo visual?

La interfaz está organizada como una secuencia lógica:

`Configuración → Modelo → Importación → Resultado → Método gráfico → Procedimiento`

El usuario puede trabajar de dos maneras:

### Ruta manual

Configura variables y restricciones → escribe coeficientes → resuelve.

### Ruta desde documento

Carga PDF o pega texto → programa separa ejercicios → intenta formular el modelo → usuario revisa → programa resuelve.

---

## 21. ¿Cómo explicar el programa en una exposición?

Una explicación clara puede ser:

“Primero el programa recibe el modelo de programación lineal. Después convierte las restricciones a una forma adecuada para el método Simplex y construye el tableau inicial. En cada iteración selecciona la variable entrante utilizando la fila objetivo, calcula las razones para encontrar la variable saliente, identifica el pivote y aplica operaciones elementales de fila para obtener el siguiente tableau. Guarda cada iteración para mostrar el procedimiento al usuario. Cuando ya no existe un coeficiente que indique una mejora en la fila objetivo, determina la solución óptima. Después verifica la solución contra las restricciones originales. Cuando hay restricciones que requieren variables artificiales, utiliza dos fases. Para dos variables también ofrece una comprobación gráfica.”

---

## 22. Preguntas típicas que pueden hacer

### “¿Cuál es la parte más importante del programa?”

El motor del Simplex (`runSimplex`, `chooseEnteringColumn`, `chooseLeavingRow` y `pivot`) porque allí se automatiza el procedimiento matemático.

### “¿Cómo sabe qué variable entra?”

Revisa los coeficientes de la fila objetivo y utiliza el criterio de la convención adoptada para la maximización.

### “¿Cómo sabe cuál sale?”

Realiza la prueba de razón usando solamente coeficientes positivos de la columna pivote y toma la menor razón positiva.

### “¿Qué es el pivote?”

Es el elemento localizado en la intersección de la columna pivote y la fila pivote. Primero se convierte en 1 y después el resto de la columna se convierte en 0.

### “¿Por qué aparece una variable artificial?”

Porque ciertas restricciones `>=` o `=` no proporcionan directamente una variable básica adecuada para iniciar el tableau.

### “¿Por qué hay dos fases?”

La Fase I comprueba si las variables artificiales pueden eliminarse hasta dejar suma cero. Después la Fase II optimiza la función objetivo original.

### “¿El programa realmente entiende lenguaje natural?”

Tiene un interpretador heurístico basado en reglas. No se presenta como infalible: muestra el modelo detectado y permite corregirlo o solicitar una interpretación asistida.

### “¿Qué pasa si no puede interpretar el ejercicio?”

Se ofrece revisión manual. El usuario puede editar el texto/modelo y volver a analizarlo.

### “¿Qué pasa si no existe una solución?”

El programa informa la condición detectada. En el caso de infactibilidad mediante dos fases, una Fase I que no puede llevar la suma de artificiales a cero indica que el modelo no tiene solución factible.

### “¿Por qué el método gráfico no aparece siempre?”

Porque esta implementación gráfica trabaja con exactamente dos variables y con no negatividad activa. El Simplex sí puede procesar modelos más generales.

---

## Versión pública actual: v4.0

La versión 4.0 representa la promoción del estado estable alcanzado durante la línea 3.x. El módulo Simplex se considera cerrado para esta etapa del proyecto: se conservan su motor de resolución, método de dos fases, explicación educativa, verificación, importación de PDF/texto y método gráfico.

Las referencias a `v3.x` dentro de esta documentación corresponden al historial real de desarrollo y no se renumeran, para conservar la trazabilidad de las correcciones.

La siguiente etapa del proyecto puede incorporar progresivamente otros contenidos del curso de Investigación de Operaciones como módulos independientes, sin alterar el núcleo estable de Simplex.

## 23. Nota importante sobre el alcance

El núcleo matemático y la interfaz son independientes del lector de lenguaje natural. Esto permite que un error de interpretación pueda corregirse sin modificar el motor Simplex.

La interpretación automática es una ayuda, no una garantía absoluta. La aplicación está diseñada para que el usuario pueda revisar el modelo detectado antes de resolverlo.

---

## 24. Resumen de arquitectura

`index.html`
→ estructura de la interfaz y de ambos módulos.

`style.css`
→ apariencia, temas, controles y sistema visual Liquid Glass.

`app.js`
→ launcher, navegación y preferencias globales.

`simplex.js`
→ lógica del módulo Simplex.

`pert.js`
→ lógica del módulo PERT / CPM.

Dentro de `simplex.js`:

`Entrada → Formulación → Estandarización → Tableau → Iteraciones → Solución → Verificación`

y, en paralelo:

`PDF/Text → Parser → Modelo revisable → Motor Simplex`

Además:

`Modelo de 2 variables → Método gráfico`

---

## 25. Idea principal para recordar

El programa no fue diseñado solamente para “dar la respuesta”. Su propósito es automatizar lo que normalmente se hace a mano:

**formular → transformar → construir tableau → escoger → pivotear → iterar → verificar → explicar.**

Esa es la idea central que se debe conservar al presentar el proyecto.


---

# 26. Módulo PERT / CPM

El módulo PERT / CPM es un complemento independiente dentro de IO Solver. No modifica el motor Simplex ni depende de sus cálculos. Su objetivo es mostrar una segunda aplicación de Investigación de Operaciones durante la exposición: la planeación y análisis temporal de proyectos mediante redes de actividades.

## 26.1 Estructura de una actividad

Cada actividad puede incluir:

- nombre;
- predecesoras;
- duración para CPM;
- estimaciones optimista (O), más probable (M) y pesimista (P) cuando está activo el Modo PERT.

Las predecesoras determinan la red de dependencias del proyecto.

## 26.2 Validación de la red

Antes de calcular, el módulo revisa condiciones que impedirían formar una red válida, entre ellas:

- nombres de actividad repetidos;
- predecesoras que no existen;
- auto-dependencias;
- ciclos en las precedencias.

Si se detecta un ciclo, el proyecto no puede procesarse como una red acíclica PERT / CPM y se muestra un diagnóstico al usuario.

## 26.3 Cálculo CPM

La función `solvePertCpm()` calcula para cada actividad:

- ES: inicio temprano;
- EF: finalización temprana;
- LS: inicio tardío;
- LF: finalización tardía;
- holgura.

El recorrido hacia adelante determina los tiempos tempranos a partir de las predecesoras. Después, el recorrido hacia atrás parte de la duración del proyecto y obtiene los tiempos tardíos.

La duración del proyecto corresponde al mayor EF alcanzado. Las actividades con holgura cero se consideran críticas.

## 26.4 Rutas críticas

`enumerateCriticalPaths()` identifica las rutas formadas únicamente por actividades críticas. Cuando existe más de una ruta crítica, el módulo las muestra por separado. Esto permite distinguir proyectos con varias secuencias que controlan la duración calculada.

## 26.5 Modo PERT

Cuando se activa PERT, cada actividad usa tres estimaciones de tiempo:

- O: optimista;
- M: más probable;
- P: pesimista.

El tiempo esperado de actividad se calcula con la ponderación PERT:

`Te = (O + 4M + P) / 6`

El valor esperado se utiliza como duración de la actividad para el cálculo de la red.

## 26.6 Análisis estadístico PERT

Para las actividades con estimaciones O, M y P, el módulo también calcula:

- varianza: `σ² = ((P - O) / 6)²`;
- desviación estándar: `σ = √σ²`.

Para cada ruta crítica se acumulan las varianzas de sus actividades y se obtiene la desviación estándar de la ruta.

El módulo permite introducir una fecha objetivo y estimar la probabilidad de terminar antes de ese plazo mediante:

`Z = (D - Te) / σ`

Después se utiliza la función de distribución normal acumulada. Cuando hay varias rutas críticas, sus resultados estadísticos se presentan por separado para no sumar varianzas de rutas distintas sin justificación.

La probabilidad es una aproximación basada en el modelo PERT y la aproximación normal; no representa una garantía de cumplimiento.

## 26.7 Red PERT / CPM

`renderNetwork()` construye una red SVG en la que cada actividad se representa como una tarjeta con su información temporal. Las conexiones muestran las precedencias y las rutas críticas reciben un tratamiento visual diferenciado.

El diseño de la red fue ajustado para evitar solapamientos y distinguir los puntos de entrada de las flechas cuando varias actividades convergen en un mismo nodo.

## 26.8 Gantt

`renderPertGantt()` transforma los resultados temporales en un cronograma de barras. Cada actividad se coloca según su ES y duración, permitiendo observar el orden temporal del proyecto y distinguir las actividades críticas.

## 26.9 Modo aprendizaje PERT

`renderPertLearning()` explica el cálculo en dos recorridos principales:

1. recorrido hacia adelante para ES y EF;
2. recorrido hacia atrás para LF y LS;
3. cálculo de la holgura como diferencia entre tiempos tardíos y tempranos.

La finalidad es hacer visible el procedimiento y no limitar el módulo a mostrar únicamente el resultado.

## 26.10 Gestión de proyectos

El módulo permite:

- crear un proyecto nuevo;
- asignar un nombre;
- guardar el proyecto en JSON;
- abrir un proyecto previamente guardado;
- generar un reporte imprimible.

El archivo JSON identifica el formato como `io-solver-project` y el tipo como `pert-cpm`, lo que permite validar que el archivo corresponda al módulo esperado.

## 26.11 Reporte

`exportPertReport()` crea una vista específica de impresión con:

- resumen del proyecto;
- red PERT / CPM;
- cronograma Gantt;
- procedimiento de aprendizaje cuando está activo;
- cálculo PERT y análisis estadístico cuando corresponda.

El navegador puede utilizar la ventana de impresión para guardar el reporte como PDF.

## 26.12 Papel del módulo PERT / CPM en la exposición

PERT / CPM se presenta como un **extra demostrativo** de IO Solver. El tema principal para explicar y, en su caso, utilizar como parte de la exención es el módulo Simplex. PERT / CPM sirve para demostrar que la aplicación puede extenderse a otro problema clásico de Investigación de Operaciones sin mezclar su lógica con el motor Simplex.

---

# 27. Sistema visual y experiencia de usuario

La versión 3.0 consolida la interfaz visual desarrollada durante las versiones 2.x. La aplicación utiliza un lenguaje inspirado en Liquid Glass, manteniendo el vidrio con mayor presencia en controles, navegación y acciones, y superficies más estables para el contenido matemático y los resultados.

Entre los detalles visuales se encuentran:

- tema Sistema, Claro y Oscuro;
- acentos Azul, Turquesa y Violeta;
- botones circulares y cápsulas para acciones frecuentes;
- switches personalizados con track de acento activo y thumb translúcido;
- slider estilizado para la recta de Z;
- estados de hover, pressed y focus;
- soporte de reducción de movimiento y transparencia cuando el sistema lo solicita;
- reportes con estilos independientes para conservar la legibilidad al imprimir.

El objetivo visual es acercar la experiencia a una aplicación moderna sin sacrificar la claridad de una herramienta educativa ejecutada en navegador.

---

# 28. Versionado final

Durante las versiones 2.x se realizaron iteraciones específicas de funcionalidad PERT / CPM, visualización, análisis estadístico, reportes y refinamiento Liquid Glass.

La versión **3.0** fue el hito histórico que consolidó el conjunto inicial estable del proyecto: dos módulos independientes, gestión de apariencia, resolución y explicación del Simplex, y el módulo adicional PERT / CPM para demostración y exposición. La versión pública actual es **4.0**.


## 29. Comprobación final de la solución (v3.3)

Al terminar una resolución Simplex, además de mostrar las comparaciones compactas de factibilidad, IO Solver sustituye los valores finales de las variables en cada restricción original. Por ejemplo, una comprobación puede mostrar una forma equivalente a `a(X1) + b(X2) = valor ≤ disponibilidad`, acompañada por el resultado exacto de la evaluación. También se muestran los valores utilizados para comprobar la condición de no negatividad.

Esta capa es exclusivamente de verificación y explicación: no cambia las operaciones del algoritmo Simplex ni sustituye la comprobación matemática del usuario.


### v3.5 — correcciones educativas del procedimiento Simplex

### v3.11 — correcciones de maquetación de explicación
- La ecuación de objetivo recuperado en Fase II se presenta como una línea matemática desplazable cuando sea necesario.
- Las tarjetas de razonamiento de entrada separan claramente la pregunta de la explicación para evitar cortes de texto.
- No se modifica el motor matemático.

### v3.11 — explicación de Fase I y Fase II
- Se explica por qué cambia la fila objetivo al entrar en Fase I.
- Se identifica la función auxiliar W y el papel de las variables artificiales.
- Se explica la transición de Fase I a Fase II.
- Se explica por qué la función objetivo original se reajusta con la base actual.
- Se conservan los cálculos del motor; los cambios son educativos y de presentación.
- La explicación de cada pivote conserva la base anterior al cambio, evitando etiquetas incorrectas como `X2 ← X2` cuando la fila pivote todavía pertenece a otra variable básica.
- La normalización ahora explica que el elemento pivote queda en 1; las operaciones de eliminación explican que el coeficiente de la columna pivote queda en 0.
- Las operaciones muestran directamente la fila pivote (por ejemplo `Z ← Z + 4/5 A1`) y se identifica la correspondencia de la fila pivote antes de actualizar la base.
- No se modifica el algoritmo matemático de resolución; los cambios son de trazabilidad y explicación del procedimiento.


### v3.11 · Presentación de transiciones y fracciones
- Se reorganizó visualmente la comparación de filas durante Fase I y Fase II para evitar saltos de texto y mantener cada fila en su propia tarjeta.
- Las fracciones exactas con numeradores demasiado grandes o denominadores excesivos se muestran como decimal cuando su forma fraccionaria deja de ser legible; el cálculo interno no cambia.
- Se mantiene el estilo visual existente y no se modifica la lógica matemática del método Simplex.


### v3.11 — legibilidad final de Fase II y comprobación
- La ecuación objetivo recuperada se mantiene en una sola línea y puede desplazarse horizontalmente en pantallas estrechas.
- La verificación final presenta los valores decimales con hasta 4 cifras para evitar tarjetas excesivamente anchas; se usa ≈ cuando se muestran valores redondeados.
- Se conserva el valor matemático interno sin modificar.
- La referencia educativa aclara que Fₚ significa “fila pivote” y señala la fila que actúa como pivote antes del cambio de base.


### v3.14 — procedimiento explícito de reajuste de objetivos y claridad de filas pivote

En esta versión se amplía la explicación educativa del procedimiento sin modificar el motor matemático:
- En Fase I se muestra cómo se construye W y cómo se ajusta usando las filas de las variables artificiales que están en la base.
- En Fase II se mantiene la restauración de Z y se explicita la operación usada para hacer cero el coeficiente de cada variable básica.
- Las operaciones de eliminación distinguen ahora entre **la variable cuyo coeficiente se está eliminando** y **la fila pivote que se utiliza para hacerlo**.
- Se aclara que una fila puede cambiar de etiqueta cuando una variable sale de la base y otra entra, mientras que la columna de la variable saliente permanece en el tableau.
- Las fórmulas de pivote identifican expresamente la fila pivote antes del cambio de base, evitando confundir, por ejemplo, la columna X2 con la antigua etiqueta A1 de la fila pivote.

- Se explica que el nombre de cada fila del tableau representa la variable básica que ocupa esa posición.
- Se muestra explícitamente el cambio `variable saliente → variable entrante`.
- Se aclara el caso educativo en el que una fila `A1` pasa a llamarse `X2`: A1 sale de la base y X2 entra; la columna A1 no desaparece del tableau.
- Se añade una explicación específica al entrar en Fase I sobre el objetivo de eliminar variables artificiales y cómo se interpreta la base.
- No se modifica el cálculo matemático del algoritmo Simplex.

### v3.12 — trazabilidad de la restauración de Z
- Fase II ahora explica por qué recuperar la función objetivo original no significa copiar literalmente la fila inicial de Z.
- Se muestra la fila original de Z, la base actual y las operaciones necesarias para hacer cero los coeficientes de las variables básicas.
- La fila final se identifica como “fila de Z ajustada a la base actual”.
- No se modifica el algoritmo Simplex; se expone el cálculo que ya realiza el motor.

### v3.16 — corrección de Fase I y trazabilidad de objetivos
- Se corrigió una llamada interna que construía la fila objetivo de Fase I con los argumentos intercambiados, provocando valores `NaN` en W y contaminando las tablas posteriores.
- Se mantiene el cálculo del método de dos fases; la corrección restablece el orden correcto de coeficientes y metadatos de columnas.
- Fase I identifica con mayor precisión qué coeficiente de W se hace cero y qué fila básica se utiliza para conseguirlo.
- Fase II deja de usar explicaciones fijas para X2: la explicación se genera a partir de la variable básica real de cada caso y distingue la variable cuyo coeficiente se elimina de la fila que se utiliza.
- Se conservan el estilo Liquid Glass y las funciones existentes.


### v3.18 — auditoría del importador PDF

La versión 3.18 refuerza exclusivamente la capa de entrada PDF/texto para que el modelo detectado dependa menos de cómo el documento haya sido construido internamente.

- PDF.js ahora reconstruye cada línea mediante sus coordenadas visuales: primero se agrupan elementos por posición vertical y después se ordenan horizontalmente.
- Se normalizan subíndices Unicode (`X₁`, `X₂`, etc.) antes del análisis.
- Se reconstruyen ecuaciones partidas en varias líneas cuando la combinación puede ser validada por el parser.
- Se amplía el patrón numérico para aceptar separadores de miles representados mediante espacios.
- Se corrigió la correspondencia de grupos del parser de términos lineales: el índice de variable se toma del grupo correcto de la expresión regular.
- Se mantienen intactas las reglas semánticas específicas de los 10 ejercicios y el motor de resolución Simplex.

### v3.17 — robustez de entrada numérica y método gráfico
- La lectura de ecuaciones desde texto/PDF conserva separadores de miles como `1,000,000` y `2,400` en lugar de interpretarlos como decimales truncados.
- La lectura de modelos escritos admite fracciones simples en coeficientes y términos independientes, por ejemplo `1/2X₁` y `3/4`.
- Se conserva el soporte para decimal con coma y formatos mixtos de miles/decimales en la entrada manual.
- El rango del control de Z del método gráfico ya puede incluir valores negativos cuando el modelo los produce; el slider deja de estar limitado artificialmente a Z ≥ 0.
- No se modifica el motor matemático del Simplex; son mejoras de entrada, visualización y cobertura de casos.
