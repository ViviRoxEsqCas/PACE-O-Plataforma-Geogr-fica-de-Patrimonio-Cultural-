#!/bin/sh
# Arranque en producción: prepara la base y el contenido inicial (todo idempotente) y lanza gunicorn.
set -e

python manage.py migrate --noinput
python manage.py cargar_fichas_iniciales      # crea lo que falte; NO sobrescribe lo que el Editor ya corrigió
python manage.py cargar_actividades_iniciales
python manage.py cargar_imagenes

# Administrador del panel /admin/: solo si se definieron ambas variables (la contraseña no se guarda en el repositorio).
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  python manage.py createsuperuser --noinput || echo "El administrador ya existe; no se modifica."
fi

exec gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-10000}" --workers "${WEB_CONCURRENCY:-2}" --timeout 60 --access-logfile -
