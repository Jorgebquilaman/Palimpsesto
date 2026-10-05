using Digesto.Application.Archivos;
using Digesto.Application.Ingesta;
using Digesto.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Digesto.Infrastructure.Ingesta;

public record NormaPipeline(
    Guid NormaId,
    string Titulo,
    string StorageKey,
    string NombreOriginal);

public class PipelineIngesta
{
    private readonly Persistencia.DigestoDbContext _db;
    private readonly IFileStorage _fileStorage;
    private readonly IPdfTools _pdfTools;
    private readonly IEstructurador _estructurador;
    private readonly IExtractorMetadatos _extractorMetadatos;
    private readonly ISanitizadorHtml _sanitizador;
    private readonly IOcrServicio _ocr;
    private readonly IngestaOpciones _opciones;
    private readonly ILogger<PipelineIngesta> _logger;

    public PipelineIngesta(
        Persistencia.DigestoDbContext db,
        IFileStorage fileStorage,
        IPdfTools pdfTools,
        IEstructurador estructurador,
        IExtractorMetadatos extractorMetadatos,
        ISanitizadorHtml sanitizador,
        IOcrServicio ocr,
        IOptions<IngestaOpciones> opciones,
        ILogger<PipelineIngesta> logger)
    {
        _db = db;
        _fileStorage = fileStorage;
        _pdfTools = pdfTools;
        _estructurador = estructurador;
        _extractorMetadatos = extractorMetadatos;
        _sanitizador = sanitizador;
        _ocr = ocr;
        _opciones = opciones.Value;
        _logger = logger;
    }

    public async Task<bool> ProcesarAsync(long procesoId, CancellationToken ct = default)
    {
        var proceso = await _db.ProcesosIngesta
            .Include(p => p.Archivo)
            .Include(p => p.Norma)
            .FirstOrDefaultAsync(p => p.Id == procesoId, ct);

        if (proceso is null)
        {
            return false;
        }

        try
        {
            await MarcarEnCursoAsync(proceso.Id, "validar", ct);
            await ValidarAsync(proceso.Archivo, ct);

            await MarcarEtapaAsync(proceso.Id, "inspeccionar", ct);
            var info = await _pdfTools.InspeccionarAsync(RutaAbsoluta(proceso.Archivo.StorageKey), ct)
                ?? throw new InvalidOperationException("No se pudo inspeccionar el PDF");

            proceso.Archivo.Paginas = info.Paginas;
            proceso.Norma.EstadoPublicacion = EstadoPublicacion.Procesando;
            await _db.SaveChangesAsync(ct);

            var rutaPdf = RutaAbsoluta(proceso.Archivo.StorageKey);

            await MarcarEtapaAsync(proceso.Id, "extraer_texto", ct);
            var paginas = await _pdfTools.ExtraerTextoPorPaginaAsync(rutaPdf, ct)
                ?? throw new InvalidOperationException("No se pudo extraer texto del PDF");

            var promedio = NormalizadorTexto.PromedioCaracteresAlfabeticos(
                paginas.Select(p => (p.Pagina, p.Texto)).ToList());

            if (promedio < _opciones.UmbralCaracteresPagina)
            {
                await MarcarEtapaAsync(proceso.Id, "ocr", ct);
                rutaPdf = await ProcesarOcrAsync(proceso, rutaPdf, ct);
                paginas = await _pdfTools.ExtraerTextoPorPaginaAsync(rutaPdf, ct)
                    ?? throw new InvalidOperationException("No se pudo extraer texto del PDF con OCR");
                promedio = NormalizadorTexto.PromedioCaracteresAlfabeticos(
                    paginas.Select(p => (p.Pagina, p.Texto)).ToList());

                if (promedio < _opciones.UmbralCaracteresPagina)
                {
                    throw new InvalidOperationException(
                        $"El PDF sigue sin texto legible tras OCR (promedio {promedio:F0} caracteres/página)");
                }

                proceso.Norma.TextoOrigen = TextoOrigen.Ocr;
                proceso.Norma.CalidadOcr = Math.Min(1m, Math.Round((decimal)(promedio / _opciones.UmbralCaracteresPagina), 2));
            }

            await MarcarEtapaAsync(proceso.Id, "normalizar", ct);
            var textoCompleto = NormalizadorTexto.Normalizar(string.Join("\n", paginas.Select(p => p.Texto)));

            await MarcarEtapaAsync(proceso.Id, "estructurar", ct);
            var fragmentos = _estructurador.Estructurar(textoCompleto, info.Paginas);

            await MarcarEtapaAsync(proceso.Id, "generar_html", ct);
            var html = GeneradorHtmlFragmentos.GenerarHtml(fragmentos, proceso.Norma.CodigoNormalizado);

            await MarcarEtapaAsync(proceso.Id, "sugerir_metadatos", ct);
            var metadatos = _extractorMetadatos.Extraer(textoCompleto, proceso.Archivo.NombreOriginal);
            AplicarSugerencias(proceso.Norma, metadatos);

            await MarcarEtapaAsync(proceso.Id, "indexar", ct);
            _db.NormasFragmentos.RemoveRange(_db.NormasFragmentos.Where(f => f.NormaId == proceso.NormaId));
            for (var i = 0; i < fragmentos.Count; i++)
            {
                _db.NormasFragmentos.Add(new Domain.Entidades.NormaFragmento
                {
                    NormaId = proceso.NormaId,
                    Orden = fragmentos[i].Orden,
                    Tipo = fragmentos[i].Tipo,
                    Etiqueta = fragmentos[i].Etiqueta,
                    Texto = fragmentos[i].Texto,
                    Html = _sanitizador.Sanitizar(html[i].Html),
                    PaginaDesde = fragmentos[i].PaginaDesde,
                    PaginaHasta = fragmentos[i].PaginaHasta,
                });
            }

            proceso.Norma.EstadoPublicacion = EstadoPublicacion.EnRevision;
            proceso.Estado = EstadoProceso.Ok;
            proceso.Etapa = null;
            proceso.Error = null;
            await _db.SaveChangesAsync(ct);

            _logger.LogInformation("Ingesta OK: norma {NormaId} con {Fragmentos} fragmentos",
                proceso.NormaId, fragmentos.Count);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ingesta falló: norma {NormaId}", proceso.NormaId);
            await MarcarErrorAsync(proceso.Id, ex.Message, ct);
            return false;
        }
    }

