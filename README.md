# Paceño

PWA para **descubrir, aprender y cuidar el patrimonio cultural del centro de La Paz** (Taller de Proyecto, Informática, UMSA).
Catálogo de fichas con fuentes documentadas, mapa con búsqueda y filtros, actividades educativas y reportes ciudadanos revisados
por un equipo editorial. El alcance completo está en el informe del proyecto; este repositorio lo implementa por semanas.

## Avance

| Semana | Alcance (informe, sección 12) | Estado |
|---|---|---|
| 1 | Base de datos y migraciones, panel con roles Editor/Administrador, validación de publicación, API de lectura, primeras fichas | ✅ Completa |
| 2 | PWA (React, Vite, rutas), lista paginada, ficha, mapa con marcadores y vista previa, búsqueda, filtro, diseño adaptable, distancia con permiso, 10 fichas | ✅ Completa, con **un bloqueo**: 0 imágenes (ver «Limitaciones») |
| 3 | Actividades (M3) y reportes ciudadanos (M4) | ⏳ Pendiente |
| 4 | Integración, pruebas finales, manifiesto PWA, despliegue HTTPS | ⏳ Pendiente |

Requisitos funcionales cubiertos: RF-01 a RF-10 y RF-12 (completos), RF-08 y RF-11 incluidos (en el cronograma eran recortables), RF-20 a RF-23
(panel y roles). Pendientes: RF-13 a RF-19 (semana 3).

## Arquitectura

Cliente-servidor por capas (sección 8). Se conserva la de la semana 1; la semana 2 añade solo la capa de presentación.

```
paceno/
├── backend/                         Django 5.2 + DRF + PostgreSQL (sin cambios de diseño respecto a la semana 1)
│   ├── config/                      settings por variables de entorno, urls
│   └── apps/patrimonio/             models (reglas RN-01..03) · roles · admin · serializers/views/urls (API) · migrations · comandos · tests
├── frontend/                        PWA React + Vite (nuevo)
│   ├── src/lib/                     api.js (cliente HTTP) · distancia.js (Haversine, formato)
│   ├── src/hooks/                   useDatos (carga/cancelación/reintento) · Ubicacion (permiso, solo memoria) · useMedia
│   ├── src/components/              Cabecera · Filtros · ListaBienes · Paginacion · MapaBienes (Leaflet) · Estados
│   ├── src/pages/                   Explorar (lista + mapa) · Ficha
│   └── e2e/semana2.e2e.mjs          verificación en navegador real (PT-06..11, PT-24)
└── docs/                            evidencias/ (capturas, JSON, resultados) · verificacion_fichas.md
```

**Flujo:** la PWA solo habla con `/api/*` (en desarrollo, Vite lo redirige al backend: sin CORS). Búsqueda, categoría y página viven en la URL, así que
«atrás» desde una ficha conserva el estado. El mapa pide todos los bienes con ubicación (`page_size=100`, recorre páginas) y la lista pide una página de 10;
si el mapa falla, la lista sigue disponible (CU-01). La posición de la persona se calcula en el navegador y **nunca se envía ni se guarda** (RN-07).

**Ajuste al backend en la semana 2:** solo contenido (`cargar_fichas_iniciales` ampliado a 10 fichas y con `--actualizar`) y pruebas. No hubo cambios
de modelo ni de API: la de la semana 1 ya cubría lo que necesita el cliente.

## Tecnologías

Backend: Python 3.12+, Django 5.2 LTS, Django REST Framework, django-cors-headers, psycopg 3, Pillow, PostgreSQL 16 (con `unaccent`, sin PostGIS).
Frontend: React 18.3, React Router 7.18, Leaflet 1.9, Vite 8, Vitest 5 (Node ≥ 20.19). `npm audit`: 0 vulnerabilidades. Mapa base: teselas de OpenStreetMap (requieren internet).

## Instalación y ejecución en Windows 11 (PowerShell en VS Code)

Necesitará **dos terminales** (menú *Terminal → Dividir terminal*): una para el backend y otra para el frontend.

### 0. Requisitos (una sola vez)
```powershell
winget install -e --id Python.Python.3.12
winget install -e --id OpenJS.NodeJS.LTS
winget install -e --id PostgreSQL.PostgreSQL.16      # anote la contraseña de "postgres"
```
Cierre y reabra VS Code. Verifique: `py -3.12 --version` · `node --version` (debe ser 20.19 o superior; si es menor, instale la LTS actual) · `npm --version`.

