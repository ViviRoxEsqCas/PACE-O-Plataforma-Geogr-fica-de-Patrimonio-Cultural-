from rest_framework.routers import DefaultRouter

from .views import BienViewSet, CategoriaViewSet

router = DefaultRouter()
router.register("bienes", BienViewSet, basename="bien")
router.register("categorias", CategoriaViewSet, basename="categoria")

urlpatterns = router.urls
