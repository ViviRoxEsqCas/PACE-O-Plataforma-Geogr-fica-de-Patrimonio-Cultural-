"""Carga de catálogos y zona piloto (informe, sección 11.3-e: «migración de datos en la semana 1»)."""
from decimal import Decimal

from django.db import migrations

TIPOS_PATRIMONIO = ["material", "inmaterial"]
TIPOS_FUENTE = ["norma", "publicación", "inventario", "sitio web", "entrevista", "otro"]
TIPOS_REPORTE = ["deterioro", "información incorrecta", "acceso restringido", "otro"]
ESTADOS_REPORTE = [("nuevo", False), ("en revisión", False), ("atendido", True), ("descartado", True)]
LICENCIAS = [
    ("CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"),
    ("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"),
    ("CC0 1.0 (dominio público)", "https://creativecommons.org/publicdomain/zero/1.0/"),
    ("Autorización expresa del titular", ""),
]
# Caja geográfica APROXIMADA del eje central (plaza Murillo, entorno de San Francisco y
# avenida Aniceto Arce). Debe reemplazarse por el polígono de la IDE La Paz cuando se obtenga.
ZONA = dict(
    nombre="Eje central: plaza Murillo – San Francisco – av. Aniceto Arce (caja aproximada)",
    lat_min=Decimal("-16.512000"), lat_max=Decimal("-16.490000"),
    lon_min=Decimal("-68.144000"), lon_max=Decimal("-68.122000"),
    activa=True,
)


def cargar(apps, schema_editor):
    M = lambda n: apps.get_model("patrimonio", n)  # noqa: E731
    for nombre in TIPOS_PATRIMONIO:
        M("TipoPatrimonio").objects.get_or_create(nombre=nombre)
    for nombre in TIPOS_FUENTE:
        M("TipoFuente").objects.get_or_create(nombre=nombre)
    for nombre in TIPOS_REPORTE:
        M("TipoReporte").objects.get_or_create(nombre=nombre)
    for nombre, final in ESTADOS_REPORTE:
        M("EstadoReporte").objects.get_or_create(nombre=nombre, defaults={"es_final": final})
    for nombre, url in LICENCIAS:
        M("Licencia").objects.get_or_create(nombre=nombre, defaults={"url": url})
    if not M("ZonaPiloto").objects.exists():
        M("ZonaPiloto").objects.create(**ZONA)


class Migration(migrations.Migration):
    dependencies = [("patrimonio", "0002_extension_unaccent")]
    # Los catálogos pueden ampliarse desde el panel; al revertir no se borran datos editoriales.
    operations = [migrations.RunPython(cargar, migrations.RunPython.noop)]
