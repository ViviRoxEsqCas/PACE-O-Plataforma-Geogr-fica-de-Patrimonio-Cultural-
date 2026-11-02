"""
Modelo de datos de Paceño (sección 11 del informe).

16 tablas de dominio:
  Núcleo  (8): categoria, bien_patrimonial, fuente_documental, bien_fuente,
               recurso_multimedia, actividad, opcion_actividad, reporte_ciudadano
  Soporte (8): tipo_patrimonio, zona_piloto, tipo_fuente, licencia,
               tipo_reporte, estado_reporte, historial_estado_reporte,
               historial_estado_bien

Los usuarios y roles usan el sistema de autenticación de Django (auth_user,
auth_group, auth_permission); no existen tablas propias de usuarios.

Desviaciones menores respecto al diagrama (documentadas en el README):
  * bien_fuente usa una clave sustituta + restricción de unicidad (bien, fuente)
    porque Django Admin no soporta claves primarias compuestas.
  * historial_estado_bien.usuario admite NULL para acciones de sistema
    (carga inicial por comando).
"""
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.db.models import Q
from django.db.models.functions import Lower


# ---------------------------------------------------------------------------
# Catálogos (tablas de soporte)
# ---------------------------------------------------------------------------
class TipoPatrimonio(models.Model):
    """Catálogo: material o inmaterial. Condiciona la obligatoriedad de coordenadas."""

    MATERIAL = "material"
    INMATERIAL = "inmaterial"

    nombre = models.CharField("nombre", max_length=30, unique=True)

    class Meta:
        db_table = "tipo_patrimonio"
        verbose_name = "tipo de patrimonio"
        verbose_name_plural = "tipos de patrimonio"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre

    @property
    def es_material(self) -> bool:
        return self.nombre.strip().lower() == self.MATERIAL


class TipoFuente(models.Model):
    """Catálogo: norma, publicación, inventario, sitio web, entrevista, otro."""

    nombre = models.CharField("nombre", max_length=40, unique=True)

    class Meta:
        db_table = "tipo_fuente"
        verbose_name = "tipo de fuente"
        verbose_name_plural = "tipos de fuente"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Licencia(models.Model):
    """Catálogo de licencias de uso de imágenes, con enlace al texto de la licencia."""

    nombre = models.CharField("nombre", max_length=100, unique=True)
    url = models.URLField("enlace al texto de la licencia", max_length=300, blank=True)

    class Meta:
        db_table = "licencia"
        verbose_name = "licencia"
        verbose_name_plural = "licencias"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class TipoReporte(models.Model):
    """Catálogo: deterioro, información incorrecta, acceso restringido, otro."""

    nombre = models.CharField("nombre", max_length=40, unique=True)

    class Meta:
        db_table = "tipo_reporte"
        verbose_name = "tipo de reporte"
        verbose_name_plural = "tipos de reporte"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class EstadoReporte(models.Model):
    """Catálogo de estados de un reporte (nuevo, en revisión, atendido, descartado)."""

    NUEVO = "nuevo"
    EN_REVISION = "en revisión"
    ATENDIDO = "atendido"
    DESCARTADO = "descartado"

    nombre = models.CharField("nombre", max_length=20, unique=True)
    es_final = models.BooleanField("es estado final", default=False)

    class Meta:
        db_table = "estado_reporte"
        verbose_name = "estado de reporte"
        verbose_name_plural = "estados de reporte"
        ordering = ["id"]

    def __str__(self):
        return self.nombre


