# Semana 4 · Integración, pruebas, estabilización y entrega

Este documento registra **lo que realmente se ejecutó** el 20-11-2026. No se marca como aprobado nada que no tenga una prueba y un registro.

## Entorno de las pruebas
| Dato | Valor |
|---|---|
| Sistema | Linux (contenedor de desarrollo), **no** Windows 11 |
| Despliegue | **Local** (Django `runserver` :8000 + Vite :5173 / `vite preview` :4173). **Sin HTTPS** |
| Base de datos | PostgreSQL 16 real (no SQLite), con las 13 fichas, 13 actividades y cuentas demo |
| Navegador | Google Chrome (Chromium) con Playwright. **No** se probó Firefox, Safari, Edge ni iOS/Android reales |
| Resoluciones | 360, 768 y 1366 px (emulación de viewport, no dispositivos físicos) |

## Cambios de esta semana
| Archivo | Cambio |
|---|---|
| `frontend/public/manifest.webmanifest` (nuevo) | Manifiesto PWA: nombre, `standalone`, colores de la interfaz, iconos 192/512/maskable. |
| `frontend/public/assets/icons/*.png` (nuevos) | Iconos generados con el mismo diseño de `favicon.svg` (sin cambiar la identidad visual). |
| `frontend/index.html` | Enlaces `<link rel="manifest">` y `apple-touch-icon`. Nada más. |
| `backend/apps/patrimonio/admin.py` | **Defecto corregido (PT-19):** el selector de estado de un reporte mostraba una opción vacía `---------` que no es un estado. Ahora solo ofrece el estado actual y sus transiciones válidas. |
| `backend/apps/patrimonio/test_semana4.py` (nuevo) | 5 pruebas: permisos en el servidor (PT-21), gestión de cuentas (PT-22) y bandeja de reportes (PT-19). |
| `frontend/src/pwa.test.js` (nuevo) | 7 pruebas del manifiesto, los iconos y que **no** exista service worker. |
| `frontend/e2e/semana4.e2e.mjs` (nuevo) | Recorrido completo en navegador (25 comprobaciones, incluye PT-25). |
| `frontend/e2e/semana2.e2e.mjs` | Solo admite `PACENO_CHROME` para usar un Chrome ya instalado. |

No se tocaron modelos, migraciones, endpoints, estilos ni componentes React.

## Estado de la PWA
- **Instalable:** Chrome (`Page.getAppManifest` e `getInstallabilityErrors`) no informa errores de manifiesto ni de instalabilidad.
- **Sin conexión: NO implementado** (fuera del MVP). No hay service worker ni caché. El mapa requiere internet.
- **HTTPS: no desplegado.** Chrome permite instalar desde `localhost`; en un hosting real se necesitará HTTPS.

## Tabla de pruebas PT-01 a PT-25
Resultado: **Aprobada** = ejecutada y con el resultado esperado. Las evidencias de la E2E están en `docs/evidencias/semana4/` y la lista de pruebas automáticas en `resultado_pruebas_backend.txt`.

