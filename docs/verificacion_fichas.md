# Verificación del catálogo (semana 3: 13 fichas)

Las **6 fichas conservadas** se verificaron el **30/10/2026** (texto de cada norma leído y contrastado). Las **7 fichas nuevas**
se redactaron el **11/11/2026** a partir de las fuentes que cita cada una; en las que dos fuentes se contradecían, la ficha no afirma el dato.
**Ninguna coordenada se contrastó con la IDE La Paz** ni con una fuente cartográfica institucional.

| Ficha | Tipo | Respaldo normativo / documental | Ubicación y su base | Confianza |
|---|---|---|---|---|
| Plaza Pedro Domingo Murillo *(antes «Plaza Murillo»)* | material | Ley N.º 219 (28/12/2011), art. 1 | −16,495648 / −68,133566 (Sygic) | Media |
| Casa Museo Pedro Domingo Murillo *(antes «Casa Museo de Murillo»)* | material | Ley Municipal N.º 019 (31/05/2012), Categoría A, calle Jaén N.º 790 | −16,492001 / −68,135597 (solo trek.zone) | **Baja** |
| Calle Jaén – conjunto histórico patrimonial | material | Notas de eju.tv (6/2/2020) y El Diario (7/2/2020): ley municipal que declara la calle y 14 inmuebles. **Número y texto de la ley: pendientes** | Punto deducido de las ubicaciones de los museos de la calle | **Baja** |
| Basílica Menor de San Francisco | material | Ley N.º 1078 (11/07/2018) · Wikipedia | −16,4965 / −68,1373 (Wikipedia) | Media |
| Museo Nacional de Etnografía y Folklore (MUSEF) | material | Wikipedia (es): Monumento Nacional 15/04/1930 *(sin número de norma)*; apertura 23/08/1962; R.M. 208 (1974) | −16,49442 / −68,13505 (aroundus.com) | Media-baja |
| Museo Costumbrista Juan de Vargas | material | Perspectiva Temporal (creación mayo 1979) · incluido en la ley de calle Jaén (eju.tv) | Centro del mapa incrustado de perspectivatemporal.org | **Baja** |
| Museo de Metales Preciosos | material | Wikipedia es/en (inaugurado 1984; «categoría monumental», sin norma) · ley de calle Jaén (eju.tv) | −16,49205 / −68,13569 (Wikipedia en, calle Jaén N.º 777) | Media |
| Museo del Litoral Boliviano | material | Perspectiva Temporal (calle Jaén N.º 789; creación 1978 *o* 1979: no se afirma) · ley de calle Jaén (eju.tv) | Centro del mapa incrustado de perspectivatemporal.org | **Baja** |
| Catedral Metropolitana Nuestra Señora de La Paz | material | La Paz Maravillosa y Wikipedia en (obras desde 24/03/1835; inaugurada 1925; torres 1989). **No consta norma de declaratoria** | −16,496256 / −68,134106 (Sygic) | Media |
| Teatro Municipal Alberto Saavedra Pérez | material | La Ventana (apertura 18/11/1845; «Patrimonio Monumental» del GAMLP, sin norma citada) · Perspectiva Temporal · Fides | Centro del mapa incrustado de perspectivatemporal.org (calle Sanjinés esq. Indaburo) | **Baja** |
| Revolución Libertaria del 16 de julio de 1809 | inmaterial | Ley Municipal N.º 002/2010 (14/07/2010) | Sin ubicación puntual | — |
| Cueca Paceña | inmaterial | Ley Municipal N.º 010 (31/10/2011); 19 de octubre «Día de la Cueca Paceña» | Sin ubicación puntual | — |
| El Pepino – personaje tradicional del Carnaval Paceño | inmaterial | Nota de eju.tv (04/02/2026) | Sin ubicación puntual | — |

## Cambios respecto al catálogo de 10 fichas
- **Salen (4):** Centro Cultural «Museo San Francisco», Convento de San Francisco, Inmuebles de la avenida Aniceto Arce y La Paz FestiJazz Internacional.
  `cargar_fichas_iniciales --retirar-obsoletas` las elimina, o las deja *desactivadas* si ya tienen reportes (los reportes no se borran).
- **Se renombran (4)**, conservando su `id`: Plaza Murillo → Plaza Pedro Domingo Murillo; Casa Museo de Murillo → Casa Museo Pedro Domingo Murillo;
  Celebración de la Revolución… → Revolución Libertaria del 16 de julio de 1809; El Pepino → El Pepino – personaje tradicional del Carnaval Paceño.
- **Entran (7):** Calle Jaén, MUSEF, Museo Costumbrista, Museo de Metales Preciosos, Museo del Litoral Boliviano, Catedral y Teatro Municipal.
- **Categoría nueva:** «Museos y casas museo» (los 5 museos).
- Resultado: 13 fichas = **10 con ubicación** (marcadores) y **3 inmateriales** sin ubicación.

## Datos que las fuentes no resuelven (por eso las fichas no los afirman)
- Año de creación del Museo del Litoral Boliviano: 1978 o 1979.
- Año de construcción del Teatro Municipal: 1834 o 1845 (solo se afirma la apertura, 18/11/1845).
- Número y fecha de la ley municipal de la calle Jaén (solo hay la fecha de la nota: 6/2/2020).
- Norma de declaratoria del MUSEF (la fuente da la fecha 15/04/1930, no el número), del Museo de Metales Preciosos, del Teatro y de la Catedral.
- La denominación «Palacio de los Marqueses de Villaverde» del MUSEF es discutida por la propia fuente.

## Pendiente antes de abrir el piloto al público
1. Contrastar todas las coordenadas con la IDE La Paz (prioridad: las 5 de confianza **baja**).
2. Ubicar el número y texto de la ley municipal de la calle Jaén y las normas de declaratoria de MUSEF, Metales Preciosos, Teatro y Catedral.
3. Cargar las imágenes con autor y licencia verificados (`contenido/imagenes/`).
4. Validar las 3 manifestaciones inmateriales con especialistas o personas portadoras (RN-09), en especial *El Pepino*.

El criterio de aceptación («fichas con fuente y licencia, 100 %») se mide con `python manage.py verificar_catalogo`.
