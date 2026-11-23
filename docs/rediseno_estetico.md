# Rediseño estético «Autumn Stories»

Solo cambia la presentación del frontend: rutas, lógica, API y backend no se tocan.

**Paleta** (`frontend/src/styles/tokens.css`): colores extraídos de la imagen Autumn Stories. El texto usa una pizarra cálida (`--ink`), nunca negro. `--salvia-600` es la salvia oscurecida para texto y botones (contraste ≥ 5:1).

**Tipografía** (Google Fonts, en `index.html`): *Shippori Mincho* para titulares editoriales y *Zen Maru Gothic* para interfaz y lectura. *M PLUS Rounded 1c* se evaluó y se descartó por ser casi idéntica a Zen Maru Gothic. No llegaron archivos tipográficos adjuntos, solo capturas.

**Lenguaje visual**: barra flotante de vidrio con control segmentado (escritorio) y dock inferior (móvil); botones en píldora; tarjetas con radios de 26–34 px y sombras ambientales; resultados en mosaico tipo Pinterest; perfiles con anillo y cifras tipo Instagram; mapa con tonos cálidos.

**Imágenes**: las fotos del patrimonio solo aparecen en sus fichas y en la tarjeta de su propio bien. Las demás imágenes son espacios marcados; ver `docs/espacios_de_imagen.md`.

**Retirado**: `styles/portada.css` (no se importaba), formas geométricas decorativas, parallax de la portada y pie negro.
