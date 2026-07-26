# HU11: observaciones en visitas

El formulario de visitas admite observaciones opcionales de hasta 255 caracteres. El frontend
muestra el contador y evita enviar textos mayores; el servicio backend repite la validación antes
de crear o editar y persiste el valor en `ACCESO.observaciones`. Los valores vacíos se guardan como
`NULL`, por lo que registros anteriores siguen siendo compatibles.

La vista de guardia muestra las observaciones tanto en el listado del turno como al validar el QR.
React renderiza el texto escapado.

Prueba manual: cree una visita con observaciones, recárguela y valídela desde guardia; repita con
el campo vacío y con 256 caracteres. Este último caso debe mostrar error y no persistir cambios.
