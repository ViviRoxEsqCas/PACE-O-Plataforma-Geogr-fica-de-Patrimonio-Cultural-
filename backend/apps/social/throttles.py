from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class RegistroThrottle(AnonRateThrottle):
    scope = "social_registro"


class AccesoThrottle(AnonRateThrottle):
    scope = "social_acceso"


class EscrituraSocialThrottle(UserRateThrottle):
    """Valoraciones, visitas, reportes de comentarios y cambios de perfil."""

    scope = "social_escritura"


class AmistadThrottle(UserRateThrottle):
    """Solicitudes de amistad nuevas (frena el envío masivo)."""

    scope = "social_amistad"
