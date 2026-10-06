# Usuarios y roles

Guía sobre los usuarios del sistema: qué roles existen, qué puede hacer cada uno y cómo administrarlos.

## Roles

| Rol | Alcance |
|---|---|
| **admin** | Acceso completo: usuarios, catálogos, auditoría, configuración de IA, estadísticas y todo lo del editor. |
| **editor** | Gestión del contenido: normas (carga, edición, fragmentos, relaciones, publicar, archivar, eliminar), boletines, importación masiva, procesos de ingesta y estadísticas. |
| **revisor** | Rol disponible para futuras tareas de revisión; actualmente sin secciones propias del backoffice. |

Cada usuario tiene exactamente un rol. La autenticación es por usuario y contraseña con token JWT.

## Crear y editar usuarios

Solo un `admin` lo puede hacer, desde el backoffice en **Admin → Usuarios** (`/admin/usuarios`).

### Crear un usuario

1. Ingresar al backoffice con una cuenta `admin`.
2. Ir a **Usuarios**.
3. Completar: usuario de acceso, nombre, contraseña inicial y rol.
4. Guardar. El usuario ya puede iniciar sesión.

### Editar un usuario

- Desde el listado se puede editar en línea el nombre, el rol y la contraseña, o dar de baja/reactivar el usuario.
- Cambiar el rol toma efecto en el próximo inicio de sesión del usuario.

### Bloqueo

- Un admin puede bloquear un usuario: pierde el acceso inmediatamente sin borrar su cuenta ni su historia.
- Desbloquear restaura el acceso.

## Contraseña propia

Cada usuario (de cualquier rol) puede cambiar su propia contraseña desde **Perfil** (`/admin/perfil`), ingresando la contraseña actual y la nueva dos veces.

Buena práctica: si se reenvió una contraseña inicial por correo o chat, pedir al usuario que la cambie al primer ingreso.

## Usuario inicial (seed)

- Al primer arranque el sistema siembra el usuario **admin**.
- Su contraseña inicial viene de la variable `SEED_ADMIN_PASSWORD` (en desarrollo es `Iupa2026!`).
- **En producción: cambiar esa contraseña inmediatamente después del primer ingreso** y no dejar la variable con valores por defecto.

## Qué ve cada rol en el backoffice

| Sección | admin | editor | revisor |
|---|---|---|---|
| Normas (listado, carga, revisión, publicación) | ✔ | ✔ | — |
| Boletines | ✔ | ✔ | — |
| Importación masiva | ✔ | ✔ | — |
| Procesos de ingesta | ✔ | ✔ | — |
| Estadísticas de búsquedas | ✔ | ✔ | — |
| Usuarios | ✔ | — | — |
| Catálogos (tipos, órganos, materias) | ✔ | — | — |
| Auditoría | ✔ | — | — |
| Configuración de IA | ✔ | — | — |
| Perfil (cambiar contraseña propia) | ✔ | ✔ | ✔ |
