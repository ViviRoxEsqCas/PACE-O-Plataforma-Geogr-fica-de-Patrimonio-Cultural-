# Correcciones: icono de descarga e imágenes en el móvil

Registro de lo que se investigó y se ejecutó el 22-11-2026. Solo se corrigió lo que tenía una causa comprobada.

## Entorno de las pruebas
| Dato | Valor |
|---|---|
| Sistema | Linux (contenedor), PostgreSQL 16 real, 13 fichas con sus 13 imágenes cargadas |
| Navegador | Google Chrome 153 con Playwright (CDP). Móvil **emulado** (Pixel 7), no un teléfono físico |
| Red | IP de la LAN del contenedor (`192.0.2.2`) por HTTP, Vite con `--host` |
| Simulación del teléfono | Toda petición a `127.0.0.1`/`localhost` distinta del origen de la página se rechaza: en un teléfono esa dirección es el propio teléfono, no el ordenador |

## 1. Icono de descarga no visible

**Hallazgo: no hay ningún componente, icono ni botón de descarga que corregir.**
- Búsqueda en todo el código (`descarg`, `download`, `install`, `beforeinstallprompt`, `a[download]`, blobs), en los estilos y en **todo el historial de git**: las únicas coincidencias son comentarios y documentación («evita descargar el Chromium de Playwright»). Nunca existió un botón de descarga.
- En el DOM real de `/` y `/explorar` no hay ningún elemento con clases, `aria-label` ni `download` relacionados con descargar o instalar.
- Lo único parecido es la **instalación de la PWA** (semana 4: `manifest.webmanifest` + iconos), que el navegador ofrece con su propio icono en la barra de direcciones. `docs/semana4.md` ya indica que no hay botón propio («menú del navegador → Instalar Paceño»).

**Instalabilidad medida con Chrome 153 (`Page.getInstallabilityErrors`, perfil normal, no incógnito):**

| Dirección | Resultado |
|---|---|
| `http://localhost:5173` (desarrollo) | **Instalable, 0 errores** |
| `http://localhost:4173` (build de producción) | **Instalable, 0 errores** |
| `http://<IP de la LAN>:5173` | `not-from-secure-origin`: Chrome **no** ofrece instalar por HTTP en una IP |

**Conclusión.** Manifiesto, iconos (192, 512, maskable) y enlaces están bien; no hay causa en el código. Si el icono no aparece:
1. **Desde el móvil por la IP en HTTP:** es una regla del navegador (la instalación exige contexto seguro) y no se arregla en el código. Opciones, sin aplicar aquí: HTTPS con un certificado de confianza local (p. ej. `mkcert`) o abrir `localhost` en el teléfono mediante `adb reverse tcp:5173 tcp:5173`.
2. **En el ordenador:** si la app ya está instalada, Chrome muestra «abrir en la aplicación» en lugar del icono de instalar.

No se añadió ningún botón: sería un componente nuevo y el encargo prohibía alterar el diseño.

## 2. Imágenes que no cargan en el móvil

**Causa raíz (reproducida).** En desarrollo, `vite.config.js` usa la forma abreviada del proxy (`"/api": destino`), que equivale a `changeOrigin: true` y **reescribe la cabecera `Host`**. El navegador envió `Host: 192.0.2.2:5199` y el backend recibió `127.0.0.1:8099` (comprobado con un servidor de eco). `ImagenSerializer.get_url` construía la imagen con `request.build_absolute_uri()`, así que la API devolvía:

```
http://127.0.0.1:8000/media/bienes/ficha_basilica_san_francisco_1.png
```

El teléfono pedía esa dirección a sí mismo y fallaba. En el ordenador funcionaba porque ahí `127.0.0.1:8000` sí es el backend. Mismo defecto en la foto de perfil (`url_foto`, app social).

**Solución.** La API entrega la ruta `/media/...` sin esquema ni host y el navegador la resuelve contra la dirección con la que abrió la página (IP de la LAN, dominio, HTTP o HTTPS). Se eligió frente a otras opciones porque:
- no exige añadir la IP del equipo a `DJANGO_ALLOWED_HOSTS` (la IP cambia con el DHCP y un comodín sería inseguro) ni activar `USE_X_FORWARDED_HOST`;
- evita el contenido mixto: detrás de un proxy HTTPS sin `X-Forwarded-Proto`, Django emitiría `http://` dentro de una página `https://`;
- un almacenamiento externo (S3, etc.) sigue devolviendo su URL completa sin cambios.

Con `VITE_API_URL` (API en otro origen) el helper `urlRecurso` antepone esa dirección a las rutas `/media/…`; los activos propios (`/assets/…`) no se tocan.

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `backend/apps/patrimonio/serializers.py` | `ImagenSerializer.get_url` devuelve `obj.archivo.url` (ruta) en vez de una URL absoluta. |
| `backend/apps/social/serializers.py` | `url_foto` igual, por la misma causa. |
| `frontend/src/lib/api.js` | Nueva función `urlRecurso(url, base)`. |
| `frontend/src/components/Foto.jsx` | `<img src={urlRecurso(src)}>`. |
| `frontend/src/components/Persona.jsx` | Avatar con `urlRecurso(persona.foto)`. |
| `frontend/src/lib/api.test.js` | 3 pruebas de `urlRecurso`. |

Sin cambios en estilos, diseño, componentes visibles, imágenes, dependencias, `settings.py`, `vite.config.js` ni `.env`.

### Qué se descartó como causa
- **CORS:** las `<img>` sin `crossorigin` no usan CORS, y por el proxy todo es del mismo origen.
- **`ALLOWED_HOSTS`:** Django sigue viendo `127.0.0.1:8000` a través del proxy; no hace falta tocarlo.
- **Contenido mixto / restricciones de HTTP:** página HTTP pidiendo imágenes HTTP; no aplica. Las rutas relativas tampoco lo introducen si luego se sirve por HTTPS.
- **`MEDIA_URL`/`MEDIA_ROOT`/`static()`:** correctos; `/media/...` responde 200 por la IP de la LAN a través del proxy.

> Para abrir la PWA desde el teléfono, Vite debe escucharse en la red: `npm run dev -- --host`. No se cambió la configuración para no exponer el servidor de desarrollo por defecto.

## Pruebas

| Prueba | Antes | Después |
|---|---|---|
| Móvil emulado por IP de la LAN: imágenes `/media/` cargadas en `/`, `/explorar` y 2 fichas | **0 de 24** (todas pedidas a `127.0.0.1:8000`) | **24 de 24** (pedidas a la IP de la LAN) |
| Escritorio por `localhost` (regresión) | 24 de 24 | 24 de 24 |
| Móvil con `VITE_API_URL=http://<IP>:8001` (API en otro origen) | — | 24 de 24 (pedidas a `<IP>:8001`) |
| Frontend `npm test` | 45/45 | **48/48** |
| `vite build` | — | Correcto |
| Backend `manage.py test` | — | **141/141** |
| E2E semana 2 (`PT-06…PT-24`) | — | **14/14** |

**Limitaciones:** móvil emulado en Chrome, no un teléfono físico ni otros navegadores (Safari/iOS, Firefox). Los mosaicos del mapa de OpenStreetMap quedan bloqueados por la red del entorno de pruebas, y no forman parte de este problema.