### 1. Base de datos (solo si no la creó en la semana 1)
Cambie `CONTRASENA_PACENO` por una contraseña propia (la usará en el paso 3).
```powershell
$psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
& $psql -U postgres -h localhost -c "CREATE ROLE paceno LOGIN CREATEDB PASSWORD 'CONTRASENA_PACENO';"
& $psql -U postgres -h localhost -c "CREATE DATABASE paceno OWNER paceno ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'Spanish_Bolivia.1252' LC_CTYPE 'Spanish_Bolivia.1252';"
```
Si `Spanish_Bolivia.1252` no existe, use `LC_COLLATE 'C' LC_CTYPE 'C'`. `CREATEDB` permite que `manage.py test` cree su base temporal.

### 2. Terminal 1 — Backend
```powershell
cd C:\ruta\a\paceno\backend
py -3.12 -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Variables de entorno del backend
```powershell
Copy-Item .env.example .env
notepad .env
```
Edite `DB_PASSWORD` (la del paso 1) y `DJANGO_SECRET_KEY` (genere una con `python -c "import secrets; print(secrets.token_urlsafe(60))"`). Si ya tenía un `.env` de la semana 1, sirve igual.

### 4. Datos y servidor del backend
```powershell
python manage.py migrate
python manage.py cargar_fichas_iniciales --actualizar   # crea las 10 fichas; si venía de la semana 1, renombra y actualiza las 7 anteriores
python manage.py crear_cuentas_demo                      # muestra las contraseñas UNA vez; anótelas
python manage.py runserver
```
Deje esta terminal abierta.

### 5. Terminal 2 — Frontend
```powershell
cd C:\ruta\a\paceno\frontend
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm ci
npm run dev
```
`.env` del frontend **no es necesario** en local (el proxy de Vite apunta a `http://127.0.0.1:8000`). Si el backend está en otra dirección: `Copy-Item .env.example .env` y edite `VITE_PROXY_TARGET`.

### 6. Comprobar que funciona
Abra **http://localhost:5173**.

| Qué hacer | Resultado esperado |
|---|---|
| Abrir la página | «10 bienes encontrados»; 6 marcadores en forma de corazón; lista con 10 tarjetas (en escritorio ambos a la vez; en móvil, pestañas Mapa/Lista) |
| Pulsar un marcador | Vista previa con nombre, tipo y categoría; «Ver ficha» abre la ficha |
| Buscar `plaza`, `PLAZA`, `pacena`, `paceña` | `plaza`/`PLAZA` → Plaza Murillo; `pacena`/`paceña` → Cueca Paceña |
| Elegir categoría «Arquitectura religiosa» | 3 bienes en lista y 3 marcadores; «Quitar filtros» restaura los 10 |
| Abrir una ficha | Descripción, ubicación con mapa, y fuentes con fecha de consulta |
| «Ver distancia a cada bien» y aceptar el permiso | Aparece «a ~X m / km» en cada bien con ubicación; si lo deniega, todo lo demás sigue funcionando |
| Abrir «Cueca Paceña» | La ficha indica que no tiene ubicación puntual; en el mapa se avisa de «4 bienes sin ubicación puntual» |
| Reducir la ventana a 360 px (o usar el modo dispositivo de las herramientas del navegador) | Sin desplazamiento horizontal; aparecen las pestañas Mapa/Lista |
| http://127.0.0.1:8000/admin con `editor_demo` / `admin_demo` | Editor sin «Usuarios»; Administrador con Usuarios e Historial |

**Pruebas automatizadas** (terminal con el entorno activo):
```powershell
cd C:\ruta\a\paceno\backend;  python manage.py test      # 43 pruebas · debe terminar en OK
cd C:\ruta\a\paceno\frontend; npm test                    # 14 pruebas unitarias · OK
```
**Verificación en navegador (opcional, 14 casos)** con el backend y el frontend en marcha:
```powershell
cd C:\ruta\a\paceno\frontend
npm install --no-save playwright
npx playwright install chromium
npm run e2e
```
Escribe capturas y `resultados_e2e.md` en `docs/evidencias/semana2/`. Ejecútelo con las 10 fichas cargadas y sin otros filtros activos: los casos asumen esos datos.

