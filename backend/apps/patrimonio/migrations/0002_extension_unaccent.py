from django.contrib.postgres.operations import UnaccentExtension
from django.db import migrations


class Migration(migrations.Migration):
    """Búsqueda por nombre sin distinguir tildes ni mayúsculas (RF-08, PT-07)."""

    dependencies = [("patrimonio", "0001_modelo_inicial")]
    operations = [UnaccentExtension()]
