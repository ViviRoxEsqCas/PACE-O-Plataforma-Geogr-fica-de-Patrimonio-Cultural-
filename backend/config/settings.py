"""
Configuración de Paceño (backend).

Toda la configuración sensible o dependiente del entorno se lee de variables
de entorno (archivo .env), según RNF-07 (mantenibilidad).
"""
import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(nombre: str, defecto: bool = False) -> bool:
    return os.getenv(nombre, str(defecto)).strip().lower() in ("1", "true", "yes", "si", "sí")


def env_list(nombre: str, defecto: str = "") -> list[str]:
    return [x.strip() for x in os.getenv(nombre, defecto).split(",") if x.strip()]


DEBUG = env_bool("DJANGO_DEBUG", False)
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured("Defina DJANGO_SECRET_KEY en el archivo .env.")
    SECRET_KEY = "inseguro-solo-para-desarrollo-local"
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
# Render define el dominio público del servicio en esta variable: se acepta sin tener que copiarlo a mano.
_HOST_RENDER = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()
if _HOST_RENDER and _HOST_RENDER not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(_HOST_RENDER)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",  # extensión unaccent: búsqueda sin tildes (RF-08)
    # Terceros
    "rest_framework",
    "corsheaders",
    "rest_framework.authtoken",  # espacio social: token por visitante (la API pública sigue anónima)
    # Propias (social va después de patrimonio: sus permisos se conceden tras los de los roles)
    "apps.patrimonio",
    "apps.social",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # sirve /static/ (admin) y la PWA compilada en producción
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# --- Base de datos: PostgreSQL (sin PostGIS en el MVP, sección 8.4) ---
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "paceno"),
        "USER": os.getenv("DB_USER", "paceno"),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}
# Plataformas como Render entregan la base como una sola URL (DATABASE_URL); si existe, tiene prioridad.
_URL_BD = os.getenv("DATABASE_URL", "").strip()
if _URL_BD:
    from urllib.parse import parse_qs, unquote, urlparse

    _bd = urlparse(_URL_BD)
    DATABASES["default"].update(
        NAME=unquote(_bd.path.lstrip("/")), USER=unquote(_bd.username or ""), PASSWORD=unquote(_bd.password or ""),
        HOST=_bd.hostname or "localhost", PORT=str(_bd.port or 5432),
    )
    # Neon, Supabase y similares exigen SSL: llega como «?sslmode=require» al final de la URL.
    _sslmode = parse_qs(_bd.query).get("sslmode", [""])[0]
    if _sslmode:
        DATABASES["default"]["OPTIONS"] = {"sslmode": _sslmode}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es"
TIME_ZONE = "America/La_Paz"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
# En producción apunte MEDIA_ROOT a un disco persistente (en Render: /data/media); si no, las fotos subidas se pierden.
MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", str(BASE_DIR / "media")))
# Sin DEBUG, Django no sirve /media/: con SERVIR_MEDIA=True lo hace la propia aplicación (suficiente para este volumen).
SERVIR_MEDIA = env_bool("SERVIR_MEDIA", False)

# PWA compilada (frontend/dist). Si existe, el mismo servicio entrega el sitio y la API en un solo origen
# (sin CORS y con las rutas /api y /media relativas, como en desarrollo). Ver Dockerfile.
FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", str(BASE_DIR.parent / "frontend" / "dist")))
if (FRONTEND_DIST / "index.html").is_file():
    WHITENOISE_ROOT = FRONTEND_DIST
    WHITENOISE_INDEX_FILE = True
    WHITENOISE_MIMETYPES = {".webmanifest": "application/manifest+json"}
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}
# Fotos, banners e imágenes del catálogo en un almacenamiento externo compatible con S3 (p. ej. Supabase Storage,
# Cloudflare R2). Es la opción para hosting gratuito, donde el disco del servicio se borra al dormirse.
# Se activa al definir S3_BUCKET; la API entrega entonces URL absolutas que el frontend respeta sin cambios.
if os.getenv("S3_BUCKET", "").strip():
    AWS_STORAGE_BUCKET_NAME = os.environ["S3_BUCKET"].strip()
    AWS_S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "").strip() or None
    AWS_S3_REGION_NAME = os.getenv("S3_REGION", "us-east-1").strip()
    AWS_ACCESS_KEY_ID = os.getenv("S3_ACCESS_KEY_ID", "").strip()
    AWS_SECRET_ACCESS_KEY = os.getenv("S3_SECRET_ACCESS_KEY", "").strip()
    # Dirección pública de lectura (sin https:// ni barra final), p. ej.
    # «<proyecto>.supabase.co/storage/v1/object/public/<bucket>».
    AWS_S3_CUSTOM_DOMAIN = os.getenv("S3_PUBLIC_DOMAIN", "").strip() or None
    AWS_QUERYSTRING_AUTH = False
    AWS_DEFAULT_ACL = None
    AWS_S3_FILE_OVERWRITE = False
    AWS_S3_ADDRESSING_STYLE = "path"
    AWS_S3_SIGNATURE_VERSION = "s3v4"
    STORAGES["default"] = {"BACKEND": "storages.backends.s3.S3Storage"}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Django REST Framework ---
# La API pública no requiere autenticación (sección 8.2). Es de lectura, salvo
# dos POST anónimos: responder actividades y enviar reportes (con límite de
# frecuencia, RF-17). Sin autenticación de sesión no se exige CSRF en estos POST.
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"]
    + (["rest_framework.renderers.BrowsableAPIRenderer"] if DEBUG else []),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    # RF-17: límite de reportes por IP. Formato «N/hour»; se ajusta en .env (REPORTES_LIMITE).
    "DEFAULT_THROTTLE_RATES": {
        "reportes": os.getenv("REPORTES_LIMITE", "5/hour"),
        # Espacio social: registro e ingreso por IP; escrituras y solicitudes de amistad por usuario.
        "social_acceso": os.getenv("SOCIAL_ACCESO_LIMITE", "20/hour"),
        "social_registro": os.getenv("SOCIAL_REGISTRO_LIMITE", "5/hour"),
        "social_escritura": os.getenv("SOCIAL_ESCRITURA_LIMITE", "120/hour"),
        "social_amistad": os.getenv("SOCIAL_AMISTAD_LIMITE", "20/day"),
    },
    # Si hay un proxy inverso delante (semana 4), indique cuántos: la IP real viene de X-Forwarded-For.
    # 0 = sin proxy: se usa REMOTE_ADDR. No convertir 0 en None: DRF tomaría entonces toda la cabecera
    # X-Forwarded-For (que el cliente controla) como identidad y el límite de reportes sería evadible.
    "NUM_PROXIES": int(os.getenv("NUM_PROXIES", "0")),
}

# --- CORS restringido al origen de la PWA (sección 8.2) ---
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000")
if _HOST_RENDER:
    CSRF_TRUSTED_ORIGINS.append(f"https://{_HOST_RENDER}")  # el panel /admin/ funciona en el dominio de Render

# --- Seguridad en producción (HTTPS) ---
if not DEBUG:
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 3600
    # Detrás de un proxy que termina HTTPS, sin esto Django ve HTTP y SECURE_SSL_REDIRECT entra en bucle.
    # Activar solo si el proxy sobrescribe siempre X-Forwarded-Proto (si no, el cliente podría falsificarla).
    if env_bool("USAR_X_FORWARDED_PROTO", False):
        SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
