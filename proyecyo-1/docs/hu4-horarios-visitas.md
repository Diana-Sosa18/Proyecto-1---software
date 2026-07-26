# HU4: horarios generales de visita

Administración > Configuración permite definir días habilitados, hora de apertura, hora de cierre,
duración máxima y estado. `PUT /admin/configuracion/horarios-visita` está restringido a admin y
persiste cada valor en `CONFIGURACION`.

La creación y edición de visitas consultan esta configuración en backend usando la fecha enviada.
Se rechazan días deshabilitados, rangos fuera de la ventana, inicio posterior al fin y duraciones
excesivas. Las fechas se interpretan como fechas civiles del residencial (`America/Guatemala`).

Prueba manual: habilite un día y guarde 08:00–18:00; cree una visita dentro del rango y pruebe otra
fuera del rango y otra en un día deshabilitado. Las dos últimas deben ser rechazadas por la API.
