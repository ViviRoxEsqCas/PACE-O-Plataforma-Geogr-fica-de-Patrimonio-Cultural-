"""
Carga las fichas del área piloto (semana 1: 7 fichas; semana 2: 10 fichas).

Contenido: se limita a lo que dicen las normas y notas citadas, cuyos textos se
revisaron el 30/10/2026 (fecha de consulta de cada fuente). Es material de ARRANQUE
sujeto a verificación editorial:
  * Las coordenadas se contrastaron solo con fuentes SECUNDARIAS (Wikipedia, Sygic,
    trek.zone), no con la IDE La Paz. Cada ficha indica la base de su ubicación y
    que es de referencia (mitigación del riesgo «Coordenadas imprecisas», sección 15).
  * Sin imágenes: requieren descarga y licencia verificada (autor + licencia, RF-04).
Las fichas se publican con la misma validación (RN-02, RN-03) que aplica el panel.

Uso:
  python manage.py cargar_fichas_iniciales               # crea lo que falte
  python manage.py cargar_fichas_iniciales --actualizar  # además sobrescribe el texto,
                                                         # fuentes y coordenadas de estas fichas
"""
from datetime import date
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.patrimonio.models import (
    BienFuente,
    BienPatrimonial,
    Categoria,
    EstadoPublicacion,
    FuenteDocumental,
    TipoFuente,
    TipoPatrimonio,
)

CONSULTA = date(2026, 10, 30)
SEC = "Coordenadas de referencia tomadas de {origen} (fuente secundaria, consulta 30/10/2026); pendiente de contraste con la IDE La Paz."

CATEGORIAS = {
    "Arquitectura religiosa": "Templos, conventos y museos asociados.",
    "Arquitectura urbana": "Inmuebles y conjuntos de calles y avenidas.",
    "Espacios públicos": "Plazas y espacios de uso público.",
    "Música y danza": "Manifestaciones musicales y dancísticas.",
    "Festividades y conmemoraciones": "Celebraciones, festivales y conmemoraciones cívicas.",
    "Personajes tradicionales": "Personajes de festividades tradicionales.",
}

# clave -> (título, autor/institución, tipo, url, títulos anteriores a reemplazar)
FUENTES = {
    "ley1078": ("Ley N.º 1078, de 11 de julio de 2018", "Estado Plurinacional de Bolivia", "norma",
                "https://www.lexivox.org/norms/BO-L-N1078.html", ()),
    "ley2791": ("Ley N.º 2791, de 5 de agosto de 2004", "República de Bolivia", "norma",
                "https://www.lexivox.org/norms/BO-L-2791.html", ()),
    "ley219": ("Ley N.º 219, de 28 de diciembre de 2011 (Plaza Murillo)", "Estado Plurinacional de Bolivia", "norma",
               "https://www.lexivox.org/norms/BO-L-N219.xhtml", ()),
    "lm002": ("Ley Municipal Autónoma N.º 002/2010, de 14 de julio de 2010", "GAMLP", "norma",
              "https://www.lexivox.org/norms/BO_LPZ-LM-2.html", ("Ley Municipal Autónoma N.º 002/2010, de 14 de julio de 2010",)),
    "lm003": ("Ley Municipal Autónoma N.º 003/2010, de 10 de septiembre de 2010 (La Paz FestiJazz Internacional)",
              "GAMLP", "norma", "https://www.lexivox.org/norms/BO_LPZ-LM-3.html", ()),
    "lm010": ("Ley Municipal Autónoma N.º 010, de 31 de octubre de 2011 (Cueca Paceña)", "GAMLP", "norma",
              "https://www.lexivox.org/norms/BO_LPZ-LM-10.html", ()),
    "lm019": ("Ley Municipal Autónoma N.º 019, de 31 de mayo de 2012 (Casa Museo de Murillo)", "GAMLP", "norma",
              "https://www.lexivox.org/norms/BO_LPZ-LM-19.html", ()),
    "ejutv": ("Concejo de La Paz declara 2026 como el año de reivindicación del personaje del Pepino [nota de prensa]",
              "eju.tv", "sitio web", "https://eju.tv/?p=4885379",
              ("Concejo de La Paz aprueba ley que declara 2026 como año de la reivindicación del Pepino [nota de prensa]",)),
    # Fuentes de la ubicación y de datos históricos (secundarias)
    "wp_basilica": ("Basilica of San Francisco, La Paz [artículo]", "Wikipedia", "sitio web",
                    "https://en.wikipedia.org/wiki/Basilica_of_San_Francisco,_La_Paz", ()),
    "wp_museo": ("Museo San Francisco Cultural Center [artículo]", "Wikipedia", "sitio web",
                 "https://en.wikipedia.org/wiki/Museo_San_Francisco_Cultural_Center", ()),
    "sygic_plaza": ("Plaza Murillo [ficha de lugar con coordenadas]", "Sygic Travel", "sitio web",
                    "https://travel.sygic.com/en/poi/plaza-murillo-poi:29796", ()),
    "trek_murillo": ("Museum House of Murillo, La Paz [ficha de lugar con coordenadas]", "trek.zone", "sitio web",
                     "https://trek.zone/en/bolivia/places/183791/museum-house-of-murillo-la-paz", ()),
}

