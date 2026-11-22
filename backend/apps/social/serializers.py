import re

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from PIL import Image
from rest_framework import serializers

from .models import PerfilVisitante, Privacidad, Valoracion
from .reglas import limpiar_texto

User = get_user_model()
USUARIO_RE = re.compile(r"^[A-Za-z0-9_]{3,30}$")
FOTO_MAX_BYTES = 2 * 1024 * 1024
FOTO_FORMATOS = {"JPEG", "PNG", "WEBP"}


def perfil_de(usuario) -> PerfilVisitante:
    perfil, _ = PerfilVisitante.objects.get_or_create(usuario=usuario, defaults={"nombre_visible": usuario.username[:40]})
    return perfil


def url_foto(perfil, request):
    if not perfil or not perfil.foto:
        return None
    # Misma razón que en ImagenSerializer.get_url (patrimonio): ruta «/media/…», no URL absoluta dependiente del Host.
    return perfil.foto.url


def identidad(usuario, request):
    """Solo lo que puede mostrarse de otra persona: usuario, nombre visible y foto. Nunca correo ni datos internos."""
    perfil = getattr(usuario, "perfil_visitante", None) or perfil_de(usuario)
    return {"username": usuario.username, "nombre_visible": perfil.nombre_visible, "foto": url_foto(perfil, request)}


class RegistroSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=30)
    password = serializers.CharField(write_only=True, max_length=128, trim_whitespace=False)
    nombre_visible = serializers.CharField(max_length=40, required=False, allow_blank=True)

    def validate_username(self, valor):
        valor = valor.strip()
        if not USUARIO_RE.match(valor):
            raise serializers.ValidationError("Use de 3 a 30 letras, números o guion bajo, sin espacios.")
        if User.objects.filter(username__iexact=valor).exists():
            raise serializers.ValidationError("Ese nombre de usuario ya está en uso.")
        return valor

    def validate_nombre_visible(self, valor):
        return limpiar_texto(valor, campo="nombre visible", maximo=40, minimo=2, una_linea=True)

    def validate(self, datos):
        candidato = User(username=datos["username"])
        try:
            validate_password(datos["password"], candidato)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        return datos

    def create(self, datos):
        usuario = User.objects.create_user(username=datos["username"], password=datos["password"])  # sin correo, sin permisos, sin is_staff
        PerfilVisitante.objects.create(usuario=usuario, nombre_visible=datos.get("nombre_visible") or usuario.username)
        return usuario


class PerfilPropioSerializer(serializers.ModelSerializer):
    """Datos que una persona puede ver y editar de SU propio perfil."""

    username = serializers.CharField(source="usuario.username", read_only=True)
    foto = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = PerfilVisitante
        fields = ("username", "nombre_visible", "biografia", "foto", "privacidad_perfil", "privacidad_actividad")

    def validate_nombre_visible(self, valor):
        valor = limpiar_texto(valor, campo="nombre visible", maximo=40, minimo=2, una_linea=True)
        if not valor:
            raise serializers.ValidationError("El nombre visible es obligatorio.")
        return valor

    def validate_biografia(self, valor):
        return limpiar_texto(valor, campo="biografía", maximo=280)

    def validate_foto(self, archivo):
        if archivo is None:
            return None
        if archivo.size > FOTO_MAX_BYTES:
            raise serializers.ValidationError("La fotografía no puede superar los 2 MB.")
        try:
            imagen = Image.open(archivo)
            formato = imagen.format
            imagen.verify()
        except Exception:
            raise serializers.ValidationError("El archivo no es una imagen válida.")
        if formato not in FOTO_FORMATOS:
            raise serializers.ValidationError("Use una imagen JPG, PNG o WEBP.")
        archivo.seek(0)
        return archivo

    def update(self, perfil, datos):
        if "foto" in datos:
            if perfil.foto:
                perfil.foto.delete(save=False)  # no se acumulan fotos antiguas ni queda una foto «retirada» accesible
            perfil.foto = datos.pop("foto") or ""
        return super().update(perfil, datos)

    def to_representation(self, perfil):
        datos = super().to_representation(perfil)
        datos["foto"] = url_foto(perfil, self.context.get("request"))
        return datos


class ValoracionEntradaSerializer(serializers.Serializer):
    estrellas = serializers.IntegerField(min_value=1, max_value=5)
    comentario = serializers.CharField(required=False, allow_blank=True, max_length=2000)

    def validate_comentario(self, valor):
        return limpiar_texto(valor, campo="comentario", maximo=500, minimo=3)


class ReporteComentarioEntradaSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=500)

    def validate_motivo(self, valor):
        valor = limpiar_texto(valor, campo="motivo", maximo=200, minimo=3, una_linea=True, permitir_enlaces=True)
        if not valor:
            raise serializers.ValidationError("Indique el motivo.")
        return valor


class SolicitudAmistadSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=30)


def serializar_valoracion(v: Valoracion, request, *, mostrar_identidad: bool, propia: bool = False):
    oculto = v.comentario_oculto
    datos = {
        "id": v.id,
        "estrellas": v.estrellas,
        # El texto oculto por moderación solo lo ve su autor (con aviso); nunca el público.
        "comentario": v.comentario if (not oculto or propia) else "",
        "comentario_oculto": oculto if propia else False,
        "fecha": v.updated_at,
        "autor": identidad(v.usuario, request) if mostrar_identidad else None,
        "propia": propia,
    }
    return datos
