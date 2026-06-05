# API SOL

## Dashboard principal DM

El dashboard ejecutivo principal debe consumir el proxy interno:

```text
GET /api/sol/metricas-dm
```

El backend proxy consume la API real de SOL:

```text
GET https://solapp.arsa.hn/api/Reportes/metricas-ugc?filtroNombre=%25DM%25
```

## Trazabilidad

El endpoint de trazabilidad queda como fuente secundaria o complementaria. No debe usarse como fuente principal del dashboard ejecutivo.

```text
GET /api/Reportes/trasabilidad-tramites?direccion=%dm0%
```

## Regla de datos

No se deben documentar ni mostrar expedientes, tramites, tecnicos, legales o colaboradores inventados. Si un dato no viene en el JSON real, la interfaz debe mostrar `Sin dato`.
