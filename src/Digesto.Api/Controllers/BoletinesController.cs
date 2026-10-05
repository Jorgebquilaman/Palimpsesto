using Digesto.Domain.Enums;
using Digesto.Infrastructure.Persistencia;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Digesto.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class BoletinesController : ControllerBase
{
    private readonly DigestoDbContext _db;

    public BoletinesController(DigestoDbContext db)
    {
        _db = db;
    }

    [HttpGet("boletines")]
    public async Task<IActionResult> Listado([FromQuery] int page = 1, CancellationToken ct = default)
    {
        var pagina = Math.Max(1, page);
        var total = await _db.Boletines.CountAsync(ct);
        var items = await _db.Boletines
            .AsNoTracking()
            .OrderByDescending(b => b.FechaPublicacion)
            .Skip((pagina - 1) * 50)
            .Take(50)
            .Select(b => new
            {
                b.Id,
                b.Numero,
                b.FechaPublicacion,
                b.Observaciones,
                TotalNormas = _db.Normas.Count(n => n.BoletinId == b.Id),
            })
            .ToListAsync(ct);

        return Ok(new { total, items });
    }

    [HttpGet("boletines/{numero}")]
    public async Task<IActionResult> Detalle(string numero, CancellationToken ct)
    {
        var boletin = await _db.Boletines
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Numero == numero, ct);

        if (boletin is null)
        {
            return Problem(statusCode: 404, detail: "Boletín no encontrado");
        }

        var normasPublicas = await _db.Normas
            .AsNoTracking()
            .Where(n => n.BoletinId == boletin.Id
                        && n.Visibilidad == Visibilidad.Publica
                        && (n.EstadoPublicacion == EstadoPublicacion.Publicada || n.EstadoPublicacion == EstadoPublicacion.Archivada))
            .OrderBy(n => n.FechaSancion)
            .Select(n => new
            {
                n.CodigoNormalizado,
                Tipo = n.TipoNorma.Codigo,
                n.Numero,
                n.Anio,
                n.Titulo,
                n.FechaSancion,
                Vigencia = n.Vigencia.ToString().ToLowerInvariant(),
            })
            .ToListAsync(ct);

        var totalNormas = await _db.Normas.CountAsync(n => n.BoletinId == boletin.Id, ct);

        return Ok(new
        {
            boletin.Id,
            boletin.Numero,
            boletin.FechaPublicacion,
            boletin.Observaciones,
            Normas = normasPublicas,
            TotalNormas = totalNormas,
        });
    }
}
