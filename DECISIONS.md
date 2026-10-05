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

## Hito 6 — OCR, endurecimiento e importador

**2026-10-04 — OCR como derivado con `ocrmypdf` via `IOcrServicio` inyectable.**
El pipeline detecta PDF escaneado por promedio de caracteres alfabéticos/página y corre `ocrmypdf -l spa --skip-text --deskew --rotate-pages`; el resultado se guarda como `norma_archivo` con `rol = ocr` (el original firmado jamás se toca). `IOcrServicio` es una interfaz para poder testear el camino OCR sin instalar tesseract (test E2E sustituye el servicio).

**2026-10-04 — Worker sandbox en docker-compose.**
Red `backend` marcadamente `internal: true` (sin salida a Internet), usuario no-root en el Dockerfile, `pids_limit`, `mem_limit`/`cpus`, `tmpfs` para el trabajo de OCR, `no-new-privileges`. Timeout por proceso en `ProcesoRunner` (kill del árbol completo al agotarse).

**2026-10-04 — Importador masivo un solo CSV + archivos en multipart.**
`POST /admin/importar` con `csv` + `archivos[]`. Parso RFC4180 básico (comillas dobles escapadas). Columnas: `archivo,tipo,numero,anio,sufijo,titulo,fecha_sancion,fecha_publicacion,visibilidad,vigencia,resumen,expediente,palabras_clave` (`;` separa palabras clave). Cada fila: norma en borrador (a revisión como el resto; nada se publica sin confirmación humana) + `proceso_ingesta` pendiente para que el worker genere texto/fragmentos con los metadatos RESPECTADOS (no sobrescritos por las heurísticas cuando el CSV trae datos). `ANALYZE` corre al final para recomputar estadísticas del planificador.

## Hito 7 — Relaciones, vigencia y boletín

**2026-10-04 — El listado del boletín respeta visibilidad y estado.**
`GET /boletines/{numero}` detalle cuenta TODAS las normas del boletín pero lista solo las públicas (publicada/archivada): el editorial puede ver cuántas reservadas hay sin exponerlas. Test de no fuga para ese endpoint.

**2026-10-04 — Relaciones: tripla única (origen, destino, tipo).**
El índice único de la migración inicial mata el duplicado a nivel SQL. Añadir la misma relación devuelve 409; distintas relaciones (modifica + deroga entre las mismas pares) sí son válidas.

**2026-10-04 — Eliminar boletín con normas en uso rechaza (409) en vez de desasociar en cascada.**
Evita perder el agrupamiento histórico por accidente.

## Hito 8 — Pulido y benchmark

**2026-10-04 — `ranking` CTE acotado a 800 (`ORDER BY rank DESC LIMIT 800`).**
La unión de candidatos puede devolver decenas de miles de filas; ordenar/avisar por ranking con 50k es el cuello del plan. Con límite de 800 suficiente para paginación (pageSize ≤ 50 × decenas de páginas) el p95 baja de > 3 s a ~100 ms.

**2026-10-04 — Benchmark sintético con distribución Zipf: palabras distintivas ~8%, fondo gibberish.**
Un generador donde TODO matchea todo infla el p95 (> 3 s) sin representar la realidad de un digesto. Las referencias con 50k/250k: p50 3 ms, p95 100 ms, máximo 161 ms.

**2026-10-04 — `pg_prewarm` instalado en la migración y usado por la herramienta.**
El heap de `norma_fragmento` es ~350 MB: warmear los índices y la tabla en el arranque del benchmark quita ruido E/S de la primera pasada (Docker Desktop en Mac tiene E/S de bloque lenta).

**2026-10-04 — Red `backend` interna sin pasar por redes menores: postgres se conecta a ambas.**
Un contenedor con una única red `internal: true` no publica puertos al host — Docker lo descarta silenciosamente. Postgres necesita el puerto para desarrollo, así que participa de `backend` (interno) y `frontend`. El worker sigue aislado (solo backend, sin salida).

