# Instalación en producción (sin Docker)

Guía para instalar Digesto Normativo IUPA en un servidor Linux, con PostgreSQL y nginx, sin contenedores.

## Requisitos

- Linux (Debian/Ubuntu o similar) con acceso root o sudo
- .NET SDK 8
- PostgreSQL 16
- Node.js 20+ y npm (para compilar el frontend; puede desinstalarse después)
- nginx (o cualquier reverse proxy)

## 1. Base de datos

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE digesto LOGIN PASSWORD 'CAMBIAR_ESTA_CLAVE';
CREATE DATABASE digesto OWNER digesto;
SQL
```

Recomendaciones de tuning en `postgresql.conf` (valores similares a los del docker-compose):

```ini
shared_buffers = 256MB
effective_cache_size = 768MB
maintenance_work_mem = 128MB
random_page_cost = 1.1
```

## 2. Compilar el backend

```bash
git clone https://github.com/Jorgebquilaman/Palimpsesto.git digesto
cd digesto
dotnet publish src/Digesto.Api -c Release -o /var/lib/digesto/api
dotnet publish src/Digesto.Worker -c Release -o /var/lib/digesto/worker
```

El build debe salir sin warnings (`--warnaserror` en CI).

## 3. Almacenamiento de archivos

```bash
sudo mkdir -p /var/lib/digesto/archivos
sudo chown digesto:digesto /var/lib/digesto/archivos
```

## 4. Compilar el frontend

```bash
cd apps/web
npm ci
npm run build
# el resultado está en apps/web/dist
sudo cp -r dist/. /var/www/digesto/
```

## 5. Variables de entorno

`/var/lib/digesto/api/env` (y el mismo contenido en `worker/env`, con los valores que correspondan):

```bash
ConnectionStrings__Digesto=Host=localhost;Port=5432;Database=digesto;Username=digesto;Password=CAMBIAR_ESTA_CLAVE
FileStorage__Root=/var/lib/digesto/archivos
Jwt__Clave=CLAVE_ALEATORIA_DE_AL_MENOS_32_CARACTERES
Ingesta__TamanioMaximoMb=50
Ingesta__UmbralCaracteresPagina=100
Ingesta__TimeoutProcesoSegundos=120
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://127.0.0.1:8080
```

Para generar `Jwt__Clave`: `openssl rand -base64 48`.

| Variable | Descripción |
|---|---|
| `ConnectionStrings__Digesto` | Conexión a PostgreSQL (jerarquía EF: `__` en env). |
| `FileStorage__Root` | Carpeta de PDFs y archivos derivados. |
| `Jwt__Clave` | Clave de firma JWT. **Obligatoria**, mínimo 32 caracteres. |
| `Ingesta__TamanioMaximoMb` | Tamaño máximo de PDF por carga (default 50). |
| `Ingesta__UmbralCaracteresPagina` | Promedio de caracteres por página debajo del cual se considera escaneado y se activa OCR (default 100). |
| `Ingesta__TimeoutProcesoSegundos` | Timeout del proceso de ingesta por norma (default 120). |

Opcional: `DEEPSEEK_API_KEY` si se usará la autocompleción de metadatos con IA (también puede configurarse desde el backoffice).

## 6. Migraciones y seed

```bash
# Migraciones (una sola vez por cada actualización)
dotnet exec /var/lib/digesto/api/Digesto.Api.dll --migrate   # si disponible
```

Alternativa recomendada, ejecutar las migraciones desde el proyecto:

```bash
cd /ruta/al/repo
dotnet ef database update --project src/Digesto.Infrastructure \
  --startup-project src/Digesto.Api
```

La API siembra el usuario `admin` al arrancar si no existe (ver `SEED_ADMIN_PASSWORD` en el punto 7).

## 7. Servicios systemd

`/etc/systemd/system/digesto-api.service`:

```ini
[Unit]
Description=Digesto IUPA - API
After=network.target postgresql.service

[Service]
User=digesto
WorkingDirectory=/var/lib/digesto/api
EnvironmentFile=/var/lib/digesto/api/env
ExecStart=/usr/bin/dotnet /var/lib/digesto/api/Digesto.Api.dll
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/digesto-worker.service`:

```ini
[Unit]
Description=Digesto IUPA - Worker de ingesta
After=digesto-api.service

[Service]
User=digesto
WorkingDirectory=/var/lib/digesto/worker
EnvironmentFile=/var/lib/digesto/worker/env
ExecStart=/usr/bin/dotnet /var/lib/digesto/worker/Digesto.Worker.dll
Restart=always
RestartSec=5
# El worker procesa PDFs no confiables: sin privilegios extra
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/digesto/archivos /tmp

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now digesto-api digesto-worker
```

### OCR

Para que funcione el OCR de PDFs escaneados, instalar `ocrmypdf` en el servidor (disponible en el repositorio de Debian/Ubuntu):

```bash
sudo apt install ocrmypdf
```

## 8. nginx

`/etc/nginx/sites-available/digesto`:

```nginx
server {
    listen 80;
    server_name digesto.iupa.edu.ar;

    # Frontend estático
    root /var/www/digesto;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API bajo /api
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 1024m;   # importación masiva (límite 1 GB)
    }

    # Swagger solo si se decide exponerlo (no recomendado en producción)
    # location /swagger/ {
    #     proxy_pass http://127.0.0.1:8080;
    # }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/digesto /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Para HTTPS, usar certbot: `sudo certbot --nginx`.

## 9. Primer arranque

1. Confirmar que la API está viva: `curl http://127.0.0.1:8080/healthz` (ajustar según el health check configurado).
2. Ingresar al backoffice en `https://digesto.iupa.edu.ar/admin` con el usuario `admin`.
3. **Cambiar de inmediato la contraseña sembrada** (sección Perfil), o fijar una segura antes del primer arranque mediante la variable `SEED_ADMIN_PASSWORD`.
4. Crear los usuarios del equipo (sección Usuarios) y los catálogos (tipos de norma, órganos emisores, materias).

## 10. Mantenimiento

- **Backups**: `pg_dump` de la base + copia de `/var/lib/digesto/archivos`.
- **Índices full-text**: tras cargas masivas ejecutar `ANALYZE;`; periódicamente `REINDEX INDEX CONCURRENTLY ix_fragmento_tsv_es;` (y el resto de los índices GIN).
- **Actualizaciones**: recompilar backend y frontend, correr migraciones y reiniciar los servicios systemd.

## Seguridad

- Ninguna clave en el repo; todo por variables de entorno.
- `Jwt__Clave` distinta por entorno y rotación periódica.
- PostgreSQL no expuesto a internet; solo escucha en localhost o red interna.
- El worker corre con usuario sin privilegios y restricciones systemd.
