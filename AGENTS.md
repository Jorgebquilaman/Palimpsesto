# AGENTS.md — Convenciones del proyecto Digesto Normativo IUPA

Guía para desarrolladores y agentes de código. Leer antes de modificar nada.

## Estructura

- `src/Digesto.Domain` — entidades de dominio, reglas puras. Sin dependencias de frameworks.
- `src/Digesto.Application` — casos de uso, interfaces de aplicación, DTOs. Depende solo de Domain.
- `src/Digesto.Infrastructure` — EF Core (escritura/migraciones), Dapper (búsqueda), `IFileStorage`, extractores. Depende de Application.
- `src/Digesto.Api` — Web API pública + admin. Depende de Infrastructure y Application.
- `src/Digesto.Worker` — BackgroundService para el pipeline de ingesta de PDFs.
- `tests/Digesto.Tests` — xUnit. Tests de dominio + integración (Testcontainers con PostgreSQL real).
- `apps/web` — React + Vite + TypeScript + Tailwind (frontend público y backoffice).
- `docker/` — Dockerfiles y configuración de nginx.

## Comandos

```bash
# Backend
dotnet build                          # compilar (debe pasar sin warnings: --warnaserror en CI)
dotnet test                           # correr tests
dotnet run --project src/Digesto.Api  # API en http://localhost:5008

# Frontend
cd apps/web
npm install
npm run dev                           # dev server con proxy /api -> localhost:5008
npm run build                         # build de producción (incluye tsc)

# Todo junto
docker compose up --build             # postgres + api + worker + web con migraciones y seed
```

## Convenciones de código

- C#: .NET 8, nullable enable, ImplicitUsings enable, analizadores habilitados. Sin comentarios salvo que se pidan.
- Entidades de dominio en **español** (`Norma`, `Fragmento`, `Boletin`, `OrganoEmisor`, `TipoNorma`); el resto del código (servicios, handlers, controladores, métodos) en **inglés**.
- Tablas PostgreSQL en `snake_case`. Mapeo explícito en EF Core (configuraciones por entidad, nunca atributos de mapeo salvo excepciones justificadas).
- UI en **español (es-AR)**.
- Configuración por variables de entorno. Nada de secretos en el repo. `.env.example` documenta las variables.
- SQL de búsqueda con **Dapper y SQL explícito** (no LINQ para búsquedas full-text). EF Core para escritura y migraciones.
- El SQL crudo (configuraciones de texto, índices GIN) va en migraciones EF con `migrationBuilder.Sql(...)`.

## Reglas de dominio clave (no romper)

1. Las normas con visibilidad `reservada` o `interna` **jamás** aparecen en endpoints públicos, facetas, sugerencias ni conteos. Hay tests de no fuga.
2. El PDF original firmado es inmutable: nunca se sobrescribe, el OCR genera un archivo derivado con `rol = ocr`.
3. Nada se publica sin confirmación humana (flujo `borrador → procesando → en_revision → publicada → archivada`).
4. El worker trata los PDFs como entrada no confiable: nombres de archivo generados por el sistema, timeout por proceso, usuario sin privilegios.
5. Búsqueda sobre texto plano por fragmento (columnas tsvector), nunca sobre HTML.

## Commits y PRs

- Mensajes en español, imperativo, primera línea ≤ 72 caracteres.
- CI: build con `--warnaserror` + tests + build de frontend. Todo debe estar verde antes de pushear.
