# HU6 – Cierre automático de sesión
Todos los roles usan `SessionTimeout` dentro de `AuthProvider`. La configuración central admite
variables `VITE_SESSION_TIMEOUT_MS` y `VITE_SESSION_WARNING_MS`. La actividad se limita a una
actualización por segundo; se muestra cuenta regresiva, continuar o cerrar. El cierre elimina
`nexus.session`, actualiza el contexto y las rutas protegidas redirigen al login. Un evento de
almacenamiento sincroniza otras pestañas. La arquitectura no posee tokens/refresh server-side;
por ello no existe una sesión remota adicional que invalidar.
