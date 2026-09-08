# HU3 y HU4 — Cierre de sesión por inactividad y actualización de permisos

Ambas historias corrigen hallazgos de la Revisión Técnica Formal (RTF): la falta de cierre de
sesión por inactividad y que los cambios de permisos no se reflejaban al volver a iniciar sesión.

## HU3 — Cierre de sesión por inactividad

### Objetivo
Cerrar la sesión automáticamente cuando el usuario permanece inactivo, mostrando un aviso previo
con cuenta regresiva y sincronizando el cierre entre pestañas.

### Funcionamiento
- El componente `SessionTimeout` (`frontend/src/components/auth/SessionTimeout.tsx`) detecta la
  actividad del usuario (clic, teclado, movimiento del puntero y navegación) y reinicia un
  temporizador de inactividad.
- Antes de cerrar la sesión muestra un **aviso previo** con los segundos restantes; el usuario
  puede continuar la sesión o cerrarla de inmediato.
- Al cumplirse el tiempo de inactividad se cierra la sesión (se limpia el almacenamiento local) y
  la aplicación redirige al inicio de sesión. El cierre se propaga a las demás pestañas abiertas.

### Configuración
Los tiempos se definen en `frontend/src/config/session.ts` y pueden ajustarse por variables de
entorno:
- `VITE_SESSION_TIMEOUT_MS`: tiempo de inactividad antes de cerrar la sesión (por defecto 30 min).
- `VITE_SESSION_WARNING_MS`: antelación del aviso previo (por defecto 1 min).

### Pruebas
`frontend/src/components/auth/SessionTimeout.test.tsx` (Vitest, con temporizadores simulados):
muestra el aviso antes del cierre, cierra la sesión al cumplirse el tiempo y reinicia el
temporizador cuando hay actividad del usuario.

## HU4 — Actualización de permisos

### Objetivo
Reflejar los cambios de rol o de estado del usuario sin necesidad de cerrar y volver a iniciar
sesión. Si un administrador cambia el rol de un usuario o lo desactiva, el cambio debe aplicarse.

### Funcionamiento
- **Backend:** nuevo endpoint `GET /auth/session` que, a partir del encabezado `x-user-id`,
  devuelve el rol y estado **actuales** del usuario desde la base de datos
  (`getCurrentSession` en `backend/src/services/authService.js`). Responde 401 si la sesión no es
  válida (usuario inexistente) y 403 si el usuario está inactivo.
- **Frontend:** el `AuthContext` (`frontend/src/context/AuthContext.tsx`) llama a este endpoint al
  cargar la aplicación, de forma periódica y al volver a enfocar la ventana. Si el rol o el correo
  cambiaron, actualiza la sesión guardada; si el backend indica que la sesión ya no es válida
  (401/403), cierra la sesión automáticamente.
- Las **rutas protegidas** (`ProtectedRoute`) usan el rol actualizado, por lo que el acceso se
  ajusta de inmediato al nuevo rol del usuario.

### Endpoint

`GET /auth/session` (encabezado `x-user-id`)

Ejemplo de respuesta:

```json
{ "id": 3, "email": "residente@test.com", "role": "residente" }
```

### Pruebas
`backend/src/services/__tests__/authService.test.js` (Jest): devuelve el rol actual, refleja un rol
actualizado, y lanza los errores 401 (id inválido o usuario inexistente) y 403 (usuario inactivo).

## Cómo ejecutar las pruebas

```
cd proyecyo-1/backend && npx jest --runInBand authService
cd proyecyo-1/frontend && npx vitest run src/components/auth/SessionTimeout.test.tsx
```
