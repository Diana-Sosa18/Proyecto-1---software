# HU10: tipos de visitante

`tipo_visita` acepta únicamente `VISITA`, `DELIVERY` o `PROVEEDOR`. El frontend usa el mismo tipo
cerrado, el backend normaliza y rechaza valores arbitrarios, `ACCESO` lo persiste y todas las APIs
de visitas lo incluyen. Los registros históricos usan los valores ya permitidos por la base.

La vista de guardia muestra un badge consistente por tipo y también el tipo al validar el QR.
Prueba manual: cree una visita de cada tipo y compruebe persistencia/badge; una petición directa
con `tipo_visita: "ARBITRARIO"` debe responder 400.