class ZonaPiloto(models.Model):
    """
    Caja geográfica aproximada del área piloto (WGS 84). Valida las coordenadas
    de los bienes (RN-03) hasta contar con el polígono institucional (IDE La Paz).
    """

    nombre = models.CharField("nombre", max_length=120)
    lat_min = models.DecimalField("latitud mínima", max_digits=9, decimal_places=6)
    lat_max = models.DecimalField("latitud máxima", max_digits=9, decimal_places=6)
    lon_min = models.DecimalField("longitud mínima", max_digits=9, decimal_places=6)
    lon_max = models.DecimalField("longitud máxima", max_digits=9, decimal_places=6)
    activa = models.BooleanField("activa", default=True)

    class Meta:
        db_table = "zona_piloto"
        verbose_name = "zona piloto"
        verbose_name_plural = "zonas piloto"
        constraints = [
            models.CheckConstraint(
                condition=Q(lat_min__lt=models.F("lat_max")) & Q(lon_min__lt=models.F("lon_max")),
                name="ck_zona_limites_validos",
            ),
            # A lo sumo una zona activa a la vez.
            models.UniqueConstraint(
                fields=["activa"], condition=Q(activa=True), name="uq_zona_una_activa"
            ),
        ]

    def __str__(self):
        return self.nombre

    def contiene(self, latitud, longitud) -> bool:
        lat, lon = Decimal(str(latitud)), Decimal(str(longitud))
        return self.lat_min <= lat <= self.lat_max and self.lon_min <= lon <= self.lon_max

    @classmethod
    def vigente(cls):
        return cls.objects.filter(activa=True).order_by("id").first()


# ---------------------------------------------------------------------------
# Núcleo: Módulo 1 (gestión del patrimonio cultural)
# ---------------------------------------------------------------------------
class Categoria(models.Model):
    nombre = models.CharField("nombre", max_length=80)
    descripcion = models.TextField("descripción", blank=True)

    class Meta:
        db_table = "categoria"
        verbose_name = "categoría"
        verbose_name_plural = "categorías"
        ordering = ["nombre"]
        constraints = [
            # RF-02: no se permiten categorías con nombre repetido (sin distinguir mayúsculas).
            models.UniqueConstraint(Lower("nombre"), name="uq_categoria_nombre_ci"),
        ]

    def __str__(self):
        return self.nombre


class EstadoPublicacion(models.TextChoices):
    BORRADOR = "borrador", "Borrador"
    REVISION = "revision", "En revisión"
    PUBLICADO = "publicado", "Publicado"
    DESACTIVADO = "desactivado", "Desactivado"


