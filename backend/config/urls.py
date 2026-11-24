from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import FileResponse, Http404
from django.urls import include, path, re_path
from django.views.static import serve

admin.site.site_header = "Paceño · Administración editorial"
admin.site.site_title = "Paceño"
admin.site.index_title = "Gestión del patrimonio cultural"


def pwa(request, ruta=""):
    """Rutas de la PWA (/rutas, /cuenta, /bienes/3…): devuelve index.html y react-router decide la pantalla."""
    archivo = settings.FRONTEND_DIST / "index.html"
    if not archivo.is_file():
        raise Http404
    return FileResponse(open(archivo, "rb"), content_type="text/html; charset=utf-8")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("apps.social.urls")),  # antes que el router: rutas más específicas (bienes/<id>/social/…)
    path("api/", include("apps.patrimonio.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
elif settings.SERVIR_MEDIA:
    urlpatterns += [re_path(r"^media/(?P<path>.+)$", serve, {"document_root": settings.MEDIA_ROOT})]

# Debe ir al final: cualquier otra ruta que no sea de la API, del panel o de archivos es una pantalla de la PWA.
if (settings.FRONTEND_DIST / "index.html").is_file():
    urlpatterns += [re_path(r"^(?!api/|admin/|media/|static/)(?P<ruta>.*)$", pwa)]
