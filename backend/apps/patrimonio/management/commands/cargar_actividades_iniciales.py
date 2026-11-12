"""
Carga 13 actividades de selección múltiple (meta de la semana 3: «al menos 10»), una por ficha.

Cada pregunta se apoya SOLO en datos que ya constan en la ficha y en su fuente normativa
(Leyes N.º 1078 y 219; Leyes Municipales 002, 010 y 019; notas de prensa y fichas de museos citadas en cada ficha). No se añaden
datos históricos nuevos. Son contenido de arranque: el Editor puede corregirlas o ampliarlas
desde el panel (Actividades), y deben revisarse editorialmente antes de la presentación.

Uso:
  python manage.py cargar_actividades_iniciales     # crea las que falten (idempotente por enunciado)
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.patrimonio.models import Actividad, BienPatrimonial, OpcionActividad

# (ficha, pregunta, [opciones], índice de la correcta, explicación)
ACTIVIDADES = [
    ("Plaza Pedro Domingo Murillo",
     "¿Cuál de estos nombres anteriores de la Plaza Murillo menciona la Ley N.º 219?",
     ["Plaza Mayor", "Plaza del Mercado", "Plaza Libertad", "Plaza de la Revolución"], 0,
     "La Ley N.º 219, de 2011, la identifica como antes conocida como «la Plaza Mayor, Plaza de Armas, Plaza 16 de Julio o Kilómetro Cero»."),
    ("Casa Museo Pedro Domingo Murillo",
     "¿Qué categoría de valoración (Valor Monumental) asigna la Ley Municipal N.º 019 a la Casa Museo de Murillo?",
     ["Categoría A", "Categoría B", "Categoría C", "Categoría D"], 0,
     "La Ley Municipal Autónoma N.º 019, de 31 de mayo de 2012, la declara patrimonio con Categoría A (Valor Monumental)."),
    ("Calle Jaén – conjunto histórico patrimonial",
     "Según las notas de prensa de febrero de 2020, ¿cuántos inmuebles de la calle Jaén declaró patrimonio el Concejo Municipal, junto con la calle?",
     ["4", "14", "24", "36"], 1,
     "El Concejo declaró patrimonio histórico, arquitectónico y urbano la calle Jaén y catorce inmuebles emplazados en ella (eju.tv y El Diario, febrero de 2020)."),
    ("Basílica Menor de San Francisco",
     "¿Qué ley, promulgada el 11 de julio de 2018, declara la Basílica Menor de San Francisco Patrimonio Cultural Material Inmueble del Estado?",
     ["Ley N.º 1078", "Ley N.º 219", "Ley N.º 2791", "Ley Municipal N.º 010"], 0,
     "La Ley N.º 1078, de 11 de julio de 2018, la declara «Templo Mayor de Los Andes» y Patrimonio Cultural Material Inmueble del Estado Plurinacional."),
    ("Museo Nacional de Etnografía y Folklore (MUSEF)",
     "¿En la esquina de qué calle con Genaro Sanjinés se ubica el Museo Nacional de Etnografía y Folklore?",
     ["Ingavi", "Jaén", "Comercio", "Potosí"], 0,
     "Según Wikipedia, el museo está en la esquina de las calles Ingavi y Genaro Sanjinés."),
    ("Museo Costumbrista Juan de Vargas",
     "Según la ficha del museo en Perspectiva Temporal, ¿en qué año se creó el Museo Costumbrista «Juan de Vargas»?",
     ["1953", "1962", "1979", "1984"], 2,
     "La fuente indica que se creó en mayo de 1979; es uno de los museos municipales de la calle Jaén."),
    ("Museo de Metales Preciosos",
     "¿Con qué nombre se inauguró en 1984 el actual Museo de Metales Preciosos Precolombinos?",
     ["Museo del Oro", "Museo de la Plata", "Museo del Litoral", "Museo de Artesanía"], 0,
     "Según Wikipedia, primero se llamó «Museo del Oro» y funciona en la antigua casa de Apolinar Jaén."),
    ("Museo del Litoral Boliviano",
     "¿A qué hecho histórico está dedicado el Museo del Litoral Boliviano?",
     ["La Guerra del Pacífico", "La Revolución del 16 de julio de 1809", "La fundación de La Paz", "La Guerra del Chaco"], 0,
     "El museo está dedicado a la Guerra del Pacífico, en la que Bolivia perdió su litoral, y al coronel Eduardo Abaroa."),
    ("Catedral Metropolitana Nuestra Señora de La Paz",
     "¿En qué fecha se iniciaron las obras de la actual Catedral Metropolitana?",
     ["24 de marzo de 1835", "16 de julio de 1809", "18 de noviembre de 1845", "11 de julio de 2018"], 0,
     "Las obras de la catedral actual comenzaron el 24 de marzo de 1835; se inauguró en 1925 y sus torres laterales en 1989."),
    ("Teatro Municipal Alberto Saavedra Pérez",
     "¿En qué fecha abrió sus puertas al público el Teatro Municipal de La Paz?",
     ["18 de noviembre de 1845", "6 de agosto de 1825", "19 de octubre de 2011", "24 de marzo de 1835"], 0,
     "Según La Ventana y Fides, abrió el 18 de noviembre de 1845; desde 1957 lleva el nombre de Alberto Saavedra Pérez."),
    ("Revolución Libertaria del 16 de julio de 1809",
     "¿Qué fecha conmemora la celebración protegida por la Ley Municipal N.º 002/2010?",
     ["16 de julio de 1809", "6 de agosto de 1825", "19 de octubre de 2011", "11 de julio de 2018"], 0,
     "La Ley Municipal N.º 002/2010 declara patrimonio histórico de La Paz la celebración de la Revolución Libertaria del 16 de julio de 1809."),
    ("Cueca Paceña",
     "¿Qué día de cada año queda establecido como «Día de la Cueca Paceña»?",
     ["16 de julio", "19 de octubre", "31 de octubre", "28 de diciembre"], 1,
     "La Ley Municipal N.º 010, de 2011, declara la Cueca Paceña Patrimonio Cultural Intangible y fija el 19 de octubre como su día."),
    ("El Pepino – personaje tradicional del Carnaval Paceño",
     "Según la nota de eju.tv citada en la ficha, ¿qué año declaró el Concejo de La Paz como «de reivindicación» del Pepino?",
     ["2015", "2026", "2010", "2004"], 1,
     "En 2015 el Pepino fue declarado patrimonio inmaterial; el Concejo declaró 2026 «año de reivindicación» para reforzar su protección y defensa."),
]


class Command(BaseCommand):
    help = "Carga 13 actividades educativas de arranque (una por ficha publicada)."

    @transaction.atomic
    def handle(self, *args, **options):
        creadas = 0
        for ficha, enunciado, opciones, correcta, explicacion in ACTIVIDADES:
            bien = BienPatrimonial.objects.filter(nombre=ficha).first()
            if bien is None:
                raise CommandError(f"No existe la ficha «{ficha}». Ejecute antes cargar_fichas_iniciales --actualizar.")
            if Actividad.objects.filter(bien=bien, enunciado=enunciado).exists():
                continue
            actividad = Actividad.objects.create(
                bien=bien, enunciado=enunciado, retroalimentacion=explicacion, puntos=10, activa=True
            )
            for i, texto in enumerate(opciones):
                OpcionActividad.objects.create(actividad=actividad, texto=texto, es_correcta=(i == correcta))
            assert not actividad.errores_validez()
            creadas += 1
        total = Actividad.objects.filter(activa=True).count()
        self.stdout.write(self.style.SUCCESS(f"Actividades creadas: {creadas}. Activas en total: {total}."))
