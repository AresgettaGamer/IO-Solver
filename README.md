# IO Solver v6.0

Herramienta educativa de **Investigación de Operaciones** para navegador, organizada en dos módulos independientes: **Simplex** y **PERT / CPM**.

El módulo **Simplex** es el componente principal del proyecto y concentra la resolución de programación lineal, el procedimiento paso a paso y las herramientas de formulación/importación. **PERT / CPM** es un módulo complementario para ampliar la demostración durante la exposición.

## v6.0 — promoción de la línea Simplex

La Versión 6.0 toma la línea anterior como base para cerrar los hallazgos de la ronda de estrés. Corrige la última fuga de la condición de no negatividad: `X₁, X₂ ≥ 0` se conserva como dominio y nunca se agrega como restricción estructural. Además, los modelos con RHS negativo pueden importarse con una advertencia no bloqueante para comprobar la factibilidad desde Resolver, y las funciones objetivo nulas o restricciones de coeficientes cero se tratan como casos matemáticos diagnosticables en lugar de bloquear automáticamente la ejecución.

Incluye, entre otras mejoras acumuladas:

- Resolución de programación lineal mediante Simplex y método de dos fases.
- Procedimiento educativo paso a paso, incluyendo operaciones de pivote, Fase I y Fase II.
- Formulación e interpretación asistida de modelos.
- Importación de texto y PDF con revisión del modelo detectado.
- Verificación de la solución contra las restricciones originales.
- Método gráfico para modelos de dos variables.
- Mejoras de entrada numérica, fracciones y separadores de miles.
- Gráficos con escala más legible y etiquetas de ejes ajustadas.
- Diagnóstico visual de infactibilidad, no acotamiento, ciclos, límite de iteraciones, empates en la prueba de razón, degeneración, posibles óptimos alternativos, artificiales con valor cero y pivotes numéricamente pequeños.
- Módulo PERT / CPM ya integrado como complemento.

**Nota de versionado:** las entradas `v3.x` que aparecen más abajo son historial de desarrollo y se conservan deliberadamente para mantener la trazabilidad de los cambios. La versión publicada actual es **v6.0**.

## PERT / CPM — fase 1

El módulo permite:

- Definir actividades y predecesoras.
- Trabajar con CPM mediante una duración por actividad.
- Activar PERT y calcular el tiempo esperado con tres estimaciones O, M y P.
- Detectar nombres repetidos, predecesoras inexistentes, auto-dependencias y ciclos.
- Calcular ES, EF, LS, LF y holgura.
- Identificar actividades críticas y varias rutas críticas cuando corresponda.
- Mostrar un resumen del proyecto con duración, número de actividades, actividades críticas y mayor holgura.
- Visualizar una red enriquecida con duración y tiempos CPM dentro de cada actividad.

## PERT / CPM — fase 4: análisis estadístico

Cuando el Modo PERT está activo, además del tiempo esperado por actividad, el módulo calcula:

- Varianza de cada actividad: `σ² = ((P - O) / 6)²`.
- Desviación estándar: `σ = √σ²`.
- Varianza y desviación estándar de cada ruta crítica, sumando las varianzas de sus actividades.
- Probabilidad aproximada de terminar antes de una fecha objetivo mediante `Z = (D - Te) / σ` y la distribución normal acumulada.
- Manejo explícito de proyectos con varias rutas críticas: sus estadísticas se muestran por separado en lugar de combinar varianzas sin justificación.

La probabilidad se interpreta como una aproximación basada en el modelo PERT y la aproximación normal; no representa una garantía de cumplimiento.

## Base de conocimiento semántica

Se reforzaron reglas de interpretación usando como conjunto de prueba los 10 ejercicios del Problemario entregado: producción química, mezcla nutricional, cartera de préstamos, procesos, capacidad compartida, ancho de banda, mano de obra, rack de centro de datos, cluster y distribución de transacciones. Se incorporaron patrones para porcentajes, proporciones, presupuestos, capacidades, conversiones de unidades, objetivos de costo/ganancia y restricciones expresadas como “al menos”, “no superar”, “debe ser”, etc.

La aplicación muestra el patrón usado y una confianza aproximada. Cuando las reglas no permiten derivar el modelo con suficiente seguridad, pide revisión en vez de inventar coeficientes. El texto puede editarse o enviarse como contexto para una interpretación asistida por IA.

## Método gráfico

Disponible como vista opcional para exactamente 2 variables con no negatividad. Presenta región factible, restricciones, óptimo de Simplex y una recta de Z móvil mediante un control deslizante. Se oculta cuando el modelo no es adecuado para esta vista.

