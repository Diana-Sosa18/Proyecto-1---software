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

## HU3 Estado de cuenta del residente

El estado de cuenta esta disponible para residentes en:

```text
/residente/estado-cuenta
```

La pantalla muestra saldo pendiente, cuotas pagadas, cuotas vencidas, proximo vencimiento y detalle por servicio. El frontend consulta la API al entrar a la pantalla y vuelve a actualizar la informacion cada 30 segundos. Tambien incluye un boton de actualizacion manual.

### Endpoint

El endpoint requiere headers de residente:

```text
x-user-role: residente
x-user-id: <id_usuario>
```

Endpoint disponible:

```text
GET /residente/estado-cuenta
```

La respuesta incluye:

```text
resumen.saldo_pendiente
resumen.cuotas_pagadas
resumen.cuotas_vencidas
resumen.cuotas_pendientes
cuotas[].estado
cuotas[].saldo_pendiente
```

Los estados se calculan con base en `CUOTA` y `PAGO`: una cuota es `PAGADA` cuando los pagos cubren el monto total, `VENCIDA` cuando aun tiene saldo y la fecha limite ya paso, y `PENDIENTE` cuando aun tiene saldo pero no ha vencido.

## HU7 Estado de cuenta del inquilino

El estado de cuenta del inquilino esta disponible en:

```text
/inquilino/estado-cuenta
```

La pantalla muestra saldo pendiente, alquiler, cuotas adicionales, cuotas vencidas, pagos aplicados y proximo vencimiento. El frontend consulta la API al cargar la pantalla, incluye boton de actualizacion manual y refresca la informacion cada 30 segundos.

### Endpoint

El endpoint requiere headers de inquilino:

```text
x-user-role: inquilino
x-user-id: <id_usuario>
```

Endpoint disponible:

```text
GET /inquilino/estado-cuenta
```

La respuesta separa:

```text
resumen.alquiler_pendiente
resumen.cuotas_adicionales_pendientes
alquiler[]
cuotas_adicionales[]
```

El alquiler se modela con `SERVICIO.tipo_servicio = 'Alquiler'` y cuotas en `CUOTA`. Las cuotas adicionales son el resto de servicios asociados a la unidad. Los estados se calculan con los pagos aplicados en `PAGO`.

### Datos demo

Al iniciar el backend, `ensureTenantAccountSeed` registra el servicio `Alquiler residencial` y crea una cuota demo para casas con inquilino autorizado cuando aun no existe. En bases nuevas, `sql/init.sql` tambien incluye ese servicio y cuota.
