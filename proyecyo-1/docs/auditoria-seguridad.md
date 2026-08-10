# Auditoría de seguridad — NexusResidencial

> Nota importante sobre el alcance: el documento base de la auditoría asumía un stack
> **NestJS + Prisma + PostgreSQL + JWT + DTOs**. El proyecto real usa **Express + SQL directo
> (mysql2) + MySQL + autenticación por cabeceras HTTP**. Por eso cada fase se adaptó al stack
> real; las partes específicas de NestJS/Prisma (Guards, `$queryRawUnsafe`, `ValidationPipe`,
> DTOs de class-validator) no aplican y se indican como "N/A".

## 1. Estado general

**Clasificación: RIESGO MEDIO.**

- **Fortaleza principal:** la protección contra **SQL Injection es sólida**. Todas las entradas de
  usuario que llegan a la base de datos usan *prepared statements* (`?`); los pocos valores
  interpolados en el SQL son constantes internas o enteros validados. No se encontró SQL Injection
  explotable.
- **Debilidad principal (crítica):** la **autenticación se basa en cabeceras HTTP
  (`x-user-role`, `x-user-id`) sin ninguna verificación criptográfica** (no hay JWT ni sesión
  firmada). Cualquiera con las DevTools o `curl` puede enviar `x-user-role: admin` y hacerse pasar
  por administrador o por cualquier residente. Esto habilita, en la práctica, escalada de
  privilegios e IDOR. No se corrigió automáticamente porque hacerlo implica un cambio
  arquitectónico grande (implementar JWT y tocar todo el equipo); se documenta como acción
  prioritaria.
- **Debilidad secundaria:** las contraseñas pueden compararse en **texto plano** cuando
  `USE_BCRYPT=false` y el valor almacenado no es un hash bcrypt (los datos de ejemplo/seed usan
  `1234` en texto plano).

## 2. SQL Injection

```
SQL Injection vulnerable: NO
```

- **Archivos revisados:** todos los `backend/src/services/*.js`, `database/mysql.js`, controladores y rutas.
- **Cómo se consulta la BD:** siempre mediante `query(sql, params)` de `mysql2/promise`, que usa
  *prepared statements*. Los valores del usuario (body, query, params) se pasan en el arreglo
  `params`, nunca concatenados en el texto SQL.
- **Interpolaciones `${...}` encontradas en SQL y por qué son seguras:**
  - `sqlFilters.join(" AND ")` / `clauses.join(...)`: se unen **fragmentos fijos** definidos en el
    código; los valores van por `params`.
  - `demoRequestsService` `LIMIT ${limit} OFFSET ${offset}`: `limit`/`offset` se generan con
    `Number.parseInt` + clamp y se **revalidan como enteros** en `pageClause` antes de interpolar.
  - `reportExportService` `FROM (${REPORTS[type]})`: `type` se valida contra una lista blanca fija.
  - `adminAuthorizedUsersService` `SEPARATOR '${PERMISSION_SEPARATOR}'`: constante interna.
  - `amenitiesReservationsService` `${USER_UNIT_SUBQUERY}`, `${lockRow ? "FOR UPDATE" : ""}`:
    constante y bandera booleana; no hay dato de usuario.
  - `automaticBackupsService`: genera un *dump* SQL con nombres de tabla/columna del **esquema
    interno** (no del usuario) y escapa valores manualmente; su uso es administrativo.
- **Consultas `unsafe` (`$queryRawUnsafe`, etc.):** N/A — no se usa Prisma.
- **Correcciones realizadas:** ninguna necesaria en esta fase (ya estaba parametrizado). Se
  agregaron pruebas automáticas que lo demuestran (ver sección 11).

## 3. Cambios realizados

| Archivo | Cambio | Justificación |
|---|---|---|
| `backend/src/app.js` | Se agregó **Helmet** (`app.use(helmet())`) | Cabeceras de seguridad HTTP (Fase 8) |
| `backend/src/app.js` | **Rate limiting** en `/login` (20 intentos / 15 min por IP) | Anti fuerza bruta (Fase 7) |
| `backend/src/app.js` | **Manejo de errores endurecido**: los errores 500 devuelven mensaje genérico y ya no reenvían `error.message` ni `error.code` internos al cliente | Evita filtrar mensajes de MySQL/rutas internas (Fase 12) |
| `backend/package.json` | Dependencias `helmet` y `express-rate-limit` | Requeridas por lo anterior |
| `backend/src/services/__tests__/security.test.js` | Pruebas de SQL Injection y validación | Fase 20 |

## 4. Autenticación

