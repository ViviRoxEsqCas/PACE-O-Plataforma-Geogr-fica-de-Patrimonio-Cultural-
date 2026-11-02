"""Serialización de la API pública (capa de lógica de aplicación, sección 8.1)."""
from rest_framework import serializers

from .models import BienPatrimonial, Categoria, FuenteDocumental, RecursoMultimedia


class CategoriaSerializer(serializers.ModelSerializer):
    total_bienes = serializers.IntegerField(read_only=True, help_text="Bienes publicados en la categoría.")

    class Meta:
        model = Categoria
        fields = ("id", "nombre", "descripcion", "total_bienes")


class CategoriaResumenSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ("id", "nombre")


class FuenteSerializer(serializers.ModelSerializer):
    tipo = serializers.CharField(source="tipo_fuente.nombre")

    class Meta:
        model = FuenteDocumental
        fields = ("id", "titulo", "autor_institucion", "tipo", "url_referencia", "fecha_consulta")


class ImagenSerializer(serializers.ModelSerializer):
    """Incluye autor y licencia: la atribución es obligatoria (RF-04, RF-10, RNF-09)."""

    url = serializers.SerializerMethodField()
    licencia = serializers.CharField(source="licencia.nombre")
    licencia_url = serializers.CharField(source="licencia.url")

    class Meta:
        model = RecursoMultimedia
        fields = ("id", "url", "texto_alternativo", "autor", "licencia", "licencia_url", "es_portada")

    def get_url(self, obj):
        request = self.context.get("request")
        url = obj.archivo.url
        return request.build_absolute_uri(url) if request else url


class BienListaSerializer(serializers.ModelSerializer):
    tipo = serializers.CharField(source="tipo_patrimonio.nombre")
    categoria = CategoriaResumenSerializer(read_only=True)
    # Coordenadas como número (no texto) para consumirlas directamente en Leaflet.
    latitud = serializers.DecimalField(max_digits=9, decimal_places=6, coerce_to_string=False, read_only=True)
    longitud = serializers.DecimalField(max_digits=9, decimal_places=6, coerce_to_string=False, read_only=True)
    tiene_ubicacion = serializers.SerializerMethodField(help_text="False: aparece en la lista sin marcador (RF-12).")
    portada = serializers.SerializerMethodField()

    class Meta:
        model = BienPatrimonial
        fields = (
            "id", "nombre", "tipo", "categoria", "direccion_referencia",
            "latitud", "longitud", "tiene_ubicacion", "portada",
        )

    def get_tiene_ubicacion(self, obj):
        return obj.latitud is not None and obj.longitud is not None

    def get_portada(self, obj):
        # Usa el prefetch de `recursos` (sin consultas adicionales por bien).
        imagenes = list(obj.recursos.all())
        portada = next((i for i in imagenes if i.es_portada), imagenes[0] if imagenes else None)
        return ImagenSerializer(portada, context=self.context).data if portada else None


class BienDetalleSerializer(BienListaSerializer):
    fuentes = FuenteSerializer(many=True, read_only=True)
    imagenes = ImagenSerializer(source="recursos", many=True, read_only=True)

    class Meta(BienListaSerializer.Meta):
        fields = BienListaSerializer.Meta.fields + ("descripcion", "fuentes", "imagenes")
