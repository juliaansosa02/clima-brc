# Clima BRC

Weather Board de montaña para trekking en Bariloche y alrededores, con foco en lectura rápida, trazabilidad de fuente y datos reales.

## Estrategia de fuentes gratis

- **Open-Meteo** es la base principal gratis para todos los puntos, usando coordenadas exactas.
- **Windguru micro público** queda como referencia secundaria sólo cuando existe un `spotId` curado y razonablemente cercano para algunos puntos base.
- Open-Meteo también cubre variables que `micro.windguru` no entrega:
  - probabilidad de precipitación
  - sensación térmica
  - visibilidad
  - freezing level
  - consenso entre modelos
  - vista diaria de 14 días

## Viabilidad real de Windguru

- `micro.windguru.cz/help.php` documenta acceso por `spotId` y también por `lat/lon`.
- El modo `lat/lon` requiere cuenta **PRO** y **secondary password**, así que para una versión gratis no es una base suficiente para cubrir refugios exactos.
- Varios refugios no tienen un spot público exacto y no hay una API de búsqueda de spots documentada como integración estable.
- Modelos relevantes disponibles en la documentación de Windguru micro:
  - `ifs`
  - `icon`
  - `swrfar`
  - `wrfarg`

## Variables y proveedor/modelo

- **Windguru micro**:
  - temperatura
  - precipitación acumulada
  - humedad
  - viento sostenido
  - ráfagas
  - dirección
  - nubosidad baja / media / alta
- **Open-Meteo (ECMWF / ICON / GFS)**:
  - probabilidad de precipitación
  - sensación térmica
  - visibilidad
  - freezing level
  - además réplica de lluvia, nubes, viento y temperatura para comparación y consenso

La UI etiqueta fuente/modelo activo y muestra una matriz de trazabilidad por métrica en el detalle.

## Puntos incluidos

El archivo [points.js](C:\Users\julia\Downloads\clima-brc\src\config\points.js) contiene nombre, aliases, zona, tipo, lat/lon, tags y metadata de Windguru.

## Setup

```bash
npm run dev
```

Abrí `http://localhost:8787`.

## Deploy en Render

Esta app ya queda lista para desplegar como servicio web Node en Render.

### Opción simple

- conectá este repo en Render
- `Build Command`: `npm install`
- `Start Command`: `npm start`
- Render va a inyectar `PORT` automáticamente
- `Health Check Path`: `/healthz`

### Opción con blueprint

El repo incluye [render.yaml](C:\Users\julia\Downloads\clima-brc\render.yaml), así que también podés crear el servicio desde ese archivo.

### Notas de producción

- el servidor ya escucha en `0.0.0.0`
- `/healthz` responde para health checks
- `index.html`, `app.js` y `styles.css` salen con `no-store` para evitar quedarte pegado a una versión vieja del front
- la API `/api/board` también sale con `no-store`

### Variables de entorno

```bash
PORT=8787
CACHE_TTL_SECONDS=300
WINDGURU_USERNAME=
WINDGURU_SECONDARY_PASSWORD=
WINDGURU_PREFERRED_MODELS=ifs,icon,swrfar,wrfarg
OPEN_METEO_MODELS=ecmwf,dwd-icon,gfs
```

## Limitaciones reales

- En esta versión gratis, los refugios y puntos sin `spotId` público razonable quedan en Open-Meteo por coordenadas exactas.
- Los `spotId` públicos de Windguru curados manualmente no siempre equivalen al punto exacto del trekking; la UI muestra precisión (`area`, `nearby`, `exact-coordinates-pro`).
- La altitud aproximada quedó vacía porque no integré aún una fuente altimétrica oficial homogénea para todos los puntos.
- El score de “ventanas recomendadas” es una regla explícita sobre datos reales; no sustituye criterio de seguridad en montaña.
