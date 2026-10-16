# IO Solver v8.0.0

Herramienta educativa de **Investigación de Operaciones** para navegador, organizada en cinco módulos: **Simplex**, **PERT / CPM**, **Modelos de transporte**, **Ruta más corta** y **Optimización clásica**.

Simplex conserva su motor de programación lineal; PERT / CPM planifica redes de actividades; Transporte construye matrices de distribución y enseña soluciones iniciales; Ruta más corta resuelve redes ponderadas con Dijkstra; Optimización clásica analiza funciones polinómicas de una variable para estudiar máximos, mínimos y puntos de inflexión.

## v8.0.0 — Cierre de la beta funcional principal

- Se agregan los módulos **Ruta más corta** (Dijkstra con pasos, grafo visual y entrada manual, texto, PDF o imagen) y **Optimización clásica** (derivadas de polinomios hasta grado 8, máximos y mínimos, extremos absolutos en intervalo cerrado y puntos de inflexión por cambio de concavidad).
- PERT / CPM ahora permite preparar una revisión de actividades a partir de texto copiado, PDF o imagen y aplicar las actividades solo tras confirmar el borrador. Se conserva el flujo de proyectos JSON.
- La importación compartida sigue sirviendo a Simplex y Transporte. Transporte acepta PDF, imagen y texto pegado; aplicar un modelo no ejecuta el algoritmo.
- Las exportaciones nuevas de proyectos identifican la versión 8.0.0; se mantienen compatibles los proyectos JSON anteriores conocidos.
- **Estado del lector:** la extracción de texto seleccionable de PDF es la ruta más fiable. La lectura de tablas mediante OCR, sobre todo en fotografías, escaneos y escritura manuscrita, sigue en beta y requiere revisión humana. Una transcripción no confirmada nunca debe tratarse como verdad matemática.
- **Fuera de alcance en v8.0.0:** asistente generativo / IA visual, formulación automática desde problemas narrativos de optimización y resolución de funciones no polinómicas o problemas multivariables. Se consideran para una versión posterior, prevista como v8.1.0.

### Verificaciones de v8.0.0

- Motor de Ruta más corta: 7 pruebas de lógica.
- Motor de Optimización clásica: 6 pruebas de lógica.
- Parser de importación PERT / CPM: 5 pruebas de lógica.
- Intérprete de Transporte: 11 pruebas; se incluye una prueba del ejercicio de clase con ruta prohibida y fuente ficticia.
- Los comandos de prueba y la suite E2E portátil con Playwright están en `tests/README.md`. La suite de interfaz debe ejecutarse en un entorno donde Chromium pueda acceder al servidor local; esta entrega no declara como aprobada una prueba de navegador que no se pudo reproducir aquí.

## v6.1 — promoción de la línea Simplex

La Versión 6.1 toma la línea anterior como base para cerrar los hallazgos de la ronda de estrés. Corrige la última fuga de la condición de no negatividad: `X₁, X₂ ≥ 0` se conserva como dominio y nunca se agrega como restricción estructural. Además, los modelos con RHS negativo pueden importarse con una advertencia no bloqueante para comprobar la factibilidad desde Resolver, y las funciones objetivo nulas o restricciones de coeficientes cero se tratan como casos matemáticos diagnosticables en lugar de bloquear automáticamente la ejecución.

Incluye, entre otras mejoras acumuladas:

- Resolución de programación lineal mediante Simplex y método de dos fases.
- Procedimiento educativo paso a paso, incluyendo operaciones de pivote, Fase I y Fase II.
- Formulación e interpretación asistida de modelos.
- Importación de texto y PDF con revisión del modelo detectado.
- Verificación de la solución contra las restricciones originales.
- Método gráfico para modelos de dos variables, con procedimiento visible para obtener fronteras, vértices y valores de Z.
- La sección gráfica solo aparece cuando el modelo puede representarse correctamente con la vista actual; si no aplica, no ocupa espacio ni simula una gráfica disponible.
- Los modelos sin variables artificiales continúan mediante Simplex directo y no muestran una Fase II ficticia ni una transición W → Z que nunca ocurrió.
- Mejoras de entrada numérica, fracciones y separadores de miles.
- Gráficos con escala más legible y etiquetas de ejes ajustadas.
- Diagnóstico visual de infactibilidad, no acotamiento, ciclos, límite de iteraciones, empates en la prueba de razón, degeneración, posibles óptimos alternativos, artificiales con valor cero y pivotes numéricamente pequeños.
- Módulo PERT / CPM ya integrado como complemento.

