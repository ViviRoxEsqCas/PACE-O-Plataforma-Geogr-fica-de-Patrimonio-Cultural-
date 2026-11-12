<div align="center">

<img src="assets/header.svg" alt="PACEÑO · Patrimonio cultural de La Paz" width="100%">

<br>

![Semana 1](https://img.shields.io/badge/SEMANA_1-COMPLETA-4FA36A?style=for-the-badge&labelColor=2A2723)
![Semana 2](https://img.shields.io/badge/SEMANA_2-CON_PENDIENTES-F5C842?style=for-the-badge&labelColor=2A2723)
![Semana 3](https://img.shields.io/badge/SEMANA_3-COMPLETA-4FA36A?style=for-the-badge&labelColor=2A2723)
![Semana 4](https://img.shields.io/badge/SEMANA_4-PENDIENTE-6FA3C7?style=for-the-badge&labelColor=2A2723)

![React](https://img.shields.io/badge/React-A8423C?style=flat-square&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-A8423C?style=flat-square&logo=vite&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-A8423C?style=flat-square&logo=leaflet&logoColor=white)
![Django](https://img.shields.io/badge/Django_REST-A8423C?style=flat-square&logo=django&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-A8423C?style=flat-square&logo=postgresql&logoColor=white)

</div>

<img src="assets/divider.svg" width="100%" alt="">

## ¿Qué es?

**Paceño** es una aplicación web progresiva para explorar bienes y manifestaciones culturales del centro de La Paz: un catálogo documentado, un mapa interactivo y fichas con fuentes verificables.

<div align="center">

| 📚 **13** fichas con fuente | 🧪 **107** pruebas (72 back · 21 unit · 14 E2E) | 📱 **3** tamaños adaptables |
|:--:|:--:|:--:|

</div>

<img src="assets/divider.svg" width="100%" alt="">

## Qué puedes hacer

| | |
|:--|:--|
| 🔎 **Buscar** | Por nombre, sin distinguir mayúsculas ni tildes. |
| 🗂️ **Filtrar** | Por categoría, con limpieza rápida. |
| 📍 **Explorar el mapa** | Marcadores con vista previa; la lista sirve como alternativa. |
| 📄 **Consultar fichas** | Descripción, ubicación y fuentes documentales. |
| 📏 **Medir distancia** | Opcional y bajo demanda. Se calcula en tu navegador; nunca se envía ni se guarda. |
| 🎓 **Practicar** | Preguntas de opción múltiple por ficha, corregidas en el servidor, con explicación, reintento y puntuación que queda solo en tu navegador. |
| 📣 **Reportar** | Formulario anónimo (tipo + descripción de hasta 500 caracteres) que revisa el equipo editorial. |
| 🛠️ **Administrar** | Panel editorial con roles de Editor y Administrador: fichas, actividades y bandeja de reportes con historial de revisión. |

<img src="assets/divider.svg" width="100%" alt="">

## Vista previa

<table>
  <tr>
    <td width="50%" align="center"><b>Mapa y lista</b><br><img src="docs/evidencias/semana2/pt06_escritorio_mapa_lista.png" alt="Mapa y lista en escritorio" width="100%"></td>
    <td width="50%" align="center"><b>Ficha patrimonial</b><br><img src="docs/evidencias/semana2/pt09_ficha_escritorio.png" alt="Ficha en escritorio" width="100%"></td>
  </tr>
  <tr>
    <td align="center"><b>Móvil · 360 px</b><br><img src="docs/evidencias/semana2/pt24_360px_lista.png" alt="Lista en móvil" width="40%"></td>
    <td align="center"><b>Panel del Editor</b><br><img src="docs/evidencias/panel_editor_fichas.png" alt="Panel del Editor" width="100%"></td>
  </tr>
</table>

<details>
<summary><b>Ver más capturas</b></summary>
<br>

<table>
  <tr>
    <td width="33%"><b>Filtro por categoría</b><br><img src="docs/evidencias/semana2/pt08_filtro_categoria.png" width="100%" alt="Filtro de categoría"></td>
    <td width="33%"><b>Distancia con permiso</b><br><img src="docs/evidencias/semana2/pt10_distancia_con_permiso.png" width="100%" alt="Distancia con permiso"></td>
    <td width="33%"><b>Tablet · 768 px</b><br><img src="docs/evidencias/semana2/pt24_768px_lista.png" width="100%" alt="Lista en tablet"></td>
  </tr>
  <tr>
    <td><b>Validación de publicación</b><br><img src="docs/evidencias/pt02_publicacion_rechazada.png" width="100%" alt="Rechazo de publicación incompleta"></td>
    <td><b>Usuarios del Administrador</b><br><img src="docs/evidencias/panel_admin_usuarios.png" width="100%" alt="Gestión de usuarios"></td>
    <td><b>Inicio del Editor</b><br><img src="docs/evidencias/panel_editor_inicio.png" width="100%" alt="Inicio del Editor"></td>
  </tr>
</table>

</details>

<img src="assets/divider.svg" width="100%" alt="">

## Arquitectura

```mermaid
flowchart LR
    A["⚛️ React + Vite<br/>Leaflet · Router"] -->|"HTTP / JSON"| B["🐍 Django REST<br/>API de lectura"]
    B -->|"ORM"| C[("🐘 PostgreSQL<br/>16 tablas")]
    D["🛠️ Django Admin"] -.-> C
    E["🗺️ OpenStreetMap"] -.-> A

    classDef f fill:#FBE3C8,stroke:#2A2723,color:#2A2723,stroke-width:2px
    classDef b fill:#F7D9D6,stroke:#A8423C,color:#2A2723,stroke-width:2px
    classDef d fill:#D8EEDD,stroke:#2F6B45,color:#2A2723,stroke-width:2px
    classDef x fill:#FFF3C4,stroke:#2A2723,color:#2A2723,stroke-width:2px
    class A f
    class B b
    class C d
    class D,E x
```

> PostgreSQL sin PostGIS en el MVP · Coordenadas WGS 84 · El mapa requiere conexión a internet.

<img src="assets/divider.svg" width="100%" alt="">

## Identidad visual

Estilo de **cuaderno cuadriculado** con colores vivos y guiños andinos: franjas de aguayo, chakana y la silueta del Illimani. El rojo aguayo, opaco y no brillante, es el color principal.

<img src="assets/paleta.svg" width="100%" alt="Paleta de color de Paceño">

| Uso | Fuente |
|:--|:--|
| Marca | Rubik Mono One |
| Títulos | Cutive Mono |
| Cuerpo y etiquetas | Space Mono |

Tokens listos para usar en [`frontend/src/styles/tokens.css`](frontend/src/styles/tokens.css).

<img src="assets/divider.svg" width="100%" alt="">

## Inicio rápido (Windows 11)

**Requisitos:** Python 3.12+ · Node.js 20.19+ · PostgreSQL 16 · Git

<table>
  <tr>
    <td width="50%" valign="top">

**Terminal 1 · Backend**

```powershell
cd .\backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# Edita .env: DB_PASSWORD y DJANGO_SECRET_KEY
python manage.py migrate
python manage.py cargar_fichas_iniciales --actualizar --retirar-obsoletas
python manage.py cargar_actividades_iniciales
python manage.py crear_cuentas_demo
python manage.py runserver
```

</td>
    <td width="50%" valign="top">

**Terminal 2 · Frontend**

```powershell
cd .\frontend
npm ci
npm run dev
```

Abre **http://localhost:5173**

> Necesitas la base `paceno` y el usuario `paceno` creados en PostgreSQL.

</td>
  </tr>
</table>

**Pruebas:** `python manage.py test` (backend) · `npm test` (frontend) · `npm run e2e` (navegador, con ambos servidores activos).

<img src="assets/divider.svg" width="100%" alt="">

## Hoja de ruta

| Semana | Alcance | Estado |
|:--|:--|:--:|
| **01** | Django, PostgreSQL, modelo de datos, roles, panel editorial y API | ✅ |
| **02** | PWA React: lista, ficha, mapa, búsqueda, filtros y distancia | ✅ ⚠️ |
| **03** | Actividades de opción múltiple y reportes ciudadanos | ✅ · [guía](docs/semana3.md) |
| **04** | Manifiesto PWA, uso sin conexión, despliegue HTTPS y documentación final | ⏳ |

### Pendientes conocidos

- **Imágenes:** 0 de 13 fichas tienen imágenes cargadas todavía. Ya existe el espacio para cargarlas: [`contenido/imagenes/`](contenido/imagenes/LEEME.md) + `python manage.py cargar_imagenes`.
- **Actividades:** las 10 preguntas de arranque usan solo datos de las fichas y sus leyes; requieren revisión editorial.
- **Coordenadas:** por contrastar con la IDE La Paz; 5 tienen confianza baja (Casa Museo, Calle Jaén, Museo Costumbrista, Museo del Litoral y Teatro Municipal). Los museos de la calle Jaén están a pocos metros y sus marcadores se superponen al alejar el mapa. Detalle en [`verificacion_fichas.md`](docs/verificacion_fichas.md).
- **Patrimonio inmaterial:** las 3 manifestaciones requieren validación con especialistas o personas portadoras.
- **Pruebas E2E:** solo en Chromium sobre Linux; falta Windows 11, Safari, Firefox e iOS. Sin conexión a teselas, el mapa base aparece gris en las capturas.
- **Captura sintética:** `pt09_imagen_sintetica_de_prueba_con_atribucion.png` es una imagen de prueba, no contenido patrimonial real.

Detalle de evidencias: [`docs/evidencias/`](docs/evidencias/) · [`verificacion_fichas.md`](docs/verificacion_fichas.md)

<br>

<div align="center">

<img src="assets/divider.svg" width="60%" alt="">

**PACEÑO** · Taller de Proyecto · UMSA
Desarrollo de Software e Innovación Tecnológica · La Paz, Bolivia

</div>