# nombre, nombres anteriores, tipo, categoría, lat, lon, referencia, fuentes, descripción
FICHAS = [
    dict(
        nombre="Basílica Menor de San Francisco", antes=(), tipo="material", categoria="Arquitectura religiosa",
        lat="-16.496500", lon="-68.137300",
        ref="Plaza San Francisco. " + SEC.format(origen="Wikipedia"),
        fuentes=["ley1078", "wp_basilica"],
        descripcion=(
            "Templo del conjunto franciscano de la plaza San Francisco, en el centro de La Paz. La Ley N.º 1078, "
            "promulgada el 11 de julio de 2018, declara la «Basílica Menor de San Francisco», como «Templo Mayor de "
            "Los Andes», Patrimonio Cultural Material Inmueble del Estado Plurinacional de Bolivia. Según Wikipedia, la "
            "obra de la basílica actual se inició en la década de 1740, en estilo barroco andino (dato a contrastar "
            "con fuentes especializadas)."
        ),
    ),
    dict(
        nombre="Centro Cultural «Museo San Francisco»", antes=("Museo y Convento de San Francisco",),
        tipo="material", categoria="Arquitectura religiosa", lat="-16.496226", lon="-68.136853",
        ref="Plaza San Francisco N.º 501. " + SEC.format(origen="Wikipedia"),
        fuentes=["ley1078", "wp_museo"],
        descripcion=(
            "Centro cultural y museo instalado en parte del antiguo convento franciscano, en la plaza San Francisco. "
            "La Ley N.º 1078, de 11 de julio de 2018, lo declara Patrimonio Cultural Material Inmueble del Estado "
            "Plurinacional de Bolivia. Según Wikipedia, se estableció en 1953 (algunas fuentes indican 1948) y conserva "
            "arte religioso de estilo barroco mestizo (dato a contrastar con fuentes especializadas)."
        ),
    ),
    dict(
        nombre="Convento de San Francisco", antes=(), tipo="material", categoria="Arquitectura religiosa",
        lat="-16.496226", lon="-68.136853",
        ref="Plaza San Francisco N.º 501 (mismo punto de referencia que el Museo). " + SEC.format(origen="Wikipedia"),
        fuentes=["ley1078", "wp_museo"],
        descripcion=(
            "Convento franciscano de La Paz. La Ley N.º 1078, de 11 de julio de 2018, declara el «Convento de San "
            "Francisco» Patrimonio Cultural Material Inmueble del Estado Plurinacional de Bolivia. Según Wikipedia, se "
            "fundó en el siglo XVI, quedó abandonado desde la década de 1970 y se restauró por fases a partir de 1992 "
            "hasta 2005 (dato a contrastar con fuentes especializadas)."
        ),
    ),
    dict(
        nombre="Plaza Murillo", antes=(), tipo="material", categoria="Espacios públicos",
        lat="-16.495648", lon="-68.133566",
        ref="Centro de la plaza. " + SEC.format(origen="Sygic Travel"),
        fuentes=["ley219", "sygic_plaza"],
        descripcion=(
            "La Ley N.º 219, de 28 de diciembre de 2011, declara la Plaza Murillo, de la ciudad de La Paz, «Patrimonio "
            "Cultural del Pueblo Boliviano y Monumento Nacional del Estado Plurinacional de Bolivia». La norma la "
            "identifica como antes conocida como «la Plaza Mayor, Plaza de Armas, Plaza 16 de Julio o Kilómetro Cero»."
        ),
    ),
    dict(
        nombre="Casa Museo de Murillo", antes=(), tipo="material", categoria="Arquitectura urbana",
        lat="-16.492001", lon="-68.135597",
        ref=("Calle Jaén N.º 790. Coordenada de BAJA confianza (un solo directorio turístico, trek.zone, consulta "
             "30/10/2026, sin contraste con otra fuente): debe verificarse en campo o con la IDE La Paz antes de su uso público."),
        fuentes=["lm019", "trek_murillo"],
        descripcion=(
            "Inmueble de la calle Jaén N.º 790, declarado por la Ley Municipal Autónoma N.º 019, de 31 de mayo de 2012, "
            "Patrimonio Arquitectónico y Urbano, Cultural e Histórico del Municipio de La Paz, con Categoría A (Valor "
            "Monumental). La norma encarga su administración y conservación a la Oficialía Mayor de Culturas."
        ),
    ),
    dict(
        nombre="Inmuebles de la avenida Aniceto Arce", antes=(), tipo="material", categoria="Arquitectura urbana",
        lat="-16.506500", lon="-68.126200",
        ref=("Avenida Aniceto Arce. Punto de referencia del tramo, NO verificado con fuente cartográfica; la ley "
             "enumera inmuebles con direcciones propias."),
        fuentes=["ley2791"],
        descripcion=(
            "La Ley N.º 2791, de 5 de agosto de 2004, declara «Patrimonio Cultural, Arquitectónico, Urbanístico e "
            "Histórico de la Nación» los inmuebles que enumera en su artículo 1, ubicados en la avenida Aniceto Arce "
            "de La Paz, cada uno con su código catastral y dirección. Ficha de arranque: falta crear fichas "
            "individuales de los inmuebles a partir de ese listado."
        ),
    ),
    dict(
        nombre="Cueca Paceña", antes=(), tipo="inmaterial", categoria="Música y danza", lat=None, lon=None, ref="",
        fuentes=["lm010"],
        descripcion=(
            "La Ley Municipal Autónoma N.º 010, de 31 de octubre de 2011, declara la «Cueca Paceña» Patrimonio Cultural "
            "Intangible del Municipio de La Paz y establece el 19 de octubre de cada año como «Día de la Cueca "
            "Paceña». Ficha de arranque: no tiene lugar de referencia definido; su descripción debe validarse con "
            "especialistas o personas portadoras (RN-09)."
        ),
    ),
    dict(
        nombre="La Paz FestiJazz Internacional", antes=(), tipo="inmaterial", categoria="Festividades y conmemoraciones",
        lat=None, lon=None, ref="", fuentes=["lm003"],
        descripcion=(
            "La Ley Municipal Autónoma N.º 003/2010, de 10 de septiembre de 2010, declara «Patrimonio Cultural del "
            "Municipio de La Paz», para su promoción y conservación, la celebración de La Paz FestiJazz Internacional, "
            "Ficha de arranque: no tiene lugar de referencia definido."
        ),
    ),
    dict(
        nombre="Celebración de la Revolución Libertaria del 16 de julio de 1809", antes=(), tipo="inmaterial",
        categoria="Festividades y conmemoraciones", lat=None, lon=None, ref="", fuentes=["lm002"],
        descripcion=(
            "La Ley Municipal Autónoma N.º 002/2010, de 14 de julio de 2010 («De conservación y promoción de la "
            "celebración del 16 de julio de 1809»), declara patrimonio histórico de la ciudad de La Paz la celebración "
            "de la Revolución Libertaria del 16 de julio de 1809. Ficha de arranque: el lugar de referencia y el "
            "contexto histórico deben completarse con fuentes especializadas."
        ),
    ),
    dict(
        nombre="El Pepino", antes=(), tipo="inmaterial", categoria="Personajes tradicionales", lat=None, lon=None,
        ref="", fuentes=["ejutv"],
        descripcion=(
            "Personaje emblemático del Carnaval paceño, declarado Patrimonio Cultural Inmaterial del Municipio de La "
            "Paz en 2015. Según eju.tv (4 de febrero de 2026), el Concejo Municipal declaró 2026 «año de reivindicación» "
            "del personaje para reforzar su protección, promoción y defensa frente a usos indebidos, y la ley prevé "
            "gestionar su declaratoria nacional. Tema sensible: validar con personas portadoras y especialistas antes "
            "de ampliar la descripción (RN-09)."
        ),
    ),
]