- **Login** (`authService.loginUser`): busca el usuario por correo con consulta parametrizada y
  compara contraseña. Correcto en cuanto a parametrización.
- **Problema crítico:** tras el login no se emite ningún **token firmado**. El frontend guarda
  `{id, email, role}` en `localStorage` y en cada petición envía esos datos como cabeceras
  `x-user-role`/`x-user-id`. Los middlewares confían en esas cabeceras **sin validarlas**. Es
  exactamente el patrón que la Fase 3 prohíbe: el cliente afirma su propio rol.
- **Recomendación (pendiente, no aplicada por ser cambio mayor):** emitir un **JWT firmado** al
  iniciar sesión, validarlo en un middleware y derivar `id`/`role` del token, no de cabeceras.

## 5. Roles y permisos

- Existen middlewares `requireAdmin`, `requireResident`, `requireGuard`,
  `requireResidentOrTenant` y cada ruta sensible los aplica (revisado en `routes/`).
- **Posibilidad de escalada de privilegios: SÍ**, pero por la causa de la sección 4: como el rol se
  toma de una cabecera falsificable, cualquiera puede autoproclamarse `admin`. La estructura de
  autorización es correcta; el problema es el **origen de la identidad**.

## 6. IDOR / Broken Access Control

- Los endpoints de residente (p. ej. `/residente/detalle-financiero`, `/residente/resumen-mensual`)
  filtran por `req.authUser.id`, lo cual es la práctica correcta de *ownership*.
- **Pero** `req.authUser.id` proviene de la cabecera `x-user-id`, que el atacante controla. Por
  tanto, un usuario puede consultar datos de otro cambiando esa cabecera. La verificación de
  pertenencia es correcta; se vuelve efectiva solo cuando la identidad provenga de un token firmado
  (sección 4).

## 7. Validación de datos

- No hay DTOs/class-validator (N/A, no es NestJS). La validación se hace **manualmente** en los
  services: funciones `normalizeString/normalizeDate/normalizeX` que lanzan `Error` con
  `.status = 400` ante datos inválidos (estados fuera de lista blanca, fechas mal formadas,
  paginación no entera, etc.).
- Es razonable y consistente, aunque ad-hoc. Recomendación futura: centralizar validación de
  entrada por endpoint.

## 8. Base de datos

- **Prisma:** N/A. Se usa `mysql2/promise` con *prepared statements* (seguro).
- **SQL raw:** el generador de respaldos y el restaurador ejecutan SQL amplio, pero son de uso
  administrativo y no reciben SQL del usuario final.
- **Privilegios:** el `.env.example` usa `DB_USER=root`. Idealmente la app debería usar una cuenta
  con privilegios mínimos (no superusuario). Es un ajuste de **infraestructura**, no de código.
- **Exposición:** no hay `DATABASE_URL` ni credenciales en el frontend; el frontend solo conoce
  `VITE_API_URL`. La arquitectura (React → API → MySQL) es correcta.

## 9. Seguridad web

- **Helmet:** agregado.
- **CORS:** restringido a `env.FRONTEND_ORIGIN` (no usa `*`). Correcto; en producción configurar el
  origen real por variable de entorno.
- **Rate limiting:** agregado en `/login`.
- **CSRF:** riesgo bajo — la app **no usa cookies** para autenticación (usa cabeceras +
  `localStorage`), por lo que el vector clásico de CSRF no aplica. (Contrapartida: `localStorage`
  es susceptible a XSS; ver siguiente punto.)
- **XSS:** React escapa el contenido por defecto y **no se usa `dangerouslySetInnerHTML`** en el
  frontend. Riesgo bajo.
- **Contraseñas:** ver sección 6 del documento base — soporta bcrypt (si el hash empieza con `$2`),
  pero permite comparación en texto plano si `USE_BCRYPT=false`. Recomendación: forzar bcrypt y
  re-hashear las contraseñas sembradas.

## 10. Dependencias

`npm audit` (backend) reporta **6 vulnerabilidades** (1 baja, 3 moderadas, 2 altas), principalmente:
- `qs` (DoS moderada) — corregible con `npm audit fix`.
- `uuid` (moderada) a través de `exceljs` — su corrección requiere un cambio mayor
  (`exceljs@3.4.0`), por lo que **no se aplicó automáticamente** para no romper la exportación de
  reportes. Debe evaluarse el impacto antes de actualizar.

No se ejecutaron actualizaciones mayores automáticas.

## 11. Pruebas

- **Ejecutadas (Jest, con BD mockeada):** 23/23 aprobadas.
- **Nuevas agregadas** (`security.test.js`): 3 pruebas
  - la búsqueda maliciosa en pagos viaja como parámetro, no en el SQL;
  - la búsqueda maliciosa en usuarios autorizados viaja como parámetro;
  - un estado inválido se rechaza (400) antes de tocar la base de datos.
