# Landing page comercial de NexusResidencial

## Objetivo y rutas

La ruta pública `/` presenta NexusResidencial como producto para residenciales, condominios, edificios y complejos habitacionales. `/login` conserva el acceso real, `/privacidad` explica el tratamiento general de los datos y `/admin/solicitudes-demo` permite al administrador dar seguimiento a contactos comerciales.

## Diseño

La landing reutiliza la identidad azul, tipografía, iconos Lucide y convenciones responsive del frontend. Incluye header accesible, hero con un mockup HTML basado en funciones reales, problema, funcionalidades, beneficios, pasos, roles, vista previa, CTA, formulario y footer. No se añadieron librerías ni imágenes externas.

## Formulario y API

`POST /public/solicitudes-demo` recibe `nombre`, `correo`, `telefono`, `residencial`, `cantidadViviendas`, `mensaje`, `aceptaContacto` y el honeypot `sitioWeb`. La validación ocurre tanto en React como en Express. Se normalizan espacios, se limitan longitudes y solo se guardan los campos permitidos.

La administración utiliza:

- `GET /admin/solicitudes-demo`
- `GET /admin/solicitudes-demo/:id`
- `PATCH /admin/solicitudes-demo/:id/estado`

Estas rutas requieren rol `admin` y un identificador de usuario válido. Admiten búsqueda, estado, fechas y paginación.

## Base de datos

`SOLICITUD_DEMO` guarda identificador, contacto, residencial, cantidad de viviendas, mensaje, estado y timestamps. Los estados permitidos son `NUEVA`, `CONTACTADA`, `DESCARTADA` y `CONVERTIDA`. Hay índices por estado/fecha y correo. `ensureDemoRequestsSchema()` hace idempotente la inicialización en instalaciones existentes.

## Seguridad y accesibilidad

- JSON limitado globalmente por Express y campos limitados individualmente.
- Honeypot antispam sin servicios externos.
- No se guardan IP, credenciales ni datos sensibles.
- Errores de base de datos no se exponen al cliente.
- Etiquetas, mensajes asociados, foco visible, controles semánticos y menú móvil operable por teclado.
- La vista comercial no altera ni expone rutas protegidas.

## Pruebas

```bash
cd backend
npm test

cd ../frontend
npm run test:run
npm run build
```

Para Docker:

```bash
docker compose -p nexus_landing_test build
docker compose -p nexus_landing_test up -d
docker compose -p nexus_landing_test down -v --remove-orphans
```

## Decisiones y pendientes comerciales

No se incluyeron métricas, premios, clientes, testimonios ni certificaciones ficticias. El correo de contacto y cualquier dominio deben configurarse antes de publicar. Los textos comerciales pueden personalizarse. La política de privacidad es una guía general y requiere revisión legal antes de un uso comercial real. No se integró envío de correo porque el proyecto no tiene un proveedor configurado.
