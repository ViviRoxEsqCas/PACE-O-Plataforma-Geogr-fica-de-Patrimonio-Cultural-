# Verificación del catálogo (semana 2)

Fecha de verificación: **30/10/2026**. Método: se leyó el texto de cada norma citada y se contrastaron los datos de
cada ficha con él; las coordenadas se contrastaron con fuentes secundarias. **Ninguna coordenada se contrastó con la
IDE La Paz** ni con una fuente cartográfica institucional (no era accesible desde el entorno de desarrollo).

| Ficha | Tipo | Respaldo normativo / documental (texto leído) | Ubicación y su base | Confianza de la ubicación |
|---|---|---|---|---|
| Basílica Menor de San Francisco | material | Ley N.º 1078 (11/07/2018), art. 1: «Templo Mayor de Los Andes» · Wikipedia | −16,4965 / −68,1373 (Wikipedia) | Media |
| Centro Cultural «Museo San Francisco» | material | Ley N.º 1078, art. 1 · Wikipedia | −16,496226 / −68,136853 (Wikipedia) | Media |
| Convento de San Francisco | material | Ley N.º 1078, art. 1 · Wikipedia | Mismo punto que el museo (comparten dirección) | Media |
| Plaza Murillo | material | Ley N.º 219 (28/12/2011), art. 1 | −16,495648 / −68,133566 (Sygic; coincide con el centro de la plaza) | Media |
| Casa Museo de Murillo | material | Ley Municipal N.º 019 (31/05/2012), arts. 1–2 (Categoría A, Valor Monumental) | −16,492001 / −68,135597 (solo trek.zone) | **Baja: verificar en campo** |
| Inmuebles de la avenida Aniceto Arce | material | Ley N.º 2791 (05/08/2004), art. 1 | Punto de referencia del tramo, **sin fuente cartográfica** | **Baja: verificar** |
| Cueca Paceña | inmaterial | Ley Municipal N.º 010 (31/10/2011), art. 1 (incl. 19 de octubre «Día de la Cueca Paceña») | Sin ubicación puntual | — |
| La Paz FestiJazz Internacional | inmaterial | Ley Municipal N.º 003/2010 (10/09/2010), art. 2 | Sin ubicación puntual | — |
| Celebración de la Revolución Libertaria del 16 de julio de 1809 | inmaterial | Ley Municipal N.º 002/2010 (14/07/2010), arts. 1–3 | Sin ubicación puntual | — |
| El Pepino | inmaterial | Nota de eju.tv (04/02/2026) | Sin ubicación puntual | — |

## Correcciones hechas durante la verificación
- Se retiró «37 inmuebles» de la ficha de la avenida Aniceto Arce: el texto de la ley arrojó 36 registros al contarlos con una
  herramienta automática; la cifra no se confirmó, así que la ficha ya no la menciona.
- Se retiraron los años de fundación del convento (1548 vs 1549, según la fuente) y el rango de construcción de la basílica
  (1743–1772 vs «décadas de 1740–1750»): las fuentes difieren; la ficha solo conserva lo que no se contradice.
- Se retiró «descrita en la norma como evento cultural» (FestiJazz): no estaba en el texto leído.
- La Ley N.º 1078 muestra «12 de julio» en el título de la página de Lexivox y «11 de julio» en su texto; se usa 11 de julio
  (coincide con el informe).

## Pendiente antes de abrir el piloto al público
1. Contrastar todas las coordenadas con la IDE La Paz (prioridad: Casa Museo de Murillo y avenida Aniceto Arce).
2. Cargar imágenes propias o con licencia clara, con autor, desde el panel (RF-04). **Hoy hay 0 imágenes.**
3. Validar las 4 manifestaciones inmateriales con especialistas o personas portadoras (RN-09), en especial *El Pepino*.
4. Convertir el listado de la Ley N.º 2791 en fichas individuales.

El criterio de aceptación («10 fichas con fuente y licencia, 100 %») también se mide con `python manage.py verificar_catalogo` (ver README).
