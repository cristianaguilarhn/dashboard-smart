# Dashboard SMART ARSA

Dashboard ejecutivo y operativo para monitoreo de trámites SOL, carga por técnico, fases, KPI históricos y reasignación segura.

## Estructura

- `frontend/web-admin/`: aplicación React + Vite + TypeScript del dashboard.
- `backend/dotnet-api/`: API ASP.NET Core que funciona como proxy para métricas reales de SOL.
- `server/`: backend Node/Express seguro para validar solicitudes de reasignación.
- `shared/`: contratos, tipos y utilidades compartidas.
- `deploy/`: recursos de despliegue.

## Requisitos

- Node.js 18+
- npm
- .NET SDK compatible con el proyecto `backend/dotnet-api`

## Variables De Entorno

No versionar archivos `.env`. Usa los `.env.example` como plantilla.

Frontend: crea `frontend/web-admin/.env` basado en `frontend/web-admin/.env.example`.

```env
VITE_API_URL=http://localhost:5198
VITE_DASHBOARD_API_URL=http://localhost:4000
VITE_SOL_LEGAL_DM_URL=/api/sol/legal-dm
VITE_USE_MOCK_DATA=false
VITE_DATA_SOURCE=api
```

- `VITE_API_URL`: URL del backend .NET para métricas SOL.
- `VITE_DASHBOARD_API_URL`: URL del backend Node seguro para reasignación.
- `VITE_SOL_LEGAL_DM_URL`: ruta del proxy .NET para fase legal DM en vivo.
- `VITE_DATA_SOURCE=api`: usa `/api/sol/metricas-dm` mediante el backend .NET.
- `VITE_DATA_SOURCE=json`: modo local explícito; carga archivos desde `frontend/web-admin/public/data/api-json`.
- `VITE_USE_MOCK_DATA=true`: modo mock explícito para desarrollo.

Backend Node: crea `server/.env` basado en `server/.env.example`.

```env
PORT=4000
ENABLE_SOL_REAL_WRITE=false
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

## Levantar Servicios

Backend .NET para métricas SOL:

```powershell
cd backend/dotnet-api
dotnet restore
dotnet run --launch-profile http
```

Queda disponible en:

```text
http://localhost:5198
```

Endpoint usado por el dashboard:

```text
GET http://localhost:5198/api/sol/metricas-dm
GET http://localhost:5198/api/sol/legal-dm
```

Backend Node seguro para reasignación:

```powershell
cd server
npm install
npm run server
```

Queda disponible en:

```text
http://localhost:4000
```

Endpoints principales:

```text
GET  http://localhost:4000/health
GET  http://localhost:4000/api/reasignacion/status
POST http://localhost:4000/api/reasignacion/tramite
POST http://localhost:4000/api/reasignacion/tramites
```

Frontend:

```powershell
cd frontend/web-admin
npm install
npm run dev
```

La app queda disponible normalmente en:

```text
http://localhost:5173
```

## Notas De Integración

- El proxy de Vite mantiene `/api` apuntando al backend .NET en `http://localhost:5198` para no romper el consumo real de `/api/sol/metricas-dm`.
- La vista `Fase legal en vivo` consume `/api/sol/legal-dm`, que proxifica `dm-tramites-fase-legal?direccion=DM0`.
- La reasignación no usa el proxy `/api`; llama al backend Node mediante `VITE_DASHBOARD_API_URL`.
- Si `VITE_DASHBOARD_API_URL` no está configurada, el frontend reporta un error claro y no simula éxito.
- Los JSON grandes de respaldo viven en `frontend/web-admin/public/data/api-json` y solo se descargan cuando se activa explícitamente `VITE_DATA_SOURCE=json`. Para fase legal local, el archivo esperado es `dm-tramites-fase-legal.customization`.

## Validación

Frontend:

```powershell
cd frontend/web-admin
npm run build
npm audit --omit=dev
```

Backend Node:

```powershell
cd server
node --check index.js
npm audit --omit=dev
```

Backend .NET:

```powershell
cd backend/dotnet-api
dotnet build
```
