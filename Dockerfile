# syntax=docker/dockerfile:1

# ---- Stage 1: build the React/Vite frontend ----
FROM node:20-alpine AS frontend

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

# Vite inlines VITE_* variables at build time, so they must be present here.
ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_MAPBOX_ACCESS_TOKEN
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
ENV VITE_MAPBOX_ACCESS_TOKEN=$VITE_MAPBOX_ACCESS_TOKEN

RUN npm run build

# ---- Stage 2: Django runtime ----
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Bring in the built frontend (templates and static assets). No node_modules here.
COPY --from=frontend /app/frontend/build /app/frontend/build

RUN python manage.py collectstatic --noinput

EXPOSE 8080

# Fallback only; the Railway start command takes precedence when set.
CMD ["sh", "-c", "gunicorn truck_routing.wsgi --bind 0.0.0.0:${PORT:-8080} --log-file -"]
