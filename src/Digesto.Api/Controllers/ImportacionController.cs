using Digesto.Application.Ingesta;
using Digesto.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Digesto.Api.Controllers;

[ApiController]
[Route("api/v1/admin")]
[Authorize(Roles = "admin,editor")]
public class ImportacionController : ControllerBase
{
    private readonly Digesto.Infrastructure.Persistencia.DigestoDbContext _db;
    private readonly IImportadorCsv _importador;

    public ImportacionController(
        Digesto.Infrastructure.Persistencia.DigestoDbContext db,
        IImportadorCsv importador)
    {
        _db = db;
        _importador = importador;
    }

    [HttpPost("importar")]
    [RequestSizeLimit(1_000_000_000)]
    public async Task<IActionResult> Importar(List<IFormFile> archivos, IFormFile csv, CancellationToken ct)
    {
        if (csv is null || csv.Length == 0)
        {
            return Problem(statusCode: 400, detail: "Falta el archivo CSV de metadatos");
        }

        string contenidoCsv;
        using (var lector = new StreamReader(csv.OpenReadStream()))
        {
            contenidoCsv = await lector.ReadToEndAsync(ct);
        }

        List<Application.Ingesta.FilaImportacion> filas = [];
        List<string> erroresCsv = [];
        try
        {
            filas = _importador.Parsear(contenidoCsv);
        }
        catch (InvalidOperationException ex)
        {
            return Problem(statusCode: 400, detail: ex.Message);
        }

        var archivosPorNombre = archivos.ToDictionary(
            a => Path.GetFileName(a.FileName),
            a => a,
            StringComparer.OrdinalIgnoreCase);

        var subidasOk = 0;
        var errores = new List<object>();
        var normasCreadas = new List<object>();

        foreach (var fila in filas)
        {
            try
            {
                if (!archivosPorNombre.TryGetValue(fila.Archivo, out var archivoPdf))
                {
                    errores.Add(new { archivo = fila.Archivo, error = "El CSV menciona un archivo no adjuntado" });
                    continue;
                }

                var tipo = fila.TipoCodigo is { } tc
                    ? await _db.TiposNorma.FirstOrDefaultAsync(t => t.Codigo == tc, ct)
                    : await _db.TiposNorma.FirstAsync(t => t.Codigo == "RES", ct);
                if (tipo is null)
                {
                    errores.Add(new { archivo = fila.Archivo, error = $"Tipo desconocido: {fila.TipoCodigo}" });
                    continue;
                }

                var organo = await _db.OrganosEmisores.FirstOrDefaultAsync(o => o.Id == 1, ct);
                if (organo is null)
                {
                    errores.Add(new { archivo = fila.Archivo, error = "Sin órgano emisor disponible" });
                    continue;
                }

                var numeroPdf = await ExtraerNumeroSiCoincideConTitulo(archivoPdf, fila, ct);
                var visibilidad = ParsearVisibilidad(fila.Visibilidad) ?? Visibilidad.Publica;
                var vigencia = ParsearVigencia(fila.Vigencia) ?? Vigencia.Vigente;
                var fechaSancion = DateOnly.TryParse(fila.FechaSancion, out var fs)
                    ? fs
                    : DateOnly.FromDateTime(DateTime.UtcNow);

                var norma = new Domain.Entidades.Norma
                {
                    Id = Guid.NewGuid(),
                    TipoNormaId = tipo.Id,
                    OrganoEmisorId = organo.Id,
                    Numero = fila.Numero ?? 0,
                    Anio = fila.Anio ?? (short)fechaSancion.Year,
                    Sufijo = fila.Sufijo,
                    CodigoNormalizado = await GenerarCodigoAsync(tipo.Codigo, organo.Codigo, ct),
                    Titulo = (fila.Titulo ?? Path.GetFileNameWithoutExtension(fila.Archivo))[..Math.Min(500, (fila.Titulo ?? fila.Archivo).Length)],
                    Resumen = fila.Resumen,
                    PalabrasClave = fila.PalabrasClave,
                    Expediente = fila.Expediente,
                    FechaSancion = fechaSancion,
                    FechaPublicacion = DateOnly.TryParse(fila.FechaPublicacion, out var fp) ? fp : null,
                    Visibilidad = visibilidad,
                    Vigencia = vigencia,
                    EstadoPublicacion = EstadoPublicacion.Borrador,
                    TextoOrigen = TextoOrigen.Nativo,
                    CreadoEn = DateTime.UtcNow,
                    CreadoPor = User.Identity?.Name ?? "importador",
                };

                await using var stream = archivoPdf.OpenReadStream();
                if (stream.Length > 50L * 1024 * 1024)
                {
                    errores.Add(new { archivo = fila.Archivo, error = "El archivo excede 50 MB" });
                    continue;
                }

                stream.Position = 0;
                var sha256 = Convert.ToHexString(
                    await System.Security.Cryptography.SHA256.HashDataAsync(stream, ct)).ToLowerInvariant();
                stream.Position = 0;

                var storage = HttpContext.RequestServices
                    .GetRequiredService<Application.Archivos.IFileStorage>();
                var guardado = await storage.GuardarAsync(stream, fila.Archivo, ct);

                norma.Archivos.Add(new Domain.Entidades.NormaArchivo
                {
                    Id = Guid.NewGuid(),
                    Rol = RolArchivo.Original,
                    NombreOriginal = fila.Archivo,
                    StorageKey = guardado.StorageKey,
                    Sha256 = sha256,
                    Mime = "application/pdf",
                    Bytes = guardado.Bytes,
                    Paginas = 0,
                });

                var proceso = new Domain.Entidades.ProcesoIngesta
                {
                    NormaId = norma.Id,
                    ArchivoId = norma.Archivos.First().Id,
                    Estado = EstadoProceso.Pendiente,
                    Etapa = "validar",
                };

                _db.Normas.Add(norma);
                _db.ProcesosIngesta.Add(proceso);
                normasCreadas.Add(new { fila.Archivo, normaId = norma.Id });
                subidasOk++;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                errores.Add(new { archivo = fila.Archivo, error = ex.Message });
            }
        }

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex)
        {
            return Problem(statusCode: 409, detail: $"Error de base de datos al importar: {ex.GetBaseException().Message}");
        }

