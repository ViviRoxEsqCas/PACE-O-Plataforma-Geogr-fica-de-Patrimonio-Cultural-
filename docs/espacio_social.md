# Espacio social vinculado al patrimonio

Ampliación incremental sobre el producto de la semana 4. No es una red social generalista: todo gira alrededor de los bienes patrimoniales. Sin chat, mensajes directos, grupos ni feed complejo.

## 1. Diagnóstico del repositorio (verificado en el código) y diferencias con la especificación
| Aspecto | Especificación | Código real encontrado |
|---|---|---|
| API | DRF | Coincide. **Totalmente anónima**: `DEFAULT_AUTHENTICATION_CLASSES = []`, `AllowAny`; 2 POST anónimos (responder, reportar) con límite por IP. |
| Usuarios | Django `User`, solo personal | Coincide. Roles *Editor* y *Administrador* son grupos sincronizados en `post_migrate`; el panel exige `is_staff`. No hay registro de visitantes. |
| Tablas | 16 de dominio | Coincide (`patrimonio`). No existían perfiles, valoraciones, amistades, visitas ni logros. |
| Puntaje | Local en el navegador | Coincide (`localStorage`, clave `paceno.puntaje.v1`). **No se modificó**: el ranking social no usa ese puntaje. |
| Ubicación | No se envía ni guarda | Coincide. La nueva visita declarada **no guarda ubicación**. |
| Mecanismo de visita | «reutilizar si existe» | No existe ninguno fiable → acción explícita «Marcar como visitado» (declarada). |
| Mensaje 429 en `api.js` | — | Estaba fijo a «reportes»; se generalizó (el de reportes se conserva idéntico). |

## 2. Alcance mínimo y decisiones de producto
- **Autenticación:** `TokenAuthentication` **solo en las vistas sociales** (`rest_framework.authtoken`, 1 tabla del framework). Los endpoints anteriores no cambian ni exigen nada. Registro con usuario + contraseña (sin correo: no se guardan datos personales innecesarios). Las cuentas de visitante no tienen `is_staff` ni grupos → no entran al panel.
- **Valoración:** 1–5 estrellas + comentario opcional (3–500 caracteres, sin enlaces ni texto repetido). Una por usuario y bien (restricción única). «Retirar» la borra.
- **Opinión ≠ información verificada:** viven en endpoints y en una sección aparte de la ficha («Opiniones de visitantes»), con aviso; la API `/api/bienes/` no cambia.
- **Moderación:** cualquier persona con cuenta reporta un comentario (una vez, nunca el propio). El Editor/Administrador **oculta o restituye** el texto desde el panel (acciones registradas en el historial). Las estrellas siguen contando. Un comentario oculto no reaparece al editarlo. No se borran valoraciones desde el panel.
- **Amistad:** una sola fila por pareja (A→B y B→A no coexisten, también en la base de datos). Estados `pendiente`, `aceptada`, `rechazada`; cancelar una solicitud o retirar una amistad **borra** la fila. Quien fue rechazado no puede insistir; quien rechazó sí puede abrir una nueva. Máx. 20 solicitudes pendientes y límite por día.
- **Privacidad (3 niveles: público / solo amistades / privado)** en *perfil* y en *actividad*, aplicada en consultas y serializadores. Un perfil privado responde 404 (igual que uno inexistente). Los comentarios son contenido público de la ficha, pero **el autor solo se identifica** si su perfil es público (o si es «solo amistades» y quien lee es amistad); si no, «Persona visitante». El personal (`is_staff`) no tiene perfil público.
- **Visita:** acción explícita, única por usuario y bien, reversible, etiquetada «declarada, no verificada». Abrir una ficha no registra nada.
- **Logros y ranking:** sin tablas; se **calculan** desde filas reales, por lo que no hay logros retroactivos ni inventados.

## 3. Modelo de datos (5 tablas nuevas; las 16 existentes no cambian)
```
auth_user 1──1 perfil_visitante
auth_user 1──N valoracion N──1 bien_patrimonial        UNIQUE(usuario, bien)  CHECK 1..5
valoracion 1──N reporte_comentario N──1 auth_user      UNIQUE(valoracion, reportante)
auth_user 1──N amistad N──1 auth_user (solicitante/destinatario)
              UNIQUE(LEAST(a,b), GREATEST(a,b))  CHECK a<>b  CHECK estado
auth_user 1──N visita_declarada N──1 bien_patrimonial  UNIQUE(usuario, bien)  (sin coordenadas)
```
Más `authtoken_token` (framework). Migraciones: `social/0001_modelo_social` (solo crea tablas; no toca datos existentes — comprobado sobre una base con 23 fichas cargadas). Foto de perfil: `media/perfiles/` (JPG/PNG/WEBP ≤ 2 MB, validada con Pillow).

