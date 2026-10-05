using System.Globalization;
using System.Text;
using Digesto.Domain.Entidades;
using Digesto.Infrastructure.Persistencia;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Digesto.Api.Controllers;

[ApiController]
[Route("api/v1/admin/catalogos")]
[Authorize(Roles = "admin")]
public class CatalogosAdminController : ControllerBase
{
    private readonly DigestoDbContext _db;

    public CatalogosAdminController(DigestoDbContext db)
    {
        _db = db;
    }

    [HttpGet("tipos")]
    public async Task<IActionResult> GetTipos(CancellationToken ct) =>
        Ok(await _db.TiposNorma.AsNoTracking().OrderBy(t => t.Codigo).ToListAsync(ct));

    [HttpPost("tipos")]
    public async Task<IActionResult> CreateTipo([FromBody] CrearTipoRequest request, CancellationToken ct)
    {
        var existe = await _db.TiposNorma.AnyAsync(t => t.Codigo == request.Codigo, ct);
        if (existe)
        {
            return Problem(statusCode: 409, detail: $"Ya existe un tipo con código {request.Codigo}");
        }

        var tipo = new TipoNorma
        {
            Codigo = request.Codigo,
            Nombre = request.Nombre,
            Alcance = request.Alcance ?? "general",
            Activo = request.Activo ?? true,
        };
        _db.TiposNorma.Add(tipo);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetTipos), new { id = tipo.Id }, tipo);
    }

    [HttpPut("tipos/{id:int}")]
    public async Task<IActionResult> UpdateTipo(int id, [FromBody] CrearTipoRequest request, CancellationToken ct)
    {
        var tipo = await _db.TiposNorma.FindAsync(new object[] { id }, ct);
        if (tipo is null)
        {
            return NotFound();
        }

        tipo.Nombre = request.Nombre;
        tipo.Alcance = request.Alcance ?? tipo.Alcance;
        tipo.Activo = request.Activo ?? tipo.Activo;
        await _db.SaveChangesAsync(ct);
        return Ok(tipo);
    }

    [HttpDelete("tipos/{id:int}")]
    public async Task<IActionResult> DeactivateTipo(int id, CancellationToken ct)
    {
        var tipo = await _db.TiposNorma.FindAsync(new object[] { id }, ct);
        if (tipo is null)
        {
            return NotFound();
        }

        tipo.Activo = false;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("organos")]
    public async Task<IActionResult> GetOrganos(CancellationToken ct) =>
        Ok(await _db.OrganosEmisores.AsNoTracking().OrderBy(o => o.Codigo).ToListAsync(ct));

    [HttpPost("organos")]
    public async Task<IActionResult> CreateOrgano([FromBody] CrearOrganoRequest request, CancellationToken ct)
    {
        var existe = await _db.OrganosEmisores.AnyAsync(o => o.Codigo == request.Codigo, ct);
        if (existe)
        {
            return Problem(statusCode: 409, detail: $"Ya existe un órgano con código {request.Codigo}");
        }

        var organo = new OrganoEmisor
        {
            Codigo = request.Codigo,
            Nombre = request.Nombre,
            PadreId = request.PadreId,
            Activo = request.Activo ?? true,
        };
        _db.OrganosEmisores.Add(organo);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetOrganos), new { id = organo.Id }, organo);
    }

    [HttpPut("organos/{id:int}")]
    public async Task<IActionResult> UpdateOrgano(int id, [FromBody] CrearOrganoRequest request, CancellationToken ct)
    {
        var organo = await _db.OrganosEmisores.FindAsync(new object[] { id }, ct);
        if (organo is null)
        {
            return NotFound();
        }

        organo.Nombre = request.Nombre;
        organo.PadreId = request.PadreId;
        organo.Activo = request.Activo ?? organo.Activo;
        await _db.SaveChangesAsync(ct);
        return Ok(organo);
    }

    [HttpDelete("organos/{id:int}")]
    public async Task<IActionResult> DeactivateOrgano(int id, CancellationToken ct)
    {
        var organo = await _db.OrganosEmisores.FindAsync(new object[] { id }, ct);
        if (organo is null)
        {
            return NotFound();
        }

        organo.Activo = false;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("materias")]
    public async Task<IActionResult> GetMaterias(CancellationToken ct) =>
        Ok(await _db.Materias.AsNoTracking().OrderBy(m => m.Nombre).ToListAsync(ct));

    [HttpPost("materias")]
    public async Task<IActionResult> CreateMateria([FromBody] CrearMateriaRequest request, CancellationToken ct)
    {
        var slug = request.Slug ?? SlugHelper.Slugificar(request.Nombre);
        var existe = await _db.Materias.AnyAsync(m => m.Slug == slug, ct);
        if (existe)
        {
            return Problem(statusCode: 409, detail: $"Ya existe una materia con slug {slug}");
        }

        var materia = new Materia
        {
            Nombre = request.Nombre,
            Slug = slug,
            PadreId = request.PadreId,
        };
        _db.Materias.Add(materia);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetMaterias), new { id = materia.Id }, materia);
    }
}

public record CrearTipoRequest(string Codigo, string Nombre, string? Alcance, bool? Activo);
public record CrearOrganoRequest(string Codigo, string Nombre, int? PadreId, bool? Activo);
public record CrearMateriaRequest(string Nombre, string? Slug, int? PadreId);

public static class SlugHelper
{
    public static string Slugificar(string texto)
    {
        var formD = texto.ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in formD)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }
            sb.Append(c);
        }
        return sb.ToString().Replace(' ', '-');
    }
}