**Nota de versionado:** las entradas `v3.x` que aparecen más abajo son historial de desarrollo y se conservan deliberadamente para mantener la trazabilidad de los cambios. La versión publicada actual es **v8.0.0**.

## v7.11.1 — OCR más conservador y texto pegado en Transporte

- Se ajustó la eliminación de líneas de tabla para que los umbrales sean más conservadores y reduzcan el riesgo de borrar trazos de texto en fotos con sombras o ruido.
- Se aumenta la resolución de preparación de imágenes antes del OCR, con un límite para evitar lienzos excesivos.
- Si no se reconoce una imagen como matriz, ahora puede repetirse la lectura con otro modo de segmentación del OCR.
- Transporte permite pegar texto copiado o transcrito, interpretarlo y revisar la matriz antes de aplicarla al editor.
- El texto pegado y las imágenes siguen el mismo principio: no se resuelve automáticamente y los datos deben revisarse.
- Se actualizan los metadatos de versión a 7.11.1.

Nota: el OCR de escritura manuscrita, fotos con perspectiva pronunciada y documentos con sombras fuertes sigue necesitando validación manual; esta actualización reduce un modo de fallo, pero no garantiza reconocimiento perfecto.

## v7.11.0 — Importación de documentos: PDF, OCR e imágenes (Simplex y Transporte)

Versión de importación. **No se modificó ningún algoritmo matemático** (Simplex, PERT/CPM, Esquina Noroeste, Costo Mínimo): el motor recibe el modelo ya revisado por el usuario.

**Flujo:** archivo → lector compartido (texto nativo + OCR) → detección de ejercicios → intérprete del módulo → **revisión editable** → «Aplicar al modelo» → resolución con el motor existente. Nada se resuelve automáticamente.

- **Formatos:** PDF con texto, PDF escaneado, PDF mixto (enunciado seleccionable + tabla como imagen) y PNG/JPEG/WebP.
- **Lector compartido (`document-import.js`):** PDF.js 4.10.38 con geometría por palabra; detección de imágenes en la página (operadores del PDF); OCR con Tesseract.js 5.1.1 solo donde hace falta; fusión sin duplicados; progreso, cancelación y reintento.
- **Transporte (`transport-import.js`, `transport-import-ui.js`):** reconstruye la tabla por coordenadas, combina enunciado y tabla, reconoce rutas prohibidas (`X`), y muestra una matriz editable con celdas dudosas marcadas con texto y borde punteado. Los problemas se clasifican en **lectura**, **incompleto** e **inviable**. El balanceo lo sigue haciendo el módulo de Transporte.
- **Simplex:** conserva su intérprete; ahora acepta PDF escaneados/mixtos e imágenes y marca las palabras dudosas del OCR.
- **Idiomas del OCR:** español por defecto; inglés disponible cuando se usan las copias locales (`vendor/`).
- **Privacidad:** el documento se procesa en tu dispositivo y no se envía a ningún servidor. Solo se descargan librerías y datos de idioma.
- **Uso sin conexión:** si sirves la carpeta con un servidor estático (por ejemplo `python -m http.server 8080` y abrir `http://localhost:8080`), PDF.js y el OCR se cargan de `vendor/` y funcionan sin Internet (comprobado con la red externa bloqueada). Con `file://` el navegador bloquea los workers locales y se usan las mismas versiones desde jsDelivr (esa ruta se verificó con las URL exactas, pero no contra el servicio real de jsDelivr).
- **Limitaciones conocidas:** el OCR confunde letras y dígitos (`C1`→`cl`, `5`→`S`), por eso nunca se corrige solo; las tablas dibujadas como vectores (no texto ni imagen) requieren «Releer con OCR forzado»; la inclinación fuerte de fotos puede degradar la lectura; se admiten hasta 8 fuentes y 8 destinos; las cifras con separador de miles o decimales ambiguos deben revisarse.
- **Cómo verificar y corregir:** revisa cada celda marcada (⚠ con texto), usa «Ir a la celda», edita el valor o «Confirmar lectura»; si cambias una cifra, tu corrección se conserva. «Aplicar al modelo» solo se habilita sin errores.
- **Pruebas:** `tests/` (fixtures reproducibles, pruebas del intérprete en Node y pruebas de extremo a extremo con Chromium).

