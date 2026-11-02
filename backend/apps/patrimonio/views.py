"""Vistas de la API pública de lectura (sección 8.2). Solo exponen bienes publicados (RN-01)."""
from django.db.models import Count, Q
from rest_framework import viewsets
from rest_framework.pagination import PageNumberPagination

from .models import BienPatrimonial, Categoria, EstadoPublicacion
from .serializers import BienDetalleSerializer, BienListaSerializer, CategoriaSerializer

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


class CategoriaViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/categorias/  catálogo completo (sin paginar) con el total de bienes publicados."""

    serializer_class = CategoriaSerializer
    pagination_class = None

    def get_queryset(self):
        publicados = Count("bienes", filter=Q(bienes__estado_publicacion=EstadoPublicacion.PUBLICADO))
        return Categoria.objects.annotate(total_bienes=publicados).order_by("nombre")
