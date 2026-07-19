# nexusprueba

## Docker

Si el puerto de MySQL del host esta ocupado, cambia `MYSQL_HOST_PORT` en un archivo `.env`.

Ejemplo:

```env
MYSQL_HOST_PORT=3308
```

## Modulo de sanciones

El modulo de sanciones esta disponible para administradores en:

```text
/admin/sanciones
```

Permite revisar el resumen de sanciones, consultar las reglas automaticas activas, generar sanciones por incumplimiento, actualizar el estado de cada sancion y revisar el historial de eventos.

### Regla automatica

La regla `CUOTA_VENCIDA` genera una sancion cuando una cuota tiene `fecha_limite` menor a la fecha actual y no registra pagos suficientes para cubrir el monto total.

El monto de sancion es el mayor entre:

```text
Q50.00
10% del monto de la cuota vencida
```

La regla evita duplicados por medio de la llave unica `codigo_regla + id_cuota`.

### Endpoints

Todos los endpoints requieren headers de administrador:

```text
x-user-role: admin
x-user-id: <id_usuario>
```

Endpoints disponibles:

```text
GET    /admin/sanciones/resumen
GET    /admin/sanciones/reglas
GET    /admin/sanciones/historial
GET    /admin/sanciones
POST   /admin/sanciones/generar
PATCH  /admin/sanciones/:id/estado
```

### Historial

La tabla `SANCION_HISTORIAL` guarda eventos de generacion automatica y cambios de estado. La pantalla muestra los ultimos eventos con fecha, unidad, residente, tipo de evento, estado y responsable.

### Pruebas

Pruebas unitarias del backend:

```bash
cd backend
npm test
```

Pruebas funcionales contra la API levantada:

```bash
cd backend
RUN_FUNCTIONAL_TESTS=1 npm run test:functional
```

En Windows PowerShell:

```powershell
cd backend
$env:RUN_FUNCTIONAL_TESTS="1"; npm run test:functional
```
