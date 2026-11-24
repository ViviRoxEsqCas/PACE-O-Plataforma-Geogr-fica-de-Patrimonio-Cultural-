# PACEÑO · un solo servicio: compila la PWA (React/Vite) y la entrega junto con la API Django (gunicorn + WhiteNoise).
# El sitio y la API comparten origen: no hace falta CORS ni VITE_API_URL.

# ---- 1) Frontend ----
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- 2) Backend + PWA compilada ----
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt
COPY backend/ backend/
COPY contenido/ contenido/
COPY --from=web /web/dist frontend/dist
WORKDIR /app/backend
# Si el repositorio se clonó en Windows, el script puede traer finales de línea CRLF: se normalizan.
RUN sed -i 's/\r$//' entrypoint.sh
RUN DJANGO_SECRET_KEY=solo-para-compilar DJANGO_DEBUG=False python manage.py collectstatic --noinput
EXPOSE 10000
CMD ["sh", "entrypoint.sh"]