- Las pruebas de rutas por `node:test` (`test/*.test.js`) y las funcionales requieren MySQL
  levantado; no se ejecutaron en este entorno sin base de datos.

## 12. Pendientes manuales (fuera del código)

- Implementar **JWT** (o sesión firmada) y dejar de confiar en cabeceras — cambio de equipo.
- **Re-hashear contraseñas** con bcrypt y poner `USE_BCRYPT=true`; eliminar contraseñas en texto
  plano de los seeds.
- Crear un **usuario de MySQL con privilegios mínimos** para la app (no root).
- Servir todo por **HTTPS** en producción y fijar `FRONTEND_ORIGIN` real.
- Revisar/actualizar dependencias vulnerables evaluando impacto (`exceljs`/`uuid`, `qs`).

## 13. Checklist final

```text
[x] SQL Injection protegida (prepared statements en todas las consultas)
[x] No existe $queryRawUnsafe inseguro (N/A - no se usa Prisma)
[x] No existe $executeRawUnsafe inseguro (N/A - no se usa Prisma)
[~] DTO validation (no hay DTOs; validación manual en services)
[ ] ValidationPipe (N/A - no es NestJS)
[ ] JWT seguro (NO existe: autenticación por cabeceras falsificables)
[ ] Refresh token seguro (no existe)
[x] Roles backend (middlewares por rol en las rutas)
[x] Permissions backend (aplicados por ruta)
[ ] IDOR protegido (la lógica filtra por id, pero el id proviene de cabecera falsificable)
[~] Password hashing (soporta bcrypt, pero permite texto plano si USE_BCRYPT=false)
[x] Rate limiting (agregado en /login)
[x] Helmet (agregado)
[x] CORS seguro (restringido a FRONTEND_ORIGIN)
[x] CSRF revisado (bajo riesgo: no usa cookies de sesión)
[x] XSS revisado (React escapa; sin dangerouslySetInnerHTML)
[x] Secretos protegidos (no hay secretos hardcodeados; solo .env.example)
[x] DATABASE_URL no expuesta (no está en el frontend)
[ ] PostgreSQL least privilege (N/A PostgreSQL; en MySQL el ejemplo usa root)
[x] Errores internos protegidos (500 devuelven mensaje genérico)
[~] Logs seguros (se usa console.error; no se registran secretos, pero no hay auditoría formal)
[x] Dependencias revisadas (npm audit ejecutado; hallazgos documentados)
[~] Archivos subidos protegidos (restauración limita a .sql y 2MB; revisar MIME de imágenes)
[x] Endpoints sensibles protegidos (con la salvedad de la autenticación por cabeceras)
[x] Pruebas de seguridad aprobadas (3 nuevas, 23/23 Jest en verde)
```

Leyenda: `[x]` confirmado · `[~]` parcial · `[ ]` no cumplido / pendiente.

## 14. Resultado de la revisión simulada (como auditor)

- **Qué atacaría primero:** la autenticación. Con las DevTools cambiaría el `localStorage`
  (`nexus.session`) o enviaría con `curl` la cabecera `x-user-role: admin` y `x-user-id: 1`. Es el
  camino más corto para comprometer el sistema, y no requiere tocar la base de datos.
- **Áreas más fuertes:** el acceso a datos. Las consultas están **parametrizadas**, así que un
  intento de SQL Injection en login, búsquedas o filtros sería tratado como texto y **no**
  modificaría la consulta. También es correcto que el frontend no toque la BD directamente.
- **Áreas que siguen débiles:** autenticación/autorización (cabeceras falsificables → escalada de
  privilegios e IDOR) y contraseñas en texto plano en la configuración por defecto.
- **¿Está listo para una prueba de SQL Injection?** Sí; con base en lo verificado, el sistema
  debería resistir intentos de SQL Injection en sus entradas, porque usa *prepared statements* de
  forma consistente.
- **¿Se podría comprometer desde el navegador o con peticiones manuales?** Sí, **no por SQL
  Injection**, sino por la autenticación basada en cabeceras: un atacante puede suplantar roles y
  acceder a datos de otros usuarios manipulando la sesión o enviando cabeceras a mano. Esa es la
  corrección prioritaria.

No se afirma que el sistema sea "imposible de hackear": la evaluación es que está **bien protegido
contra inyección SQL** pero **débil en autenticación/autorización** por diseño actual.
```
No se hizo push. Todos los cambios quedan locales en la rama `auditoria_seguridad`.
```
