using Digesto.Domain.Entidades;
using Digesto.Infrastructure.Persistencia;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Digesto.Api.Controllers;

[ApiController]
[Route("api/v1/admin/bitacora")]
[Authorize(Roles = "admin,editor")]
public class BitacoraController : ControllerBase
{
    private readonly DigestoDbContext _db;

    public BitacoraController(DigestoDbContext db)
    {
        _db = db;
    }

    [HttpGet("documentos")]
    public async Task<IActionResult> Documentos(CancellationToken ct)
    {
        var normas = await _db.Normas
            .AsNoTracking()
            .Select(n => new
            {
                n.Id,
                n.CodigoNormalizado,
                n.Titulo,
                n.EstadoPublicacion,
                n.Vigencia,
                n.Visibilidad,
                n.CreadoPor,
                n.ActualizadoPor,
                n.ActualizadoEn,
                n.CreadoEn,
            })
            .ToListAsync(ct);

        var eventos = await _db.Auditorias
            .AsNoTracking()
            .Where(a => a.Entidad == "norma")
            .Select(a => new
            {
                a.EntidadId,
                a.Accion,
                a.Usuario,
                a.Fecha,
                a.Antes,
                a.NormaCodigo,
                a.NormaTitulo,
            })
            .ToListAsync(ct);

        var idsVivos = normas.Select(n => n.Id.ToString()).ToHashSet();

        var resumenPorDocumento = eventos
            .GroupBy(a => a.EntidadId)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(a => a.Fecha).ToList());

        var documentos = new List<DocumentoBitacoraDto>();

        foreach (var n in normas)
        {
            var clave = n.Id.ToString();
            resumenPorDocumento.TryGetValue(clave, out var filas);
            documentos.Add(new DocumentoBitacoraDto
            {
                Id = n.Id,
                DocumentoId = null,
                Codigo = n.CodigoNormalizado,
                Titulo = n.Titulo,
                Estado = n.EstadoPublicacion.ToString().ToLowerInvariant(),
                Vigencia = n.Vigencia.ToString().ToLowerInvariant(),
                Visibilidad = n.Visibilidad.ToString().ToLowerInvariant(),
                UltimaActividad = filas?.First().Fecha ?? n.ActualizadoEn ?? n.CreadoEn,
                UltimoUsuario = filas?.First().Usuario ?? n.ActualizadoPor ?? n.CreadoPor,
                Eventos = filas?.Count ?? 0,
                Eliminado = false,
            });
        }

        var eliminados = resumenPorDocumento.Where(r => !idsVivos.Contains(r.Key));

        foreach (var grupo in eliminados)
        {
            var filas = grupo.Value;
            var ultima = filas.First();
            var codigo = ultima.NormaCodigo
                ?? (ultima.Accion == "eliminar" ? ultima.Antes : null)
                ?? "(código no registrado)";
            var titulo = ultima.NormaTitulo ?? "(título no registrado)";

            documentos.Add(new DocumentoBitacoraDto
            {
                Id = null,
                DocumentoId = grupo.Key,
                Codigo = codigo,
                Titulo = titulo,
                Estado = "eliminado",
                Vigencia = null,
                Visibilidad = null,
                UltimaActividad = ultima.Fecha,
                UltimoUsuario = ultima.Usuario,
                Eventos = filas.Count,
                Eliminado = true,
            });
        }

