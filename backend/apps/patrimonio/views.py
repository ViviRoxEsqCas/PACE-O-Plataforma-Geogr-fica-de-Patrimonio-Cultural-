"""Vistas de la API pública de lectura (sección 8.2). Solo exponen bienes publicados (RN-01)."""
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .models import Actividad, BienPatrimonial, Categoria, EstadoPublicacion, TipoReporte
from .serializers import (
    ActividadPublicaSerializer,
    BienDetalleSerializer,
    BienListaSerializer,
    CategoriaSerializer,
    ReporteCrearSerializer,
    RespuestaSerializer,
    TipoReporteSerializer,
)

PUBLICADOS = Q(estado_publicacion=EstadoPublicacion.PUBLICADO)


class PaginacionBienes(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class BienViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/bienes/          lista paginada; ?q=texto (sin tildes ni mayúsculas) y ?categoria=<id>
    GET /api/bienes/{id}/     ficha con fuentes e imágenes con atribución
    """

    pagination_class = PaginacionBienes

    def get_queryset(self):
        qs = (
            BienPatrimonial.objects.filter(PUBLICADOS)
            .select_related("tipo_patrimonio", "categoria")
            .order_by("nombre", "id")
        )
        if self.action == "retrieve":
            qs = qs.prefetch_related("recursos__licencia", "fuentes__tipo_fuente")
        else:
            qs = qs.prefetch_related("recursos__licencia")
        categoria = self.request.query_params.get("categoria")
        if categoria:
            qs = qs.filter(categoria_id=categoria) if categoria.isdigit() else qs.none()
        texto = (self.request.query_params.get("q") or "").strip()
        if texto:
            qs = qs.filter(nombre__unaccent__icontains=texto)
        return qs

    def get_serializer_class(self):
        return BienDetalleSerializer if self.action == "retrieve" else BienListaSerializer

    @action(detail=True, methods=["get"], pagination_class=None)
    def actividades(self, request, pk=None):
        """GET /api/bienes/{id}/actividades/  actividades activas y válidas; sin la respuesta correcta (RN-04)."""
        bien = self.get_object()
        actividades = (
            Actividad.objects.filter(bien=bien, activa=True)
            .annotate(n_opciones=Count("opciones"), n_correctas=Count("opciones", filter=Q(opciones__es_correcta=True)))
            .filter(n_correctas=1, n_opciones__gte=Actividad.MIN_OPCIONES)
            .prefetch_related("opciones")
            .order_by("id")
        )
        return Response(ActividadPublicaSerializer(actividades, many=True).data)


class CategoriaViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/categorias/  catálogo completo (sin paginar) con el total de bienes publicados."""

    serializer_class = CategoriaSerializer
    pagination_class = None

    def get_queryset(self):
        publicados = Count("bienes", filter=Q(bienes__estado_publicacion=EstadoPublicacion.PUBLICADO))
        return Categoria.objects.annotate(total_bienes=publicados).order_by("nombre")


class ActividadViewSet(viewsets.GenericViewSet):
    """POST /api/actividades/{id}/responder/  {"opcion": <id>}  → corrección en el servidor (RF-14)."""

    queryset = Actividad.objects.none()
    pagination_class = None

    def get_queryset(self):
        return Actividad.objects.filter(activa=True, bien__estado_publicacion=EstadoPublicacion.PUBLICADO)

    @action(detail=True, methods=["post"])
    def responder(self, request, pk=None):
        actividad = get_object_or_404(self.get_queryset().prefetch_related("opciones"), pk=pk)
        entrada = RespuestaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        opciones = {o.id: o for o in actividad.opciones.all()}
        elegida = opciones.get(entrada.validated_data["opcion"])
        if elegida is None:
            return Response({"opcion": ["La opción no pertenece a esta actividad."]}, status=status.HTTP_400_BAD_REQUEST)
        correcta = elegida.es_correcta
        # Si falla, NO se revela cuál era la correcta: la persona puede reintentar (RF-14).
        return Response({
            "correcta": correcta,
            "opcion_correcta": elegida.id if correcta else None,
            "puntos": actividad.puntos if correcta else 0,
            "retroalimentacion": actividad.retroalimentacion,
        })


class TipoReporteViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/tipos-reporte/  catálogo para el formulario."""

    queryset = TipoReporte.objects.order_by("nombre")
    serializer_class = TipoReporteSerializer
    pagination_class = None


class ReporteThrottle(AnonRateThrottle):
    """RF-17: limita los envíos por dirección IP (tasa en REST_FRAMEWORK → «reportes»); responde 429."""

    scope = "reportes"


class ReporteViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """POST /api/reportes/  Solo creación: el visitante no puede listar ni consultar reportes (alcance, sección 10)."""

    serializer_class = ReporteCrearSerializer
    throttle_classes = [ReporteThrottle]
    queryset = None

    def create(self, request, *args, **kwargs):
        serializador = self.get_serializer(data=request.data)
        serializador.is_valid(raise_exception=True)
        reporte = serializador.save()
        return Response({"id": reporte.id, "estado": reporte.estado.nombre}, status=status.HTTP_201_CREATED)
