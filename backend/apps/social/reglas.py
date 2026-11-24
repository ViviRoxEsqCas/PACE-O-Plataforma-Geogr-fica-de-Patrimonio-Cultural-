"""
Reglas del espacio social: validación de textos, privacidad, puntos, logros y ranking.

Todo lo que se muestra como «logro» o «puntos» se CALCULA aquí a partir de filas reales
(visitas declaradas, valoraciones, amistades). No hay tablas de logros ni de puntaje que puedan
inventarse o quedar desactualizadas, y el resultado es reproducible con una consulta.
"""
import re
import unicodedata

from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from rest_framework import serializers

from apps.patrimonio.models import BienPatrimonial, EstadoPublicacion

from .models import Amistad, EstadoAmistad, Privacidad, Valoracion, VisitaDeclarada

User = get_user_model()

# --- Fórmula del ranking (documentada en docs/espacio_social.md) ----------------------------------------
PUNTOS_VISITA = 3  # por cada bien PUBLICADO distinto marcado como visitado (declarada, no verificada)
PUNTOS_VALORACION = 2  # por cada bien PUBLICADO distinto valorado
PUNTOS_COMENTARIO = 2  # extra por comentario visible de al menos MIN_CARACTERES_COMENTARIO (máx. uno por bien)
MIN_CARACTERES_COMENTARIO = 30
# Anti-spam: las tres acciones son únicas por usuario y bien (restricciones de la base de datos), por lo que
# el máximo posible por persona es 7 puntos × bienes publicados. Repetir, editar o borrar y volver a crear no suma.

PUBLICADO = Q(estado_publicacion=EstadoPublicacion.PUBLICADO)


# --- Validación de texto (se hace en el servidor; el frontend solo ayuda) ---------------------------------
_ENLACE = re.compile(r"(https?://|www\.|\b[\w-]+\.(com|net|org|info|xyz|ru|bo|io|me|ly)\b)", re.IGNORECASE)
_REPETIDO = re.compile(r"(\S)\1{9,}")


def limpiar_texto(valor, *, campo, maximo, minimo=0, una_linea=False, permitir_enlaces=False):
    valor = unicodedata.normalize("NFC", str(valor or "")).replace("\r\n", "\n").replace("\r", "\n").strip()
    if any(unicodedata.category(c) in ("Cc", "Cf") and c not in "\n\t" for c in valor):
        raise serializers.ValidationError(f"El {campo} contiene caracteres no permitidos.")
    valor = re.sub(r"[ \t]+", " ", valor)
    valor = re.sub(r"\n{3,}", "\n\n", valor)
    if una_linea and "\n" in valor:
        raise serializers.ValidationError(f"El {campo} debe estar en una sola línea.")
    if valor and len(valor) < minimo:
        raise serializers.ValidationError(f"El {campo} debe tener al menos {minimo} caracteres.")
    if len(valor) > maximo:
        raise serializers.ValidationError(f"El {campo} no puede superar los {maximo} caracteres.")
    if valor and not permitir_enlaces and _ENLACE.search(valor):
        raise serializers.ValidationError(f"El {campo} no puede incluir enlaces.")
    if valor and _REPETIDO.search(valor):
        raise serializers.ValidationError(f"El {campo} parece texto repetido; escríbalo con sus palabras.")
    return valor


# --- Amistad y privacidad -----------------------------------------------------------------------------
def amistades_aceptadas(usuario_id):
    return Amistad.objects.filter(estado=EstadoAmistad.ACEPTADA).filter(Q(solicitante_id=usuario_id) | Q(destinatario_id=usuario_id))


def ids_de_amigos(usuario_id) -> set[int]:
    ids = set()
    for sol, dest in amistades_aceptadas(usuario_id).values_list("solicitante_id", "destinatario_id"):
        ids.add(dest if sol == usuario_id else sol)
    return ids


def son_amigos(a_id, b_id) -> bool:
    return Amistad.objects.filter(estado=EstadoAmistad.ACEPTADA).filter(
        Q(solicitante_id=a_id, destinatario_id=b_id) | Q(solicitante_id=b_id, destinatario_id=a_id)
    ).exists()


def puede_ver(espectador, dueno_id, nivel) -> bool:
    """Privacidad aplicada en el servidor: público / solo amistades / privado (solo la propia persona)."""
    autenticado = bool(espectador and espectador.is_authenticated)
    if autenticado and espectador.id == dueno_id:
        return True
    if nivel == Privacidad.PUBLICO:
        return True
    if nivel == Privacidad.AMIGOS:
        return autenticado and son_amigos(espectador.id, dueno_id)
    return False


# --- Contadores, logros y ranking -----------------------------------------------------------------------
def _filtro_comentario_valido(prefijo=""):
    return Q(**{
        f"{prefijo}bien__estado_publicacion": EstadoPublicacion.PUBLICADO,
        f"{prefijo}comentario_oculto": False,
        # «al menos N caracteres» (PostgreSQL: el punto también abarca saltos de línea)
        f"{prefijo}comentario__regex": r"^.{%d,}" % MIN_CARACTERES_COMENTARIO,
    })


