using Digesto.Infrastructure.Persistencia;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Digesto.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class CatalogosController : ControllerBase
{
    private readonly DigestoDbContext _db;

    public CatalogosController(DigestoDbContext db)
    {
        _db = db;
    }

    [HttpGet("catalogos")]
    public async Task<IActionResult> Catalogos(CancellationToken ct)
    {
        var tipos = await _db.TiposNorma.AsNoTracking()
            .Where(t => t.Activo)
            .OrderBy(t => t.Codigo)
            .Select(t => new { t.Id, t.Codigo, t.Nombre, t.Alcance })
            .ToListAsync(ct);

        var organos = await _db.OrganosEmisores.AsNoTracking()
            .Where(o => o.Activo)
            .OrderBy(o => o.Codigo)
            .Select(o => new { o.Id, o.Codigo, o.Nombre, o.PadreId })
            .ToListAsync(ct);

        var anios = await _db.Normas.AsNoTracking()
            .Where(n => n.Visibilidad == Domain.Enums.Visibilidad.Publica)
            .Select(n => n.Anio)
            .Distinct()
            .OrderByDescending(a => a)
            .ToListAsync(ct);

        var vigencias = Enum.GetNames<Domain.Enums.Vigencia>()
            .Select(v => v.ToLowerInvariant())
            .ToList();

        return Ok(new { tipos, organos, anios, vigencias });
    }
}
