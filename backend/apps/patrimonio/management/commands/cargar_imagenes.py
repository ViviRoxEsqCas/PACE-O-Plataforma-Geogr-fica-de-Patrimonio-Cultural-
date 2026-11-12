"""
Importa las imágenes de las fichas desde la carpeta del repositorio `contenido/imagenes/`.

Cada fila de `manifiesto.csv` describe una imagen: archivo, bien, autor, licencia, texto_alternativo, portada.
El comando valida (archivo existente y legible, ficha existente, autor y licencia obligatorios), copia el
archivo al almacenamiento de medios (MEDIA_ROOT, o el almacenamiento configurado) y registra el recurso en la
base de datos. Es idempotente: una imagen ya cargada no se duplica. Las filas con «archivo» vacío se ignoran.

Uso:
  python manage.py cargar_imagenes --simular   # solo valida e informa
  python manage.py cargar_imagenes             # carga
"""
import csv
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from PIL import Image

from apps.patrimonio.models import BienPatrimonial, Licencia, RecursoMultimedia

CARPETA_POR_DEFECTO = Path(settings.BASE_DIR).parent / "contenido" / "imagenes"
COLUMNAS = {"archivo", "bien", "autor", "licencia", "texto_alternativo", "portada"}
VERDADERO = {"1", "si", "sí", "true", "x", "yes"}


class Command(BaseCommand):
    help = "Importa imágenes con autor y licencia desde contenido/imagenes/manifiesto.csv."

    def add_arguments(self, parser):
        parser.add_argument("--carpeta", default=str(CARPETA_POR_DEFECTO), help="Carpeta con las imágenes y manifiesto.csv")
        parser.add_argument("--simular", action="store_true", help="Valida sin escribir nada.")

    def handle(self, *args, carpeta, simular, **options):
        carpeta = Path(carpeta)
        manifiesto = carpeta / "manifiesto.csv"
        if not manifiesto.is_file():
            raise CommandError(f"No existe {manifiesto}.")
        with manifiesto.open(encoding="utf-8-sig", newline="") as f:
            lector = csv.DictReader(f)
            if not COLUMNAS.issubset(set(lector.fieldnames or [])):
                raise CommandError(f"El manifiesto debe tener las columnas: {', '.join(sorted(COLUMNAS))}.")
            filas = [(n, {k: (v or "").strip() for k, v in fila.items()}) for n, fila in enumerate(lector, start=2)]

        errores, a_cargar, omitidas = [], [], 0
        licencias = {l.nombre: l for l in Licencia.objects.all()}
        for n, fila in filas:
            if not fila["archivo"]:
                omitidas += 1
                continue
            ruta = carpeta / fila["archivo"]
            bien = BienPatrimonial.objects.filter(nombre=fila["bien"]).first()
            if not ruta.is_file():
                errores.append(f"Fila {n}: no existe el archivo «{fila['archivo']}».")
                continue
            try:
                with Image.open(ruta) as im:
                    im.verify()
            except Exception:
                errores.append(f"Fila {n}: «{fila['archivo']}» no es una imagen válida.")
                continue
            if bien is None:
                errores.append(f"Fila {n}: no existe la ficha «{fila['bien']}» (copie el nombre exacto).")
            if not fila["autor"]:
                errores.append(f"Fila {n}: falta el autor (obligatorio, RF-04).")
            if fila["licencia"] not in licencias:
                errores.append(f"Fila {n}: la licencia «{fila['licencia']}» no existe. Opciones: {', '.join(licencias)}.")
            if bien and fila["autor"] and fila["licencia"] in licencias:
                a_cargar.append((ruta, bien, fila))
        if errores:
            raise CommandError("No se cargó nada:\n  " + "\n  ".join(errores))

        nuevas = 0
        with transaction.atomic():
            for ruta, bien, fila in a_cargar:
                destino = f"bienes/{ruta.name}"
                if RecursoMultimedia.objects.filter(bien=bien, archivo=destino).exists():
                    continue
                nuevas += 1
                if simular:
                    continue
                portada = fila["portada"].lower() in VERDADERO or not bien.recursos.filter(es_portada=True).exists()
                if portada:
                    bien.recursos.filter(es_portada=True).update(es_portada=False)
                recurso = RecursoMultimedia(
                    bien=bien, autor=fila["autor"], licencia=licencias[fila["licencia"]],
                    texto_alternativo=fila["texto_alternativo"] or bien.nombre, es_portada=portada,
                )
                with ruta.open("rb") as binario:
                    recurso.archivo.save(ruta.name, File(binario), save=False)
                recurso.save()
        etiqueta = "Se cargarían" if simular else "Cargadas"
        self.stdout.write(self.style.SUCCESS(
            f"{etiqueta}: {nuevas} imagen(es). Ya existentes: {len(a_cargar) - nuevas}. Filas vacías ignoradas: {omitidas}."
        ))
