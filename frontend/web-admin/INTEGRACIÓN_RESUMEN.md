# Integracion Dashboard SOL

## Estado actual

El dashboard DM usa datos reales desde el proxy backend:

```text
GET /api/sol/metricas-dm
```

El proxy backend consulta:

```text
https://solapp.arsa.hn/api/Reportes/metricas-ugc?filtroNombre=%25DM%25
```

## Prioridad

1. Backend proxy.
2. Consumo real de API.
3. Diagnostico.
4. Normalizacion de campos reales UGC.
5. KPIs reales.
6. Luego redisenio visual, graficas y exportaciones avanzadas.

## Mock data

`VITE_USE_MOCK_DATA=false` por defecto. Si la API falla, la app muestra error y no inventa datos.