**2026-10-04 — `consulta_busqueda` se llena en cada búsqueda pública y `GET /admin/estadisticas/busquedas` expone populares + sin resultados.**
Anonimizado por diseño (sin usuario ni IP). El log es la base para las alertas Fase 2 y alimenta el panel de estadísticas del backoffice.

## Ajustes finales (post-hito 8)

**2026-10-05 — Docker: restore por csproj, no por slnx.**
El SDK 8.0 en contenedor no reconoce `.slnx` (formato del SDK 10 de la máquina local). Los Dockerfiles restauran por los csproj con capa cacheada por proyecto (patrón de restore parcial + `COPY src/ .`), compilación en `/f` para evitar el duplicado `/src/src`. Además `.dockerignore` no debe excluir `docker/` (nginx.conf es necesario en la imagen de web) ni el `.slnx`.

**2026-10-05 — `FileStorage__Root` con precedencia explícita (env → config → FILE_STORAGE_ROOT).**
`builder.Configuration["FileStorage:Root"]` no ve la env var `FileStorage__Root` en contenedor por el orden de providers en producción; se resuelvo en ese orden explícito en Api y Worker para garantizar la misma raíz compartida en el volumen `archivos`.

**2026-10-05 — `mysql no eran mysql: registro de consultas con DBNull.**
Dapper no acepta `DBNull.Value` para parámetros anónimos; envuelve en cast `(object)` correctamente o usa string nula. Solo manda `NULL` si la búsqueda vino sin texto.

**2026-10-05 — Diagnóstico del compose: puertos no publicados con red `internal: true` única.**
Un contenedor con SOLO red interna no recibe `PortBindings` en el host (Docker lo descarta). Postgres está en backend+frontend para poder desarrollarlo; el worker sigue aislado.

**2026-10-05 — Criterios de aceptación validados en el stack completo:**
- Subir un PDF con texto y encontrollarlo por palabra del cuerpo con/sin acentos (y eso ya en hito 3, re-verificado en Docker con ingesta real).
- El PDF descargado keep SHA-256 idéntico al subido (`0b08cdcc06fc7b5a685f…`).
- Búsqueda p95 ≈ 100 ms con 50k normas / 250k fragmentos.
- `docker compose up -d` deja API+worker+web+postgres funcionando con seed de catálogos y usuario admin.

## Diseño visual — sistema de diseño

**Fuentes autoalojadas vía paquetes Fontsource** (fraunces variable, source-serif-4 variable, montserrat estático): quedan en node_modules/`public` del bundle de Vite, cero pedidos externos en runtime, `font-display: swap` incluido por el paquete.

**Paleta como CSS variables + `@theme inline` de Tailwind v4.** Los tokens semánticos (`--bg`, `--surface`, `--text`…) cambian bajo `.dark` (clase puesta por script inline en `index.html` para evitar FOUC, con `prefers-color-scheme` como default y toggle manual persistido). Los utilitarios de Tailwind (`bg-surface`, `text-ink`…) referencian las variables, y el modo oscuro no necesita variantes `dark:`.

**Test de contraste como pipeline del build** (`scripts/contraste.mjs`): lee el CSS, resuelve la cascada `:root`/`.dark` y valida 15 pares texto-fondo contra WCAG AA (4.5:1). Detectó 2 fallos reales (badge ámbar en claro, badges en oscuro comparados contra fondos claros); corregidos con `--modificada-texto: #7d5009` y pares por modo.

**Sombras teñidas de verde + `--highlight: inset`** en `.panel`, botones y campos: nunca negro puro. Radios 10/16/24 px mapeados al namespace `--radius-*` de Tailwind.

**Textura papel con SVG de ruido inline** (feTurbulence, ~300 bytes) tintado distinto para claro/oscuro; se apaga con `prefers-reduced-transparency` y en el backoffice (`.sin-textura`). El hero combur degradado 160° + radial + ruido `soft-light`.

**Backoffice más calma**: barra lateral verde-950 con estado activo, fondo liso crema, tablas densas; la revisión mantiene la estructura left/right ya existente.

**Print limpio**: `@media print` remueve texturas, sombras y elementos `.no-print` (cabecera, tabs, índice, acciones); `.lectura` cae a 12pt a ancho completo.

