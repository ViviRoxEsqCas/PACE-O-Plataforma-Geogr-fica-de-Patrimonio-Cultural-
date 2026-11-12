from rest_framework.routers import DefaultRouter

from .views import ActividadViewSet, BienViewSet, CategoriaViewSet, ReporteViewSet, TipoReporteViewSet

router = DefaultRouter()
router.register("bienes", BienViewSet, basename="bien")
router.register("categorias", CategoriaViewSet, basename="categoria")
router.register("actividades", ActividadViewSet, basename="actividad")
router.register("reportes", ReporteViewSet, basename="reporte")
router.register("tipos-reporte", TipoReporteViewSet, basename="tipo-reporte")

urlpatterns = router.urls
