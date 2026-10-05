# DECISIONS.md — Registro de decisiones

Formato: fecha — decisión — por qué — alternativas descartadas.

## Hito 0 — Andamiaje

**2026-10-04 — Target framework .NET 8 (LTS) en todos los proyectos.**
El SDK instalado es .NET 10, pero el requisito es ".NET 8 o superior" y la imagen Docker runtime es 8.0. Se unificó todo a `net8.0` para que el build local, Docker y CI coincidan. Alternativa descartada: net10.0 (requeriría imágenes SDK 10 y ASP.NET OpenAPI nativo, pero pierde LTS).

**2026-10-04 — Swashbuckle en lugar de Microsoft.AspNetCore.OpenApi.**
`AddOpenApi`/`MapOpenApi` solo existen desde .NET 9; con net8.0 el paquete `Microsoft.AspNetCore.OpenApi` 8.x no expone esas extensiones. Se usa `Swashbuckle.AspNetCore` 6.9 (Swagger UI incluido en Development). Cuando se migre a .NET 9/10 se puede volver al OpenAPI nativo.

**2026-10-04 — NuGetAudit sin supresiones.**
Se detectó que `Microsoft.AspNetCore.OpenApi` 10.x arrastraba `Microsoft.OpenApi` 2.0.0 vulnerable (GHSA-v5pm-xwqc-g5wc). Al quedar en net8.0/Swashbuckle el warning desapareció. CI usa `--warnaserror`, así que cualquier regresión de audit falla el build.

**2026-10-04 — Cola de ingesta en PostgreSQL (`FOR UPDATE SKIP LOCKED`), sin RabbitMQ/Redis.**
Requisito del diseño (sección 5). Evita infraestructura extra; el volumen del digesto universitario no justifica un broker.

**2026-10-04 — Plantilla Vite react-ts con Tailwind v4 vía `@tailwindcss/vite`.**
Plugin oficial de Vite para Tailwind 4: cero postcss.config, cero tailwind.config. Menos piezas móviles.

**2026-10-04 — `.gitignore` incluye `appsettings.Development.json`.**
Precaución: si mañana alguien pone una cadena con contraseña real en desarrollo, no termina en el repo. Los valores dev por defecto viven en `appsettings.json`.

**2026-10-04 — La solución usa formato `.slnx`.**
`dotnet new sln` con SDK 10 genera `.slnx` por defecto. Es legible y soportado por SDK 9+. No se convirtió a `.sln` clásico.

**2026-10-04 — MediatR 12.4.1 en Application.**
Para separar endpoints de handlers de casos de uso desde el hito 1 (subida de PDFs, publicación, etc.). Licencia: MediatR 12 sigue siendo Apache 2.0 (el cambio de licencia comercial llega en 13).

## Pendientes de decidir

- Versión exacta de `Npgsql.EntityFrameworkCore.PostgreSQL` vs .NET 8: fijada en 8.0.x cuando se agregue el primer DbContext (hito 1).
- Testcontainers version y estrategia de imágenes para CI (hito 1).