        return Ok(documentos.OrderByDescending(d => d.UltimaActividad).ToList());
    }

    [HttpGet("documentos/{clave}")]
    public async Task<IActionResult> Historial(string clave, CancellationToken ct)
    {
        Guid? normaId = Guid.TryParse(clave, out var guid) ? guid : null;

        var filas = await _db.Auditorias
            .AsNoTracking()
            .Where(a => a.Entidad == "norma" && (normaId != null ? a.EntidadId == normaId.Value.ToString() : a.EntidadId == clave))
            .OrderByDescending(a => a.Id)
            .Select(a => new
            {
                a.Id,
                a.Usuario,
                a.Accion,
                a.Antes,
                a.Despues,
                a.Texto,
                a.Fecha,
                a.NormaCodigo,
                a.NormaTitulo,
            })
            .ToListAsync(ct);

        if (filas.Count == 0 && normaId != null)
        {
            var existe = await _db.Normas.AsNoTracking().AnyAsync(n => n.Id == normaId.Value, ct);
            if (!existe)
            {
                return Problem(statusCode: 404, detail: "No hay movimientos registrados para este documento");
            }
        }

        return Ok(filas);
    }

    [HttpPost("notas")]
    public async Task<IActionResult> Anotar([FromBody] NotaBitacoraRequest request, CancellationToken ct)
    {
        var texto = request.Texto?.Trim();
        if (string.IsNullOrWhiteSpace(texto))
        {
            return Problem(statusCode: 400, detail: "La nota no puede estar vacía");
        }

        string? codigo = null;
        string? titulo = null;
        var entidadId = string.Empty;

        if (request.EntidadId is { } id && id != Guid.Empty)
        {
            var norma = await _db.Normas.AsNoTracking()
                .Where(n => n.Id == id)
                .Select(n => new { n.CodigoNormalizado, n.Titulo })
                .FirstOrDefaultAsync(ct);
            if (norma is null)
            {
                return Problem(statusCode: 404, detail: "Norma no encontrada");
            }
            codigo = norma.CodigoNormalizado;
            titulo = norma.Titulo;
            entidadId = id.ToString();
        }

        var registro = new Auditoria
        {
            Usuario = User.Identity?.Name ?? "desconocido",
            Entidad = request.EntidadId is { } e && e != Guid.Empty ? "norma" : "sistema",
            EntidadId = entidadId,
            Accion = "nota",
            Texto = texto,
            NormaCodigo = codigo,
            NormaTitulo = titulo,
        };

        _db.Auditorias.Add(registro);
        await _db.SaveChangesAsync(ct);

        return StatusCode(201, new { registro.Id });
    }

    [HttpPut("notas/{id:long}")]
    public async Task<IActionResult> EditarNota(long id, [FromBody] NotaBitacoraRequest request, CancellationToken ct)
    {
        var texto = request.Texto?.Trim();
        if (string.IsNullOrWhiteSpace(texto))
        {
            return Problem(statusCode: 400, detail: "La nota no puede estar vacía");
        }

        var registro = await _db.Auditorias.FindAsync(new object[] { id }, ct);
        if (registro is null)
        {
            return Problem(statusCode: 404, detail: "Nota no encontrada");
        }
        if (registro.Accion != "nota")
        {
            return Problem(statusCode: 409, detail: "Solo se pueden editar las notas manuales");
        }

        registro.Texto = texto;
        await _db.SaveChangesAsync(ct);

        return Ok(new { registro.Id });
    }

    [HttpDelete("notas/{id:long}")]
    public async Task<IActionResult> BorrarNota(long id, CancellationToken ct)
    {
        var registro = await _db.Auditorias.FindAsync(new object[] { id }, ct);
        if (registro is null)
        {
            return Problem(statusCode: 404, detail: "Nota no encontrada");
        }
        if (registro.Accion != "nota")
        {
            return Problem(statusCode: 409, detail: "Solo se pueden borrar las notas manuales");
        }

        _db.Auditorias.Remove(registro);
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }
}

public record NotaBitacoraRequest(Guid? EntidadId, string? Texto);

public class DocumentoBitacoraDto
{
    public Guid? Id { get; set; }
    public string? DocumentoId { get; set; }
    public string Codigo { get; set; } = null!;
    public string Titulo { get; set; } = null!;
    public string Estado { get; set; } = null!;
    public string? Vigencia { get; set; }
    public string? Visibilidad { get; set; }
    public DateTime UltimaActividad { get; set; }
    public string? UltimoUsuario { get; set; }
    public int Eventos { get; set; }
    public bool Eliminado { get; set; }
}
