# Espacios de imagen para añadir

Copia cada archivo en la ruta indicada (relativa a `frontend/`); aparece solo, sin tocar código. Mientras no exista, se ve un recuadro marcado con su etiqueta y ruta.

| Dónde | Ruta | Formato |
|---|---|---|
| Portada: imagen principal | `public/assets/images/illustrations/hero-main.png` | vertical 4:5 |
| Portada: ilustración flotante | `public/assets/images/floating/corner-character.png` | PNG transparente, cuadrada |
| Explorar, narrativa: imagen 01 | `public/assets/images/editorial/coleccion-01.jpg` | vertical 4:5 |
| Explorar, narrativa: imagen 02 | `public/assets/images/editorial/coleccion-02.jpg` | vertical 3:4 |
| Explorar, narrativa: flotante | `public/assets/images/floating/editorial-sticker.png` | PNG transparente, cuadrada |
| Cápsulas 1, 2 y 3 | `public/assets/images/editorial/capsula-01.jpg` … `capsula-03.jpg` | horizontal 4:3 |

Las fotos del patrimonio se cargan desde el panel, en cada ficha. Las tarjetas de lista muestran la portada de su propio bien; para quitarla, borra `src={bien.portada?.url}` en `components/ListaBienes.jsx`.
