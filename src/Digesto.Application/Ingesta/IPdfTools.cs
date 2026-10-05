namespace Digesto.Application.Ingesta;

public record ResultadoProceso(int CodigoSalida, string Salida, string Error)
{
    public bool Ok => CodigoSalida == 0;
}

public record InfoPdf(int Paginas, string? Titulo, string? Autor, bool FirmaDigital);

public record TextoPagina(int Pagina, string Texto);

public interface IProcesoRunner
{
    Task<ResultadoProceso> EjecutarAsync(string programa, string[] argumentos, TimeSpan timeout, CancellationToken ct = default);
}

public interface IPdfTools
{
    Task<InfoPdf?> InspeccionarAsync(string rutaPdf, CancellationToken ct = default);
    Task<List<TextoPagina>?> ExtraerTextoPorPaginaAsync(string rutaPdf, CancellationToken ct = default);
}
