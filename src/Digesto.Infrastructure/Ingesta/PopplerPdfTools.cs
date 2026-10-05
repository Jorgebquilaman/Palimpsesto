using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Digesto.Application.Ingesta;

namespace Digesto.Infrastructure.Ingesta;

public partial class PopplerPdfTools : IPdfTools
{
    private readonly IProcesoRunner _runner;
    private readonly ILogger<PopplerPdfTools> _logger;

    public PopplerPdfTools(IProcesoRunner runner, ILogger<PopplerPdfTools> logger)
    {
        _runner = runner;
        _logger = logger;
    }

    [GeneratedRegex(@"^Pages:\s+(\d+)", RegexOptions.Multiline)]
    private static partial Regex RegexPaginas();

    [GeneratedRegex(@"^Title:\s+(.*)$", RegexOptions.Multiline)]
    private static partial Regex RegexTitulo();

    [GeneratedRegex(@"^Author:\s+(.*)$", RegexOptions.Multiline)]
    private static partial Regex RegexAutor();

    public async Task<InfoPdf?> InspeccionarAsync(string rutaPdf, CancellationToken ct = default)
    {
        var resultado = await _runner.EjecutarAsync("pdfinfo", [rutaPdf], TimeSpan.FromSeconds(30), ct);
        if (!resultado.Ok)
        {
            _logger.LogWarning("pdfinfo falló para {Ruta}: {Error}", rutaPdf, resultado.Error);
            return null;
        }

        var paginas = RegexPaginas().Match(resultado.Salida) is { Success: true } m ? int.Parse(m.Groups[1].Value) : 0;
        var titulo = RegexTitulo().Match(resultado.Salida) is { Success: true } t && !string.IsNullOrWhiteSpace(t.Groups[1].Value) ? t.Groups[1].Value.Trim() : null;
        var autor = RegexAutor().Match(resultado.Salida) is { Success: true } a && !string.IsNullOrWhiteSpace(a.Groups[1].Value) ? a.Groups[1].Value.Trim() : null;

        return new InfoPdf(paginas, titulo, autor, FirmaDigital: false);
    }

    public async Task<List<TextoPagina>?> ExtraerTextoPorPaginaAsync(string rutaPdf, CancellationToken ct = default)
    {
        var nPaginas = (await InspeccionarAsync(rutaPdf, ct))?.Paginas ?? 0;
        if (nPaginas == 0)
        {
            return null;
        }

        var paginas = new List<TextoPagina>(nPaginas);
        for (var p = 1; p <= nPaginas; p++)
        {
            var resultado = await _runner.EjecutarAsync(
                "pdftotext",
                ["-f", p.ToString(), "-l", p.ToString(), "-layout", rutaPdf, "-"],
                TimeSpan.FromSeconds(60),
                ct);

            if (!resultado.Ok)
            {
                _logger.LogWarning("pdftotext falló en página {Pagina}: {Error}", p, resultado.Error);
                return null;
            }
            paginas.Add(new TextoPagina(p, resultado.Salida));
        }
        return paginas;
    }
}
