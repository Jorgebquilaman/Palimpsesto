using System.Security.Cryptography;
using System.Text;
using Digesto.Application.Archivos;
using Digesto.Domain.Entidades;
using Digesto.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Digesto.Infrastructure.Ingesta;

public class IngestaService : Application.Ingesta.IIngestaService
{
    private readonly Persistencia.DigestoDbContext _db;
    private readonly IFileStorage _fileStorage;
    private readonly IngestaOpciones _opciones;
    private readonly ILogger<IngestaService> _logger;

    public IngestaService(
        Persistencia.DigestoDbContext db,
        IFileStorage fileStorage,
        IngestaOpciones opciones,
        ILogger<IngestaService> logger)
    {
        _db = db;
        _fileStorage = fileStorage;
        _opciones = opciones;
        _logger = logger;
    }

    public async Task<Application.Ingesta.NormaCreada> SubirPdfAsync(
        Stream contenido,
        string nombreOriginal,
        string usuario,
        CancellationToken ct = default)
    {
        ValidarMagicBytes(contenido);

        if (contenido.Length > _opciones.TamanioMaximoBytes)
        {
            throw new InvalidOperationException(
                $"El archivo excede el tamaño máximo permitido ({_opciones.TamanioMaximoMb} MB)");
        }

        contenido.Position = 0;
        var sha256 = await CalcularSha256Async(contenido, ct);
        contenido.Position = 0;

        var duplicado = await _db.NormasArchivos.AnyAsync(a => a.Sha256 == sha256, ct);

        var guardado = await _fileStorage.GuardarAsync(contenido, nombreOriginal, ct);

        var tipo = await _db.TiposNorma.FirstAsync(t => t.Codigo == "RES", ct);
        var organo = await _db.OrganosEmisores.FirstAsync(o => o.Codigo == "REC", ct);

        var norma = new Norma
        {
            Id = Guid.NewGuid(),
            TipoNormaId = tipo.Id,
            OrganoEmisorId = organo.Id,
            Numero = 0,
            Anio = (short)DateTime.UtcNow.Year,
            CodigoNormalizado = await GenerarCodigoUnicoAsync(tipo.Codigo, organo.Codigo, ct),
            Titulo = Path.GetFileNameWithoutExtension(nombreOriginal),
            FechaSancion = DateOnly.FromDateTime(DateTime.UtcNow),
            Visibilidad = Visibilidad.Publica,
            EstadoPublicacion = EstadoPublicacion.Borrador,
            TextoOrigen = TextoOrigen.Nativo,
            CreadoEn = DateTime.UtcNow,
            CreadoPor = usuario,
        };

        var archivo = new NormaArchivo
        {
            Id = Guid.NewGuid(),
            NormaId = norma.Id,
            Rol = RolArchivo.Original,
            NombreOriginal = nombreOriginal,
            StorageKey = guardado.StorageKey,
            Sha256 = sha256,
            Mime = "application/pdf",
            Bytes = guardado.Bytes,
            Paginas = 0,
        };

        var proceso = new ProcesoIngesta
        {
            NormaId = norma.Id,
            ArchivoId = archivo.Id,
            Estado = EstadoProceso.Pendiente,
            Etapa = "validar",
        };

        _db.Normas.Add(norma);
        _db.NormasArchivos.Add(archivo);
        _db.ProcesosIngesta.Add(proceso);
        await _db.SaveChangesAsync(ct);

        if (duplicado)
        {
            _logger.LogInformation("Archivo duplicado detectado (sha256 {Sha256}) al subir {Nombre}", sha256, nombreOriginal);
        }

        return new Application.Ingesta.NormaCreada(norma.Id, archivo.Id, sha256, duplicado);
    }

    private void ValidarMagicBytes(Stream contenido)
    {
        Span<byte> cabecera = stackalloc byte[5];
        var leidos = contenido.Read(cabecera);
        var firma = Encoding.ASCII.GetString(cabecera[..leidos]);
        if (!firma.StartsWith("%PDF"))
        {
            throw new InvalidOperationException("El archivo no es un PDF válido");
        }
        contenido.Position = 0;
    }

    private static async Task<string> CalcularSha256Async(Stream contenido, CancellationToken ct)
    {
        using var sha = SHA256.Create();
        var hash = await sha.ComputeHashAsync(contenido, ct);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private async Task<string> GenerarCodigoUnicoAsync(string codigoTipo, string codigoOrgano, CancellationToken ct)
    {
        var prefijo = $"{codigoTipo}-{codigoOrgano}-{DateTime.UtcNow.Year}-";
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
}

public class IngestaOpciones
{
    public const string Seccion = "Ingesta";
    public int TamanioMaximoMb { get; set; } = 50;
    public long TamanioMaximoBytes => (long)TamanioMaximoMb * 1024 * 1024;
    public int UmbralCaracteresPagina { get; set; } = 100;
    public int TimeoutProcesoSegundos { get; set; } = 120;
}