    private async Task<string> ProcesarOcrAsync(Domain.Entidades.ProcesoIngesta proceso, string rutaOriginal, CancellationToken ct)
    {
        var etiqueta = Guid.NewGuid().ToString("N");
        var directorio = Path.GetDirectoryName(rutaOriginal)!;
        var rutaDerivado = Path.Combine(directorio, $"{etiqueta}.pdf");

        var ok = await _ocr.EjecutarAsync(rutaOriginal, rutaDerivado,
            TimeSpan.FromSeconds(Math.Max(60, _opciones.TimeoutProcesoSegundos * 10)), ct);
        if (!ok || !File.Exists(rutaDerivado))
        {
            throw new InvalidOperationException("No se pudo generar el derivado con OCR");
        }

        await using var stream = File.OpenRead(rutaDerivado);
        var guardado = await _fileStorage.GuardarAsync(stream, Path.GetFileName(rutaDerivado), ct);
        await stream.DisposeAsync();

        var sha256 = Convert.ToHexString(await System.Security.Cryptography.SHA256.HashDataAsync(
            File.OpenRead(rutaDerivado), ct)).ToLowerInvariant();

        _db.NormasArchivos.Add(new Domain.Entidades.NormaArchivo
        {
            Id = Guid.NewGuid(),
            NormaId = proceso.NormaId,
            Rol = RolArchivo.Ocr,
            NombreOriginal = proceso.Archivo.NombreOriginal,
            StorageKey = guardado.StorageKey,
            Sha256 = sha256,
            Mime = "application/pdf",
            Bytes = guardado.Bytes,
            Paginas = proceso.Archivo.Paginas,
        });
        await _db.SaveChangesAsync(ct);

        return rutaDerivado;
    }

    private async Task ValidarAsync(Domain.Entidades.NormaArchivo archivo, CancellationToken ct)
    {
        await using var stream = await _fileStorage.AbrirAsync(archivo.StorageKey, ct);
        var cabecera = new byte[5];
        var leidos = await stream.ReadAsync(cabecera, ct);
        var firma = System.Text.Encoding.ASCII.GetString(cabecera, 0, leidos);
        if (!firma.StartsWith("%PDF"))
        {
            throw new InvalidOperationException("El archivo guardado no es un PDF válido");
        }
    }

    private void AplicarSugerencias(Domain.Entidades.Norma norma, MetadatosSugeridos metadatos)
    {
        if (metadatos.TituloSugerido is { } titulo && !string.IsNullOrWhiteSpace(titulo))
        {
            norma.Titulo = titulo.Length <= 500 ? titulo : titulo[..500];
        }
        if (metadatos.Numero is { } numero && numero > 0)
        {
            norma.Numero = numero;
        }
        if (metadatos.Anio is { } anio)
        {
            norma.Anio = anio;
        }
        if (metadatos.FechaSancion is { } fecha)
        {
            norma.FechaSancion = fecha;
        }
        if (metadatos.Expediente is { } expediente)
        {
            norma.Expediente = expediente;
        }
    }

    private string RutaAbsoluta(string storageKey)
    {
        if (storageKey.Contains("..") || Path.IsPathRooted(storageKey))
        {
            throw new ArgumentException("storage_key inválido");
        }
        return Path.Combine(_fileStorage.Root, storageKey);
    }

    private async Task MarcarEnCursoAsync(long id, string etapa, CancellationToken ct)
    {
        await _db.ProcesosIngesta
            .Where(p => p.Id == id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.Estado, EstadoProceso.EnCurso)
                .SetProperty(p => p.Etapa, etapa)
                .SetProperty(p => p.LockedAt, DateTime.UtcNow), ct);
    }

    private async Task MarcarEtapaAsync(long id, string etapa, CancellationToken ct)
    {
        await _db.ProcesosIngesta
            .Where(p => p.Id == id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Etapa, etapa), ct);
    }

    private async Task MarcarErrorAsync(long id, string error, CancellationToken ct)
    {
        await _db.ProcesosIngesta
            .Where(p => p.Id == id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.Estado, EstadoProceso.Error)
                .SetProperty(p => p.Error, Truncar(error))
                .SetProperty(p => p.Etapa, (string?)null)
                .SetProperty(p => p.Intentos, p => p.Intentos + 1), ct);
    }

    private static string Truncar(string texto) => texto.Length <= 2000 ? texto : texto[..2000];
}
