# Digesto Normativo IUPA

Sistema de digesto normativo para el Instituto Universitario Patagónico de las Artes (IUPA): búsqueda pública de normas institucionales, visor de texto y PDF original, y backoffice con pipeline de ingesta de PDFs (texto nativo u OCR) y búsqueda full-text en PostgreSQL.

## Puesta en marcha rápida

```bash
cp .env.example .env        # ajustar si hace falta
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:5008 (Swagger en `/swagger`)
- PostgreSQL: localhost:5433

En el hito 1 `docker compose up` incluirá migraciones y seed automáticos.

## Desarrollo local

```bash
# Backend
dotnet build
dotnet test
dotnet run --project src/Digesto.Api   # API en http://localhost:5008

# Frontend
cd apps/web
npm install
npm run dev                            # proxy /api -> localhost:5008
```

## Estructura

Ver `AGENTS.md` para la estructura de proyectos, convenciones de código y reglas de dominio. Las decisiones técnicas están registradas en `DECISIONS.md`.

## Benchmark con 50.000 normas

Generador de datos sintéticos + mediciones reproducibles:

```bash
dotnet run --project src/Digesto.Herramientas -- generar 50000   # ~250.000 fragmentos
dotnet run --project src/Digesto.Herramientas -- benchmark        # p50/p95/p99
```

Referencia local (Docker Desktop en macOS, 50k normas / 250k fragmentos):
p50 ≈ 3 ms, p95 ≈ 100 ms, p99 ≈ 112 ms. Las consultas que matchean ~34% del corpus (palabras de uso legal muy común) pueden ser más lentas: son un caso límite, no el patrón de uso.

## Mantenimiento de índices (desde el hito 3)

- Tras cargas masivas: `ANALYZE;`
- Periódicamente: `REINDEX INDEX CONCURRENTLY ix_fragmento_tsv_es;` (y el resto de los GIN).
- Backups: `pg_dump` de la base + copia del volumen `archivos` (`/data/archivos`).

## Estado

- [x] Hito 0: andamiaje (solución, web, docker-compose, CI, health checks)
- [ ] Hito 1: modelo y catálogos
- [ ] Hito 2: ingesta con texto nativo
- [ ] Hito 3: búsqueda
- [ ] Hito 4: frontend público
- [ ] Hito 5: backoffice
- [ ] Hito 6: OCR e importador masivo
- [ ] Hito 7: relaciones, vigencia y boletín
- [ ] Hito 8: pulido y benchmark
