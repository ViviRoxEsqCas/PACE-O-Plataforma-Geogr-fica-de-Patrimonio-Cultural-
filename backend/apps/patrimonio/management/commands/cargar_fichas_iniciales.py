"""
Carga las 13 fichas del catálogo (semana 3: ajuste del alcance a 13 bienes; antes 10).

Contenido: se limita a lo que dicen las normas y notas citadas. Es material de ARRANQUE sujeto a
verificación editorial:
  * Las fuentes de las fichas originales se leyeron el 30/10/2026; las de las 7 fichas nuevas, el 11/11/2026.
  * Las coordenadas se tomaron de fuentes SECUNDARIAS (Wikipedia, Sygic, trek.zone, aroundus.com, el mapa
    incrustado de perspectivatemporal.org), no de la IDE La Paz. Cada ficha indica la base de su ubicación y su
    nivel de confianza (mitigación del riesgo «Coordenadas imprecisas», sección 15).
  * Cuando las fuentes difieren en un dato (fechas, números), la ficha no lo afirma.
Las fichas se publican con la misma validación (RN-02, RN-03) que aplica el panel.

Uso:
  python manage.py cargar_fichas_iniciales                     # crea lo que falte
  python manage.py cargar_fichas_iniciales --actualizar        # además sobrescribe texto, fuentes y coordenadas
                                                               # y renombra las fichas anteriores
  python manage.py cargar_fichas_iniciales --actualizar --retirar-obsoletas
                                                               # además retira las 4 fichas que salen del alcance
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

CONSULTA = date(2026, 10, 30)  # fuentes de las fichas originales
CONSULTA2 = date(2026, 11, 11)  # fuentes de las fichas nuevas (semana 3)
SEC = "Coordenadas de referencia tomadas de {origen} (fuente secundaria, consulta 30/10/2026); pendiente de contraste con la IDE La Paz."

CATEGORIAS = {
    "Arquitectura religiosa": "Templos, conventos y museos asociados.",
    "Arquitectura urbana": "Inmuebles y conjuntos de calles y avenidas.",
    "Espacios públicos": "Plazas y espacios de uso público.",
    "Museos y casas museo": "Museos y casas museo del centro histórico.",
    "Música y danza": "Manifestaciones musicales y dancísticas.",
    "Festividades y conmemoraciones": "Celebraciones, festivales y conmemoraciones cívicas.",
    "Personajes tradicionales": "Personajes de festividades tradicionales.",
}

# clave -> (título, autor/institución, tipo, url, títulos anteriores a reemplazar[, fecha de consulta])
FUENTES = {
    "ley1078": ("Ley N.º 1078, de 11 de julio de 2018", "Estado Plurinacional de Bolivia", "norma",
                "https://www.lexivox.org/norms/BO-L-N1078.html", ()),
    "ley219": ("Ley N.º 219, de 28 de diciembre de 2011 (Plaza Murillo)", "Estado Plurinacional de Bolivia", "norma",
               "https://www.lexivox.org/norms/BO-L-N219.xhtml", ()),
    "lm002": ("Ley Municipal Autónoma N.º 002/2010, de 14 de julio de 2010", "GAMLP", "norma",
              "https://www.lexivox.org/norms/BO_LPZ-LM-2.html", ("Ley Municipal Autónoma N.º 002/2010, de 14 de julio de 2010",)),
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
    "sygic_plaza": ("Plaza Murillo [ficha de lugar con coordenadas]", "Sygic Travel", "sitio web",
                    "https://travel.sygic.com/en/poi/plaza-murillo-poi:29796", ()),
    "trek_murillo": ("Museum House of Murillo, La Paz [ficha de lugar con coordenadas]", "trek.zone", "sitio web",
                     "https://trek.zone/en/bolivia/places/183791/museum-house-of-murillo-la-paz", ()),
    # --- Fuentes de las fichas nuevas (consultadas el 11/11/2026) ---
    "eju_jaen": ("Concejo de La Paz declara patrimonio histórico, arquitectónico y urbano a la calle Jaén y a 14 inmuebles [nota de prensa, 6/2/2020]",
                 "eju.tv", "sitio web",
                 "https://eju.tv/2020/02/concejo-de-la-paz-declara-patrimonio-historico-arquitectonico-y-urbano-a-la-calle-jaen-y-a-14-inmuebles/", (), CONSULTA2),
    "eldiario_jaen": ("Edificaciones de calle Jaén son declaradas patrimonios [nota de prensa, 7/2/2020]", "El Diario", "sitio web",
                      "https://pub.eldiario.net/movil/index.php?n=16&a=2020&m=02&d=07", (), CONSULTA2),
    "wp_jaen": ("Calle Apolinar Jaén [artículo]", "Wikipedia", "sitio web", "https://es.wikipedia.org/wiki/Calle_Apolinar_Ja%C3%A9n", (), CONSULTA2),
    "wp_musef": ("Museo Nacional de Etnografía y Folklore [artículo]", "Wikipedia", "sitio web",
                 "https://es.wikipedia.org/wiki/Museo_Nacional_de_Etnograf%C3%ADa_y_Folklore", (), CONSULTA2),
    "aroundus_musef": ("National Museum of Ethnography and Folklore [ficha de lugar con coordenadas]", "Around Us", "sitio web",
                       "https://aroundus.com/p/4311868-national-museum-of-ethnography-and-folklore", (), CONSULTA2),
    "wp_metales": ("Museo de Metales Preciosos Precolombinos [artículo]", "Wikipedia", "sitio web",
                   "https://es.wikipedia.org/wiki/Museo_de_Metales_Preciosos_Precolombinos", (), CONSULTA2),
    "wpen_metales": ("Pre-Columbian Precious Metals Museum [artículo con dirección y coordenadas]", "Wikipedia", "sitio web",
                     "https://en.wikipedia.org/wiki/Pre-Columbian_Precious_Metals_Museum", (), CONSULTA2),
    "pt_costumbrista": ("Museo Costumbrista «Juan de Vargas» [ficha de museo]", "Perspectiva Temporal", "sitio web",
                        "https://perspectivatemporal.org/places/museos/museo-costumbrista-juan-de-vargas", (), CONSULTA2),
    "pt_litoral": ("Museo del Litoral Boliviano [ficha de museo]", "Perspectiva Temporal", "sitio web",
                   "https://perspectivatemporal.org/places/museos/museo-del-litoral-boliviano", (), CONSULTA2),
    "lpm_catedral": ("Catedral Metropolitana Nuestra Señora de La Paz [artículo]", "La Paz Maravillosa", "sitio web",
                     "https://lapazmaravillosa.wordpress.com/about/turismo/cultural/historico/arquitectura/iglesias-y-museos/catedral-metropolitana-nuestra-senora-de-la-paz/", (), CONSULTA2),
    "wpen_catedral": ("Cathedral Basilica of Our Lady of Peace, La Paz [artículo]", "Wikipedia", "sitio web",
                      "https://en.wikipedia.org/wiki/Cathedral_Basilica_of_Our_Lady_of_Peace,_La_Paz", (), CONSULTA2),
    "sygic_catedral": ("Murillo Cathedral [ficha de lugar con coordenadas]", "Sygic Travel", "sitio web",
                       "https://travel.sygic.com/en/poi/murillo-cathedral-poi:29756", (), CONSULTA2),
    "ventana_teatro": ("El Teatro Municipal Alberto Saavedra Pérez cumple 176 años [nota de prensa]", "La Ventana", "sitio web",
                       "https://www.laventanabolivia.com/ver_noticia.php?n=6256", (), CONSULTA2),
    "pt_teatro": ("Teatro Municipal «Alberto Saavedra Pérez» [ficha de teatro con dirección]", "Perspectiva Temporal", "sitio web",
                  "https://www.perspectivatemporal.org/places/teatros/teatro-municipal-alberto-saavedra-perez", (), CONSULTA2),
    "fides_teatro": ("La Oficialía de Culturas restaurará el Teatro Municipal «Alberto Saavedra Pérez» [nota de prensa, 26/4/2005]",
                     "ANF Agencia de Noticias Fides", "sitio web",
                     "https://www.noticiasfides.com/nacional/sociedad/la-oficialia-de-culturas-restaurara-el-teatro-municipal-alberto-saavedra-perez-238066", (), CONSULTA2),
}

# Nombres de las fichas que salen del alcance de 13 bienes (se retiran con --retirar-obsoletas).
OBSOLETAS = (
    "Centro Cultural «Museo San Francisco»",
    "Museo y Convento de San Francisco",
    "Convento de San Francisco",
    "Inmuebles de la avenida Aniceto Arce",
    "La Paz FestiJazz Internacional",
)
# Fuentes que solo respaldaban a esas fichas: si quedan sin ficha se eliminan.
FUENTES_OBSOLETAS = (
    "Ley N.º 2791, de 5 de agosto de 2004",
    "Ley Municipal Autónoma N.º 003/2010, de 10 de septiembre de 2010 (La Paz FestiJazz Internacional)",
    "Museo San Francisco Cultural Center [artículo]",
)

JAEN = "Calle Jaén. "
BAJA = "Confianza BAJA: "

# nombre, nombres anteriores, tipo, categoría, lat, lon, referencia, fuentes, descripción
FICHAS = [
    dict(
        nombre="Plaza Pedro Domingo Murillo", antes=("Plaza Murillo",), tipo="material", categoria="Espacios públicos",
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
        nombre="Casa Museo Pedro Domingo Murillo", antes=("Casa Museo de Murillo",), tipo="material",
        categoria="Museos y casas museo", lat="-16.492001", lon="-68.135597",
        ref=("Calle Jaén N.º 790. Coordenada de BAJA confianza (un solo directorio turístico, trek.zone, consulta "
             "30/10/2026, sin contraste con otra fuente): debe verificarse en campo o con la IDE La Paz antes de su uso público."),
        fuentes=["lm019", "trek_murillo"],
        descripcion=(
            "Inmueble de la calle Jaén N.º 790, declarado por la Ley Municipal Autónoma N.º 019, de 31 de mayo de 2012 "
            "(que lo denomina «Casa Museo de Murillo»), Patrimonio Arquitectónico y Urbano, Cultural e Histórico del "
            "Municipio de La Paz, con Categoría A (Valor Monumental). La norma encarga su administración y conservación "
            "a la Oficialía Mayor de Culturas."
        ),
    ),
    dict(
        nombre="Calle Jaén – conjunto histórico patrimonial", antes=(), tipo="material", categoria="Arquitectura urbana",
        lat="-16.491900", lon="-68.135700",
        ref=(JAEN + "Punto de referencia del tramo, deducido de las ubicaciones de los museos de la calle "
             "(Metales Preciosos, Costumbrista y Litoral). " + BAJA + "no es el eje de la calle; verificar con la IDE La Paz."),
        fuentes=["eju_jaen", "eldiario_jaen", "wp_jaen"],
        descripcion=(
            "Según eju.tv (6 de febrero de 2020), el Concejo Municipal de La Paz aprobó una ley que declara patrimonio "
            "histórico, arquitectónico y urbano la calle Jaén y catorce inmuebles emplazados en ella; entre los que "
            "nombra la nota están los museos de Metales Preciosos, Costumbrista y del Litoral Boliviano. Según El Diario "
            "(7 de febrero de 2020), la declaratoria abarca el tramo entre las calles Sucre e Indaburo y busca proteger "
            "la arquitectura colonial, republicana y ecléctica; la misma nota menciona un decreto supremo de diciembre de "
            "1967 que declaró monumentos nacionales varias construcciones, entre ellas la calle Jaén (dato a contrastar). "
            "Wikipedia la describe como una calle de unos 100 metros, con balcones y calles empedradas. "
            "Pendiente: ubicar el número y el texto de la ley municipal (las notas no los citan)."
        ),
    ),
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
        nombre="Museo Nacional de Etnografía y Folklore (MUSEF)", antes=(), tipo="material", categoria="Museos y casas museo",
        lat="-16.494420", lon="-68.135050",
        ref=("Calle Ingavi, esquina Genaro Sanjinés (Wikipedia); una ficha de lugar indica Ingavi N.º 916. Coordenadas de "
             "referencia tomadas de aroundus.com (fuente secundaria, consulta 11/11/2026); pendiente de contraste con la IDE La Paz."),
        fuentes=["wp_musef", "aroundus_musef"],
        descripcion=(
            "Museo ubicado en la esquina de las calles Ingavi y Genaro Sanjinés. Según Wikipedia, el edificio es conocido "
            "como Palacio de los Marqueses de Villaverde (la propia fuente advierte que esa denominación es discutida) y "
            "fue declarado Monumento Nacional el 15 de abril de 1930 (la fuente no cita la norma). El museo se abrió el "
            "23 de agosto de 1962 como Museo de Artesanía y Arte Popular; sus orígenes se remontan a 1925, y desde 1974 "
            "(Resolución Ministerial N.º 208) se llama Museo Nacional de Etnografía y Folklore. Datos a contrastar con "
            "la norma de declaratoria y con la institución."
        ),
    ),
    dict(
        nombre="Museo Costumbrista Juan de Vargas", antes=(), tipo="material", categoria="Museos y casas museo",
        lat="-16.491700", lon="-68.135700",
        ref=(JAEN + "Sin número en la fuente. " + BAJA + "centro del mapa incrustado de perspectivatemporal.org, "
             "no un punto señalado; consulta 11/11/2026; verificar en campo o con la IDE La Paz."),
        fuentes=["pt_costumbrista", "eju_jaen"],
        descripcion=(
            "Museo de la calle Jaén que muestra costumbres, tradiciones e historia de La Paz colonial y republicana. "
            "Según Perspectiva Temporal, se creó en mayo de 1979 y forma parte de la red de museos municipales; tiene "
            "cinco salas permanentes y una temporal. eju.tv (6 de febrero de 2020) lo incluye entre los inmuebles de la "
            "calle Jaén declarados patrimonio histórico, arquitectónico y urbano por el Concejo Municipal."
        ),
    ),
    dict(
        nombre="Museo de Metales Preciosos", antes=(), tipo="material", categoria="Museos y casas museo",
        lat="-16.492050", lon="-68.135690",
        ref=("Calle Jaén N.º 777. Coordenadas de referencia tomadas de Wikipedia (inglés; fuente secundaria, consulta "
             "11/11/2026); pendiente de contraste con la IDE La Paz."),
        fuentes=["wp_metales", "wpen_metales", "eju_jaen"],
        descripcion=(
            "Museo instalado en la antigua casa de Apolinar Jaén, en la calle Jaén. Según Wikipedia, se inauguró en 1984 "
            "como «Museo del Oro» y luego pasó a llamarse Museo de Metales Preciosos Precolombinos; el inmueble tiene "
            "«categoría monumental» (la fuente no cita la norma). eju.tv (6 de febrero de 2020) lo incluye entre los "
            "inmuebles de la calle Jaén declarados patrimonio histórico, arquitectónico y urbano por el Concejo Municipal."
        ),
    ),
    dict(
        nombre="Museo del Litoral Boliviano", antes=(), tipo="material", categoria="Museos y casas museo",
        lat="-16.491900", lon="-68.135800",
        ref=("Calle Jaén N.º 789. " + BAJA + "centro del mapa incrustado de perspectivatemporal.org, no un punto "
             "señalado; consulta 11/11/2026; verificar en campo o con la IDE La Paz."),
        fuentes=["pt_litoral", "eju_jaen"],
        descripcion=(
            "Museo instalado en una casona de la calle Jaén N.º 789, dedicado a la Guerra del Pacífico, en la que "
            "Bolivia perdió su litoral, y al coronel Eduardo Abaroa. Pertenece a la red de museos municipales de La Paz. "
            "La fuente da dos años de creación (1978 y 1979), por lo que esta ficha no afirma ninguno. eju.tv (6 de "
            "febrero de 2020) lo incluye entre los inmuebles de la calle Jaén declarados patrimonio histórico, "
            "arquitectónico y urbano por el Concejo Municipal."
        ),
    ),
    dict(
        nombre="Catedral Metropolitana Nuestra Señora de La Paz", antes=(), tipo="material", categoria="Arquitectura religiosa",
        lat="-16.496256", lon="-68.134106",
        ref=("Plaza Murillo. Coordenadas de referencia tomadas de Sygic Travel (fuente secundaria, consulta "
             "11/11/2026); pendiente de contraste con la IDE La Paz."),
        fuentes=["lpm_catedral", "wpen_catedral", "sygic_catedral"],
        descripcion=(
            "Catedral y basílica menor ubicada en la plaza Murillo. Según La Paz Maravillosa y Wikipedia, las obras de "
            "la catedral actual se iniciaron el 24 de marzo de 1835, se inauguró en 1925 (primer centenario de la "
            "república), su ornamentación interior continuó hasta 1932 y sus dos torres laterales se inauguraron en 1989; "
            "es de estilo neoclásico con elementos barrocos. En las fuentes consultadas no consta una norma de "
            "declaratoria patrimonial: debe ubicarse antes de afirmarla."
        ),
    ),
    dict(
        nombre="Teatro Municipal Alberto Saavedra Pérez", antes=(), tipo="material", categoria="Arquitectura urbana",
        lat="-16.493700", lon="-68.135100",
        ref=("Calle Genaro Sanjinés, esquina Indaburo. " + BAJA + "centro del mapa incrustado de perspectivatemporal.org, "
             "no un punto señalado; consulta 11/11/2026; verificar en campo o con la IDE La Paz."),
        fuentes=["ventana_teatro", "pt_teatro", "fides_teatro"],
        descripcion=(
            "Teatro de la calle Genaro Sanjinés, esquina Indaburo. Según La Ventana, abrió sus puertas el 18 de "
            "noviembre de 1845, fue diseñado por el arquitecto paceño José Núñez del Prado, lleva el nombre del "
            "dramaturgo y periodista Alberto Saavedra Pérez desde 1957 y fue declarado «Patrimonio Monumental» por el "
            "Gobierno Autónomo Municipal de La Paz (la nota no cita la norma). Las fuentes difieren en el año de "
            "construcción (1834 o 1845), por lo que esta ficha solo afirma la fecha de apertura."
        ),
    ),
    dict(
        nombre="Revolución Libertaria del 16 de julio de 1809", antes=("Celebración de la Revolución Libertaria del 16 de julio de 1809",),
        tipo="inmaterial", categoria="Festividades y conmemoraciones", lat=None, lon=None, ref="", fuentes=["lm002"],
        descripcion=(
            "La Ley Municipal Autónoma N.º 002/2010, de 14 de julio de 2010 («De conservación y promoción de la "
            "celebración del 16 de julio de 1809»), declara patrimonio histórico de la ciudad de La Paz la celebración "
            "de la Revolución Libertaria del 16 de julio de 1809. Ficha de arranque: el lugar de referencia y el "
            "contexto histórico deben completarse con fuentes especializadas."
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
        nombre="El Pepino – personaje tradicional del Carnaval Paceño", antes=("El Pepino",), tipo="inmaterial",
        categoria="Personajes tradicionales", lat=None, lon=None, ref="", fuentes=["ejutv"],
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
            help="Sobrescribe texto, categoría, coordenadas y fuentes de estas fichas (y renombra las anteriores).",
        )
        parser.add_argument(
            "--retirar-obsoletas", action="store_true",
            help="Retira las fichas que salen del alcance de 13 bienes: las borra, o las desactiva si ya tienen reportes.",
        )

    @transaction.atomic
    def handle(self, *args, actualizar=False, retirar_obsoletas=False, **options):
        categorias = {
            n: Categoria.objects.get_or_create(nombre=n, defaults={"descripcion": d})[0]
            for n, d in CATEGORIAS.items()
        }
        fuentes = {}
        for clave, (titulo, autor, tipo, url, anteriores, *resto) in FUENTES.items():
            datos = dict(autor_institucion=autor, tipo_fuente=TipoFuente.objects.get(nombre=tipo),
                         url_referencia=url, fecha_consulta=resto[0] if resto else CONSULTA)
            existente = FuenteDocumental.objects.filter(titulo__in=(titulo,) + tuple(anteriores)).first()
            if existente is None:
                fuentes[clave] = FuenteDocumental.objects.create(titulo=titulo, **datos)
            else:
                fuentes[clave] = existente
                if actualizar:
                    for campo, valor in dict(titulo=titulo, **datos).items():
                        setattr(existente, campo, valor)
                    existente.save()

        if retirar_obsoletas:
            self._retirar_obsoletas()

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

        sobrantes = BienPatrimonial.objects.filter(nombre__in=OBSOLETAS).exclude(estado_publicacion=EstadoPublicacion.DESACTIVADO)
        if sobrantes.exists():
            self.stdout.write(self.style.WARNING(
                "Quedan fichas fuera del alcance de 13 bienes: " + "; ".join(sobrantes.values_list("nombre", flat=True))
                + ". Ejecute con --retirar-obsoletas para retirarlas."
            ))
        self.stdout.write(self.style.SUCCESS(
            f"Fichas en total: {len(FICHAS)} ({publicadas} publicadas en esta ejecución)."
        ))

    def _retirar_obsoletas(self):
        for bien in BienPatrimonial.objects.filter(nombre__in=OBSOLETAS):
            if bien.reportes.exists():  # los reportes se conservan (trazabilidad): la ficha solo se oculta
                if bien.estado_publicacion != EstadoPublicacion.DESACTIVADO:
                    bien.estado_publicacion = EstadoPublicacion.DESACTIVADO
                    bien.save()
                self.stdout.write(f"  desactivada (tiene reportes)  {bien.nombre}")
            else:
                self.stdout.write(f"  eliminada                     {bien.nombre}")
                bien.delete()
        FuenteDocumental.objects.filter(titulo__in=FUENTES_OBSOLETAS, bien_fuentes__isnull=True).delete()
