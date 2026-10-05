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

## Hito 1 — Modelo y catálogos

**2026-10-04 — Identity tables mapeadas a tablas snake_case propias (`usuarios`, `roles`, etc.).**
`IdentityDbContext.OnModelCreating` sobreescribe `ToTable` si se invoca después del base, así que las renombres se aplican tras `base.OnModelCreating(...)`. Las columnas internas de Identity quedan snake_case vía `UseSnakeCaseNamingConvention()` (EFCore.NamingConventions), que convierte cualquier columna no configurada explícitamente.

**2026-10-04 — `UsuarioApp` en Infrastructure, no en Domain.**
`IdentityUser` arrastra dependencias de ASP.NET Identity; Domain debe ser puro. Compromiso aceptado: la entidad de usuario no es parte del dominio digesto sino de la plataforma.

**2026-10-04 — `f_unir(text[])` inmutable para `tsv_meta`.**
`array_to_string` es STABLE y PostgreSQL rechaza expresiones no-inmutables en columnas generadas. Se envolvió en una función SQL IMMUTABLE. Mismo patrón estará disponible si el generador de `tsv_meta` crece.

**2026-10-04 — Migración + seed automáticos al arrancar la API.**
Un hosted-block en `Program.cs` hace `MigrateAsync()` + `SeedDigesto` antes de servir tráfico. El requisito "docker compose up en máquina limpia" lo pide; alternativo (migrador como entrypoint separado) se descartó por simplificar el flujo de desarrollo. En producción se puede desacoplar con la misma lógica en un job.

**2026-10-04 — Configuración de JWT centralizada en `TokenOptions` (IOptions).**
Program.cs resuelve config/env una sola vez con un default solo-dev; `TokenGenerator` valida largo ≥ 32. Evita divergencia entre el emisor y el validador del token.

**2026-10-04 — Claims estándar (`ClaimTypes.NameIdentifier`, `ClaimTypes.Name`).**
Los claim mappings de JwtBearer transforman `sub`/`unique_name`; emitir directamente los tipos largos evita sorpresas al resolver `User.FindFirstValue(...)`.

**2026-10-04 — Testcontainers en cada clase de fixture.**
`MigracionYBusquedaFixture` levanta un postgres:16-alpine por corrida de clase (poco más de 1 s). Compartir contenedor entre clases complica el orden de tests; el costo es bajo para el volumen esperado.

## Hito 2 — Ingesta con texto nativo

**2026-10-04 — PDF de prueba generado programáticamente (`PdfFabrica`).**
Se construye un PDF 1.4 mínimo (Catalog/Pages/Page/Font/ContentStream con `Tj`) con codificación WinAnsi y escapes octales para acentos. Evita dependencias de librerías de generación de PDF para fixtures y funciona igual en local (poppler de Homebrew) y en CI (apt poppler-utils).

**2026-10-04 — `IFileStorage.Root` expuesto como propiedad de la interfaz.**
El pipeline necesita la ruta absoluta para pasarla a `pdfinfo`/`pdftotext`; sin `Root` cada componente resolvía su propia raíz por separado y divergían. Alternativa descartada: inyectar `FileStorageLocal` concreto (acopla a la implementación local).

**2026-10-04 — Sugerencias de metadatos se aplican sobre la norma borrador, no sobre un campo aparte.**
La pantalla de revisión del backoffice mostrará los valores actuales de la norma; el editor los corrige antes de publicar. Guardarlos aparte duplicaría estado. `Numero = 0` y un `codigo_normalizado` provisional único evitan romper la unicidad mientras el usuario confirma los datos reales.

**2026-10-04 — Worker reclama la cola con `UPDATE ... RETURNING id ... FOR UPDATE SKIP LOCKED`.**
Una sola sentencia atómica: reclama, marca `en_curso` y devuelve ids. Límite de 20 por ciclo para no acaparar todos los procesos.

**2026-10-04 — La validación de magic bytes corre en el upload y de nuevo en el worker.**
El upload valida el stream recibido; el worker revalida el archivo guardado (defensa en profundidad: la copia en disco es la fuente de verdad del pipeline).

**2026-10-04 — AngleSharp para el sanitizador (allowlist).**
Servidor-side con allowlist de etiquetas/atributos; DOMPurify queda para el cliente (hitos de frontend). AngleSharp 1.5.0 parchea la vulnerabilidad moderada de 1.1.x (GHSA-pgww-w46g-26qg).

## Hito 3 — Búsqueda

**2026-10-04 — `es_unaccent` y `simple_unaccent` eliminados; pre-unaccent con `f_unaccent` inmutable.**
En PostgreSQL las cadenas de diccionarios (`WITH unaccent, spanish_stem`) se cortan en el primer diccionario que devuelve lexemas: unaccent no encadena al stemmer, así que `resoluciones` (ASCII, solo spanish_stem → `resolu`) y `resolución` (word, unaccent → `resolucion` sin stem) quedaban asimétricos. Solución: vectorizar el texto pre-unacentuado con `to_tsvector('spanish', f_unaccent(texto))`, donde `f_unaccent` es IMMUTABLE (válida para columnas generadas). Además el stemmer snowball español es asimétrico para la misma palabra acentuada vs plana (`resolución`→`resolu` pero `resolucion`→`resolucion`), por lo que `tsv_es` concatena el stem del texto original (acentos incluidos) y el del texto unacentuado: las búsquedas "resoluciones", "resolucion" y "resolución" matchean.

