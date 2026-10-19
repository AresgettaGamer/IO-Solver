# Implementación v8.1.5 — Informe de Transporte

## Objetivo
Mejorar la exportación imprimible que generan los métodos Esquina Noroeste y Costo Mínimo, manteniendo intactos sus algoritmos de resolución.

## Cambios
- Se agrega una instantánea de la matriz después de cada asignación.
- Cada instantánea muestra las asignaciones acumuladas, los costos unitarios, las rutas prohibidas, la oferta restante por fuente y la demanda pendiente por destino.
- Cada iteración muestra el costo de su asignación y el costo acumulado hasta ese paso.
- Se conserva la matriz original, el modelo matemático, el procedimiento narrado y el costo final.
- Se actualiza la versión visible a 8.1.5.

## Alcance y verificación
No se modificaron los algoritmos de Esquina Noroeste ni Costo Mínimo. Las tablas se generan a partir de `solution.steps`, con las asignaciones acumuladas hasta cada iteración. Debe hacerse una comprobación visual en navegador con «Imprimir / Guardar PDF» para revisar paginación y legibilidad con matrices grandes.
