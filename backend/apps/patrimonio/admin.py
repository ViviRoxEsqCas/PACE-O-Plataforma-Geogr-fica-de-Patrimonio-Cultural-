"""
Administración editorial con Django Admin (Módulo 5, sección 8.1): no se
desarrolla un panel propio. Aquí solo se configuran listados, filtros,
validaciones y acciones.
"""
from django.contrib import admin, messages
from django.contrib.admin.models import LogEntry
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import Group, User
from django.core.exceptions import ValidationError
from django import forms
from django.forms.models import BaseInlineFormSet

from .models import (
    Actividad,
    BienFuente,
    BienPatrimonial,
    Categoria,
    EstadoPublicacion,
    EstadoReporte,
    FuenteDocumental,
    HistorialEstadoBien,
    HistorialEstadoReporte,
    Licencia,
    OpcionActividad,
    RecursoMultimedia,
    ReporteCiudadano,
    TipoFuente,
    TipoPatrimonio,
    TipoReporte,
    ZonaPiloto,
)


# ---------------------------------------------------------------------------
# Catálogos
# ---------------------------------------------------------------------------
@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "descripcion")
    search_fields = ("nombre",)


@admin.register(TipoFuente)
class TipoFuenteAdmin(admin.ModelAdmin):
    search_fields = ("nombre",)


@admin.register(Licencia)
class LicenciaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "url")
    search_fields = ("nombre",)


@admin.register(TipoPatrimonio)
class TipoPatrimonioAdmin(admin.ModelAdmin):
    list_display = ("nombre",)


@admin.register(ZonaPiloto)
class ZonaPilotoAdmin(admin.ModelAdmin):
    list_display = ("nombre", "lat_min", "lat_max", "lon_min", "lon_max", "activa")


@admin.register(FuenteDocumental)
class FuenteDocumentalAdmin(admin.ModelAdmin):
    list_display = ("titulo", "autor_institucion", "tipo_fuente", "fecha_consulta")
    list_filter = ("tipo_fuente",)
    search_fields = ("titulo", "autor_institucion")  # requerido por autocomplete_fields


# ---------------------------------------------------------------------------
# Bien patrimonial (M1)
# ---------------------------------------------------------------------------
class BienFuenteInline(admin.TabularInline):
    model = BienFuente
    extra = 1
    autocomplete_fields = ("fuente",)
    verbose_name = "fuente documental"
    verbose_name_plural = "fuentes documentales (al menos una para publicar)"


class RecursoMultimediaInline(admin.StackedInline):
    model = RecursoMultimedia
    extra = 0
    verbose_name = "imagen"
    verbose_name_plural = "imágenes (cada una con autor y licencia)"


class HistorialEstadoBienInline(admin.TabularInline):
    model = HistorialEstadoBien
    extra = 0
    can_delete = False
    fields = ("fecha", "estado_anterior", "estado_nuevo", "usuario")
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(BienPatrimonial)
class BienPatrimonialAdmin(admin.ModelAdmin):
    list_display = ("nombre", "tipo_patrimonio", "categoria", "estado_publicacion", "con_ubicacion", "updated_at")
    list_filter = ("estado_publicacion", "tipo_patrimonio", "categoria")
    search_fields = ("nombre", "descripcion")
    list_select_related = ("tipo_patrimonio", "categoria")
    exclude = ("zona", "creado_por")
    readonly_fields = ("created_at", "updated_at")
    inlines = [BienFuenteInline, RecursoMultimediaInline, HistorialEstadoBienInline]
    actions = ["publicar", "pasar_a_revision", "desactivar"]

    @admin.display(boolean=True, description="Ubicación puntual")
    def con_ubicacion(self, obj):
        return obj.latitud is not None and obj.longitud is not None

    # -- Publicación en dos pasos ------------------------------------------
    # Las fuentes e imágenes se guardan DESPUÉS de la ficha; por eso, si se pide
    # publicar, primero se guarda con el estado vigente y la publicación se
    # confirma (o se rechaza con mensaje) tras guardar los formularios en línea.
    def save_model(self, request, obj, form, change):
        obj._usuario = request.user
        if not change:
            obj.creado_por = request.user
        obj._estado_solicitado = obj.estado_publicacion
        if obj.estado_publicacion == EstadoPublicacion.PUBLICADO and obj._estado_original != EstadoPublicacion.PUBLICADO:
            obj.estado_publicacion = obj._estado_original or EstadoPublicacion.BORRADOR
        obj.save(validar_publicacion=False)

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        obj = form.instance
        if getattr(obj, "_estado_solicitado", None) != EstadoPublicacion.PUBLICADO:
            return
        errores = obj.errores_publicacion()
        if not errores:
            if obj.estado_publicacion != EstadoPublicacion.PUBLICADO:
                obj.estado_publicacion = EstadoPublicacion.PUBLICADO
                obj.save()
            return
        if obj.estado_publicacion == EstadoPublicacion.PUBLICADO:
            # Ya estaba publicada y la edición la dejó incompleta: se retira del público.
            obj.estado_publicacion = EstadoPublicacion.REVISION
            obj.save(validar_publicacion=False)
            aviso = "La ficha pasó a «En revisión» porque ya no cumple los requisitos de publicación: "
        else:
            aviso = "La ficha NO se publicó (se conserva como «%s»): " % obj.get_estado_publicacion_display()
        messages.error(request, aviso + " ".join(errores))

    # -- Acciones masivas ----------------------------------------------------
    def _cambiar_estado(self, request, queryset, estado):
        cambiadas = 0
        for bien in queryset:
            if bien.estado_publicacion == estado:
                continue
            bien._usuario = request.user
            bien.estado_publicacion = estado
            try:
                bien.save()
            except ValidationError as e:
                messages.error(request, f"«{bien.nombre}» no se publicó: " + " ".join(e.messages))
            else:
                cambiadas += 1
        if cambiadas:
            messages.success(request, f"{cambiadas} ficha(s) cambiaron a «{EstadoPublicacion(estado).label}».")

    @admin.action(description="Publicar fichas seleccionadas (valida requisitos)")
    def publicar(self, request, queryset):
        self._cambiar_estado(request, queryset, EstadoPublicacion.PUBLICADO)

    @admin.action(description="Pasar fichas seleccionadas a revisión")
    def pasar_a_revision(self, request, queryset):
        self._cambiar_estado(request, queryset, EstadoPublicacion.REVISION)

    @admin.action(description="Desactivar fichas seleccionadas")
    def desactivar(self, request, queryset):
        self._cambiar_estado(request, queryset, EstadoPublicacion.DESACTIVADO)


