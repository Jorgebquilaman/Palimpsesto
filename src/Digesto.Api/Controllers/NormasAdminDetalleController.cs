using Digesto.Application.Archivos;
using Digesto.Application.Ingesta;
using Digesto.Domain.Entidades;
using Digesto.Domain.Enums;
using Digesto.Infrastructure;
using Digesto.Infrastructure.Persistencia;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Digesto.Api.Controllers;

[ApiController]
[Route("api/v1/admin/normas")]
[Authorize(Roles = "admin,editor")]
public class NormasAdminDetalleController : ControllerBase
{
    private readonly DigestoDbContext _db;
    private readonly IFileStorage _fileStorage;

    public NormasAdminDetalleController(DigestoDbContext db, IFileStorage fileStorage)
    {
        _db = db;
        _fileStorage = fileStorage;
    }

    [HttpGet]
    public async Task<IActionResult> Listado(
        [FromQuery] string? estado,
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        CancellationToken ct = default)
    {
        var query = _db.Normas
            .AsNoTracking()
            .Include(n => n.TipoNorma)
            .Include(n => n.OrganoEmisor)
            .AsQueryable();

        if (Enum.TryParse<EstadoPublicacion>(estado?.Replace("_", ""), ignoreCase: true, out var estadoEnum))
        {
            query = query.Where(n => n.EstadoPublicacion == estadoEnum);
        }
        if (!string.IsNullOrWhiteSpace(q))
        {
            query = query.Where(n => EF.Functions.ILike(n.Titulo, $"%{q}%"));
        }

        var total = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(n => n.CreadoEn)
            .Skip((Math.Max(1, page) - 1) * 50)
            .Take(50)
            .Select(n => new
            {
                n.Id,
                n.CodigoNormalizado,
                Tipo = n.TipoNorma.Codigo,
                Organo = n.OrganoEmisor.Nombre,
                n.Numero,
                n.Anio,
                n.Titulo,
                FechaSancion = n.FechaSancion == DateOnly.MinValue ? (DateOnly?)null : n.FechaSancion,
                Estado = EstadoSnakeFmt.EstadoSnake(n.EstadoPublicacion),
                n.Visibilidad,
                n.Vigencia,
            })
            .ToListAsync(ct);

        return Ok(new { total, items });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Detalle(Guid id, CancellationToken ct)
    {
        var norma = await _db.Normas
            .Include(n => n.TipoNorma)
            .Include(n => n.OrganoEmisor)
            .Include(n => n.Boletin)
            .Include(n => n.Archivos)
            .Include(n => n.Fragmentos.OrderBy(f => f.Orden))
            .FirstOrDefaultAsync(n => n.Id == id, ct);

        if (norma is null)
        {
            return Problem(statusCode: 404, detail: "Norma no encontrada");
        }

        return Ok(new
        {
            norma.Id,
            norma.CodigoNormalizado,
            TipoNormaId = norma.TipoNormaId,
            TipoNombre = norma.TipoNorma.Nombre,
            OrganoEmisorId = norma.OrganoEmisorId,
            OrganoNombre = norma.OrganoEmisor.Nombre,
            norma.Numero,
            norma.Anio,
            norma.Sufijo,
            norma.Titulo,
            norma.Resumen,
            norma.PalabrasClave,
            norma.Expediente,
            FechaSancion = norma.FechaSancion == DateOnly.MinValue ? (DateOnly?)null : norma.FechaSancion,
            norma.FechaPublicacion,
            norma.BoletinId,
            Vigencia = norma.Vigencia.ToString().ToLowerInvariant(),
            Visibilidad = norma.Visibilidad.ToString().ToLowerInvariant(),
            Estado = EstadoSnakeFmt.EstadoSnake(norma.EstadoPublicacion),
            TextoOrigen = norma.TextoOrigen.ToString().ToLowerInvariant(),
            Archivos = norma.Archivos.Select(a => new { a.Id, a.NombreOriginal, a.Sha256, a.Bytes, a.Paginas, Rol = a.Rol.ToString().ToLowerInvariant() }),
            Fragmentos = norma.Fragmentos.Select(f => new
            {
                f.Orden,
                Tipo = f.Tipo.ToString().ToLowerInvariant(),
                f.Etiqueta,
                f.Texto,
                f.Html,
                f.PaginaDesde,
                f.PaginaHasta,
            }),
        });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Actualizar(Guid id, [FromBody] ActualizarNormaRequest request, CancellationToken ct)
    {
        var norma = await _db.Normas.FindAsync(new object[] { id }, ct);
        if (norma is null)
        {
            return Problem(statusCode: 404, detail: "Norma no encontrada");
        }

        var antes = AuditoriaHelper.Serializar(new
        {
            norma.Numero,
            norma.Anio,
            norma.Sufijo,
            norma.Titulo,
            FechaSancion = norma.FechaSancion == DateOnly.MinValue ? (DateOnly?)null : norma.FechaSancion,
            norma.FechaPublicacion,
            norma.Resumen,
            norma.Expediente,
            norma.EstadoPublicacion,
        });

        if (request.Titulo is { Length: > 0 }) norma.Titulo = request.Titulo[..Math.Min(500, request.Titulo.Length)];
        if (request.Numero is { } numero) norma.Numero = numero;
        if (request.Anio is { } anio) norma.Anio = anio;
        if (request.Sufijo is not null) norma.Sufijo = string.IsNullOrWhiteSpace(request.Sufijo) ? null : request.Sufijo[..Math.Min(10, request.Sufijo.Length)];
        if (request.TipoNormaId is { } tipoId) norma.TipoNormaId = tipoId;
        if (request.OrganoEmisorId is { } organoId) norma.OrganoEmisorId = organoId;
        if (request.FechaSancion is { } fs) norma.FechaSancion = fs;
        if (request.FechaPublicacion is { } fp) norma.FechaPublicacion = fp;
        if (request.Resumen is not null) norma.Resumen = request.Resumen;
        if (request.PalabrasClave is not null) norma.PalabrasClave = request.PalabrasClave;
        if (request.Expediente is not null) norma.Expediente = request.Expediente[..Math.Min(50, request.Expediente.Length)];
        if (request.Visibilidad is { } vis) norma.Visibilidad = vis;
        if (request.Vigencia is { } vig) norma.Vigencia = vig;

        norma.ActualizadoEn = DateTime.UtcNow;
        norma.ActualizadoPor = User.Identity?.Name ?? "desconocido";

        var despues = AuditoriaHelper.Serializar(new
        {
            norma.Numero,
            norma.Anio,
            norma.Sufijo,
            norma.Titulo,
            FechaSancion = norma.FechaSancion == DateOnly.MinValue ? (DateOnly?)null : norma.FechaSancion,
            norma.FechaPublicacion,
            norma.Resumen,
            norma.Expediente,
            norma.EstadoPublicacion,
        });

        _db.Auditorias.Add(new Auditoria
        {
            Usuario = User.Identity?.Name ?? "desconocido",
            Entidad = "norma",
            EntidadId = norma.Id.ToString(),
            Accion = "actualizar",
            Antes = antes,
            Despues = despues,
        });

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return Problem(statusCode: 409, detail: "Ya existe una norma con ese tipo, órgano, número y año");
        }
        return Ok(new { norma.Id, norma.EstadoPublicacion });
    }

    [HttpGet("{id:guid}/pdf")]
    public async Task<IActionResult> PdfBorrador(Guid id, CancellationToken ct)
    {
        var archivo = await _db.NormasArchivos
            .AsNoTracking()
            .Where(a => a.NormaId == id && a.Rol == Domain.Enums.RolArchivo.Original)
            .Select(a => new { a.StorageKey, a.NombreOriginal })
            .FirstOrDefaultAsync(ct);

        if (archivo is null)
        {
            return Problem(statusCode: 404, detail: "PDF no disponible");
        }

        try
        {
            var stream = await _fileStorage.AbrirAsync(archivo.StorageKey, ct);
            return File(stream, "application/pdf", archivo.NombreOriginal, enableRangeProcessing: true);
        }
        catch (FileNotFoundException)
        {
            return Problem(statusCode: 404, detail: "El archivo físico no está disponible en el almacenamiento; reprocesá la norma");
        }
        catch (DirectoryNotFoundException)
        {
            return Problem(statusCode: 404, detail: "El archivo físico no está disponible en el almacenamiento; reprocesá la norma");
        }
    }

    [HttpPost("{id:guid}/fragmentos")]
    public async Task<IActionResult> AgregarFragmento(Guid id, [FromBody] FragmentoNuevoRequest request, CancellationToken ct)
    {
        var norma = await _db.Normas.FindAsync(new object[] { id }, ct);
        if (norma is null)
        {
            return Problem(statusCode: 404, detail: "Norma no encontrada");
        }

        if (string.IsNullOrWhiteSpace(request.Texto))
        {
            return Problem(statusCode: 400, detail: "El texto del fragmento es obligatorio");
        }

        var ultimo = await _db.NormasFragmentos
            .Where(f => f.NormaId == id)
            .OrderByDescending(f => f.Orden)
            .Select(f => (int?)f.Orden)
            .FirstOrDefaultAsync(ct);

        _db.NormasFragmentos.Add(new NormaFragmento
        {
            NormaId = id,
            Orden = (ultimo ?? 0) + 1,
            Tipo = TipoFragmento.Pagina,
            Etiqueta = string.IsNullOrWhiteSpace(request.Etiqueta) ? null : request.Etiqueta[..Math.Min(100, request.Etiqueta.Length)],
            Texto = request.Texto,
        });

        if (norma.EstadoPublicacion is EstadoPublicacion.Borrador or EstadoPublicacion.Procesando)
        {
            norma.EstadoPublicacion = EstadoPublicacion.EnRevision;
        }

        _db.Auditorias.Add(new Auditoria
        {
            Usuario = User.Identity?.Name ?? "desconocido",
            Entidad = "norma_fragmento",
            EntidadId = norma.Id.ToString(),
            Accion = "agregar_texto",
        });

        await _db.SaveChangesAsync(ct);
        return Ok(new { norma.Id });
    }

    [HttpPut("{id:guid}/fragmentos")]
    public async Task<IActionResult> ActualizarFragmentos(Guid id, [FromBody] List<FragmentoEditado> fragmentos, CancellationToken ct)
    {
        var norma = await _db.Normas.FindAsync(new object[] { id }, ct);
        if (norma is null)
        {
            return Problem(statusCode: 404, detail: "Norma no encontrada");
        }

        var existentes = await _db.NormasFragmentos.Where(f => f.NormaId == id).OrderBy(f => f.Orden).ToListAsync(ct);
        var sanitizador = new Digesto.Infrastructure.Ingesta.SanitizadorHtml();

        var orden = 1;
        foreach (var editado in fragmentos)
        {
            var existente = existentes.FirstOrDefault(f => f.Orden == editado.Orden);
            if (existente is null)
            {
                continue;
            }
            if (!string.IsNullOrWhiteSpace(editado.Texto)) existente.Texto = editado.Texto;
            if (editado.Html is not null) existente.Html = sanitizador.Sanitizar(editado.Html);
            if (editado.Etiqueta is not null) existente.Etiqueta = editado.Etiqueta;
            existente.Orden = orden++;
        }

        norma.ActualizadoEn = DateTime.UtcNow;
        norma.ActualizadoPor = User.Identity?.Name ?? "desconocido";

        _db.Auditorias.Add(new Auditoria
        {
            Usuario = User.Identity?.Name ?? "desconocido",
            Entidad = "norma_fragmento",
            EntidadId = norma.Id.ToString(),
            Accion = "editar_texto",
        });

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return Problem(statusCode: 409, detail: "No se pudieron guardar los fragmentos");
        }
        return Ok(new { norma.Id, cantidad = fragmentos.Count });
    }

