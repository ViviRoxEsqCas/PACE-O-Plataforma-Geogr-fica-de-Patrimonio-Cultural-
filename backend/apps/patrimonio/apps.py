from django.apps import AppConfig
from django.db.models.signals import post_migrate


class PatrimonioConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.patrimonio"
    label = "patrimonio"
    verbose_name = "Patrimonio cultural"

    def ready(self):
        from .roles import sincronizar_grupos

        post_migrate.connect(sincronizar_grupos, sender=self, dispatch_uid="paceno_sincronizar_grupos")
