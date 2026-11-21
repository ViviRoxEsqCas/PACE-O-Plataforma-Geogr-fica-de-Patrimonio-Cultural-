"""Moderación editorial del espacio social. El Editor oculta o restituye comentarios; no los crea ni los borra."""
from django.contrib import admin, messages
from django.contrib.admin.models import CHANGE, LogEntry
from django.contrib.contenttypes.models import ContentType
from django.db.models import Count

from .models import ReporteComentario, Valoracion


class SoloLectura:
    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class ReporteInline(SoloLectura, admin.TabularInline):
    model = ReporteComentario
    extra = 0
    fields = ("reportante", "motivo", "atendido", "created_at")
    readonly_fields = ("reportante", "motivo", "created_at")
    can_delete = False


@admin.register(Valoracion)
class ValoracionAdmin(SoloLectura, admin.ModelAdmin):
    list_display = ("bien", "usuario", "estrellas", "comentario_corto", "comentario_oculto", "n_reportes", "updated_at")
    list_filter = ("comentario_oculto", "estrellas")
    search_fields = ("bien__nombre", "usuario__username", "comentario")
    readonly_fields = ("usuario", "bien", "estrellas", "comentario", "created_at", "updated_at")
    fields = readonly_fields + ("comentario_oculto",)
    inlines = [ReporteInline]
    actions = ["ocultar_comentarios", "restituir_comentarios"]
    list_select_related = ("bien", "usuario")

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_reportes=Count("reportes"))

    @admin.display(description="comentario")
    def comentario_corto(self, obj):
        return (obj.comentario[:60] + "…") if len(obj.comentario) > 60 else obj.comentario

    @admin.display(description="reportes", ordering="_reportes")
    def n_reportes(self, obj):
        return obj._reportes

    def _cambiar(self, request, queryset, oculto):
        n = 0
        tipo = ContentType.objects.get_for_model(Valoracion)
        for v in queryset.exclude(comentario_oculto=oculto):
            v.comentario_oculto = oculto
            v.save(update_fields=["comentario_oculto"])
            LogEntry.objects.log_action(request.user.pk, tipo.pk, v.pk, str(v), CHANGE, "Comentario oculto" if oculto else "Comentario restituido")
            n += 1
        self.message_user(request, f"{n} comentario(s) {'ocultado(s)' if oculto else 'restituido(s)'}.", messages.SUCCESS)

    @admin.action(description="Ocultar comentarios seleccionados (las estrellas se conservan)")
    def ocultar_comentarios(self, request, queryset):
        self._cambiar(request, queryset, True)

    @admin.action(description="Restituir comentarios seleccionados")
    def restituir_comentarios(self, request, queryset):
        self._cambiar(request, queryset, False)


@admin.register(ReporteComentario)
class ReporteComentarioAdmin(SoloLectura, admin.ModelAdmin):
    list_display = ("valoracion", "reportante", "motivo", "atendido", "created_at")
    list_filter = ("atendido",)
    readonly_fields = ("valoracion", "reportante", "motivo", "created_at")
    fields = readonly_fields + ("atendido",)