| ID | Resultado | Cómo se comprobó | Observaciones |
|---|---|---|---|
| PT-01 | Aprobada | Backend + E2E (panel y API pública) | |
| PT-02 | Aprobada | Backend + E2E | Mensaje «NO se publicó…» con el motivo. |
| PT-03 | Aprobada | Backend (modelo y panel) | **No** repetida en navegador. |
| PT-04 | Aprobada | Backend + E2E | |
| PT-05 | Aprobada | Backend + E2E | La E2E comprueba que el rechazo se debe a autor/licencia, no a un archivo dañado. |
| PT-06 | Aprobada | E2E semana 2 y E2E semana 4 | Teselas de OSM bloqueadas en la prueba (mapa base gris); los marcadores sí se cuentan. |
| PT-07 | Aprobada | Backend + E2E semana 2 | «plaza», «PLAZA» y nombre con tilde. |
| PT-08 | Aprobada | Backend + E2E semana 2 | |
| PT-09 | Aprobada | E2E semana 4 | Con imagen y fuente cargadas desde el panel. |
| PT-10 | Aprobada con reserva | E2E semana 2 | Geolocalización **simulada** por Playwright; no se probó con GPS real. |
| PT-11 | Aprobada | Backend + E2E semana 2 | |
| PT-12 | Aprobada | Backend + E2E | La lista de actividades no contiene la respuesta ni la explicación. |
| PT-13 | Aprobada | Backend + E2E | |
| PT-14 | Aprobada | E2E | Puntos suman una vez; se conservan tras recargar. |
| PT-15 | Aprobada | Backend (base de datos y panel) + E2E | Dos correctas y ninguna correcta rechazadas. |
| PT-16 | Aprobada | Backend + E2E | HTTP 201, estado «nuevo». |
| PT-17 | Aprobada | Backend + E2E | Sin tipo, 501 caracteres y ficha borrador. |
| PT-18 | Aprobada | Backend + E2E | HTTP 429 y mensaje comprensible en la PWA. En la E2E el límite se subió con `REPORTES_LIMITE=30/hour`. |
| PT-19 | Aprobada **tras corregir un defecto** | Backend + E2E | Defecto: opción `---------` en el selector. Corregido y repetido. |
| PT-20 | Aprobada | Backend + E2E | Revisor, fecha, estado anterior y nuevo. |
| PT-21 | Aprobada | Backend + E2E | El Editor recibe **403** también al enviar los formularios directamente. |
| PT-22 | Aprobada | Backend + E2E | La cuenta desactivada no ingresa; las cuentas no se borran. |
| PT-23 | Aprobada | Backend + E2E | El historial del panel lo ve solo el Administrador. |
| PT-24 | Aprobada **solo en Chrome** | E2E semanas 2 y 4 | 360/768/1366 px sin desbordes. **No ejecutada** en otros navegadores ni en dispositivos físicos. |
| PT-25 | Aprobada (local, Chrome) | E2E semana 4 | Ficha creada y publicada en el panel → vista en la PWA → actividad → reporte → revisión del Editor. |

Conteo: backend **82/82**, frontend **37/37**, E2E semana 2 **14/14**, E2E semana 4 **25/25**.

## Limitaciones y pendientes reales
1. **Despliegue HTTPS no realizado**: se entrega ejecución local documentada.
2. **Navegadores previstos**: solo Chrome. Falta Firefox, Safari/iOS, Edge y Windows 11 real.
3. **Imágenes del catálogo**: 12 de 13 están declaradas como «Elaboración propia asistida por IA» con licencia «Autorización expresa del titular». El informe exige imágenes propias o con licencia clara; la editorial debe confirmar esa titularidad o reemplazarlas por fotografías reales. Solo la de la Revolución Libertaria (Pablo Michel, CC BY 4.0) tiene autoría externa identificable.
4. **Contenido**: coordenadas por contrastar (5 con confianza baja), actividades por revisar y manifestaciones inmateriales por validar con especialistas (ver `verificacion_fichas.md`).
5. **Video de demostración**: no se generó (no se puede grabar desde este entorno). El guion es la sección 11 del documento de la semana y lo reproduce `npm run e2e:semana4`.
6. **PT-10** con geolocalización simulada; no hay prueba con GPS real.
7. **Protección de datos personales**: revisar el marco aplicable antes de abrir el piloto al público.
8. **Contraseñas demo**: las genera `crear_cuentas_demo` (solo con `DJANGO_DEBUG=True`); no se versionan.

## Manual breve
- **Visitante:** abrir la PWA → *Explorar* (mapa/lista, buscar, filtrar) → abrir una ficha → *Practicar con este bien* → *Reportar un problema con esta ficha*. Puede instalarla desde el menú del navegador («Instalar Paceño»).
- **Editor:** `http://localhost:8000/admin/` → crear fuentes → crear ficha (borrador) → añadir fuente e imagen con autor y licencia → pasar a *publicado* → revisar *Reportes ciudadanos* y cambiar su estado (nuevo → en revisión → atendido/descartado).
- **Administrador:** lo anterior, más *Usuarios* (crear, asignar grupo, desactivar) e historial de cambios.

## Endpoints realmente disponibles
`GET /api/bienes/` · `GET /api/bienes/{id}/` · `GET /api/categorias/` · `GET /api/bienes/{id}/actividades/` · `POST /api/actividades/{id}/responder/` · `GET /api/tipos-reporte/` · `POST /api/reportes/` (este último y `tipos-reporte` se añadieron en la semana 3; ver `docs/semana3.md`).

## Cómo repetir las pruebas
```powershell
# Backend (desde backend\, con el entorno virtual activo)
python manage.py test

# Frontend unitarias (desde frontend\)
npm test

# E2E (con backend iniciado con REPORTES_LIMITE=30/hour y frontend activo; desde frontend\)
$env:PACENO_EDITOR_CLAVE = "<clave de editor_demo>"
$env:PACENO_ADMIN_CLAVE  = "<clave de admin_demo>"
npm run e2e:semana4
```
