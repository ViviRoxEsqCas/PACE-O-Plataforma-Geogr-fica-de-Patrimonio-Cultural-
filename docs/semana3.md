# Semana 3 · Aprendizaje (M3) y participación ciudadana (M4)

## Qué se añadió
- **Sin tablas ni migraciones nuevas.** Las 16 tablas ya existían; se añadió la lógica (RN-04 a RN-06), la API, el panel y la interfaz.
- **API pública**

| Método y ruta | Función |
|---|---|
| `GET /api/bienes/{id}/actividades/` | Actividades activas y válidas de una ficha. **No incluye** la opción correcta ni la explicación (RN-04). |
| `POST /api/actividades/{id}/responder/` `{"opcion": id}` | Corrige en el servidor. Responde `correcta`, `puntos` y `retroalimentacion`; si es incorrecta no revela la correcta (permite reintentar). |
| `GET /api/tipos-reporte/` | Catálogo del formulario. |
| `POST /api/reportes/` `{bien, tipo_reporte, descripcion}` | Crea el reporte en estado «nuevo». Valida ficha publicada, tipo y 1 a 500 caracteres. Límite por IP: **429** al excederlo (`REPORTES_LIMITE`, por defecto `5/hour`). El visitante no puede listar ni leer reportes. |

- **Panel (Django Admin):** *Actividades* con opciones en línea (activa ⇒ 2 a 6 opciones y exactamente una correcta) y *Reportes ciudadanos* (bandeja con filtros; estado limitado a las transiciones permitidas; nota; historial con revisor y fecha; sin crear ni borrar). Editor y Administrador tienen ambos permisos.
- **PWA:** secciones «Practicar» y «Reportar» en la ficha. La puntuación se guarda en `localStorage` (con respaldo en memoria si está bloqueado); los puntos se otorgan una sola vez por actividad.

## Transiciones de estado de un reporte (RN-06)
`nuevo → en revisión | descartado` · `en revisión → atendido | descartado` · `atendido` y `descartado` son finales.

## Ajuste del catálogo a 13 bienes
Si su base viene de la semana 2 (10 fichas), ejecute **una vez**, desde `backend/`:
```powershell
python manage.py cargar_fichas_iniciales --actualizar --retirar-obsoletas
python manage.py cargar_actividades_iniciales
python manage.py verificar_catalogo
```
Renombra 4 fichas conservando su `id`, crea 7 nuevas, retira las 4 que salen del alcance y deja 13 fichas publicadas (10 con ubicación). Sin `--retirar-obsoletas` no borra nada y solo avisa. Detalle y fuentes de cada ficha: [`verificacion_fichas.md`](verificacion_fichas.md).

## Cargar contenido
```powershell
cd backend
python manage.py cargar_actividades_iniciales   # 13 actividades (una por ficha); idempotente
python manage.py cargar_imagenes --simular      # valida las fotos de contenido/imagenes/
python manage.py cargar_imagenes                # las carga
```

## Dónde y cómo se guardan las imágenes
| Qué | Dónde |
|---|---|
| Fotos originales + `manifiesto.csv` (autor, licencia, texto alternativo) | `contenido/imagenes/` (en el repositorio; JPG/WebP < 500 KB) |
| Referencia de cada imagen (ruta, autor, licencia, ficha) | Tabla `recurso_multimedia` de PostgreSQL |
| Archivo que se sirve a la PWA | `backend/media/bienes/` (en `.gitignore`) |

La base guarda la *referencia*, no los bytes. Como el repositorio conserva las fotos y el manifiesto, cualquier servidor se reconstruye con un comando.
Para el despliegue de la semana 4 basta que el servidor sirva `media/` desde un disco persistente; un servicio de objetos en la nube (S3, Cloudflare R2) solo haría falta si se esperan muchas imágenes o varios servidores.

## Pruebas
`python manage.py test` → 72 pruebas · `npm test` → 21 · `npm run e2e` → 14 casos. Resultados en `docs/evidencias/semana3/`.
Las pruebas PT-12 a PT-20 y PT-25 llevan su identificador en el nombre. El flujo completo también se verificó en Chromium (390 px); no se probó en un teléfono real.