@admin.register(HistorialEstadoBien)
class HistorialEstadoBienAdmin(admin.ModelAdmin):
    """Trazabilidad de estados de las fichas: solo lectura."""

    list_display = ("bien", "estado_anterior", "estado_nuevo", "usuario", "fecha")
    list_filter = ("estado_nuevo",)
    search_fields = ("bien__nombre",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# ---------------------------------------------------------------------------
# Actividades (M3, RF-13)
# ---------------------------------------------------------------------------
class OpcionesFormSet(BaseInlineFormSet):
    """RN-04: una actividad ACTIVA debe quedar con 2 a 6 opciones y exactamente una correcta."""

    def clean(self):
        super().clean()
        if any(self.errors) or not self.instance.activa:
            return
        vivas = [f for f in self.forms if f.cleaned_data and not f.cleaned_data.get("DELETE")]
        correctas = sum(1 for f in vivas if f.cleaned_data.get("es_correcta"))
        if not (Actividad.MIN_OPCIONES <= len(vivas) <= Actividad.MAX_OPCIONES):
            raise ValidationError(
                f"Una actividad activa debe tener entre {Actividad.MIN_OPCIONES} y {Actividad.MAX_OPCIONES} opciones "
                f"(tiene {len(vivas)}). Para guardarla incompleta, desmarque «activa»."
            )
        if correctas != 1:
            raise ValidationError(
                f"Debe marcar exactamente una opción como correcta (marcadas: {correctas}). "
                "Para guardarla incompleta, desmarque «activa»."
            )


class OpcionActividadInline(admin.TabularInline):
    model = OpcionActividad
    formset = OpcionesFormSet
    extra = 4
    verbose_name = "opción"
    verbose_name_plural = "opciones (2 a 6; exactamente una correcta)"


@admin.register(Actividad)
class ActividadAdmin(admin.ModelAdmin):
    list_display = ("enunciado_corto", "bien", "puntos", "activa", "es_valida")
    list_filter = ("activa", "bien")
    search_fields = ("enunciado", "bien__nombre")
    autocomplete_fields = ("bien",)
    inlines = [OpcionActividadInline]

    @admin.display(description="Pregunta")
    def enunciado_corto(self, obj):
        return obj.enunciado[:80]

    @admin.display(boolean=True, description="Opciones válidas")
    def es_valida(self, obj):
        return not obj.errores_validez()


# ---------------------------------------------------------------------------
# Reportes ciudadanos (M4, RF-18 y RF-19): la bandeja editorial
# ---------------------------------------------------------------------------
class RevisionForm(forms.ModelForm):
    """Solo el estado (limitado a las transiciones permitidas) y una nota son editables."""

    nota_revision = forms.CharField(
        label="Nota de la revisión", required=False, max_length=500,
        widget=forms.Textarea(attrs={"rows": 2}), help_text="Opcional. Queda en el historial junto con su nombre y la fecha.",
    )

    class Meta:
        model = ReporteCiudadano
        fields = ("estado",)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        actual = self.instance.estado if self.instance.pk else None
        if actual is not None:
            permitidos = (actual.nombre,) + ReporteCiudadano.destinos_permitidos(actual.nombre)
            self.fields["estado"].queryset = EstadoReporte.objects.filter(nombre__in=permitidos)
            if actual.es_final:
                self.fields["estado"].disabled = True
                self.fields["nota_revision"].disabled = True


class HistorialReporteInline(admin.TabularInline):
    model = HistorialEstadoReporte
    extra = 0
    can_delete = False
    fields = ("fecha", "estado_anterior", "estado_nuevo", "revisado_por", "nota")
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(ReporteCiudadano)
class ReporteCiudadanoAdmin(admin.ModelAdmin):
    form = RevisionForm
    list_display = ("id", "bien", "tipo_reporte", "resumen", "estado", "fecha_creacion")
    list_filter = ("estado", "tipo_reporte")
    search_fields = ("descripcion", "bien__nombre")
    list_select_related = ("bien", "tipo_reporte", "estado")
    date_hierarchy = "fecha_creacion"
    inlines = [HistorialReporteInline]
    actions = ["marcar_en_revision", "marcar_atendido", "marcar_descartado"]
    fields = ("bien", "tipo_reporte", "descripcion", "fecha_creacion", "estado", "nota_revision")
    readonly_fields = ("bien", "tipo_reporte", "descripcion", "fecha_creacion")

    @admin.display(description="Descripción")
    def resumen(self, obj):
        return obj.descripcion[:70]

    def has_add_permission(self, request):
        return False  # los reportes los envía el público por la API

    def has_delete_permission(self, request, obj=None):
        return False  # se conservan para trazabilidad: se descartan, no se borran

    def save_model(self, request, obj, form, change):
        nuevo = form.cleaned_data["estado"]
        anterior = ReporteCiudadano.objects.select_related("estado").get(pk=obj.pk).estado
        if nuevo.pk == anterior.pk:
            return
        obj.estado = anterior  # cambiar_estado valida la transición desde el estado guardado
        try:
            obj.cambiar_estado(nuevo, request.user, form.cleaned_data.get("nota_revision", ""))
        except ValidationError as e:
            messages.error(request, " ".join(e.messages))

    # -- Acciones masivas ----------------------------------------------------
    def _transicion(self, request, queryset, nombre):
        destino = EstadoReporte.objects.get(nombre=nombre)
        hechos = 0
        for reporte in queryset.select_related("estado"):
            try:
                reporte.cambiar_estado(destino, request.user)
            except ValidationError as e:
                messages.warning(request, f"Reporte #{reporte.pk}: " + " ".join(e.messages))
            else:
                hechos += 1
        if hechos:
            messages.success(request, f"{hechos} reporte(s) pasaron a «{nombre}».")

    @admin.action(description="Pasar a «en revisión»")
    def marcar_en_revision(self, request, queryset):
        self._transicion(request, queryset, EstadoReporte.EN_REVISION)

    @admin.action(description="Marcar como «atendido»")
    def marcar_atendido(self, request, queryset):
        self._transicion(request, queryset, EstadoReporte.ATENDIDO)

    @admin.action(description="Marcar como «descartado»")
    def marcar_descartado(self, request, queryset):
        self._transicion(request, queryset, EstadoReporte.DESCARTADO)


@admin.register(TipoReporte)
class TipoReporteAdmin(admin.ModelAdmin):
    list_display = ("nombre",)


# ---------------------------------------------------------------------------
# Usuarios y grupos (M5)
# ---------------------------------------------------------------------------
admin.site.unregister(User)


@admin.register(User)
class UsuarioAdmin(UserAdmin):
    """El Administrador gestiona cuentas, pero no puede ver ni modificar superusuarios,
    ni concederse `is_superuser` o permisos directos (evita escalada de privilegios)."""

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs if request.user.is_superuser else qs.filter(is_superuser=False)

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        if not request.user.is_superuser:
            for campo in ("is_superuser", "user_permissions"):
                if campo in form.base_fields:
                    form.base_fields[campo].disabled = True
        return form


@admin.register(LogEntry)
class LogEntryAdmin(admin.ModelAdmin):
    """Historial de cambios del panel (RF-23): solo lectura."""

    list_display = ("action_time", "user", "content_type", "object_repr", "action_flag")
    list_filter = ("action_flag", "content_type")
    search_fields = ("object_repr", "change_message")
    date_hierarchy = "action_time"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