**Adorno de línea única** (`OrnamentoLinea`): trazo original, un gradiente de terracota que se disipa; usado en el hero y el estado vacío. Rombo `✦` como detalle de marca en títulos de sección, logo placeholder, sidebar y anclas al hover.

## Diseño — pase "moderna y limpia"

**Portada**: hero con ornamento de línea, título Fraunces más grande con interlineado 1.05, y tarjeta de búsqueda elevada que flota sobre el hero (-mt-8/12). El campo de texto es grande (h-12) con botón pegado; modo de búsqueda como control segmentado (radiogroup con pills, mejor que radios crudos); N°/Año/Filtros en una fila secundaria.

**Resultados**: tarjetas p-5 con código como chip verde-900, título en Source Serif con subrayado terracota solo al hover, metadatos con separadores finos, y snippet con barra lateral durazno (`border-l-2 border-barro-300`) en vez de solo fondo.

**Facetas**: de panels a listas minimal con rombo de selección, alineadas con la columna de resultados.

**Detalle de norma**: cabecera jerárquica (código → título serif → metadatos), acciones con iconos tipográficos separadas por borde, pestañas estilo subrayado (`border-b-2` con acento) en vez de "carpetas", índice lateral sticky.

**Boletín**: items de listado con fecha a la derecha (baseline), borde acento al seleccionar.

Todo con radios y colores de tokens; el contraste WCAG AA sigue pasando (15 pares) porque el pase no tocó los pares de texto/fondo validados.

## Fix — React error #310 (hooks desbalanceados)

**La consulta de relaciones en `RevisionNorma` estaba después de los `return` tempranos (`isPending`/`isError`)**: al pasar de cargando a datos, el componente renderizaba con un hook más y React cortaba con #310. Regla aplicada: TODOS los hooks arriba del componente, sin excepción; las dependencias condicionales se logran con `enabled` de TanStack Query, nunca con returns tempranos antes de hooks. Verifiqué el resto de las pantallas: ninguna tenía el patrón.

## Fix — PDF de revisión (404 + auth)

**Dos fallas encadenadas**: el front pedía `/admin/normas/{id}/pdf-admin` (endpoint inexistente; el real es `/{id}/pdf`) y, aun con la URL correcta, un `<embed src>` no manda el header `Authorization` → 401. Solución: fetch con el JWT → `blob` → `URL.createObjectURL` para el embed, con `revokeObjectURL` al desmontar (fuga de memoria evitada) y `staleTime: Infinity` (el PDF es inmutable).

**Nota de operación**: quedó comprobado que un `dotnet run` local escuchando en 5008 enmascara al contenedor Docker (produce 500 con rutas del filesystem local y confunde el diagnóstico). Al probar el stack, verificar `lsof -i :5008` o matar los `dotnet run` locales.

## Estética de la referencia (Root + Bloom / mitzi james)

**Patrones tomados (solo estilo, sin copiar logo ni ilustración):**
- Botón CTA en **pill terracota** (`.btn-acento`, `bg-acento` con texto `--on-acento` verde-950 — contraste 5.3:1, AA ok incluso en oscuro donde `--accent` pasa a barro-300). La referencia usa texto crema sobre durazno que no cumple AA; el nuestro mantiene el look con texto oscuro.
- **Hero dos columnas** (título serif izquierda + arte/valor derecha) con CTA pill; la tarjeta de búsqueda sigue flotando debajo.
- **Bandas de color alternadas** (crema → salvia `.banda-salvia` → verde oscuro) para dar ritmo: la banda de accesos rápidos usa salvia verde-700 con texto crema (6:1).
- **Headings centrados serif** para secciones (Boletín, Accesos rápidos) y headings de backoffice con rombo.
- Icons line-art simples (unicode ligeros) con acento terracota, nunca solo color.

**Par de contraste nuevo en el test**: `--on-acento/--accent` (16 pares en total).

## Fix — superposición portada + faceta de vigencia

