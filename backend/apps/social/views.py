from django.contrib.auth import authenticate, get_user_model
from django.http import Http404
from django.db import IntegrityError, transaction
from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.patrimonio.models import BienPatrimonial, EstadoPublicacion

from . import reglas
from .models import Amistad, EstadoAmistad, Privacidad, ReporteComentario, Valoracion, VisitaDeclarada
from .serializers import (
    PerfilPropioSerializer, RegistroSerializer, ReporteComentarioEntradaSerializer, SolicitudAmistadSerializer,
    ValoracionEntradaSerializer, identidad, perfil_de, serializar_valoracion, url_foto,
)
from .throttles import AccesoThrottle, AmistadThrottle, EscrituraSocialThrottle, RegistroThrottle

User = get_user_model()
MAX_SOLICITUDES_PENDIENTES = 20


class BaseSocial(APIView):
    """La API pública anterior sigue anónima: aquí se acepta (no se exige) el token en cada vista."""

    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]


class Publica(BaseSocial):
    permission_classes = [permissions.AllowAny]


def bien_publicado_o_404(bien_id) -> BienPatrimonial:
    return get_object_or_404(BienPatrimonial, pk=bien_id, estado_publicacion=EstadoPublicacion.PUBLICADO)


def error(campo_o_mensaje, mensaje=None, codigo=status.HTTP_400_BAD_REQUEST):
    cuerpo = {campo_o_mensaje: [mensaje]} if mensaje else {"detail": campo_o_mensaje}
    return Response(cuerpo, status=codigo)


# ---------------------------------------------------------------------------------------------------
# Cuenta
# ---------------------------------------------------------------------------------------------------
def respuesta_de_sesion(usuario, request, token, codigo=status.HTTP_200_OK):
    perfil = perfil_de(usuario)
    return Response({"token": token.key, "perfil": PerfilPropioSerializer(perfil, context={"request": request}).data}, status=codigo)


class RegistroView(BaseSocial):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RegistroThrottle]

    def post(self, request):
        s = RegistroSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            usuario = s.save()
        except IntegrityError:  # carrera entre dos registros del mismo nombre
            return error("username", "Ese nombre de usuario ya está en uso.")
        token, _ = Token.objects.get_or_create(user=usuario)
        return respuesta_de_sesion(usuario, request, token, status.HTTP_201_CREATED)


class AccesoView(BaseSocial):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AccesoThrottle]

    def post(self, request):
        usuario = authenticate(request, username=str(request.data.get("username", "")), password=str(request.data.get("password", "")))
        if usuario is None or not usuario.is_active:
            return error("Usuario o contraseña incorrectos.", codigo=status.HTTP_400_BAD_REQUEST)
        token, _ = Token.objects.get_or_create(user=usuario)
        return respuesta_de_sesion(usuario, request, token)


class SalidaView(BaseSocial):
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class YoView(BaseSocial):
    """GET/PATCH /api/cuentas/yo/ · Solo los datos propios; no hay forma de indicar otro usuario."""

    parser_classes = [JSONParser, MultiPartParser, FormParser]
    throttle_classes = [EscrituraSocialThrottle]

    def get(self, request):
        perfil = perfil_de(request.user)
        datos = PerfilPropioSerializer(perfil, context={"request": request}).data
        datos.update(reglas.contadores(request.user.id))
        datos["logros"] = reglas.logros_de(reglas.contadores(request.user.id))
        return Response(datos)

    def patch(self, request):
        perfil = perfil_de(request.user)
        s = PerfilPropioSerializer(perfil, data=request.data, partial=True, context={"request": request})
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


