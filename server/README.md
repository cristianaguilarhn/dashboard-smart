# Dashboard SMART Secure Server

Backend seguro inicial para preparar la redistribucion de carga y reasignacion de tramites desde Dashboard SMART.

## Estado actual

- Modo seguro por defecto.
- No conecta con SOL real mientras `SOL_INTEGRATION_ENABLED=false`.
- No mueve tramites reales.
- No guarda credenciales ni tokens reales.
- `SOL_INTEGRATION_ENABLED=false` evita escrituras reales.

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
SOL_API_BASE_URL=https://URL_PREPRODUCCION/sol
SOL_USERNAME=
SOL_PASSWORD=
SOL_TOKEN=
SOL_INTEGRATION_ENABLED=false
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
GET /api/dashboard/status
POST /api/dashboard/login
POST /api/dashboard/reasignar-tramites
```

`POST /api/dashboard/reasignar-tramites` recibe:

```json
{
  "codigos": [12345, 12346],
  "responsable": 58,
  "nota": "Redistribucion de carga operativa"
}
```

El backend valida el payload y responde en modo simulacion mientras `SOL_INTEGRATION_ENABLED=false`.
Cuando se active la integracion, llamara a `POST /api/Listas/CambiarResponsables` usando query params repetidos `Codigos`.

## Proximo paso

Validar en preproduccion el contrato de `POST /api/Listas/CambiarResponsables` antes de activar `SOL_INTEGRATION_ENABLED=true`.