class BienPatrimonial(models.Model):
    """Ficha de un bien material o manifestación inmaterial."""

    nombre = models.CharField("nombre", max_length=200)
    descripcion = models.TextField("descripción", blank=True)
    tipo_patrimonio = models.ForeignKey(
        TipoPatrimonio, on_delete=models.PROTECT, related_name="bienes", verbose_name="tipo"
    )
    categoria = models.ForeignKey(
        Categoria, on_delete=models.PROTECT, related_name="bienes", verbose_name="categoría"
    )
    zona = models.ForeignKey(
        ZonaPiloto,
        on_delete=models.PROTECT,
        related_name="bienes",
        null=True,
        blank=True,
        verbose_name="zona piloto",
        help_text="Si se deja vacía se asigna la zona piloto activa.",
    )
    direccion_referencia = models.CharField(
        "dirección o lugar de referencia", max_length=250, blank=True
    )
    latitud = models.DecimalField(
        "latitud (WGS 84)", max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitud = models.DecimalField(
        "longitud (WGS 84)", max_digits=9, decimal_places=6, null=True, blank=True
    )
    estado_publicacion = models.CharField(
        "estado editorial",
        max_length=12,
        choices=EstadoPublicacion.choices,
        default=EstadoPublicacion.BORRADOR,
        db_index=True,
    )
    fuentes = models.ManyToManyField(
        "FuenteDocumental", through="BienFuente", related_name="bienes", blank=True
    )
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bienes_creados",
        verbose_name="creado por",
    )
    created_at = models.DateTimeField("creado", auto_now_add=True)
    updated_at = models.DateTimeField("actualizado", auto_now=True)

    class Meta:
        db_table = "bien_patrimonial"
        verbose_name = "bien patrimonial"
        verbose_name_plural = "bienes patrimoniales"
        ordering = ["nombre"]
        constraints = [
            models.CheckConstraint(
                condition=Q(estado_publicacion__in=EstadoPublicacion.values),
                name="ck_bien_estado_publicacion",
            ),
            models.CheckConstraint(
                condition=Q(latitud__isnull=True) | (Q(latitud__gte=-90) & Q(latitud__lte=90)),
                name="ck_bien_latitud_rango",
            ),
            models.CheckConstraint(
                condition=Q(longitud__isnull=True) | (Q(longitud__gte=-180) & Q(longitud__lte=180)),
                name="ck_bien_longitud_rango",
            ),
            models.CheckConstraint(
                condition=(Q(latitud__isnull=True) & Q(longitud__isnull=True))
                | (Q(latitud__isnull=False) & Q(longitud__isnull=False)),
                name="ck_bien_coordenadas_en_par",
            ),
        ]

    def __str__(self):
        return self.nombre

    # Estado persistido en la base de datos: sirve para detectar cambios y escribir
    # el historial (RF-05). Se fija en from_db() porque en __init__ Django todavía
    # marca la instancia como nueva (`_state.adding`), incluso al leerla de la BD.
    _estado_original = None

    @classmethod
    def from_db(cls, db, field_names, values):
        instancia = super().from_db(db, field_names, values)
        instancia._estado_original = instancia.__dict__.get("estado_publicacion")
        return instancia

    # -- Validaciones ------------------------------------------------------
    @property
    def es_material(self) -> bool:
        return bool(self.tipo_patrimonio_id) and self.tipo_patrimonio.es_material

    def errores_ubicacion(self, requerida: bool) -> list[str]:
        """Valida el par de coordenadas y su pertenencia al área piloto (RN-03)."""
        errores = []
        if self.latitud is None and self.longitud is None:
            if requerida:
                errores.append("Un bien material requiere coordenadas (latitud y longitud).")
            return errores
        if self.latitud is None or self.longitud is None:
            return ["Debe indicar latitud y longitud juntas, o dejar ambas vacías."]
        lat, lon = Decimal(str(self.latitud)), Decimal(str(self.longitud))
        if not (Decimal(-90) <= lat <= Decimal(90)):
            errores.append("La latitud debe estar entre -90 y 90.")
        if not (Decimal(-180) <= lon <= Decimal(180)):
            errores.append("La longitud debe estar entre -180 y 180.")
        if errores:
            return errores
        zona = self.zona or ZonaPiloto.vigente()
        if zona is None:
            errores.append("No hay una zona piloto activa para validar las coordenadas.")
        elif not zona.contiene(lat, lon):
            errores.append(
                f"Las coordenadas están fuera del área piloto «{zona.nombre}» "
                f"(lat {zona.lat_min} a {zona.lat_max}, lon {zona.lon_min} a {zona.lon_max})."
            )
        return errores

    def errores_campos_publicacion(self) -> list[str]:
        """RN-02 y RN-03 sobre los campos de la propia ficha (no dependen de otras tablas)."""
        errores = []
        if not (self.nombre or "").strip():
            errores.append("Falta el nombre.")
        if not (self.descripcion or "").strip():
            errores.append("Falta la descripción.")
        if not self.tipo_patrimonio_id:
            errores.append("Falta el tipo de patrimonio.")
        if not self.categoria_id:
            errores.append("Falta la categoría.")
        errores.extend(self.errores_ubicacion(requerida=self.es_material))
        return errores

    def errores_relaciones_publicacion(self) -> list[str]:
        """RN-02 sobre fuentes e imágenes; requiere que la ficha ya esté guardada."""
        if self.pk is None:
            return [
                "Debe asociar al menos una fuente documental con fecha de consulta "
                "(guarde primero como borrador, agregue fuentes y luego publique)."
            ]
        errores = []
        if not self.bien_fuentes.filter(fuente__fecha_consulta__isnull=False).exists():
            errores.append("Debe asociar al menos una fuente documental con fecha de consulta.")
        for imagen in self.recursos.select_related("licencia"):
            if not (imagen.autor or "").strip() or not imagen.licencia_id:
                errores.append(f"La imagen «{imagen.archivo.name or imagen.pk}» requiere autor y licencia.")
        return errores

    def errores_publicacion(self) -> list[str]:
        """Todos los motivos por los que la ficha NO puede estar en estado «publicado»."""
        return self.errores_campos_publicacion() + self.errores_relaciones_publicacion()

    def clean(self):
        # Los campos se validan aquí (el formulario muestra los mensajes). Las fuentes
        # e imágenes se guardan después de la ficha, por lo que su validación se hace
        # en save() y, en el panel, tras guardar los formularios en línea.
        if self.estado_publicacion == EstadoPublicacion.PUBLICADO:
            errores = self.errores_campos_publicacion()
            if errores:
                raise ValidationError({"estado_publicacion": errores})
        else:
            errores = self.errores_ubicacion(requerida=False)
            if errores:
                raise ValidationError({"latitud": errores})

    # -- Guardado con historial -------------------------------------------
    def save(self, *args, validar_publicacion=True, **kwargs):
        """
        Guarda la ficha y registra el cambio de estado en el historial.

        Si el estado es «publicado» se exige el cumplimiento de RN-02/RN-03. El panel
        de administración pasa `validar_publicacion=False` porque publica en dos
        pasos (primero guarda la ficha y sus formularios en línea, luego valida).
        """
        if self.zona_id is None:
            self.zona = ZonaPiloto.vigente()

        if validar_publicacion and self.estado_publicacion == EstadoPublicacion.PUBLICADO:
            errores = self.errores_publicacion()
            if errores:
                raise ValidationError({"estado_publicacion": errores})

        anterior = self._estado_original
        nuevo_registro = self._state.adding
        with transaction.atomic():
            super().save(*args, **kwargs)
            if nuevo_registro or anterior != self.estado_publicacion:
                HistorialEstadoBien.objects.create(
                    bien=self,
                    estado_anterior=None if nuevo_registro else anterior,
                    estado_nuevo=self.estado_publicacion,
                    usuario=getattr(self, "_usuario", None) or self.creado_por,
                )
        self._estado_original = self.estado_publicacion


