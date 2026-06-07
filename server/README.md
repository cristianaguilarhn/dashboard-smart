# Dashboard SMART Secure Server

Backend seguro inicial para preparar la futura redistribucion de carga y reasignacion de tramites desde Dashboard SMART.

## Estado actual

- Modo seguro por defecto.
- No conecta con SOL real.
- No mueve tramites reales.
- No guarda credenciales ni tokens reales.
- `ENABLE_SOL_REAL_WRITE=false` evita escrituras reales.

## Instalar dependencias

```bash
cd server
npm install
```

## Configuracion

Crear un archivo `.env` local a partir de `.env.example` si se necesita cambiar configuracion de desarrollo.

Variables principales:

```bash
PORT=4000
SOL_API_BASE_URL=
SOL_AUTH_MODE=manual
SOL_APP_USER=
SOL_APP_PASSWORD=
JWT_SECRET=
SESSION_TTL_MINUTES=30
ENABLE_SOL_REAL_WRITE=false
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

No colocar credenciales reales en el repositorio.

## Ejecutar

```bash
npm run server
```

Para desarrollo:

```bash
npm run dev:server
```

## Endpoints disponibles

```http
GET /api/reasignacion/status
POST /api/reasignacion/login
POST /api/reasignacion/tramite
POST /api/reasignacion/tramites
```

Todos los endpoints responden en modo seguro/controlado. La integracion real con SOL queda pendiente para una fase posterior.

## Proximo paso

Integrar autenticacion real con SOL desde este backend seguro, proteger rutas y habilitar escritura real solo cuando exista validacion funcional, auditoria y autorizacion institucional.