## 4. Endpoints
Nuevos (prefijo `/api/`; ✱ = exige `Authorization: Token …`):
| Método y ruta | Uso |
|---|---|
| `POST cuentas/registro/` · `cuentas/acceso/` · ✱`cuentas/salida/` | Cuenta (límites por IP) |
| ✱`GET/PATCH cuentas/yo/` | Mi perfil y privacidad (solo datos propios; multipart para la foto) |
| `GET perfiles/?q=` · `GET perfiles/{usuario}/` | Búsqueda (solo públicos) y perfil público con logros, puntos, posición y actividad según privacidad |
| `GET bienes/{id}/social/` | Promedio, cantidad, visitas declaradas (+ lo propio si hay sesión) |
| `GET bienes/{id}/valoraciones/` | Comentarios visibles, recientes primero, paginados de 10 |
| ✱`PUT/DELETE bienes/{id}/mi-valoracion/` | Crear/editar o retirar mi valoración |
| ✱`PUT/DELETE bienes/{id}/mi-visita/` | Marcar/desmarcar visita declarada |
| ✱`POST valoraciones/{id}/reportar/` | Reportar comentario |
| ✱`GET amistades/` · `POST amistades/solicitar/` · `POST amistades/{id}/aceptar|rechazar/` · `DELETE amistades/{id}/` · `GET amistades/actividad/` | Amistades y actividad |
| `GET ranking/` | Top 20, fórmula, catálogo de logros y mi posición |

Modificados: ninguno de la API anterior. `config/settings.py` (apps, throttles), `config/urls.py` (incluye `apps.social.urls`).

## 5. Fórmula del ranking (transparente y reproducible)
- **3** puntos por cada bien publicado distinto marcado como visitado.
- **2** puntos por cada bien publicado distinto valorado.
- **2** puntos más por un comentario visible de ≥ 30 caracteres (uno por bien).
- Anti-spam: todo es único por usuario y bien en la base de datos; editar, repetir o borrar y recrear no suma; comentarios ocultos no puntúan. Máximo 7 puntos por bien.
- Solo perfiles públicos y activos, con ≥ 1 punto. Orden total: más puntos → más visitas → cuenta más antigua → menor id.

Logros (condiciones comprobables): primera visita declarada · explorador (5 visitas) · recorrido completo (todos los bienes publicados) · primera valoración · primera opinión (≥ 30 caracteres, visible) · primera amistad.

## 6. Seguridad
Escrituras exigen sesión; cada vista opera sobre `request.user` (no recibe ids de propietario) y las acciones de amistad filtran por destinatario/participante. Validación en servidor. Límites (`.env`): registro 5/h, ingreso 20/h por IP; escrituras 120/h y solicitudes de amistad 20/día por cuenta. No se exponen correo, contraseñas ni `is_staff`. No se tocó la validación ni la respuesta de actividades.

## 7. Pruebas realmente ejecutadas (20-11/21-11-2026, Linux, PostgreSQL 16, Chrome)
| Suite | Resultado |
|---|---|
| Backend `python manage.py test` | **141/141** (82 previas + 59 nuevas en `apps/social/tests.py`) |
| Frontend `npm test` | **45/45** (37 previas + 8 nuevas en `lib/social.test.js`) |
| E2E social `npm run e2e:social` | **19/19** (varias corridas consecutivas: 19/19) |
| Regresión E2E semana 2 / semana 4 | **14/14** / **25/25** con el espacio social activo |
Registros: `docs/evidencias/social/`.

## 8. Pendientes y límites reales
1. **Moderación en navegador:** el panel (ocultar/restituir, permisos) se comprobó con pruebas de backend, **no** con una E2E de navegador.
2. Solo Chrome; responsive verificado a 360/768/1366 px por emulación.
3. **Sin recuperación de contraseña ni cambio de contraseña** (no hay correo). Un olvido lo resuelve el Administrador creando/restableciendo la cuenta desde el panel.
4. Tokens sin caducidad (se invalidan al cerrar sesión o al desactivar la cuenta).
5. El ranking se calcula en cada consulta (adecuado para el piloto de ~13 fichas; con miles de cuentas habría que cachearlo).
6. Sin ranking solo de amistades, sin notificaciones, sin bloqueo de personas.
7. Protección de datos personales y términos de uso para opiniones públicas: revisar antes de abrir al público. HTTPS sigue sin desplegarse.
8. La foto de perfil se sirve desde `/media/` solo con `DEBUG=True` (igual que las imágenes del catálogo).
