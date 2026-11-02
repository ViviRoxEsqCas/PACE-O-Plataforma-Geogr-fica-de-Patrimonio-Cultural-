# Resultados e2e de la semana 2

Fecha: 2026-10-31T14:59:15.498Z

| Caso | Descripción | Resultado |
|---|---|---|
| PT-06 | Mapa: un marcador por bien con coordenadas; abre vista previa y la ficha | OK |
| PT-07 | Búsqueda: «plaza», «PLAZA» y nombre con tilde dan resultados equivalentes | OK |
| PT-08 | Filtro por categoría: solo esa categoría; al limpiarlo vuelven todas | OK |
| PT-09 | Ficha: descripción, categoría, ubicación y fuentes con fecha de consulta | OK |
| PT-09b | Ficha: las imágenes muestran autor y licencia (respuesta de API simulada) | OK |
| PT-10 | Distancia: con permiso muestra «a ~X m»; sin permiso el resto funciona; no se envía la posición | OK |
| PT-11 | Bien sin coordenadas: aparece en la lista sin marcador y la ficha lo indica | OK |
| CU-01-alt | Si el mapa no carga, la lista sigue disponible; el error se puede reintentar | OK |
| ERR-red | Sin servidor: mensaje claro con «Reintentar»; se recupera al volver | OK |
| ERR-404 | Ficha inexistente o no publicada: mensaje y salida | OK |
| URL | Búsqueda, filtro y página viven en la URL: «atrás» desde la ficha conserva el estado | OK |
| PT-24 | Adaptación a 360 px: sin desbordes y con todas las funciones | OK |
| PT-24 | Adaptación a 768 px: sin desbordes y con todas las funciones | OK |
| PT-24 | Adaptación a 1366 px: sin desbordes y con todas las funciones | OK |

Total: 14; fallos: 0