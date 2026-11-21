from django.apps import AppConfig
from django.db.models.signals import post_migrate


class SocialConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.social"
    label = "social"
    verbose_name = "Espacio social"

    def ready(self):
        from .roles import conceder_permisos_de_moderacion

        # Se ejecuta después del post_migrate de «patrimonio» (INSTALLED_APPS lo mantiene en ese orden):
        # los permisos de esta app solo existen una vez migrada, y roles.py de patrimonio los ignora.
        post_migrate.connect(conceder_permisos_de_moderacion, sender=self, dispatch_uid="paceno_social_moderacion")
