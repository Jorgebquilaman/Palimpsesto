using Digesto.Application.Ingesta;
using Microsoft.Extensions.Logging;

namespace Digesto.Infrastructure.Ingesta;

public interface IOcrServicio
{
    /// <summary>
    /// Genera un PDF derivado con capa de texto (rol = ocr). No modifica el original.
    /// Devuelve true si funcionó, false si la herramienta no está disponible; lanza en errores de datos.
    /// </summary>
    Task<bool> EjecutarAsync(string rutaEntrada, string rutaSalida, TimeSpan timeout, CancellationToken ct = default);
}

public class OcrmypdfServicio : IOcrServicio
{
    private readonly IProcesoRunner _runner;
    private readonly ILogger<OcrmypdfServicio> _logger;

    public OcrmypdfServicio(IProcesoRunner runner, ILogger<OcrmypdfServicio> logger)
    {
        _runner = runner;
        _logger = logger;
    }

    public async Task<bool> EjecutarAsync(string rutaEntrada, string rutaSalida, TimeSpan timeout, CancellationToken ct = default)
    {
        var resultado = await _runner.EjecutarAsync(
            "ocrmypdf",
            [
                "-l", "spa",
                "--skip-text",
                "--deskew",
                "--rotate-pages",
                "--output-type", "pdf",
                rutaEntrada,
                rutaSalida,
            ],
            timeout,
            ct);

        if (resultado.Ok)
        {
            return true;
        }

        _logger.LogWarning("ocrmypdf falló (salida {Codigo}): {Error}", resultado.CodigoSalida, resultado.Error);
        return false;
    }
}