# ---------------------------------------------------------------------------------------------------
# Perfiles públicos
# ---------------------------------------------------------------------------------------------------
def relacion_con(espectador, otro_id) -> dict:
    if not espectador.is_authenticated:
        return {"estado": "anonimo", "amistad_id": None}
    if espectador.id == otro_id:
        return {"estado": "propio", "amistad_id": None}
    fila = Amistad.objects.filter(Q(solicitante=espectador, destinatario_id=otro_id) | Q(solicitante_id=otro_id, destinatario=espectador)).first()
    if fila is None:
        return {"estado": "ninguna", "amistad_id": None}
    if fila.estado == EstadoAmistad.ACEPTADA:
        return {"estado": "amigos", "amistad_id": fila.id}
    if fila.estado == EstadoAmistad.PENDIENTE:
        return {"estado": "enviada" if fila.solicitante_id == espectador.id else "recibida", "amistad_id": fila.id}
    # Rechazada: quien la rechazó no recibe nuevas solicitudes de insistencia; el otro lado no lo sabe.
    return {"estado": "ninguna", "amistad_id": None}


def serializar_evento(e, request):
    return {
        "tipo": e["tipo"], "fecha": e["fecha"], "usuario": identidad(e["usuario"], request),
        "bien": {"id": e["bien"].id, "nombre": e["bien"].nombre}, "estrellas": e["estrellas"], "comentario": e["comentario"],
    }


class PerfilPublicoView(Publica):
    def get(self, request, username):
        # Un perfil «privado» responde igual que uno inexistente (no confirma que la cuenta existe).
        # El personal editorial (is_staff) no participa en el espacio social: no tiene perfil público.
        usuario = get_object_or_404(User.objects.select_related("perfil_visitante"), username__iexact=username, is_active=True, is_staff=False)
        perfil = perfil_de(usuario)
        if not reglas.puede_ver(request.user, usuario.id, perfil.privacidad_perfil):
            raise Http404
        relacion = relacion_con(request.user, usuario.id)
        base = {**identidad(usuario, request), "relacion": relacion}
        cont = reglas.contadores(usuario.id)
        ranking = {f["usuario"].id: f["posicion"] for f in reglas.tabla_ranking()}
        datos = {
            **base,
            "biografia": perfil.biografia,
            "miembro_desde": usuario.date_joined.date(),
            "contadores": {k: cont[k] for k in ("visitas", "valoraciones", "comentarios", "amigos")},
            "puntos": cont["puntos"],
            "posicion_ranking": ranking.get(usuario.id),
            "logros": reglas.logros_de(cont),
            "actividad": None,
        }
        if reglas.puede_ver(request.user, usuario.id, perfil.privacidad_actividad):
            datos["actividad"] = [serializar_evento(e, request) for e in reglas.eventos_de_actividad([usuario.id], 15)]
        return Response(datos)


class BuscarPerfilesView(Publica):
    """GET /api/perfiles/?q=  Solo perfiles públicos (los «solo amistades» y privados no se listan)."""

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return error("q", "Escriba al menos 2 caracteres.")
        consulta = User.objects.filter(is_active=True, is_staff=False, perfil_visitante__privacidad_perfil=Privacidad.PUBLICO).filter(
            Q(username__icontains=q) | Q(perfil_visitante__nombre_visible__icontains=q)
        ).select_related("perfil_visitante").order_by("username")[:20]
        return Response({"results": [identidad(u, request) for u in consulta]})


# ---------------------------------------------------------------------------------------------------
# Valoraciones, comentarios y visitas declaradas
# ---------------------------------------------------------------------------------------------------
class ResumenSocialView(Publica):
    """GET /api/bienes/{id}/social/  Promedio, cantidad y, si hay sesión, lo propio de la persona."""

    def get(self, request, bien_id):
        bien = bien_publicado_o_404(bien_id)
        agregado = Valoracion.objects.filter(bien=bien).aggregate(promedio=Avg("estrellas"), cantidad=Count("id"))
        datos = {
            "promedio": round(float(agregado["promedio"]), 1) if agregado["cantidad"] else None,
            "cantidad": agregado["cantidad"],
            "visitas_declaradas": VisitaDeclarada.objects.filter(bien=bien).count(),
            "mi_valoracion": None,
            "visitado": None,
        }
        if request.user.is_authenticated:
            propia = Valoracion.objects.filter(bien=bien, usuario=request.user).select_related("usuario__perfil_visitante").first()
            datos["mi_valoracion"] = serializar_valoracion(propia, request, mostrar_identidad=False, propia=True) if propia else None
            datos["visitado"] = VisitaDeclarada.objects.filter(bien=bien, usuario=request.user).exists()
        return Response(datos)


