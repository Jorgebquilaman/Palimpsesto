# Manual de uso

Paso a paso para usar el sitio público y el backoffice de Digesto Normativo IUPA.

## Parte 1: sitio público

### Buscar normas

1. Entrar a la página principal (`/`).
2. Escribir texto libre en el buscador y presionar Enter. Se buscan normas por contenido de sus fragmentos.
3. Opciones del buscador:
   - **Modo**: `todas` (todos los términos deben aparecer), `cualquiera` (basta uno), `frase` (la frase exacta).
   - **Filtros**: número, año, tipo de norma, órgano emisor, vigencia y rango de fechas.
4. A la izquierda (o abajo en móvil) están las **facetas**: tipos, órganos, años y vigencias con cantidad de resultados. Hacer clic para refinar la búsqueda.
5. Cambiar el **orden** de resultados (por defecto, relevancia).

### Consultar una norma

Desde los resultados hacer clic en una norma para abrir su detalle (`/normas/{código}`):

- **Texto completo** ordenado por fragmentos (encabezado, visto, considerando, artículos, anexos).
- **PDF original** firmado, visualizable en pantalla y descargable.
- **Relaciones**: normas que modifica, deroga, deja sin efecto, etc. (enlaces clicables).
- **Datos**: número, año, tipo, órgano emisor, fechas, vigencia y boletín de publicación.
- Botón flotante con el **índice** de la norma en pantallas móviles.

### Boletines

En la solapa **Boletines** (`/boletin`) se puede ver el índice de boletines cargados y, dentro de uno, las normas que se publicaron en él y su PDF.

> Nota: las normas con visibilidad `interna` o `reservada` nunca aparecen en el sitio público, ni en resultados, facetas, sugerencias ni conteos.

## Parte 2: backoffice

Ingresar en `/admin` con usuario y contraseña. Ver [usuarios y roles](usuarios.md) para los permisos de cada rol.

### 2.1 Cargar una norma (editor o admin)

1. Ir a **Normas** (`/admin/normas`).
2. Arrastrar el PDF a la zona de carga (o hacer clic para elegirlo).
3. Completar los metadatos mínimos: tipo de norma, número, año, órgano emisor y fecha. La visibilidad por defecto es `publica` (cambiar a `interna`/`reservada` si corresponde).
4. Guardar: se crea la norma en estado `borrador` y se encola el proceso de ingesta.

### 2.2 Seguir el proceso de ingesta

- En **Normas** se ve el listado con el estado de cada norma y los procesos (`pendiente`, `en curso`, `ok`, `error`).
- El worker extrae el texto (nativo u OCR si es escaneado), arma los fragmentos y pasa la norma a `en_revision`.
- Si falla, la norma vuelve a `borrador` con el error anotado: se puede corregir y presionar **Reprocesar**.
- Cuando la extracción da poco texto (PDF escaneado), el sistema aplica OCR automáticamente y guarda un PDF derivado con rol `ocr`; el original firmado nunca se modifica.

### 2.3 Revisar y editar una norma

Abrir una norma desde el listado (`/admin/normas/{id}`):

- **Metadatos**: editar tipo, número, año, órgano, fechas, visibilidad, vigencia, sumario, etc. Con IA configurada, botón **Completar con IA** para autocompletar metadatos desde el texto.
- **Fragmentos**: revisar y corregir el texto extraído; se pueden crear, editar y borrar fragmentos (encabezado, visto, considerando, artículo, anexo…).
- **Relaciones**: agregar vínculos con otras normas (modifica, deroga, deja sin efecto…).
- **Acciones de estado**:
  - **Publicar**: pasa a `publicada` y aparece en el sitio público. Requiere confirmación humana: nada se publica solo.
  - **Despublicar**: vuelve a `en_revision` y deja de verse en el público.
  - **Archivar**: marca la norma como archivada; sigue visible.
  - **Limpiar**: borra metadatos y fragmentos (queda el PDF) para volver a empezar; queda auditado.
  - **Eliminar**: baja definitiva de la norma.

### 2.4 Importación masiva (editor o admin)

1. Ir a la importación masiva desde **Normas**.
2. Subir varios PDFs a la vez + un **CSV de metadatos** que asocia cada archivo con sus datos (límite total 1 GB).
3. El sistema crea una norma por PDF y encola la ingesta de todas; se sigue el avance en el listado.

### 2.5 Boletines (editor o admin)

1. Ir a **Boletines** (`/admin/boletines`).
2. Crear un boletín (número y fecha) y subir su **PDF**.
3. Las normas se vinculan a su boletín de publicación desde la edición de metadatos.

### 2.6 Catálogos (solo admin)

En **Catálogos** (`/admin/catalogos`) se administran:

- **Tipos de norma**: resolución, disposición, etc.
- **Órganos emisores**: consejo superior, rectorado, etc.
- **Materias**: jerárquicas (una materia puede tener padre).

Crear, editar, desactivar o eliminar según corresponda. Se usan en los filtros y facetas del sitio público.

### 2.7 Usuarios (solo admin)

Ver la guía de [usuarios y roles](usuarios.md).

### 2.8 Configuración de IA (solo admin)

En **IA** (`/admin/ai`):

1. Configurar el proveedor (DeepSeek) con su API key. La clave se guarda en la base de datos.
2. Botón **Probar conexión** para validar.
3. A partir de entonces, en la revisión de cada norma está disponible **Completar con IA**.

### 2.9 Auditoría (solo admin)

En **Auditoría** (`/admin/auditoria`) queda el registro de acciones relevantes (creaciones, ediciones, publicaciones, limpiezas, cambios de usuarios…), con usuario, fecha y detalle.

### 2.10 Perfil

En **Perfil** (`/admin/perfil`) cualquier usuario cambia su propia contraseña.

## Estados de una norma (resumen)

```
borrador ──(worker toma)──▶ procesando ──(ok)──▶ en_revision ──(publicar)──▶ publicada ──(archivar)──▶ archivada
    ▲                          │error               ▲
    └──────────────┴──────────┴──── despublicar ────┘
```

- Solo `publicada` y `archivada` se ven en el sitio público (y solo si su visibilidad es `publica`).
- `despublicar` regresa la norma a `en_revision`.
