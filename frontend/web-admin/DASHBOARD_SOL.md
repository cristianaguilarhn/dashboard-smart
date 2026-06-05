# Dashboard Ejecutivo SOL - DM

## Fuente principal

El frontend consume solo el endpoint interno:

```text
GET /api/sol/metricas-dm
```

El backend proxy consume SOL:

```text
GET https://solapp.arsa.hn/api/Reportes/metricas-ugc?filtroNombre=%25DM%25
```

## Reglas

- No consumir SOL directamente desde el navegador.
- No usar datos simulados salvo que `VITE_USE_MOCK_DATA=true`.
- Si la API falla y mock esta apagado, mostrar error claro y no inventar informacion.
- Si un dato no viene en el JSON real, mostrar `Sin dato`.

## Diagnostico

El modo desarrollo muestra URL consultada por backend, status HTTP, total recibido, primer registro crudo, campos detectados, total normalizado, total filtrado y errores de mapeo.