class Command(BaseCommand):
    help = "Carga (de forma idempotente) las fichas del área piloto y las publica con validación."

    def add_arguments(self, parser):
        parser.add_argument(
            "--actualizar", action="store_true",
            help="Sobrescribe texto, categoría, coordenadas y fuentes de estas fichas (y renombra las de la semana 1).",
        )

    @transaction.atomic
    def handle(self, *args, actualizar=False, **options):
        categorias = {
            n: Categoria.objects.get_or_create(nombre=n, defaults={"descripcion": d})[0]
            for n, d in CATEGORIAS.items()
        }
        fuentes = {}
        for clave, (titulo, autor, tipo, url, anteriores) in FUENTES.items():
            datos = dict(autor_institucion=autor, tipo_fuente=TipoFuente.objects.get(nombre=tipo),
                         url_referencia=url, fecha_consulta=CONSULTA)
            existente = FuenteDocumental.objects.filter(titulo__in=(titulo,) + tuple(anteriores)).first()
            if existente is None:
                fuentes[clave] = FuenteDocumental.objects.create(titulo=titulo, **datos)
            else:
                fuentes[clave] = existente
                if actualizar:
                    for campo, valor in dict(titulo=titulo, **datos).items():
                        setattr(existente, campo, valor)
                    existente.save()

        publicadas = 0
        for f in FICHAS:
            bien = BienPatrimonial.objects.filter(nombre__in=(f["nombre"],) + tuple(f["antes"])).first()
            creada = bien is None
            valores = dict(
                nombre=f["nombre"],
                descripcion=f["descripcion"],
                tipo_patrimonio=TipoPatrimonio.objects.get(nombre=f["tipo"]),
                categoria=categorias[f["categoria"]],
                latitud=Decimal(f["lat"]) if f["lat"] else None,
                longitud=Decimal(f["lon"]) if f["lon"] else None,
                direccion_referencia=f["ref"],
            )
            if creada:
                bien = BienPatrimonial.objects.create(estado_publicacion=EstadoPublicacion.BORRADOR, **valores)
            elif actualizar:
                for campo, valor in valores.items():
                    setattr(bien, campo, valor)
            if creada or actualizar:
                if actualizar:
                    bien.bien_fuentes.exclude(fuente__in=[fuentes[c] for c in f["fuentes"]]).delete()
                for clave in f["fuentes"]:
                    BienFuente.objects.get_or_create(bien=bien, fuente=fuentes[clave])
            if bien.estado_publicacion != EstadoPublicacion.PUBLICADO:
                bien.estado_publicacion = EstadoPublicacion.PUBLICADO
                publicadas += 1
            bien.save()  # valida RN-02/RN-03: si falta algo, lanza ValidationError y revierte todo
            self.stdout.write(f"  {'creada    ' if creada else ('actualizada' if actualizar else 'existente ')}  {bien.nombre}")
        self.stdout.write(self.style.SUCCESS(
            f"Fichas en total: {len(FICHAS)} ({publicadas} publicadas en esta ejecución)."
        ))
