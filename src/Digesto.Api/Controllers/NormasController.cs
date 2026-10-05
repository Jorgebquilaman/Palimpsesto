using Digesto.Application.Busquedas;
using Digesto.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace Digesto.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class NormasController : ControllerBase
{
    private readonly IBuscadorNormas _buscador;
    private readonly ISugerenciasNormas _sugerencias;
    private readonly Digesto.Infrastructure.Persistencia.DigestoDbContext _db;
    private readonly Digesto.Application.Archivos.IFileStorage _fileStorage;

    public NormasController(
        IBuscadorNormas buscador,
        ISugerenciasNormas sugerencias,
        Digesto.Infrastructure.Persistencia.DigestoDbContext db,
        Digesto.Application.Archivos.IFileStorage fileStorage)
    {
        _buscador = buscador;
        _sugerencias = sugerencias;
        _db = db;
        _fileStorage = fileStorage;
    }

    [HttpGet("normas")]
    public async Task<IActionResult> Buscar(
        [FromQuery] int? numero,
        [FromQuery] short? anio,
        [FromQuery] int? tipoId,
        [FromQuery] int? organoId,
        [FromQuery] DateOnly? desde,
        [FromQuery] DateOnly? hasta,
        [FromQuery] string? vigencia,
        [FromQuery] string? q,
        [FromQuery] string modo = "todas",
        [FromQuery] string orden = "relevancia",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var modoBusqueda = modo switch
        {
            "cualquiera" => ModoBusqueda.Cualquiera,
            "frase" => ModoBusqueda.Frase,
            _ => ModoBusqueda.Todas,
        };

        Domain.Enums.Vigencia? vigenciaFiltro = vigencia switch
        {
            "vigente" => Domain.Enums.Vigencia.Vigente,
            "modificada" => Domain.Enums.Vigencia.Modificada,
            "derogada" => Domain.Enums.Vigencia.Derogada,
            "derogada_parcialmente" => Domain.Enums.Vigencia.DerogadaParcialmente,
            "deja_sin_efecto" => Domain.Enums.Vigencia.DejaSinEfecto,
            _ => null,
        };

        var filtros = new FiltrosBusqueda(
            q, modoBusqueda, numero, anio, tipoId, organoId, desde, hasta,
            vigenciaFiltro, orden, Math.Max(1, page), pageSize);

        var resultado = await _buscador.BuscarAsync(filtros, ct);
        return Ok(resultado);
    }

    [HttpGet("normas/{codigo}")]
    public async Task<IActionResult> Detalle(string codigo, CancellationToken ct)
    {
        var norma = await _db.Normas
            .AsNoTracking()
            .Include(n => n.TipoNorma)
            .Include(n => n.OrganoEmisor)
            .Include(n => n.Boletin)
            .Where(n => n.CodigoNormalizado == codigo.ToUpperInvariant()
                        && n.Visibilidad == Visibilidad.Publica
                        && (n.EstadoPublicacion == EstadoPublicacion.Publicada || n.EstadoPublicacion == EstadoPublicacion.Archivada))
            .Select(n => new
            {
                n.Id,
                n.CodigoNormalizado,
                Tipo = new { n.TipoNorma.Codigo, n.TipoNorma.Nombre },
                Organo = new { n.OrganoEmisor.Codigo, n.OrganoEmisor.Nombre },
                n.Numero,
                n.Anio,
                n.Sufijo,
                n.Titulo,
                n.Resumen,
                n.PalabrasClave,
                n.Expediente,
                n.FechaSancion,
                n.FechaPublicacion,
                Boletin = n.Boletin == null ? null : new { n.Boletin.Numero, n.Boletin.FechaPublicacion },
                Vigencia = n.Vigencia.ToString().ToLowerInvariant(),
                n.TextoOrigen,
                n.CalidadOcr,
                n.EstadoPublicacion,
            })
            .FirstOrDefaultAsync(ct);

        if (norma is null)
        {
            return Problem(statusCode: 404, detail: "Norma no encontrada");
        }

        return Ok(norma);
    }

    [HttpGet("normas/{codigo}/html")]
    public async Task<IActionResult> Html(string codigo, CancellationToken ct)
    {
        var normaId = await _db.Normas
            .AsNoTracking()
            .Where(n => n.CodigoNormalizado == codigo.ToUpperInvariant()
                        && n.Visibilidad == Visibilidad.Publica
                        && (n.EstadoPublicacion == EstadoPublicacion.Publicada || n.EstadoPublicacion == EstadoPublicacion.Archivada))
            .Select(n => (Guid?)n.Id)
            .FirstOrDefaultAsync(ct);

        if (normaId is null)
        {
            return Problem(statusCode: 404, detail: "Norma no encontrada");
        }

        var fragmentos = await _db.NormasFragmentos
            .AsNoTracking()
            .Where(f => f.NormaId == normaId)
            .OrderBy(f => f.Orden)
            .Select(f => new
            {
                f.Orden,
                Tipo = f.Tipo.ToString().ToLowerInvariant(),
                f.Etiqueta,
                f.Texto,
                f.Html,
                f.PaginaDesde,
                f.PaginaHasta,
            })
            .ToListAsync(ct);

        return Ok(new { codigo = codigo.ToUpperInvariant(), fragmentos });
    }

    [HttpGet("normas/{codigo}/relaciones")]
    public async Task<IActionResult> Relaciones(string codigo, CancellationToken ct)
    {
        var normaId = await _db.Normas
            .AsNoTracking()
            .Where(n => n.CodigoNormalizado == codigo.ToUpperInvariant()
                        && n.Visibilidad == Visibilidad.Publica)
            .Select(n => (Guid?)n.Id)
            .FirstOrDefaultAsync(ct);

        if (normaId is null)
        {
            return Problem(statusCode: 404, detail: "Norma no encontrada");
        }

        var origen = await _db.NormasRelaciones
            .AsNoTracking()
            .Where(r => r.NormaOrigenId == normaId)
            .Join(_db.Normas, r => r.NormaDestinoId, n => n.Id, (r, n) => new
            {
                direccion = "saliente",
                tipo = r.Tipo.ToString().ToLowerInvariant(),
                detalle = r.Detalle,
                normaDestino = new { n.CodigoNormalizado, n.Titulo },
            })
            .ToListAsync(ct);

        var destino = await _db.NormasRelaciones
            .AsNoTracking()
            .Where(r => r.NormaDestinoId == normaId)
            .Join(_db.Normas, r => r.NormaOrigenId, n => n.Id, (r, n) => new
            {
                direccion = "entrante",
                tipo = r.Tipo.ToString().ToLowerInvariant(),
                detalle = r.Detalle,
                normaOrigen = new { n.CodigoNormalizado, n.Titulo },
            })
            .ToListAsync(ct);

        return Ok(new { origen, destino });
    }

    [HttpGet("normas/{codigo}/pdf")]
    public async Task<IActionResult> Pdf(string codigo, [FromHeader(Name = "Range")] string? range, CancellationToken ct)
    {
        var archivo = await _db.NormasArchivos
            .AsNoTracking()
            .Where(a => a.Norma.CodigoNormalizado == codigo.ToUpperInvariant()
                        && a.Norma.Visibilidad == Visibilidad.Publica
                        && (a.Norma.EstadoPublicacion == EstadoPublicacion.Publicada || a.Norma.EstadoPublicacion == EstadoPublicacion.Archivada)
                        && a.Rol == RolArchivo.Original)
            .Select(a => new { a.StorageKey, a.NombreOriginal })
            .FirstOrDefaultAsync(ct);

        if (archivo is null)
        {
            return Problem(statusCode: 404, detail: "PDF no disponible");
        }

        var stream = await _fileStorage.AbrirAsync(archivo.StorageKey, ct);
        return File(stream, "application/pdf", archivo.NombreOriginal, enableRangeProcessing: true);
    }
    [HttpGet("sugerencias")]
    public async Task<IActionResult> Sugerencias([FromQuery] string? q, [FromQuery] int limite = 8, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
        {
            return Ok(Array.Empty<object>());
        }

        var sugerencias = await _sugerencias.SugerirAsync(q, limite, ct);
        return Ok(sugerencias);
    }
}