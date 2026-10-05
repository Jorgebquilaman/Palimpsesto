using Digesto.Application.Ingesta;
using Digesto.Infrastructure;
using Digesto.Infrastructure.Persistencia;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Digesto.Api.Controllers;

[ApiController]
[Route("api/v1/admin")]
[Authorize(Roles = "admin,editor")]
public class NormasAdminController : ControllerBase
{
    private readonly IIngestaService _ingestaService;
    private readonly DigestoDbContext _db;

    public NormasAdminController(IIngestaService ingestaService, DigestoDbContext db)
    {
        _ingestaService = ingestaService;
        _db = db;
    }

    [HttpPost("normas")]
    [RequestSizeLimit(500_000_000)]
    public async Task<IActionResult> Subir(List<IFormFile> archivos, CancellationToken ct)
    {
        if (archivos is null || archivos.Count == 0)
        {
            return Problem(statusCode: 400, detail: "No se recibieron archivos");
        }

        var usuario = User.Identity?.Name ?? "desconocido";
        var resultados = new List<object>();
        var errores = new List<object>();

        foreach (var archivo in archivos)
        {
            try
            {
                await using var stream = archivo.OpenReadStream();
                var creada = await _ingestaService.SubirPdfAsync(stream, archivo.FileName, usuario, ct);
                resultados.Add(new
                {
                    archivo.FileName,
                    creada.NormaId,
                    creada.ArchivoId,
                    creada.Sha256,
                    AvisoDuplicado = creada.Duplicado,
                });
            }
            catch (InvalidOperationException ex)
            {
                errores.Add(new { archivo = archivo.FileName, error = ex.Message });
            }
        }

        return StatusCode(201, new { subidos = resultados, errores });
    }

    [HttpGet("procesos")]
    public async Task<IActionResult> Procesos([FromQuery] string? estado, CancellationToken ct)
    {
        var query = _db.ProcesosIngesta
            .AsNoTracking()
            .OrderByDescending(p => p.Id)
            .AsQueryable();

        if (int.TryParse(estado, out var estadoInt) && Enum.IsDefined(typeof(Domain.Enums.EstadoProceso), estadoInt))
        {
            query = query.Where(p => p.Estado == (Domain.Enums.EstadoProceso)estadoInt);
        }

        var procesos = await query
            .Select(p => new
            {
                p.Id,
                p.NormaId,
                p.Estado,
                p.Etapa,
                p.Intentos,
                p.Error,
                p.LockedAt,
            })
            .Take(100)
            .ToListAsync(ct);

        return Ok(procesos);
    }

    [HttpPost("normas/{id:guid}/reprocesar")]
    public async Task<IActionResult> Reprocesar(Guid id, CancellationToken ct)
    {
        var proceso = await _db.ProcesosIngesta
            .Where(p => p.NormaId == id)
            .OrderByDescending(p => p.Id)
            .FirstOrDefaultAsync(ct);

        if (proceso is null)
        {
            return NotFound();
        }

        proceso.Estado = Domain.Enums.EstadoProceso.Pendiente;
        proceso.Etapa = null;
        proceso.Error = null;
        proceso.LockedAt = null;
        await _db.SaveChangesAsync(ct);
        return Accepted(new { proceso.Id, normaId = id, estado = "pendiente" });
    }
}
