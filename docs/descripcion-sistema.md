# Descripción del sistema

Digesto Normativo IUPA es el sistema de digesto normativo del Instituto Universitario Patagónico de las Artes: permite publicar, buscar y consultar las normas institucionales (resoluciones, estatuto, etc.) con su PDF original firmado, texto estructurado por fragmentos y búsqueda full-text.

## Para qué sirve

- **Búsqueda pública**: cualquier persona puede buscar normas por texto libre, número, año, tipo, órgano emisor, vigencia y fecha, con facetas que refinan resultados.
- **Consulta de la norma**: visor con el texto ordenado por fragmentos, descarga del PDF original firmado, relaciones con otras normas (modifica, deroga, etc.) y referencia al boletín oficial donde se publicó.
- **Backoffice**: carga de PDFs, extracción automática de texto (nativo u OCR), revisión humana, edición de metadatos y fragmentos, y publicación controlada.

## Componentes

| Componente | Tecnología | Función |
|---|---|---|
| `Digesto.Domain` | .NET 8 | Entidades y reglas de dominio (Norma, Fragmento, Boletín, etc.). Sin dependencias de frameworks. |
| `Digesto.Application` | .NET 8 | Casos de uso, DTOs, interfaces. Depende solo de Domain. |
| `Digesto.Infrastructure` | EF Core + Dapper | Persistencia: EF Core para escritura y migraciones, Dapper con SQL explícito para búsqueda full-text (tsvector). Almacenamiento de archivos. |
| `Digesto.Api` | ASP.NET Core | API pública + endpoints de administración. Autenticación JWT. |
| `Digesto.Worker` | BackgroundService | Pipeline de ingesta de PDFs: extrae texto, hace OCR si hace falta, estructura fragmentos, genera HTML. |
| `apps/web` | React + Vite + TypeScript + Tailwind | Sitio público de búsqueda/consulta y backoffice. |
| PostgreSQL 16 | Base de datos | Datos + índices GIN sobre tsvector por fragmento. |

## Flujo de vida de una norma

1. **Carga**: un editor sube el PDF (individual o importación masiva) con metadatos. La norma nace en estado `borrador`.
2. **Procesamiento**: el worker la toma, extrae el texto (nativo, u OCR con `ocrmypdf` si es escaneado) y genera fragmentos estructurados (encabezado, visto, considerando, artículos, anexos…). Estado `procesando`.
3. **Revisión**: un editor o admin verifica metadatos y fragmentos, corrige lo necesario y agrega relaciones. Estado `en_revision`.
4. **Publicación**: solo con confirmación humana (`publicar`). Estado `publicada` y visible en el sitio público.
5. **Archivo**: cuando la norma deja de tener vigencia plena se archiva; sigue visible.

Si el proceso falla, la norma queda en `borrador` con el error registrado y puede reprocesarse.

## Reglas clave de dominio

- Las normas con visibilidad `reservada` o `interna` **jamás** aparecen en endpoints públicos, facetas, sugerencias ni conteos. Hay tests de no fuga.
- El PDF original firmado es **inmutable**: nunca se sobrescribe; el OCR genera un archivo derivado con rol `ocr`.
- Nada se publica sin confirmación humana.
- El worker trata los PDFs como entrada no confiable: nombres de archivo generados por el sistema, timeout por proceso, usuario sin privilegios.
- La búsqueda se hace sobre texto plano por fragmento (columnas tsvector), nunca sobre HTML.

## Visibilidad

| Visibilidad | En el sitio público | En el backoffice |
|---|---|---|
| `publica` | Sí (si está `publicada` o `archivada`) | Sí |
| `interna` | No | Sí |
| `reservada` | No | Sí |

## Roles de usuario

- **admin**: gestión completa de usuarios, catálogos, auditoría, configuración de IA y estadísticas; además todo lo del editor.
- **editor**: gestión de normas (carga, edición, fragmentos, relaciones, publicar, archivar), boletines, importación masiva y estadísticas.
- **revisor**: rol reservado para futuras tareas de revisión; actualmente no tiene acceso a secciones del backoffice.

## Estado del proyecto

Hito 0 (andamiaje) completo; el resto de los hitos (modelo, ingesta, búsqueda, frontend, backoffice, OCR, vigencia, benchmark) en desarrollo según `README.md`.
