"""
Verifica el catálogo contra el criterio de aceptación de la semana 2 (informe, sección 12):
«10 fichas publicadas con fuente y licencia (100 %)». Solo lee: no modifica nada.

Uso:
  python manage.py verificar_catalogo             # informe; termina siempre con código 0
  python manage.py verificar_catalogo --estricto  # termina con error si el criterio no se cumple
"""
from django.core.management.base import BaseCommand, CommandError

from apps.patrimonio.models import BienPatrimonial, EstadoPublicacion, ZonaPiloto

META_FICHAS = 10


class Command(BaseCommand):
    help = "Informe de verificación del catálogo (fuentes, imágenes con atribución y ubicaciones)."

    def add_arguments(self, parser):
        parser.add_argument("--estricto", action="store_true", help="Falla si el criterio no se cumple.")

    def handle(self, *args, estricto=False, **options):
        zona = ZonaPiloto.vigente()
        bienes = (
            BienPatrimonial.objects.filter(estado_publicacion=EstadoPublicacion.PUBLICADO)
            .select_related("tipo_patrimonio")
            .prefetch_related("bien_fuentes__fuente", "recursos")
            .order_by("nombre")
        )
        filas, con_fuente, con_imagen_ok, imagenes, imagenes_ok = [], 0, 0, 0, 0
        for b in bienes:
            fuentes = [bf for bf in b.bien_fuentes.all() if bf.fuente.fecha_consulta]
            recursos = list(b.recursos.all())
            atribuidas = [r for r in recursos if (r.autor or "").strip() and r.licencia_id]
            imagenes += len(recursos)
            imagenes_ok += len(atribuidas)
            con_fuente += bool(fuentes)
            imagen_ok = bool(recursos) and len(atribuidas) == len(recursos)
            con_imagen_ok += imagen_ok
            if b.latitud is None:
                ubicacion = "sin ubicación puntual"
            else:
                ubicacion = "en la zona piloto" if zona and zona.contiene(b.latitud, b.longitud) else "FUERA DE LA ZONA"
            filas.append((b.nombre, b.tipo_patrimonio.nombre, len(fuentes), f"{len(atribuidas)}/{len(recursos)}", ubicacion))

        total = len(filas)
        self.stdout.write(f"{'Ficha':<66} {'Tipo':<11} {'Fuentes':>7} {'Imág.':>6}  Ubicación")
        for nombre, tipo, nf, ni, ub in filas:
            self.stdout.write(f"{nombre[:65]:<66} {tipo:<11} {nf:>7} {ni:>6}  {ub}")

        pct = lambda n: f"{(100 * n // total) if total else 0} %"  # noqa: E731
        self.stdout.write("")
        self.stdout.write(f"Fichas publicadas: {total} (meta: {META_FICHAS})")
        self.stdout.write(f"Con al menos una fuente con fecha de consulta: {con_fuente}/{total} ({pct(con_fuente)})")
        self.stdout.write(f"Imágenes con autor y licencia: {imagenes_ok}/{imagenes}")
        self.stdout.write(f"Fichas con imágenes, todas atribuidas: {con_imagen_ok}/{total} ({pct(con_imagen_ok)})")

        faltas = []
        if total < META_FICHAS:
            faltas.append(f"hay {total} fichas publicadas y la meta es {META_FICHAS}")
        if con_fuente < total:
            faltas.append("hay fichas sin fuente con fecha de consulta")
        if con_imagen_ok < total:
            faltas.append(f"{total - con_imagen_ok} ficha(s) sin imágenes atribuidas (autor y licencia)")
        if faltas:
            self.stdout.write(self.style.WARNING("CRITERIO NO CUMPLIDO: " + "; ".join(faltas) + "."))
            if estricto:
                raise CommandError("El catálogo no cumple el criterio de la semana 2.")
        else:
            self.stdout.write(self.style.SUCCESS("CRITERIO CUMPLIDO."))
