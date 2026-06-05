# Dashboard SMART

Dashboard ejecutivo y operativo para monitoreo de trámites SOL, carga por técnico, fases y KPI históricos de ARSA.

## Requisitos

- .NET SDK compatible con el proyecto backend
- Node.js 18+
- npm

## Estructura

- `backend/dotnet-api/`: API ASP.NET Core con endpoint de ejemplo `/weatherforecast`.
- `frontend/web-admin/`: aplicacion React + Vite + TypeScript.
- `shared/`: espacio para contratos, tipos y utilidades compartidas.
- `.vscode/`: configuracion recomendada para desarrollo local.

## Backend

Desde la raiz del repositorio:

```powershell
cd backend/dotnet-api
dotnet restore
dotnet run --launch-profile http
```

La API queda disponible en:

```text
http://localhost:5198
```

Endpoint de prueba:

```text
http://localhost:5198/weatherforecast
```

## Frontend

Desde la raiz del repositorio:

```powershell
cd frontend/web-admin
npm install
npm run dev
```

La app queda disponible normalmente en:

```text
http://localhost:5173
```

## Variables De Entorno

El frontend usa Vite, por lo que las variables expuestas al cliente deben iniciar con `VITE_`.

Crea un archivo `frontend/web-admin/.env` basado en `frontend/web-admin/.env.example`:

```env
VITE_API_URL=http://localhost:5198
```

`frontend/web-admin/.env` no debe versionarse. Usa `.env.example` como referencia segura para la plantilla.

## Validacion

Backend:

```powershell
cd backend/dotnet-api
dotnet build
```

Frontend:

```powershell
cd frontend/web-admin
npm run build
```