class FuenteDocumental(models.Model):
    """Respaldo documental y normativo de las fichas."""

    titulo = models.CharField("título", max_length=300)
    autor_institucion = models.CharField("autor o institución", max_length=200, blank=True)
    tipo_fuente = models.ForeignKey(
        TipoFuente, on_delete=models.PROTECT, related_name="fuentes", verbose_name="tipo de fuente"
    )
    url_referencia = models.URLField("enlace", max_length=500, blank=True)
    fecha_consulta = models.DateField("fecha de consulta")

    class Meta:
        db_table = "fuente_documental"
        verbose_name = "fuente documental"
        verbose_name_plural = "fuentes documentales"
        ordering = ["titulo"]

    def __str__(self):
        return self.titulo


class BienFuente(models.Model):
    """Tabla intermedia N:M: una fuente respalda varios bienes y un bien tiene varias fuentes."""

    bien = models.ForeignKey(BienPatrimonial, on_delete=models.CASCADE, related_name="bien_fuentes")
    fuente = models.ForeignKey(
        FuenteDocumental, on_delete=models.PROTECT, related_name="bien_fuentes"
    )
    nota = models.CharField("nota", max_length=250, blank=True)

    class Meta:
        db_table = "bien_fuente"
        verbose_name = "fuente del bien"
        verbose_name_plural = "fuentes del bien"
        constraints = [
            models.UniqueConstraint(fields=["bien", "fuente"], name="uq_bien_fuente"),
        ]

    def __str__(self):
        return f"{self.bien} ← {self.fuente}"


class RecursoMultimedia(models.Model):
    """Imágenes de un bien. Exigen autor y licencia (RF-04, RNF-09)."""

    bien = models.ForeignKey(BienPatrimonial, on_delete=models.CASCADE, related_name="recursos")
    archivo = models.ImageField("imagen", upload_to="bienes/", max_length=500)
    texto_alternativo = models.CharField("texto alternativo", max_length=250, blank=True)
    autor = models.CharField("autor", max_length=150)
    licencia = models.ForeignKey(
        Licencia, on_delete=models.PROTECT, related_name="recursos", verbose_name="licencia"
    )
    es_portada = models.BooleanField("es portada", default=False)

    class Meta:
        db_table = "recurso_multimedia"
        verbose_name = "imagen"
        verbose_name_plural = "imágenes"
        constraints = [
            models.CheckConstraint(condition=~Q(autor=""), name="ck_recurso_autor_no_vacio"),
            models.UniqueConstraint(
                fields=["bien"], condition=Q(es_portada=True), name="uq_recurso_una_portada"
            ),
        ]

    def __str__(self):
        return f"Imagen de {self.bien}"

    def clean(self):
        if not (self.autor or "").strip():
            raise ValidationError({"autor": "La imagen requiere autor."})