**Verificar el catálogo** (informe: «10 fichas con fuente y licencia, 100 %»; solo lee la base de datos):
```powershell
cd C:\ruta\a\paceno\backend; python manage.py verificar_catalogo             # informe por ficha
python manage.py verificar_catalogo --estricto                                  # falla (código ≠ 0) mientras el criterio no se cumpla
```
Hoy informa **10/10 fichas con fuente y 0/10 con imágenes atribuidas** («CRITERIO NO CUMPLIDO»): ver Limitaciones.

## Funcionalidades implementadas

**Semana 1 (backend):** 16 tablas + catálogos; Django Admin con roles Editor/Administrador; publicación validada (RN-01..03) con historial; API
`GET /api/bienes/`, `/api/bienes/{id}/`, `/api/categorias/`; cuentas de demostración.
**Semana 2 (frontend):** exploración con mapa y lista sincronizados; vista previa; búsqueda sin tildes ni mayúsculas (con pausa de 300 ms); filtro por
categoría con totales; paginación; ficha con fuentes e imágenes con autor y licencia; distancia aproximada bajo demanda; bienes sin coordenadas
solo en lista; estados de carga, vacío y error con «Reintentar»; teclado, etiquetas y contraste AA (verificado por cálculo, ≥ 5,9:1).

## Limitaciones conocidas

- **Hay 0 imágenes.** El entorno de desarrollo no puede descargar de Wikimedia ni de otras webs, y no se puede inventar autor/licencia. La PWA
  ya muestra imágenes con atribución: se comprobó (caso PT-09b con una respuesta simulada, y además con un archivo real servido por el backend en una base de
  pruebas aparte; captura `pt09_imagen_sintetica_de_prueba_con_atribucion.png`, imagen generada, **no** es contenido del catálogo). Mientras tanto la ficha indica: *«todavía no tiene imágenes…»*.
  **Cargue las imágenes desde el panel** (ficha → Imágenes: archivo, autor y licencia obligatorios). Hasta entonces no se cumple el criterio «imágenes
  atribuidas» de la semana 2 en el contenido, aunque sí en el software.
- **Coordenadas sin contrastar con la IDE La Paz**: vienen de Wikipedia/Sygic/trek.zone. Dos tienen confianza baja (Casa Museo de Murillo, avenida
  Aniceto Arce). Detalle en `docs/verificacion_fichas.md`. Museo y Convento de San Francisco comparten punto, por eso sus marcadores se superponen.
- Las 4 manifestaciones inmateriales no están validadas con especialistas o portadores (RN-09). Los datos históricos de las fichas se limitaron a lo
  que las fuentes no contradicen.
- **No se probó en Windows 11, Safari, Firefox ni iOS**; las pruebas e2e corrieron en Chromium sobre Linux, sin acceso a las teselas de OpenStreetMap
  (el mapa se probó con marcadores sobre fondo gris; con internet se verá el mapa base). RNF-08 queda pendiente de ese contraste.
- La ubicación solo funciona en HTTPS o `localhost`. Sin manifiesto ni instalación de la PWA (semana 4, según cronograma). Aún no hay botones «Practicar» ni «Reportar» en la ficha (semana 3).
- RNF-05/06 (usabilidad y rendimiento con personas/dos dispositivos) no se midieron. No se ejecutó `check --deploy` con un dominio real.

## Recomendaciones para la semana 3

1. **Reemplazar los datos provisionales primero**: cargar imágenes y contrastar coordenadas; son riesgos ya declarados en la sección 15 del informe.
2. Actividades (M3): exigir *exactamente una* opción correcta (hoy el índice solo impide más de una), registrar `Actividad`/`OpcionActividad` y
   `ReporteCiudadano` en el admin con sus permisos en `roles.py`; endpoint `POST …/responder/` sin exponer la opción correcta antes de responder.
3. Reportes (M4): `POST /api/reportes/` con límite de frecuencia (429) y transiciones de estado con historial; añadir «Practicar» y «Reportar» a `Ficha.jsx`
   (hay que reservar su sitio: el espacio bajo «Fuentes»).
4. Guardar la puntuación en `localStorage` con `try/catch` (puede estar bloqueado); no hay estado persistente en el cliente todavía.
5. Antes de la semana 4: servir `frontend/dist` y `media` en producción (las URL de las imágenes salen con el host de la petición; el proxy debe reenviar `Host`/`X-Forwarded-*`), añadir el manifiesto y los iconos, y repetir el e2e en el dispositivo real.
