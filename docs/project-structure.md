# ATLAS Arica - estructura tecnica objetivo

## Separacion de responsabilidades

El sistema debe separar tres capas:

1. Cartografia base: calles, geometria y nombres oficiales. Esta capa viene desde GeoServer u OpenStreetMap y no se edita desde el formulario de eventos.
2. Eventos viales: baches, grietas, hundimientos y reparaciones capturadas en terreno con GPS.
3. Evidencia: fotos y adjuntos asociados al evento, almacenados fuera de la base de datos relacional.

## Modelo de tablas propuesto

### profiles

Usuarios internos autorizados.

| columna | tipo | nota |
| --- | --- | --- |
| id | uuid | referencia a auth.users |
| email | text | unico |
| full_name | text | nombre del funcionario |
| role | text | admin, supervisor, operador, gestor_datos |
| created_at | timestamptz | fecha de creacion |

### road_segments

Tramos oficiales o importados desde cartografia. No representan un bache por si solos.

| columna | tipo | nota |
| --- | --- | --- |
| id | uuid | identificador interno |
| source_id | text | id OSM, GeoServer o municipal |
| street_name | text | nombre oficial de la calle |
| sector | text | sector urbano |
| geometry | geometry(LineString, 4326) | tramo georreferenciado |
| source | text | geoserver, osm, manual_import |
| updated_at | timestamptz | ultima sincronizacion |

### road_events

Evento tecnico registrado en terreno.

| columna | tipo | nota |
| --- | --- | --- |
| id | uuid | identificador del evento |
| road_segment_id | uuid | referencia opcional al tramo mas cercano |
| reported_by | uuid | usuario operador |
| severity | text | good, warning, critical, repaired |
| damage_type | text | bache profundo, grieta, hundimiento, etc. |
| length_m | numeric | largo o diametro principal |
| width_m | numeric | ancho |
| depth_cm | numeric | profundidad, si aplica |
| priority_score | numeric | 0 a 10 |
| status | text | open, under_review, repaired, rejected |
| point | geometry(Point, 4326) | GPS exacto de captura |
| geometry | geometry(LineString, 4326) | tramo afectado, si se captura inicio y fin |
| notes | text | observacion tecnica |
| captured_at | timestamptz | fecha de captura |
| repaired_at | timestamptz | fecha de reparacion |

### event_photos

Metadatos de fotos guardadas en Supabase Storage.

| columna | tipo | nota |
| --- | --- | --- |
| id | uuid | identificador |
| event_id | uuid | referencia a road_events |
| storage_path | text | ruta del objeto en Supabase Storage |
| public_url | text | URL publica o firmada |
| mime_type | text | image/jpeg, image/webp |
| size_bytes | integer | peso final comprimido |
| captured_lat | numeric | latitud de la foto |
| captured_lng | numeric | longitud de la foto |
| created_at | timestamptz | fecha de subida |

### event_history

Auditoria de cambios.

| columna | tipo | nota |
| --- | --- | --- |
| id | uuid | identificador |
| event_id | uuid | evento modificado |
| actor_id | uuid | usuario |
| action | text | created, updated, repaired, deleted |
| previous_data | jsonb | estado anterior |
| next_data | jsonb | estado nuevo |
| created_at | timestamptz | fecha del cambio |

## Algoritmos recomendados

- Asignacion de calle: buscar el road_segment mas cercano al punto GPS con PostGIS `ST_DWithin` y `ST_Distance`.
- Prioridad: calcular puntaje por severidad, dimensiones, antiguedad, cercania a vias principales y cantidad de reportes cercanos.
- Duplicados: detectar eventos abiertos a menos de 5 a 10 metros con tipo de dano similar.
- Color de mapa: derivar desde `road_events.severity`, no desde la calle base.
- Reparacion: cambiar `road_events.status` y `severity` a repaired; la calle oficial no cambia.

## Criterio tecnico clave

Editar un evento nunca debe cambiar el nombre o geometria oficial de una calle. Si el nombre esta mal, se corrige la capa cartografica o se recalcula la asociacion GPS contra el tramo mas cercano.