# ---------------------------------------------------------------------------
# Núcleo: Módulo 3 (actividades). Estructura lista; lógica completa en semana 3.
# ---------------------------------------------------------------------------
class Actividad(models.Model):
    bien = models.ForeignKey(BienPatrimonial, on_delete=models.CASCADE, related_name="actividades")
    enunciado = models.TextField("pregunta")
    retroalimentacion = models.TextField("explicación", blank=True)
    puntos = models.PositiveSmallIntegerField(
        "puntos", default=10, validators=[MinValueValidator(0)]
    )
    activa = models.BooleanField("activa", default=True)

    class Meta:
        db_table = "actividad"
        verbose_name = "actividad"
        verbose_name_plural = "actividades"

    def __str__(self):
        return self.enunciado[:60]


class OpcionActividad(models.Model):
    actividad = models.ForeignKey(Actividad, on_delete=models.CASCADE, related_name="opciones")
    texto = models.CharField("texto", max_length=250)
    es_correcta = models.BooleanField("es la correcta", default=False)

    class Meta:
        db_table = "opcion_actividad"
        verbose_name = "opción de respuesta"
        verbose_name_plural = "opciones de respuesta"
        constraints = [
            # RN-04: a lo sumo una opción correcta por actividad (índice único parcial).
            models.UniqueConstraint(
                fields=["actividad"], condition=Q(es_correcta=True), name="uq_opcion_una_correcta"
            ),
        ]

    def __str__(self):
        return self.texto


# ---------------------------------------------------------------------------
# Núcleo: Módulo 4 (reportes). Estructura lista; lógica completa en semana 3.
# ---------------------------------------------------------------------------
class ReporteCiudadano(models.Model):
    bien = models.ForeignKey(BienPatrimonial, on_delete=models.PROTECT, related_name="reportes")
    tipo_reporte = models.ForeignKey(
        TipoReporte, on_delete=models.PROTECT, related_name="reportes", verbose_name="tipo"
    )
    estado = models.ForeignKey(
        EstadoReporte, on_delete=models.PROTECT, related_name="reportes", verbose_name="estado"
    )
    descripcion = models.CharField("descripción", max_length=500)
    fecha_creacion = models.DateTimeField("fecha de envío", auto_now_add=True)

    class Meta:
        db_table = "reporte_ciudadano"
        verbose_name = "reporte ciudadano"
        verbose_name_plural = "reportes ciudadanos"
        ordering = ["-fecha_creacion"]

    def __str__(self):
        return f"Reporte #{self.pk} sobre {self.bien}"


class HistorialEstadoReporte(models.Model):
    reporte = models.ForeignKey(ReporteCiudadano, on_delete=models.CASCADE, related_name="historial")
    estado_anterior = models.ForeignKey(
        EstadoReporte, on_delete=models.PROTECT, related_name="+", null=True, blank=True
    )
    estado_nuevo = models.ForeignKey(EstadoReporte, on_delete=models.PROTECT, related_name="+")
    revisado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="revisiones"
    )
    fecha = models.DateTimeField("fecha", auto_now_add=True)
    nota = models.CharField("nota", max_length=500, blank=True)

    class Meta:
        db_table = "historial_estado_reporte"
        verbose_name = "historial de estado de reporte"
        verbose_name_plural = "historial de estados de reportes"
        ordering = ["-fecha"]

    def __str__(self):
        return f"{self.reporte_id}: {self.estado_anterior} → {self.estado_nuevo}"


class HistorialEstadoBien(models.Model):
    bien = models.ForeignKey(BienPatrimonial, on_delete=models.CASCADE, related_name="historial")
    estado_anterior = models.CharField("estado anterior", max_length=12, null=True, blank=True)
    estado_nuevo = models.CharField("estado nuevo", max_length=12)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cambios_estado_bien",
    )
    fecha = models.DateTimeField("fecha", auto_now_add=True)

    class Meta:
        db_table = "historial_estado_bien"
        verbose_name = "historial de estado de ficha"
        verbose_name_plural = "historial de estados de fichas"
        ordering = ["-fecha", "-id"]

    def __str__(self):
        return f"{self.estado_anterior or '(alta)'} → {self.estado_nuevo}"
