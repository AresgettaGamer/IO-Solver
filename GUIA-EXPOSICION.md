# IO Solver v6.0 — Guía rápida para explicar el proyecto

> **Alcance de esta guía:** esta guía está enfocada exclusivamente en el **módulo Simplex**, que es el componente que se presenta para la exención. El resto de la aplicación no forma parte de la explicación principal de esta guía.

## En 30 segundos

“IO Solver es una aplicación web educativa para Investigación de Operaciones enfocada en automatizar y explicar el procedimiento del método Simplex. Puede recibir un problema manualmente, desde texto o desde un PDF, intentar formular el modelo, mostrarlo para revisión y después reproducir las iteraciones del Simplex paso a paso. También verifica la solución y, cuando el problema tiene dos variables, permite compararla mediante el método gráfico.”

## Si pregunta “¿qué hace?”

“El programa toma un problema de programación lineal, construye o interpreta su modelo, lo estandariza y ejecuta el procedimiento del Simplex. No solamente muestra el resultado final: conserva y presenta las operaciones de cada iteración para que se pueda seguir el procedimiento que normalmente realizamos manualmente.”

## Si pregunta “¿cómo funciona?”

1. Lee el modelo.
2. Lo estandariza.
3. Crea el tableau inicial.
4. Busca la variable entrante.
5. Hace la prueba de razón.
6. Encuentra la fila y el elemento pivote.
7. Normaliza la fila pivote.
8. Hace ceros en la columna pivote mediante operaciones de fila.
9. Guarda la iteración.
10. Repite hasta alcanzar la optimalidad o detectar una condición especial.
11. Extrae y verifica la solución.

## Si pregunta “¿qué hace cada archivo?”

- `index.html`: contiene la estructura de la interfaz, formularios, botones y áreas donde se muestran los resultados.
- `style.css`: contiene el diseño visual, distribución, tablas, formularios, temas claro/oscuro y estilos de los controles.
- `simplex.js`: contiene la lógica principal del módulo Simplex: formulación, estandarización, algoritmo, dos fases, verificación, método gráfico, interpretación e importación de problemas.
- `app.js`: controla la navegación general, el launcher y las preferencias visuales comunes.

## Si pregunta “¿por qué el programa puede leer PDFs?”

Puede extraer el texto seleccionable de un PDF, separar ejercicios y aplicar reglas para detectar elementos de un modelo de programación lineal. Antes de resolver, muestra la formulación detectada para que pueda revisarse y corregirse.

## Si pregunta “¿qué pasa si no entiende el problema?”

No debe inventar una formulación. Cuando las reglas de interpretación no permiten obtener el modelo con suficiente seguridad, permite revisar o editar el texto y preparar nuevamente la interpretación.

## Si pregunta “¿por qué dos fases?”

Las variables artificiales permiten construir una base inicial cuando ciertas restricciones `>=` o `=` no proporcionan directamente una solución básica factible. La Fase I busca eliminar las variables artificiales y demostrar factibilidad; después, la Fase II continúa con la función objetivo original para realizar la optimización.

## Si pregunta “¿cómo sabe que terminó?”

Para la convención de maximización utilizada en clase, cuando la fila objetivo ya no contiene coeficientes negativos que indiquen una mejora adicional, se cumple el criterio de optimalidad. El programa también contempla condiciones especiales del procedimiento, como problemas no acotados o sin solución factible.

## Si pregunta “¿qué es el método gráfico?”

Es una comprobación visual para problemas con exactamente dos variables. El programa dibuja las restricciones, la región factible, la recta de la función objetivo y el punto óptimo obtenido por Simplex. La recta de la función objetivo puede desplazarse mediante un control deslizante para visualizar el cambio del valor de Z.

## Si pregunta “¿qué significa mostrar la operación completa?”

Permite ver las operaciones de fila utilizadas para transformar una tabla en la siguiente, incluyendo la normalización de la fila pivote y las operaciones necesarias para hacer ceros en el resto de la columna pivote. Esto sirve para relacionar el resultado automático con el procedimiento realizado a mano en clase.

## Si pregunta “¿cómo comprueba la solución?”

Después de obtener una solución, el programa revisa las restricciones y el valor de la función objetivo para comprobar que la solución extraída del tableau sea consistente con el modelo planteado.

## Si pregunta “¿por qué importar texto además de introducirlo manualmente?”

Porque permite trabajar con ejercicios escritos previamente y probar la capacidad de interpretación del programa sin obligar al usuario a capturar todos los coeficientes desde cero. La formulación siempre puede revisarse antes de ejecutar el método.

## Frase final

“No programamos solamente una calculadora de resultados; automatizamos el procedimiento del método Simplex que normalmente realizamos manualmente y dejamos visibles las decisiones y operaciones que llevan de una tabla a la siguiente.”

## Versión final

La versión de entrega es **IO Solver 5.1**. Las versiones 2.x corresponden al desarrollo incremental de funcionalidades y al refinamiento visual; 5.1 consolida la versión estable actual que se utiliza para la presentación del proyecto.


## Diagnóstico de condiciones especiales

La Versión 6.0 puede explicar por qué el procedimiento terminó o encontró una situación especial. Además, durante la importación distingue el dominio de no negatividad de las restricciones estructurales y separa los empates de variable entrante de los empates de razón. No presenta estas condiciones como errores de software: las presenta como estados matemáticos del procedimiento. Puede señalar infactibilidad, no acotamiento, ciclos, límite de iteraciones, empates de razón, degeneración, posibles óptimos alternativos, artificiales con valor cero y pivotes muy pequeños.
