using Digesto.Domain.Entidades;
using Digesto.Domain.Enums;
using Digesto.Infrastructure;
using Digesto.Infrastructure.Persistencia;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Digesto.Api.Controllers;

[ApiController]
[Route("api/v1/admin")]
[Authorize(Roles = "admin,editor")]
public class RelacionesController : ControllerBase
{
    private readonly DigestoDbContext _db;

    public RelacionesController(DigestoDbContext db)
    {
        _db = db;
    }

    [HttpPost("normas/{id:guid}/relaciones")]
    public async Task<IActionResult> CrearRelacion(Guid id, [FromBody] CrearRelacionRequest request, CancellationToken ct)
    {
        if (request.NormaDestinoId == id)
        {
            return Problem(statusCode: 400, detail: "Una norma no puede relacionarse consigo misma");
        }

        var existeDestino = await _db.Normas.AnyAsync(n => n.Id == request.NormaDestinoId, ct);
        if (!existeDestino)
        {
            return Problem(statusCode: 404, detail: "Norma destino no encontrada");
        }

        var existe = await _db.NormasRelaciones.AnyAsync(
            r => r.NormaOrigenId == id && r.NormaDestinoId == request.NormaDestinoId && r.Tipo == request.Tipo, ct);
        if (existe)
        {
            return Problem(statusCode: 409, detail: "Ya existe esa relación");
        }

        var relacion = new NormaRelacion
        {
            NormaOrigenId = id,
            NormaDestinoId = request.NormaDestinoId,
            Tipo = request.Tipo,
            Detalle = request.Detalle,
        };
        _db.NormasRelaciones.Add(relacion);
        await _db.SaveChangesAsync(ct);

        _db.Auditorias.Add(new Auditoria
        {
            Usuario = User.Identity?.Name ?? "desconocido",
            Entidad = "norma_relacion",
            EntidadId = id.ToString(),
            Accion = $"relacion_{request.Tipo}",
            Despues = AuditoriaHelper.Serializar(new { request.NormaDestinoId, tipo = request.Tipo.ToString(), request.Detalle }),
        });
        await _db.SaveChangesAsync(ct);

        return Created($"/api/v1/normas/{id}/relaciones", new { relacion.Id, relacion.Tipo, relacion.Detalle });
    }

    [HttpDelete("relaciones/{idRelacion:long}")]
    public async Task<IActionResult> EliminarRelacion(long idRelacion, CancellationToken ct)
    {
        var relacion = await _db.NormasRelaciones.FindAsync(new object[] { idRelacion }, ct);
        if (relacion is null)
        {
            return NotFound();
        }

        _db.NormasRelaciones.Remove(relacion);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("boletines")]
    public async Task<IActionResult> CrearBoletin([FromBody] CrearBoletinRequest request, CancellationToken ct)
    {
        var existe = await _db.Boletines.AnyAsync(b => b.Numero == request.Numero, ct);
        if (existe)
        {
            return Problem(statusCode: 409, detail: "Ya existe un boletín con ese número");
        }

        var boletin = new Boletin
        {
            Numero = request.Numero,
            FechaPublicacion = request.FechaPublicacion,
            Observaciones = request.Observaciones,
        };
        _db.Boletines.Add(boletin);
        await _db.SaveChangesAsync(ct);
        return StatusCode(201, new { boletin.Id, boletin.Numero, boletin.FechaPublicacion });
    }

    [HttpDelete("boletines/{id:int}")]
    public async Task<IActionResult> EliminarBoletin(int id, CancellationToken ct)
    {
        var enUso = await _db.Normas.AnyAsync(n => n.BoletinId == id, ct);
        if (enUso)
        {
            return Problem(statusCode: 409, detail: "Hay normas asignadas a ese boletín");
        }

        var boletin = await _db.Boletines.FindAsync(new object[] { id }, ct);
        if (boletin is null)
        {
            return NotFound();
        }

        _db.Boletines.Remove(boletin);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

public record CrearRelacionRequest(Guid NormaDestinoId, TipoRelacion Tipo, string? Detalle);
public record CrearBoletinRequest(string Numero, DateOnly FechaPublicacion, string? Observaciones);
