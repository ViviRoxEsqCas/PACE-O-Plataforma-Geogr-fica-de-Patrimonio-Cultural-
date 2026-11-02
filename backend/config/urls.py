from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "Paceño · Administración editorial"
admin.site.site_title = "Paceño"
admin.site.index_title = "Gestión del patrimonio cultural"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("apps.patrimonio.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