## v7.10.3 — Corrección del balanceo del modelo de transporte

Se corrige el ajuste estándar de oferta y demanda en el modelo de transporte:

- Si la **demanda supera a la oferta**, se agrega una **fuente/fábrica ficticia** con oferta igual al déficit y costos cero hacia todos los destinos.
- Si la **oferta supera a la demanda**, se agrega un **cliente/destino ficticio** con demanda igual al excedente y costos cero desde todas las fuentes. Las asignaciones a ese destino representan producto sobrante que no se envía a clientes reales.
- Tras el ajuste, oferta y demanda del modelo ampliado quedan iguales y todas las restricciones de oferta/demanda se expresan como igualdades. No se crean ofertas negativas ni envíos negativos.
- Las filas/columnas ficticias aparecen en el procedimiento, la matriz final, la formulación y el informe imprimible. Se mantienen las rutas prohibidas y los modos automáticos/manuales de desempate.
- No incluye interpretación automática de enunciados ni lectura de PDF; esa capacidad sigue reservada para v7.11.0.

## v7.10.2 — Corrección del selector de método

Corrige el selector entre Esquina Noroeste y Costo Mínimo. Los campos `input` tienen estilos globales de tamaño, borde y relleno; el selector ahora restablece dimensiones explícitas para el radio y permite que el título y la descripción ocupen el ancho restante de cada tarjeta. Se actualizó el identificador de versión en la interfaz y en los proyectos exportados. No cambia la lógica matemática ni incorpora lectura de PDF.

## v7.10.1 — Primera revisión del módulo de Transporte

Versión intermedia de trabajo anterior a este hotfix. Se conserva aquí como referencia del historial; la versión vigente es **v8.0.0**.

## v7.10.0 — Módulo de Modelos de transporte

Se incorpora el tercer módulo de IO Solver, con captura manual de matrices de transporte de entre 2 y 8 fuentes y 2 y 8 destinos.

- **Editor de datos:** costos unitarios, nombres editables de fuentes y destinos, oferta y demanda; se pueden añadir o quitar filas y columnas.
- **Diagnóstico de balance:** compara oferta y demanda antes de resolver.
- **Balanceo correcto:** cuando la oferta supera a la demanda se añade un cliente ficticio con demanda igual al excedente; cuando la demanda supera a la oferta se añade una fábrica ficticia con oferta igual al déficit. Todos los costos ficticios son cero.
- **Falta de oferta:** agrega una fuente ficticia con oferta positiva y costo cero para completar el modelo balanceado.
- **Formulación automática:** genera función objetivo, restricciones de oferta y demanda y no negatividad.
- **Método de la Esquina Noroeste:** presenta cada iteración, la celda activa, la asignación mínima y la actualización visible de oferta/demanda; el valor anterior permanece junto al nuevo y el acento destaca el cambio.
- **Método de Costo Mínimo:** selecciona la celda permitida de menor costo entre las rutas que siguen disponibles y documenta cada asignación. En modo automático resuelve empates escogiendo la primera celda empatada en orden de matriz.
- **Desempates manuales opcionales:** un botón activa la selección del usuario. Cuando hay varias celdas con costo mínimo igual, el procedimiento se pausa para elegir una; vuelve a preguntar en cada empate posterior.
- **Rutas prohibidas:** cada celda puede marcarse como imposible (X). Las rutas bloqueadas no reciben asignaciones y se fijan como `xᵢⱼ = 0` en el modelo. La validación impide que un destino con demanda quede sin ninguna ruta disponible.
- **Balance:** el modelo ampliado queda balanceado con una fuente ficticia si falta oferta o un cliente ficticio si sobra oferta.
- **Resultado:** muestra la matriz de asignaciones y el costo de la solución inicial. Ambos métodos producen una solución inicial factible cuando pueden completar la asignación, pero no garantizan optimalidad.
- **Proyectos:** permite exportar/importar los datos, incluidas las rutas prohibidas, en JSON y generar un reporte imprimible. Los JSON antiguos de transporte se siguen cargando con todas las rutas permitidas por defecto.
- **Diseño:** usa los tokens compartidos de IO Solver y respeta tema, acento, movimiento reducido y alto contraste.

