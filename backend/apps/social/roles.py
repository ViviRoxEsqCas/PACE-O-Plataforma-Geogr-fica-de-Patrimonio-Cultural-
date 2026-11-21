"""
Moderación del espacio social. El Editor revisa y oculta comentarios; no crea, edita ni borra
valoraciones ni cuentas de visitantes. Las cuentas de visitantes las gestiona el Administrador
(ya tiene `auth.user`: ver, crear y modificar → desactivar). Se AÑADEN permisos a los grupos
existentes (no se reemplazan) para no alterar la matriz de la semana 3.
"""
from django.contrib.auth.models import Group, Permission

PERMISOS_MODERACION = {
    "social.valoracion": ("view", "change"),
    "social.reportecomentario": ("view", "change"),
}


def conceder_permisos_de_moderacion(**_kwargs):
    permisos = []
    for etiqueta, acciones in PERMISOS_MODERACION.items():
        app_label, modelo = etiqueta.split(".")
        encontrados = Permission.objects.filter(
            content_type__app_label=app_label, content_type__model=modelo,
            codename__in=[f"{a}_{modelo}" for a in acciones],
        )
        if encontrados.count() != len(acciones):
            raise RuntimeError(f"Permisos inexistentes para {etiqueta}")
        permisos.extend(encontrados)
    for nombre in ("Editor", "Administrador"):
        grupo, _ = Group.objects.get_or_create(name=nombre)
        grupo.permissions.add(*permisos)