**El hero tapaba la tarjeta de búsqueda**: el hero es `relative` y `main` estático; en CSS los elementos posicionados pintan encima de los estáticos aunque el estático venga después (por el margen negativo que los superpone). Solución: `relative z-10` en el `main` de la portada. Verificado con captura headless (Playwright) a 1280/360 px, claro y oscuro, cero scroll horizontal.

**Faceta de vigencia mostraba el int del enum** (`n.vigencia::text`); ahora el SQL mapea a los nombres (`vigente`, `derogada_parcialmente`…).

## Backoffice — menú de árbol a la izquierda

**Sidebar `fixed inset-y-0 left-0` (pegado al borde, ancho 240px, fondo verde-950)** y contenido con `padding-left` equivalente. Estructura de árbol:
- **Normas** (grupo): Listado y carga de PDFs · Procesos de ingesta (ancla `#procesos`)
- **Catálogos** (grupo): Tipos de norma · Órganos emisores · Materias (anclas `#tipos/#organos/#materias`)
- **Auditoría** y **Usuarios y roles** como hojas simples
- Pie del menú: volver al sitio público y salir

Los grupos colapsan con chevron rotado y se auto-abren si la ruta activa pertenece al grupo; la hoja activa lleva rombo `✦` y fondo crema translúcido. En móvil sigue la barra horizontal por arriba. Los anclas llevan `scroll-margin-top` para no quedar bajo nada.

## Fix — 500 al ver el PDF de un borrador

**Causa**: normivas subidas antes del fix de `FileStorage__Root` tenían el archivo físico en la raíz vieja (`archivos/` del repo, cuando la API corría con `dotnet run` local); la fila `norma_archivo` apunta a un `storage_key` que no existía en el volumen Docker. Diagnóstico por el 500 (`FileNotFoundException`).

**Recuperación**: `docker cp` de la carpeta `archivos/2026/10/` local al volumen `/data/archivos/2026/10/` del contenedor (24 archivos). Los PDFs volver a estar disponibles sin reprocesar.

**Robustez**: los dos endpoints de PDF (admin borrador y público) atrapan `FileNotFoundException`/`DirectoryNotFoundException` y responden 404 con mensaje "reprocesá la norma" en lugar de 500.

## Integración DeepSeek

**Elección de la API de DeepSeek** (compatibility API estilo OpenAI en `api.deepseek.com/chat/completions`): `deepseek-chat` como modelo default, `response_format: json_object` + `temperature: 0.1` para respuestas estructuradas estables; instrucción explícita de "no inventes datos, null si no aparece".

**Configuración en DB, no en env**: el volumen de `configuracion` (clave/valor JSON) guarda `clave_api`, `modelo` y `base_url`. La API key la carga el administrador por UI (Inteligencia artificial en el menú del backoffice) — precaución operativa: la clave está en la base del sistema, no en el repo; backups de `pg_dump` la contienen. `DEEPSEEK_API_KEY` env también funciona como fallback sin persistir.

**Flujo de "Completar con AI"** (`POST /admin/ai/normas/{id}/completar`):
1. Lee los fragmentos ya extraídos por el worker (hasta 12.000 caracteres)
2. Manda el texto + catálogos de tipos y órganos disponibles al LLM
3. Aplica los campos que el modelo devuelva (tipo, número, año, título, resumen, palabras clave, expediente, fecha, vigencia)
4. Para cada `cita` detectada (otra norma mencionada con tipo/número/año), busca la norma en la DB y crea la relación (`modifica`, `deroga`, `reglamenta`…) si no existía — `Detalle: "Detectada por AI"`
5. Responde con los campos aplicados + relaciones creadas; el front las muestra y refresca el formulario

**Test del parser**: `ParsearRespuesta` tolera cercas markdown (`\`\`\`json`), texto alrededor del JSON y claves ausentes (todo nulo). `InternalsVisibleTo` habilitado para Digesto.Tests.

El 500 en `GET /admin/ai` era la tabla `configuracion` inexistente: registré la entidad pero nunca generé la migración. Plantilla: **cada entidad nueva → migración inmediata**, el backend con modelo sin migración arranca pero explota al tocar la tabla faltante (PostgresException 42P01).
