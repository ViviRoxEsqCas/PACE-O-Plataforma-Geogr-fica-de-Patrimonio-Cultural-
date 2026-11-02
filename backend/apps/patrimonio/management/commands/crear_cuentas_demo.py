"""
Crea cuentas de demostración del panel: una de Editor y una de Administrador.

Las contraseñas se toman de las variables DEMO_EDITOR_PASSWORD y
DEMO_ADMIN_PASSWORD o, si no existen, se generan al azar y se muestran UNA vez.
No usar en producción (RN-08: en producción las cuentas las crea el Administrador).
"""
import os
import secrets

from django.contrib.auth.models import Group, User
from django.core.management.base import BaseCommand

from apps.patrimonio.roles import GRUPO_ADMINISTRADOR, GRUPO_EDITOR

CUENTAS = [
    ("editor_demo", GRUPO_EDITOR, "DEMO_EDITOR_PASSWORD"),
    ("admin_demo", GRUPO_ADMINISTRADOR, "DEMO_ADMIN_PASSWORD"),
]


class Command(BaseCommand):
    help = "Crea las cuentas editor_demo y admin_demo (idempotente; restablece su contraseña)."

    def handle(self, *args, **options):
        for usuario, grupo, variable in CUENTAS:
            clave = os.getenv(variable) or secrets.token_urlsafe(12)
            cuenta, _ = User.objects.get_or_create(username=usuario)
            cuenta.is_staff = True  # acceso al panel; los permisos vienen del grupo
            cuenta.is_superuser = False
            cuenta.is_active = True
            cuenta.set_password(clave)
            cuenta.save()
            cuenta.groups.set([Group.objects.get(name=grupo)])
            self.stdout.write(f"{usuario} ({grupo})  contraseña: {clave}")
        self.stdout.write(self.style.WARNING("Guarde las contraseñas: no se vuelven a mostrar."))
