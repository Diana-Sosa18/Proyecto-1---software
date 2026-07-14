# HU8 — Visualizar usuarios autorizados

## Objetivo

Permitir al administrador ver, en `/admin/usuarios-autorizados`, el listado de inquilinos
autorizados (`INQUILINO.autorizado = TRUE`), su unidad asignada y sus permisos activos, con
busqueda por nombre, correo o unidad.

## Regla de negocio

- **Usuario autorizado** = registro en `INQUILINO` con `autorizado = TRUE`, unido a `USUARIO` para
  sus datos de contacto y a `INQUILINO_CASA`/`CASA` para su unidad (un inquilino puede no tener
  unidad asignada todavia; en ese caso se muestra "Sin unidad asignada").
- **Permiso activo** = registro en `PERMISO_INQUILINO` (tabla creada dinamicamente por
  `ensureSprintUserStoriesSchema` en `backend/src/database/mysql.js`) con `estado = 'ACTIVO'` para
  ese `id_usuario`. Un usuario puede tener cero o varios permisos activos.

## Endpoint

`GET /admin/usuarios-autorizados`

Requiere headers de sesion de administrador (`x-user-role: admin`, `x-user-id: <id>`), igual que
el resto de endpoints `/admin/*` (middleware `requireAdmin`).

### Query params (opcionales)

| Param    | Valores      | Descripcion                                     |
|----------|--------------|--------------------------------------------------|
| `search` | texto libre  | Filtra por nombre, correo o unidad del inquilino |

### Ejemplo de respuesta

```json
[
  {
    "id_usuario": 7,
    "nombre": "Ana Martinez",
    "correo": "ana@test.com",
    "telefono": "5555-1234",
    "unidades": "A-102",
    "permisos_activos": ["Gestion de visitas", "Reservas de amenidades"],
    "total_permisos_activos": 2
  }
]
```

## Pantallas

- `frontend/src/views/AdminAuthorizedUsersView.tsx`: tabla con nombre, correo, unidad y badges de
  permisos activos, mas buscador y contador de autorizados. Se agrego al menu del panel de
  administracion (`AdminLayout.tsx`) y a las rutas protegidas de admin (`AppRouter.tsx`).

## Codigo relevante

- `backend/src/services/adminAuthorizedUsersService.js`
- `backend/src/controllers/adminAuthorizedUsersController.js`
- `backend/src/routes/adminAuthorizedUsersRoutes.js`
- `frontend/src/services/authorizedUsersService.ts`
- `frontend/src/types/authorizedUsers.ts`

## Pruebas

```
cd proyecyo-1/backend
npm install
npm test
```

- **Unitarias** (`backend/src/services/__tests__/adminAuthorizedUsersService.test.js`): mapeo de
  filas (incluyendo el caso sin permisos activos), armado del filtro de busqueda, mockeando
  `backend/src/database/mysql.js`.
- **Funcionales** (`backend/src/routes/__tests__/adminAuthorizedUsers.route.test.js`): peticiones
  HTTP con Supertest contra `createApp()`, mockeando el service, para validar el middleware
  `requireAdmin` (incluye el caso de un rol distinto a `admin`) y la propagacion de query params.
  No sustituyen una prueba de extremo a extremo contra la base de datos real del `docker-compose`.