En el módulo Transporte, la interpretación automática de enunciados y la importación de PDF (incluidos documentos escaneados) quedan reservadas para la versión 7.11.0. Esa capacidad no está incluida en la rama v7.10.x. Tampoco se incluyen métodos posteriores para comprobar/mejorar la optimalidad de la solución inicial.

## v7.9.0 — Saneamiento y consolidación visual

Versión de limpieza: **sin módulos nuevos y sin cambios en la matemática de Simplex ni PERT/CPM.** Los resultados de ambos módulos son idénticos a v7.0.0 (comprobado comparando el texto generado). La v7.10.0 toma esta base visual consolidada e incorpora el módulo de Transporte.

- **Liquid Glass con jerarquía:** el contenido (paneles, tablas, campos, resultados, gráficas) es sólido; el vidrio queda en la capa flotante (cabeceras y tarjetas de navegación, ajustes, controles). Se eliminó el vidrio sobre vidrio.
- **Escala tipográfica:** 5 pasos (`--fs-xs/sm/base/lg/xl` = 12/14/16/20/28 px) más el título fluido de portada. Texto de lectura y controles en `--fs-sm`. Excepciones deliberadas: etiquetas dentro de SVG (gráfica y red PERT).
- **Contraste de acentos:** variantes semánticas (`--accent-text`, `--accent-fill`, `--on-accent`). En modo oscuro el texto del botón primario pasa a casi negro (el acento es claro).
- **Transición entre módulos:** fundido breve (View Transitions, ~0.18 s) con continuidad de cabecera; con *reduced motion* se reduce a un fundido de 0.12 s.
- **Reduced motion:** el scroll suave de JS (`window.ioScrollBehavior()`) respeta la preferencia del sistema y el ajuste de la app; la política es "alternativa más suave" (fundidos y cambios de color cortos), no ausencia de feedback.
- **liquid-glass.js:** corregido un bucle `requestAnimationFrame` duplicado en la animación de altura de la gráfica.
- **Tokens:** `--input`→`--input-bg`, `--panel-2`→`--panel`, `--border-strong` definido.
- **CSS:** 163 declaraciones sobrescritas y 39 reglas vacías/obsoletas eliminadas (verificado: estilos computados idénticos antes/después).
- **Jerarquía de controles:** acción principal / secundaria / herramientas agrupadas en barra.
- **Anchos:** `--w-app` (1180 px), `--w-read` (72ch); tablas, redes y gráficas conservan scroll horizontal propio.
- **prefers-contrast: more:** bordes y texto secundario reforzados, superficies sólidas, foco de 3 px.
- **Versionado:** pie de página, metadatos y exportaciones JSON de Simplex/PERT indican 7.9.0 (el formato de datos no cambia y la importación no depende de la versión).

### Contraste de acentos (estilo Neón)

Texto del botón sobre el relleno y texto de acento sobre superficies (objetivo AA ≥ 4.5:1; se usó margen para el vidrio).

**Modo claro** (texto blanco sobre relleno; texto de acento ≥ 5.5:1 sobre `#fff`/`#f5f7fb`)

