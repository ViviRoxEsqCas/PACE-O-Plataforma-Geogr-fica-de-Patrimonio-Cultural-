"""
Espacio social vinculado al patrimonio (sin chat, grupos ni feed complejo).

Se reutiliza el usuario de Django (no hay tabla de usuario propia). Tablas nuevas (5):
  perfil_visitante   1:1 con auth_user  · nombre visible, foto, banner, biografía, privacidad
  valoracion         N:1 usuario, N:1 bien · 1–5 estrellas + comentario opcional (única por usuario y bien)
  reporte_comentario N:1 valoración, N:1 usuario · denuncia de un comentario (única por denunciante)
  amistad            solicitante → destinatario · estado; una sola fila por pareja, sin importar el sentido
  visita_declarada   N:1 usuario, N:1 bien · «marcar como visitado» (NO verificada; no guarda ubicación)
Logros y ranking NO tienen tabla: se calculan siempre a partir de las acciones anteriores (ver reglas.py),
así no pueden quedar desincronizados ni inventarse retroactivamente.
"""
import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q
from django.db.models.functions import Greatest, Least

from apps.patrimonio.models import BienPatrimonial


class Privacidad(models.TextChoices):
    PUBLICO = "publico", "Público"
    AMIGOS = "amigos", "Solo amistades"
    PRIVADO = "privado", "Privado"


def ruta_foto_perfil(instancia, nombre):
    extension = nombre.rsplit(".", 1)[-1].lower() if "." in nombre else "jpg"
    return f"perfiles/usuario_{instancia.usuario_id}.{extension}"


def ruta_banner_perfil(instancia, nombre):
    extension = nombre.rsplit(".", 1)[-1].lower() if "." in nombre else "jpg"
    # Nombre único por subida: así el navegador no muestra un banner antiguo desde su caché al reemplazarlo.
    return f"perfiles/banner_usuario_{instancia.usuario_id}_{uuid.uuid4().hex[:8]}.{extension}"


class PerfilVisitante(models.Model):
    usuario = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="perfil_visitante")
    nombre_visible = models.CharField("nombre visible", max_length=40)
    biografia = models.CharField("biografía", max_length=280, blank=True)
    foto = models.ImageField("fotografía", upload_to=ruta_foto_perfil, blank=True)
    banner = models.ImageField("banner del perfil", upload_to=ruta_banner_perfil, blank=True)
    privacidad_perfil = models.CharField(max_length=8, choices=Privacidad.choices, default=Privacidad.PUBLICO)
    privacidad_actividad = models.CharField(max_length=8, choices=Privacidad.choices, default=Privacidad.AMIGOS)
    created_at = models.DateTimeField("creado", auto_now_add=True)

    class Meta:
        db_table = "perfil_visitante"
        verbose_name = "perfil de visitante"
        verbose_name_plural = "perfiles de visitantes"
        constraints = [
            models.CheckConstraint(condition=Q(privacidad_perfil__in=Privacidad.values), name="ck_perfil_priv_perfil"),
            models.CheckConstraint(condition=Q(privacidad_actividad__in=Privacidad.values), name="ck_perfil_priv_actividad"),
        ]

    def __str__(self):
        return f"{self.nombre_visible} (@{self.usuario.username})"


class Valoracion(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="valoraciones")
    bien = models.ForeignKey(BienPatrimonial, on_delete=models.CASCADE, related_name="valoraciones")
    estrellas = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comentario = models.CharField("comentario", max_length=500, blank=True)
    comentario_oculto = models.BooleanField(
        "comentario oculto por moderación", default=False,
        help_text="Oculta solo el texto; las estrellas siguen contando. Se restituye desmarcando esta casilla.",
    )
    created_at = models.DateTimeField("creada", auto_now_add=True)
    updated_at = models.DateTimeField("actualizada", auto_now=True)

    class Meta:
        db_table = "valoracion"
        verbose_name = "valoración y comentario"
        verbose_name_plural = "valoraciones y comentarios"
        ordering = ["-updated_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["usuario", "bien"], name="uq_valoracion_usuario_bien"),
            models.CheckConstraint(condition=Q(estrellas__gte=1, estrellas__lte=5), name="ck_valoracion_estrellas"),
        ]
        indexes = [models.Index(fields=["bien", "-updated_at"], name="ix_valoracion_bien_fecha")]

    def __str__(self):
        return f"{self.usuario} → {self.bien}: {self.estrellas}★"


class ReporteComentario(models.Model):
    valoracion = models.ForeignKey(Valoracion, on_delete=models.CASCADE, related_name="reportes")
    reportante = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reportes_de_comentarios")
    motivo = models.CharField("motivo", max_length=200)
    atendido = models.BooleanField("atendido", default=False)
    created_at = models.DateTimeField("recibido", auto_now_add=True)

    class Meta:
        db_table = "reporte_comentario"
        verbose_name = "reporte de comentario"
        verbose_name_plural = "reportes de comentarios"
        ordering = ["atendido", "-created_at"]
        constraints = [models.UniqueConstraint(fields=["valoracion", "reportante"], name="uq_reporte_comentario_persona")]


class EstadoAmistad(models.TextChoices):
    PENDIENTE = "pendiente", "Pendiente"
    ACEPTADA = "aceptada", "Aceptada"
    RECHAZADA = "rechazada", "Rechazada"  # una solicitud cancelada o una amistad retirada se borra


class Amistad(models.Model):
    solicitante = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="solicitudes_enviadas")
    destinatario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="solicitudes_recibidas")
    estado = models.CharField(max_length=10, choices=EstadoAmistad.choices, default=EstadoAmistad.PENDIENTE)
    created_at = models.DateTimeField("enviada", auto_now_add=True)
    respondida_at = models.DateTimeField("respondida", null=True, blank=True)

    class Meta:
        db_table = "amistad"
        verbose_name = "amistad"
        verbose_name_plural = "amistades"
        constraints = [
            models.CheckConstraint(condition=~Q(solicitante=F("destinatario")), name="ck_amistad_no_consigo_mismo"),
            models.CheckConstraint(condition=Q(estado__in=EstadoAmistad.values), name="ck_amistad_estado"),
            # Una sola fila por pareja, en cualquier sentido: A→B y B→A no pueden coexistir.
            models.UniqueConstraint(
                Least("solicitante", "destinatario"), Greatest("solicitante", "destinatario"), name="uq_amistad_pareja"
            ),
        ]
        indexes = [models.Index(fields=["destinatario", "estado"], name="ix_amistad_destinatario")]


class VisitaDeclarada(models.Model):
    """«Marcar como visitado»: declaración de la persona. NO es una visita verificada ni guarda ubicación."""

    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="visitas_declaradas")
    bien = models.ForeignKey(BienPatrimonial, on_delete=models.CASCADE, related_name="visitas_declaradas")
    created_at = models.DateTimeField("declarada", auto_now_add=True)

    class Meta:
        db_table = "visita_declarada"
        verbose_name = "visita declarada"
        verbose_name_plural = "visitas declaradas"
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["usuario", "bien"], name="uq_visita_usuario_bien")]