**2026-10-04 — Consulta "cualquiera de las palabras" a mano con `to_tsquery` + `:*`.**
Las palabras se unen con `|` y sufijo `:*` (prefijo). `websearch_to_tsquery` no admite el operador OR explícito por palabra; para el modo cualquiera conviene `to_tsquery`. Se citan las palabras con `quote_literal` antes de concatenarlas.

**2026-10-04 — `ts_headline` solo sobre la página visible, con el tsquery de `spanish` sobre `f.texto`.**
El headline tokeniza el texto original; si se busca con tsquery `simple` (literal "becas") contra un vector stemmed, no matchea. Se usa el mismo tsquery de la búsqueda principal para correr `ts_rank_cd` y elegir el mejor fragmento por norma con `DISTINCT ON`.

**2026-10-04 — Citas directas: `CitaNormaParser` puro en Application con fallback a búsqueda full-text.**
Patrones admitidos: `Res. 123/2024`, `Ord 45-2023`, `RES-CS-2024-0123`. Si matchea una única norma, se devuelve directo (total=1, `codigoCitaDirecta`); si no, se degrada a búsqueda normal. Test unitario posible sin base de datos.

**2026-10-04 — El índice de unicidad es PARCIAL (`WHERE numero > 0`).**
Los borradores recién subidos se crean con `numero = 0` hasta que el revisor confirme los datos; un índice único normal haría imposible subir dos borradores. La unicidad treaty real se exige recién cuando la norma tiene su número definido.

**2026-10-04 — `palabras_clave` nullable.**
EF Core genera columnas `NOT NULL` para arrays no-nullable; texto[] tolerable pero el modelo lo trató como opcional para no forzar datos al cargar migraciones históricas.

**2026-10-04 — Migración de índices en su propio `Migration` con `Designer.cs`.**
La migración manual (sin `dotnet ef add`) solo se descubre si lleva el archivo `.Designer.cs` con `[Migration("id")]`; el atributo en el propio cuerpo no fue suficiente con el SDK. Mantengo `Inicial` (tablas) y `IndiceTexto` (extensiones + tsvectors + índices GIN + unicidad) separados para poder regenerar el modelo sin tocar el SQL crudo.

**2026-10-04 — `FileStorage:Root` por defecto es el cwd (`archivos/` bajo el directorio de ejecución).**
El pipeline necesita resolver rutas absolutas para `pdfinfo`/`pdftotext`; cada proceso (API y worker) tenía su propio default divergente. En docker-compose ambas comparten `FileStorage__Root: /data/archivos` (volumen común); en desarrollo local se exporta `FILE_STORAGE_ROOT` igual para ambos.

## Hito 4 — Frontend público

**2026-10-04 — Filtros de búsqueda viven en la URL (`useSearchParams`).**
Cada cambio de filtro es un `setParametros`: las búsquedas quedan compartibles y el back/forward del navegador funciona. TanStack Query key = querystring completa, con `placeholderData` para no flashear setState mientras se teclea.

**2026-10-04 — Snippets renderizados con `dangerouslySetInnerHTML` y confianzas acotadas.**
Los `<mark>` vienen de `ts_headline` del servidor, que escapa el texto origen; no ejecutar nada más ahí. El HTML de fragmentos, en cambio, SI pasa por `DOMPurify.sanitize` en el cliente además del sanitizador del worker (defensa en dos capas).

**2026-10-04 — Visor PDF con `pdfjs-dist` dinámico y canvas por página.**
`import('pdfjs-dist')` lazy: el bundle principal no crece (pdf.js se parte en un chunk propio de ~129 kB gzip). Worker configurado por URL del paquete (compatible con Vite). Navegación por página y zoom con re-render; para salto directo a la página del fragmento queda `data-page` en los artículos (fase 2).

**2026-10-04 — Resaltado de términos con TreeWalker + `<mark>`.**
La búsqueda previa (`?q=`) y la búsqueda dentro de la norma marcan coincidencias en el DOM ya sanitizado, sin tocar la estructura.

**2026-10-04 — `dangerouslySetInnerHTML` limitado a fragmentos: cada artículo lleva `id="art-N"` y `data-page`, generados por el worker.**
El índice lateral ancla a esos ids; el orden de los fragmentos es el del documento.

## Hito 5 — Backoffice

**2026-10-04 — El PDF de revisión se sirve por un endpoint admin aparte (`/admin/normas/{id}/pdf`).**
El endpoint público `/normas/{codigo}/pdf` exige `publicada`/`archivada`; un borrador en revisión necesita su PDF original a la vista sin publicarlo.

**2026-10-04 — `numero = 0` en borradores + índice único parcial.**
La pantalla de revisión confirma el número real; antes de eso el borrador no participa en la unicidad (índice parcial `WHERE numero > 0`). El intento de guardar metadatos que choque con otra norma devuelve 409 con mensaje claro.

**2026-10-04 — Publicación con transición explícita.**
Solo `en_revision → publicada`; despublicar deja `en_revision` (nunca borra el estado que permitiría reproceso). Cada cambio escribe en `auditoria` con antes/después serializados (jsonb text).

**2026-10-04 — Los roles `editor` y `admin` comparten backoffice; `admin` administra usuarios/catálogos.**
403 real para editor en `/admin/usuarios` y auditoría. El seed solo crea admin; el resto de usuarios se generan desde el backoffice.