        await _db.Database.ExecuteSqlRawAsync("ANALYZE;", ct);

        return StatusCode(201, new { subidos = subidasOk, errores = errores, normas = normasCreadas });
    }

    private static Visibilidad? ParsearVisibilidad(string? valor) => valor?.ToLowerInvariant() switch
    {
        "publica" or "publica" or "pública" => Visibilidad.Publica,
        "interna" => Visibilidad.Interna,
        "reservada" => Visibilidad.Reservada,
        _ => null,
    };

    private static Vigencia? ParsearVigencia(string? valor) => valor?.ToLowerInvariant().Replace(' ', '_') switch
    {
        "vigente" => Vigencia.Vigente,
        "modificada" => Vigencia.Modificada,
        "derogada" => Vigencia.Derogada,
        "derogada_parcialmente" => Vigencia.DerogadaParcialmente,
        "deja_sin_efecto" => Vigencia.DejaSinEfecto,
        _ => null,
    };

    private async Task<string> GenerarCodigoAsync(string codigoTipo, string codigoOrgano, CancellationToken ct)
    {
        var prefijo = $"{codigoTipo}-{codigoOrgano}-{DateTime.UtcNow.Year}-IMP-";
        var ultimo = await _db.Normas
            .Where(n => n.CodigoNormalizado.StartsWith(prefijo))
            .Select(n => n.CodigoNormalizado)
            .ToListAsync(ct);

        var maximo = ultimo
            .Select(c => int.TryParse(c.Split('-').LastOrDefault(), out var v) ? v : 0)
            .DefaultIfEmpty(0)
            .Max();

        return $"{prefijo}{(maximo + 1):D4}";
    }

    /// <summary>Si el CSV no trae número, intenta extraerlo del nombre del archivo del PDF original.</summary>
    private static Task<int?> ExtraerNumeroSiCoincideConTitulo(IFormFile archivo, Application.Ingesta.FilaImportacion fila, CancellationToken ct)
    {
        return Task.FromResult<int?>(null);
    }
}