    [HttpPost("{id:guid}/publicar")]
    public async Task<IActionResult> Publicar(Guid id, CancellationToken ct) =>
        await CambiarEstado(id, EstadoPublicacion.Publicada, ct);

    [HttpPost("{id:guid}/despublicar")]
    public async Task<IActionResult> Despublicar(Guid id, CancellationToken ct) =>
        await CambiarEstado(id, EstadoPublicacion.EnRevision, ct);

    [HttpPost("{id:guid}/archivar")]
    public async Task<IActionResult> Archivar(Guid id, CancellationToken ct) =>
        await CambiarEstado(id, EstadoPublicacion.Archivada, ct);

    [HttpPost("{id:guid}/limpiar")]
    public async Task<IActionResult> Limpiar(Guid id, CancellationToken ct)
    {
        var norma = await _db.Normas.FindAsync(new object[] { id }, ct);
        if (norma is null)
        {
            return Problem(statusCode: 404, detail: "Norma no encontrada");
        }

        norma.Numero = 0;
        norma.Sufijo = null;
        norma.Titulo = string.Empty;
        norma.Resumen = null;
        norma.PalabrasClave = null;
        norma.Expediente = null;
        norma.FechaSancion = DateOnly.MinValue;
        norma.Vigencia = Vigencia.Vigente;

        var fragmentos = await _db.NormasFragmentos
            .Where(f => f.NormaId == id)
            .ToListAsync(ct);
        _db.NormasFragmentos.RemoveRange(fragmentos);

        norma.ActualizadoEn = DateTime.UtcNow;
        norma.ActualizadoPor = User.Identity?.Name ?? "desconocido";

        _db.Auditorias.Add(new Auditoria
        {
            Usuario = User.Identity?.Name ?? "desconocido",
            Entidad = "norma",
            EntidadId = norma.Id.ToString(),
            Accion = "limpiar_datos",
        });

        await _db.SaveChangesAsync(ct);
        return Ok(new { norma.Id });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Eliminar(Guid id, CancellationToken ct)
    {
        var norma = await _db.Normas
            .Include(n => n.Archivos)
            .Include(n => n.Fragmentos)
            .FirstOrDefaultAsync(n => n.Id == id, ct);
        if (norma is null)
        {
            return Problem(statusCode: 404, detail: "Norma no encontrada");
        }

        var relaciones = await _db.NormasRelaciones
            .Where(r => r.NormaOrigenId == id || r.NormaDestinoId == id)
            .ToListAsync(ct);
        _db.NormasRelaciones.RemoveRange(relaciones);

        var claves = norma.Archivos.Select(a => a.StorageKey).ToList();
        _db.NormasArchivos.RemoveRange(norma.Archivos);
        _db.NormasFragmentos.RemoveRange(norma.Fragmentos);
        _db.Normas.Remove(norma);

        _db.Auditorias.Add(new Auditoria
        {
            Usuario = User.Identity?.Name ?? "desconocido",
            Entidad = "norma",
            EntidadId = norma.Id.ToString(),
            Accion = "eliminar",
            Antes = norma.CodigoNormalizado,
        });

        await _db.SaveChangesAsync(ct);

        foreach (var clave in claves)
        {
            await _fileStorage.EliminarAsync(clave, ct);
        }

        return NoContent();
    }

    private async Task<IActionResult> CambiarEstado(Guid id, EstadoPublicacion destino, CancellationToken ct)
    {
        var norma = await _db.Normas.FindAsync(new object[] { id }, ct);
        if (norma is null)
        {
            return Problem(statusCode: 404, detail: "Norma no encontrada");
        }

        if (destino == EstadoPublicacion.Publicada)
        {
            if (norma.EstadoPublicacion == EstadoPublicacion.Publicada)
            {
                return Ok(new { norma.Id, Estado = "publicada" });
            }
            if (norma.EstadoPublicacion != EstadoPublicacion.EnRevision)
            {
                return Problem(statusCode: 409, detail: "Solo se puede publicar una norma en revisión");
            }
        }

        _db.Auditorias.Add(new Auditoria
        {
            Usuario = User.Identity?.Name ?? "desconocido",
            Entidad = "norma",
            EntidadId = norma.Id.ToString(),
            Accion = $"estado_{destino}",
            Antes = norma.EstadoPublicacion.ToString(),
            Despues = destino.ToString(),
        });

        norma.EstadoPublicacion = destino;
        norma.ActualizadoEn = DateTime.UtcNow;
        norma.ActualizadoPor = User.Identity?.Name ?? "desconocido";
        await _db.SaveChangesAsync(ct);

        return Ok(new { norma.Id, Estado = destino.ToString().ToLowerInvariant() });
    }
}

public record ActualizarNormaRequest(
    string? Titulo,
    int? Numero,
    short? Anio,
    string? Sufijo,
    int? TipoNormaId,
    int? OrganoEmisorId,
    DateOnly? FechaSancion,
    DateOnly? FechaPublicacion,
    string? Resumen,
    string[]? PalabrasClave,
    string? Expediente,
    Visibilidad? Visibilidad,
    Vigencia? Vigencia);

public record FragmentoEditado(int Orden, string? Etiqueta, string Texto, string? Html);
public record FragmentoNuevoRequest(string Texto, string? Etiqueta);

internal static class EstadoSnakeFmt
{
    public static string EstadoSnake(EstadoPublicacion estado) => estado switch
    {
        EstadoPublicacion.EnRevision => "en_revision",
        _ => estado.ToString().ToLowerInvariant(),
    };
}