| Acento | Relleno botón | Texto sobre relleno | Texto de acento | Texto de acento s/ superficies |
|---|---|---|---|---|
| blue | `#2563eb`→`#1d4ed8` | 5.17:1 / 6.7:1 | `#215cd5` | 5.51:1 |
| teal | `#0f766e`→`#115e59` | 5.47:1 / 7.58:1 | `#0f7068` | 5.53:1 |
| violet | `#7c3aed`→`#6d28d9` | 5.7:1 / 7.1:1 | `#7838e6` | 5.58:1 |
| pink | `#cf236f`→`#be185d` | 5.09:1 / 6.04:1 | `#ba2162` | 5.62:1 |
| magenta | `#b723ca`→`#a21caf` | 5.11:1 / 6.32:1 | `#a521b8` | 5.58:1 |
| indigo | `#4f46e5`→`#4338ca` | 6.29:1 / 7.9:1 | `#4f46e5` | 5.86:1 |
| green | `#507b0d`→`#48720f` | 5.02:1 / 5.69:1 | `#496d0d` | 5.63:1 |

**Modo oscuro** (texto `#0b1220` sobre el acento claro; texto de acento ≥ 9:1 sobre `#0d1420`/`#172333`)

| Acento | Relleno botón | Texto sobre relleno | Texto de acento | Texto de acento s/ superficies |
|---|---|---|---|---|
| blue | `#60a5fa`→`#93c5fd` | 7.36:1 / 10.38:1 | `#a0c7fa` | 9.09:1 |
| teal | `#2dd4bf`→`#5eead4` | 10.06:1 / 12.66:1 | `#41d9c4` | 9.02:1 |
| violet | `#a78bfa`→`#c4b5fd` | 6.88:1 / 10.14:1 | `#c9bbfa` | 9.04:1 |
| pink | `#f472b6`→`#f9a8d4` | 7.07:1 / 10.32:1 | `#f4b0d2` | 9.05:1 |
| magenta | `#e879f9`→`#f0abfc` | 7.61:1 / 10.64:1 | `#e8b0f9` | 9.07:1 |
| indigo | `#818cf8`→`#a5b4fc` | 6.28:1 / 9.39:1 | `#bbc0f8` | 9.07:1 |
| green | `#a3e635`→`#bef264` | 12.42:1 / 14.33:1 | `#a3e635` | 10.51:1 |

El estilo Apple usa su propia paleta (texto ≥ 4.6:1 sobre `#f5f7fb`/`#1c1c1e`, botones con texto blanco ≥ 4.6:1).

## v7.0.0 — Inicio de la etapa de mejora de PERT / CPM

La versión 7.0.0 establece la base publicada para la nueva etapa de evolución de PERT / CPM. Conserva la infraestructura consolidada durante la rama 6.x y prepara el proyecto para comenzar las mejoras funcionales del módulo en las siguientes revisiones 7.x.

No se modifica todavía el algoritmo de cálculo de PERT / CPM en este incremento de versión. Las mejoras de infraestructura, guardado y reportes descritas en la rama 6.x permanecen como parte de la base estable.


## v6.5.0 — Modo práctica y estado visual de herramientas

Se añade un modo de práctica basado en las iteraciones reales almacenadas por Simplex. La sesión propone preguntas de selección de variable entrante, prueba de razón, variable saliente y elemento pivote. Incluye modo guiado con retroalimentación inmediata y modo examen con revisión al terminar. El resultado conserva aciertos, respuestas y revisión de cada pregunta.

Las herramientas de resultado que abren contenido en secciones separadas ahora muestran estado visual activo mediante el mismo sistema de acento de la interfaz, para dejar claro que una herramienta como Verificar, Auditar, Historial o Modo práctica está abierta aunque su efecto no ocurra en el botón mismo.

## v6.4.0 — Auditoría del procedimiento

Se añade una auditoría interna del procedimiento Simplex para revisar dimensiones de tableaux, selección de variable entrante, prueba de razón, elemento pivote, reproducción numérica del pivote, normalización, eliminación, cambio de base y criterio de optimalidad cuando corresponde. La auditoría es una herramienta de consistencia y trazabilidad; no sustituye la revisión matemática del ejercicio.

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
