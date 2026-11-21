from django.urls import path

from . import views as v

urlpatterns = [
    path("cuentas/registro/", v.RegistroView.as_view()),
    path("cuentas/acceso/", v.AccesoView.as_view()),
    path("cuentas/salida/", v.SalidaView.as_view()),
    path("cuentas/yo/", v.YoView.as_view()),
    path("perfiles/", v.BuscarPerfilesView.as_view()),
    path("perfiles/<str:username>/", v.PerfilPublicoView.as_view()),
    path("bienes/<int:bien_id>/social/", v.ResumenSocialView.as_view()),
    path("bienes/<int:bien_id>/valoraciones/", v.ComentariosView.as_view()),
    path("bienes/<int:bien_id>/mi-valoracion/", v.MiValoracionView.as_view()),
    path("bienes/<int:bien_id>/mi-visita/", v.MiVisitaView.as_view()),
    path("valoraciones/<int:valoracion_id>/reportar/", v.ReportarComentarioView.as_view()),
    path("amistades/", v.AmistadesView.as_view()),
    path("amistades/solicitar/", v.SolicitarAmistadView.as_view()),
    path("amistades/actividad/", v.ActividadAmistadesView.as_view()),
    path("amistades/<int:amistad_id>/aceptar/", v.ResponderAmistadView.as_view(accion="aceptar")),
    path("amistades/<int:amistad_id>/rechazar/", v.ResponderAmistadView.as_view(accion="rechazar")),
    path("amistades/<int:amistad_id>/", v.AmistadDetalleView.as_view()),
    path("ranking/", v.RankingView.as_view()),
]