## v2.4 — Corrección de red PERT/CPM
- Tarjetas de actividad ampliadas para evitar solapamiento de ES/EF/LS/LF/H.
- Flechas SVG corregidas con marcadores separados para dependencias y ruta crítica.
- Mejor separación horizontal/vertical entre actividades.
- Leyenda ampliada para distinguir actividades críticas y no críticas.
- La red conserva desplazamiento horizontal en pantallas pequeñas.


## v2.7 — Gestión de proyectos y reportes
- Crear un proyecto nuevo desde PERT/CPM.
- Guardar y abrir proyectos en JSON.
- Nombrar el proyecto para identificar los archivos y reportes.
- Generar un reporte imprimible desde los resultados calculados; el navegador permite guardarlo como PDF.


## v3.3 — versión consolidada

- Launcher común para seleccionar Simplex o PERT / CPM.
- Navegación de regreso al launcher y preferencias globales de apariencia.
- Tema Sistema, Claro y Oscuro.
- Acentos Azul, Turquesa y Violeta.
- Sistema visual inspirado en Liquid Glass aplicado principalmente a navegación y controles.
- Switches, sliders y acciones con estados de interacción y materiales translúcidos.
- PERT / CPM con red, Gantt, Modo PERT, estadísticas, aprendizaje, guardado/carga JSON y reportes.

### Alcance para la exposición

El módulo Simplex es el componente principal que se presenta para la parte de programación lineal y la exención. PERT / CPM se mantiene como demostración adicional y no sustituye ni modifica el contenido del módulo Simplex.


### v3.3 — comprobación final de soluciones
- La verificación de Simplex ahora muestra la sustitución de los valores obtenidos dentro de cada restricción original.
- Se conserva el resultado exacto de la evaluación y se indica si la desigualdad o igualdad se cumple.
- La comprobación de no negatividad muestra los valores finales de las variables.
- Esta mejora es únicamente de explicación y verificación; no modifica el algoritmo de resolución.


### v3.5 — correcciones educativas del procedimiento Simplex

### v3.11 — correcciones de maquetación de explicación
- La ecuación de objetivo recuperado en Fase II se mantiene en una sola línea desplazable, evitando que cada término se apile verticalmente.
- Las cajas "¿Por qué entra...?" usan una columna fija para la pregunta y otra para la explicación, evitando que el encabezado se corte.
- Se conserva la lógica matemática y el estilo visual.

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

### v3.18 — auditoría y robustez del importador PDF
- La extracción de PDF reconstruye las líneas a partir de las coordenadas X/Y de PDF.js, ordenando los fragmentos de izquierda a derecha para reducir errores de lectura visual.
- Se normalizan subíndices Unicode como `X₁`, `X₂`, `X₃` a `X1`, `X2`, `X3` antes de interpretar el modelo.
- Se admite la reconstrucción de ecuaciones que PDF.js haya partido entre dos o más líneas cuando la expresión combinada resulta matemáticamente válida.
- Se amplía el reconocimiento de números con separadores de miles y espacios, además de las fracciones simples ya soportadas.
- Se corrigió la indexación interna del parser lineal para que el índice de variable corresponda realmente a `X1`, `X2`, etc.; por ejemplo, `25X1` ya no puede terminar interpretándose como `X25`.
- Se conserva el texto por página y los saltos de página para facilitar la revisión manual del contenido detectado.
- No se modifica el motor matemático del Simplex.

### v3.17 — corrección de Fase I y trazabilidad de objetivos
- Se corrigió una llamada interna que construía la fila objetivo de Fase I con los argumentos intercambiados, provocando valores `NaN` en W y contaminando las tablas posteriores.
- Se mantiene el cálculo del método de dos fases; la corrección restablece el orden correcto de coeficientes y metadatos de columnas.
- Fase I identifica con mayor precisión qué coeficiente de W se hace cero y qué fila básica se utiliza para conseguirlo.
- Fase II deja de usar explicaciones fijas para X2: la explicación se genera a partir de la variable básica real de cada caso y distingue la variable cuyo coeficiente se elimina de la fila que se utiliza.
- Se conservan el estilo Liquid Glass y las funciones existentes.


### v3.17
Mejoras de robustez en números escritos/importados (miles, decimales y fracciones) y soporte del rango negativo del control de Z del método gráfico.

### v4.2.5 — personalización y dominio visible
- La no negatividad detectada desde PDF se presenta como información normal del modelo en una tarjeta con el color de acento elegido, no como advertencia amarilla.
- Las advertencias reales de lectura, como un RHS negativo, conservan el color semántico amarillo.
- Se mantienen separados los colores de personalización de los colores semánticos de estado.
- Se agregan tres acentos: Rosa, Magenta e Índigo, junto con Azul, Turquesa y Violeta.
