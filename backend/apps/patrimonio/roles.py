"""
Roles editoriales (sección 7.1 del informe) como grupos de Django.

Los grupos se crean (o se corrigen) después de cada `migrate`, de forma
idempotente, para que la matriz de permisos sea reproducible en cualquier entorno.
No se concede permiso de borrado sobre fichas: se «desactivan» (RF-05).
"""
from django.contrib.auth.models import Group, Permission

GRUPO_EDITOR = "Editor"
GRUPO_ADMINISTRADOR = "Administrador"

# modelo -> acciones concedidas al Editor
PERMISOS_EDITOR = {
    "patrimonio.categoria": ("view", "add", "change"),
    "patrimonio.bienpatrimonial": ("view", "add", "change"),
    "patrimonio.fuentedocumental": ("view", "add", "change"),
    "patrimonio.bienfuente": ("view", "add", "change", "delete"),
    "patrimonio.recursomultimedia": ("view", "add", "change", "delete"),
    "patrimonio.tipofuente": ("view", "add", "change"),
    "patrimonio.licencia": ("view", "add", "change"),
    # Catálogos cuyo nombre interviene en la lógica: solo lectura para el Editor.
    "patrimonio.tipopatrimonio": ("view",),
    "patrimonio.zonapiloto": ("view",),
    "patrimonio.historialestadobien": ("view",),
    # Semana 3. Actividades: el Editor las gestiona (RF-13). Reportes: solo revisa y cambia el estado;
    # no los crea ni los borra (los envía el público) y el historial es solo lectura (RF-18, RF-19).
    "patrimonio.actividad": ("view", "add", "change", "delete"),
    "patrimonio.opcionactividad": ("view", "add", "change", "delete"),
    "patrimonio.reporteciudadano": ("view", "change"),
    "patrimonio.historialestadoreporte": ("view",),
    "patrimonio.tiporeporte": ("view",),
    "patrimonio.estadoreporte": ("view",),
}

# Acciones adicionales exclusivas del Administrador (el resto lo hereda del Editor)
PERMISOS_ADMINISTRADOR_EXTRA = {
    "patrimonio.tipopatrimonio": ("add", "change"),
    "patrimonio.zonapiloto": ("add", "change"),
    "patrimonio.tiporeporte": ("add", "change"),
    "auth.user": ("view", "add", "change"),  # las cuentas se desactivan, no se borran
    "auth.group": ("view",),  # asigna grupos a cuentas, pero no edita sus permisos
    "admin.logentry": ("view",),  # historial de cambios del panel (RF-23)
}


def _permisos(mapa: dict[str, tuple[str, ...]]) -> list[Permission]:
    resultado = []
    for etiqueta, acciones in mapa.items():
        app_label, modelo = etiqueta.split(".")
        codenames = [f"{accion}_{modelo}" for accion in acciones]
        encontrados = Permission.objects.filter(
            content_type__app_label=app_label,
            content_type__model=modelo,
            codename__in=codenames,
        )
        if encontrados.count() != len(codenames):
            raise RuntimeError(f"Permisos inexistentes para {etiqueta}: {codenames}")
        resultado.extend(encontrados)
    return resultado


def sincronizar_grupos(**_kwargs):
    """Crea o actualiza los grupos Editor y Administrador (conectado a post_migrate)."""
    editor, _ = Group.objects.get_or_create(name=GRUPO_EDITOR)
    editor.permissions.set(_permisos(PERMISOS_EDITOR))

    admin, _ = Group.objects.get_or_create(name=GRUPO_ADMINISTRADOR)
    admin.permissions.set(_permisos(PERMISOS_EDITOR) + _permisos(PERMISOS_ADMINISTRADOR_EXTRA))