class ComentariosView(Publica):
    """GET /api/bienes/{id}/valoraciones/  Comentarios visibles, del más reciente al más antiguo (paginado)."""

    def get(self, request, bien_id):
        bien = bien_publicado_o_404(bien_id)
        consulta = Valoracion.objects.filter(bien=bien, comentario_oculto=False).exclude(comentario="").select_related("usuario__perfil_visitante").order_by("-updated_at", "-id")
        try:
            pagina = max(int(request.query_params.get("page", 1)), 1)
        except ValueError:
            pagina = 1
        tam = 10
        total = consulta.count()
        filas = list(consulta[(pagina - 1) * tam: pagina * tam])
        amigos = reglas.ids_de_amigos(request.user.id) if request.user.is_authenticated else set()
        resultados = []
        for v in filas:
            perfil = perfil_de(v.usuario)
            propia = request.user.is_authenticated and v.usuario_id == request.user.id
            visible = propia or perfil.privacidad_perfil == Privacidad.PUBLICO or (perfil.privacidad_perfil == Privacidad.AMIGOS and v.usuario_id in amigos)
            resultados.append(serializar_valoracion(v, request, mostrar_identidad=visible, propia=propia))
        return Response({"count": total, "page": pagina, "has_next": pagina * tam < total, "results": resultados})