def contadores(usuario_id) -> dict:
    visitas = VisitaDeclarada.objects.filter(usuario_id=usuario_id, bien__estado_publicacion=EstadoPublicacion.PUBLICADO).count()
    valoraciones = Valoracion.objects.filter(usuario_id=usuario_id, bien__estado_publicacion=EstadoPublicacion.PUBLICADO).count()
    comentarios = Valoracion.objects.filter(_filtro_comentario_valido(), usuario_id=usuario_id).count()
    return {
        "visitas": visitas,
        "valoraciones": valoraciones,
        "comentarios": comentarios,
        "amigos": amistades_aceptadas(usuario_id).count(),
        "puntos": PUNTOS_VISITA * visitas + PUNTOS_VALORACION * valoraciones + PUNTOS_COMENTARIO * comentarios,
    }


# (código, nombre, condición legible, función de comprobación(contadores, total_bienes_publicados))
LOGROS = [
    ("primera_visita", "Primera visita declarada", "Marcar un bien como visitado.", lambda c, t: c["visitas"] >= 1),
    ("explorador", "Explorador", "Declarar 5 bienes distintos como visitados.", lambda c, t: c["visitas"] >= 5),
    ("recorrido_completo", "Recorrido completo", "Declarar como visitados todos los bienes publicados.", lambda c, t: t > 0 and c["visitas"] >= t),
    ("primera_valoracion", "Primera valoración", "Valorar un bien con estrellas.", lambda c, t: c["valoraciones"] >= 1),
    (
        "primera_opinion", "Primera opinión",
        f"Publicar un comentario visible de al menos {MIN_CARACTERES_COMENTARIO} caracteres.", lambda c, t: c["comentarios"] >= 1,
    ),
    ("primera_amistad", "Primera amistad", "Tener una amistad aceptada.", lambda c, t: c["amigos"] >= 1),
]


def logros_de(cont: dict) -> list[dict]:
    total = BienPatrimonial.objects.filter(PUBLICADO).count()
    return [{"codigo": c, "nombre": n, "condicion": d} for c, n, d, ok in LOGROS if ok(cont, total)]


def logros_pendientes_de(cont: dict) -> list[dict]:
    """Los logros que aún no se obtuvieron (para mostrarlos atenuados en el perfil propio)."""
    total = BienPatrimonial.objects.filter(PUBLICADO).count()
    return [{"codigo": c, "nombre": n, "condicion": d} for c, n, d, ok in LOGROS if not ok(cont, total)]


def catalogo_de_logros() -> list[dict]:
    return [{"codigo": c, "nombre": n, "condicion": d} for c, n, d, _ in LOGROS]


def tabla_ranking() -> list[dict]:
    """Personas con perfil PÚBLICO y al menos 1 punto. Orden total (sin empates):
    1.º más puntos · 2.º más bienes visitados · 3.º cuenta más antigua · 4.º menor id."""
    consulta = User.objects.filter(is_active=True, is_staff=False, perfil_visitante__privacidad_perfil=Privacidad.PUBLICO).annotate(
        n_visitas=Count("visitas_declaradas", filter=Q(visitas_declaradas__bien__estado_publicacion=EstadoPublicacion.PUBLICADO), distinct=True),
        n_valoraciones=Count("valoraciones", filter=Q(valoraciones__bien__estado_publicacion=EstadoPublicacion.PUBLICADO), distinct=True),
        n_comentarios=Count("valoraciones", filter=_filtro_comentario_valido("valoraciones__"), distinct=True),
    ).select_related("perfil_visitante")
    filas = []
    for u in consulta:
        puntos = PUNTOS_VISITA * u.n_visitas + PUNTOS_VALORACION * u.n_valoraciones + PUNTOS_COMENTARIO * u.n_comentarios
        if puntos > 0:
            filas.append({"usuario": u, "puntos": puntos, "visitas": u.n_visitas, "orden": (-puntos, -u.n_visitas, u.date_joined, u.id)})
    filas.sort(key=lambda f: f["orden"])
    for posicion, fila in enumerate(filas, start=1):
        fila["posicion"] = posicion
    return filas


# --- Actividad patrimonial (solo visitas declaradas, valoraciones y comentarios) ----------------------
def eventos_de_actividad(usuario_ids, limite=30) -> list[dict]:
    """Eventos recientes de las personas indicadas. El llamador ya aplicó la privacidad de la actividad."""
    eventos = []
    visitas = VisitaDeclarada.objects.filter(usuario_id__in=usuario_ids, bien__estado_publicacion=EstadoPublicacion.PUBLICADO)
    for v in visitas.select_related("usuario__perfil_visitante", "bien").order_by("-created_at")[:limite]:
        eventos.append({"tipo": "visita", "fecha": v.created_at, "usuario": v.usuario, "bien": v.bien, "estrellas": None, "comentario": ""})
    valoraciones = Valoracion.objects.filter(usuario_id__in=usuario_ids, bien__estado_publicacion=EstadoPublicacion.PUBLICADO)
    for r in valoraciones.select_related("usuario__perfil_visitante", "bien").order_by("-updated_at")[:limite]:
        eventos.append({"tipo": "valoracion", "fecha": r.updated_at, "usuario": r.usuario, "bien": r.bien, "estrellas": r.estrellas, "comentario": ""})
        if r.comentario and not r.comentario_oculto:
            eventos.append({"tipo": "comentario", "fecha": r.updated_at, "usuario": r.usuario, "bien": r.bien, "estrellas": None, "comentario": r.comentario})
    eventos.sort(key=lambda e: (e["fecha"], e["tipo"]), reverse=True)
    return eventos[:limite]