class MiValoracionView(BaseSocial):
    throttle_classes = [EscrituraSocialThrottle]

    def put(self, request, bien_id):
        bien = bien_publicado_o_404(bien_id)
        s = ValoracionEntradaSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        datos = s.validated_data
        with transaction.atomic():
            existente = Valoracion.objects.select_for_update().filter(usuario=request.user, bien=bien).first()
            if existente:
                existente.estrellas = datos["estrellas"]
                if "comentario" in datos:
                    existente.comentario = datos["comentario"]
                existente.save()
                v, creada = existente, False
            else:
                try:
                    v = Valoracion.objects.create(usuario=request.user, bien=bien, estrellas=datos["estrellas"], comentario=datos.get("comentario", ""))
                    creada = True
                except IntegrityError:  # dos envíos simultáneos: la restricción única impide el duplicado
                    return error("Ya existe una valoración suya para este bien. Recargue e intente de nuevo.", codigo=status.HTTP_409_CONFLICT)
        return Response(serializar_valoracion(v, request, mostrar_identidad=False, propia=True), status=status.HTTP_201_CREATED if creada else status.HTTP_200_OK)

    def delete(self, request, bien_id):
        bien = bien_publicado_o_404(bien_id)
        borradas, _ = Valoracion.objects.filter(usuario=request.user, bien=bien).delete()
        if not borradas:
            return error("No tiene una valoración para este bien.", codigo=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReportarComentarioView(BaseSocial):
    throttle_classes = [EscrituraSocialThrottle]

    def post(self, request, valoracion_id):
        v = get_object_or_404(Valoracion, pk=valoracion_id, comentario_oculto=False, bien__estado_publicacion=EstadoPublicacion.PUBLICADO)
        if not v.comentario:
            return error("Esta valoración no tiene comentario.", codigo=status.HTTP_404_NOT_FOUND)
        if v.usuario_id == request.user.id:
            return error("No puede reportar su propio comentario; puede editarlo o retirarlo.")
        s = ReporteComentarioEntradaSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        _, creado = ReporteComentario.objects.get_or_create(valoracion=v, reportante=request.user, defaults={"motivo": s.validated_data["motivo"]})
        if not creado:
            return error("Ya reportó este comentario; el equipo editorial lo revisará.", codigo=status.HTTP_409_CONFLICT)
        return Response({"detail": "Gracias. El equipo editorial revisará el comentario."}, status=status.HTTP_201_CREATED)


class MiVisitaView(BaseSocial):
    """PUT marca (idempotente) · DELETE desmarca. Declarada por la persona: no verificada, sin ubicación."""

    throttle_classes = [EscrituraSocialThrottle]

    def put(self, request, bien_id):
        bien = bien_publicado_o_404(bien_id)
        _, creada = VisitaDeclarada.objects.get_or_create(usuario=request.user, bien=bien)
        return Response({"visitado": True, "verificada": False}, status=status.HTTP_201_CREATED if creada else status.HTTP_200_OK)

    def delete(self, request, bien_id):
        bien = bien_publicado_o_404(bien_id)
        VisitaDeclarada.objects.filter(usuario=request.user, bien=bien).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------------------------------
# Amistades
# ---------------------------------------------------------------------------------------------------
def _fila_amistad(f, yo, request):
    otro = f.destinatario if f.solicitante_id == yo.id else f.solicitante
    return {"id": f.id, "persona": identidad(otro, request), "fecha": f.created_at}


class AmistadesView(BaseSocial):
    """GET /api/amistades/  Mis amistades y solicitudes (recibidas y enviadas)."""

    def get(self, request):
        base = Amistad.objects.select_related("solicitante__perfil_visitante", "destinatario__perfil_visitante").filter(
            Q(solicitante=request.user) | Q(destinatario=request.user), solicitante__is_active=True, destinatario__is_active=True
        )
        return Response({
            "amigos": [_fila_amistad(f, request.user, request) for f in base.filter(estado=EstadoAmistad.ACEPTADA).order_by("-respondida_at")],
            "recibidas": [_fila_amistad(f, request.user, request) for f in base.filter(estado=EstadoAmistad.PENDIENTE, destinatario=request.user).order_by("-created_at")],
            "enviadas": [_fila_amistad(f, request.user, request) for f in base.filter(estado=EstadoAmistad.PENDIENTE, solicitante=request.user).order_by("-created_at")],
        })


class SolicitarAmistadView(BaseSocial):
    throttle_classes = [AmistadThrottle]

    def post(self, request):
        s = SolicitudAmistadSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        destino = User.objects.filter(username__iexact=s.validated_data["username"], is_active=True, is_staff=False).select_related("perfil_visitante").first()
        # Perfil privado o inexistente: misma respuesta (no se revela la cuenta).
        if destino is None or perfil_de(destino).privacidad_perfil == Privacidad.PRIVADO and destino.id != request.user.id:
            return error("No se encontró a esa persona.", codigo=status.HTTP_404_NOT_FOUND)
        if destino.id == request.user.id:
            return error("No puede enviarse una solicitud a sí mismo.")
        existente = Amistad.objects.filter(Q(solicitante=request.user, destinatario=destino) | Q(solicitante=destino, destinatario=request.user)).first()
        if existente:
            if existente.estado == EstadoAmistad.ACEPTADA:
                return error("Ya son amistades.", codigo=status.HTTP_409_CONFLICT)
            if existente.estado == EstadoAmistad.PENDIENTE:
                if existente.solicitante_id == request.user.id:
                    return error("Ya envió una solicitud a esta persona.", codigo=status.HTTP_409_CONFLICT)
                return error("Esta persona ya le envió una solicitud: puede aceptarla en «Amistades».", codigo=status.HTTP_409_CONFLICT)
            # Rechazada: solo quien rechazó puede volver a abrirla; quien fue rechazado no puede insistir.
            if existente.destinatario_id != request.user.id:
                return error("Esta persona no aceptó su solicitud anterior.", codigo=status.HTTP_409_CONFLICT)
            existente.solicitante, existente.destinatario = request.user, destino
            existente.estado, existente.respondida_at = EstadoAmistad.PENDIENTE, None
            existente.save()
            return Response({"id": existente.id, "estado": existente.estado}, status=status.HTTP_201_CREATED)
        if Amistad.objects.filter(solicitante=request.user, estado=EstadoAmistad.PENDIENTE).count() >= MAX_SOLICITUDES_PENDIENTES:
            return error(f"Tiene {MAX_SOLICITUDES_PENDIENTES} solicitudes pendientes; espere respuestas o cancele alguna.", codigo=status.HTTP_409_CONFLICT)
        try:
            with transaction.atomic():
                f = Amistad.objects.create(solicitante=request.user, destinatario=destino)
        except IntegrityError:  # solicitudes cruzadas simultáneas: la restricción de pareja impide la duplicada
            return error("Ya existe una solicitud entre ustedes.", codigo=status.HTTP_409_CONFLICT)
        return Response({"id": f.id, "estado": f.estado}, status=status.HTTP_201_CREATED)


class ResponderAmistadView(BaseSocial):
    """POST /api/amistades/{id}/aceptar|rechazar/ — solo el destinatario de una solicitud pendiente."""

    accion = None
    throttle_classes = [EscrituraSocialThrottle]

    def post(self, request, amistad_id):
        f = get_object_or_404(Amistad, pk=amistad_id, destinatario=request.user, estado=EstadoAmistad.PENDIENTE)
        f.estado = EstadoAmistad.ACEPTADA if self.accion == "aceptar" else EstadoAmistad.RECHAZADA
        f.respondida_at = timezone.now()
        f.save(update_fields=["estado", "respondida_at"])
        return Response({"id": f.id, "estado": f.estado})


class AmistadDetalleView(BaseSocial):
    """DELETE /api/amistades/{id}/  Quien envió cancela su solicitud pendiente; cualquiera de las dos personas retira una amistad."""

    throttle_classes = [EscrituraSocialThrottle]

    def delete(self, request, amistad_id):
        f = get_object_or_404(Amistad.objects.filter(Q(solicitante=request.user) | Q(destinatario=request.user)), pk=amistad_id)
        if f.estado == EstadoAmistad.PENDIENTE and f.destinatario_id == request.user.id:
            return error("Para una solicitud recibida use «rechazar».", codigo=status.HTTP_409_CONFLICT)
        if f.estado == EstadoAmistad.RECHAZADA:
            return error("Esta solicitud ya fue respondida.", codigo=status.HTTP_404_NOT_FOUND)
        f.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ActividadAmistadesView(BaseSocial):
    """GET /api/amistades/actividad/  Actividad patrimonial reciente de MIS amistades, respetando su privacidad de actividad."""

    def get(self, request):
        ids = reglas.ids_de_amigos(request.user.id)
        permitidos = list(User.objects.filter(id__in=ids, is_active=True, perfil_visitante__privacidad_actividad__in=[Privacidad.AMIGOS, Privacidad.PUBLICO]).values_list("id", flat=True))
        return Response({"results": [serializar_evento(e, request) for e in reglas.eventos_de_actividad(permitidos, 30)]})


# ---------------------------------------------------------------------------------------------------
# Ranking y logros
# ---------------------------------------------------------------------------------------------------
class RankingView(Publica):
    def get(self, request):
        tabla = reglas.tabla_ranking()
        propia = next((f for f in tabla if request.user.is_authenticated and f["usuario"].id == request.user.id), None)
        return Response({
            "formula": {
                "visita_declarada": reglas.PUNTOS_VISITA, "valoracion": reglas.PUNTOS_VALORACION, "comentario": reglas.PUNTOS_COMENTARIO,
                "min_caracteres_comentario": reglas.MIN_CARACTERES_COMENTARIO,
                "desempate": ["más puntos", "más bienes visitados", "cuenta más antigua", "menor identificador"],
            },
            "logros": reglas.catalogo_de_logros(),
            "results": [
                {"posicion": f["posicion"], "puntos": f["puntos"], "visitas": f["visitas"], "persona": identidad(f["usuario"], request)}
                for f in tabla[:20]
            ],
            "mi_posicion": propia["posicion"] if propia else None,
            "mis_puntos": propia["puntos"] if propia else None,
        })
