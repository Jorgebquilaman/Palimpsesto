namespace Digesto.Application.Ai;

public record CitaDetectadaAi(string Tipo, int Numero, short Anio, string? TipoRelacion);

public record DatosAi(
    string? TipoNormaCodigo,
    int? Numero,
    short? Anio,
    string? Sufijo,
    string? Titulo,
    string? Resumen,
    string[]? PalabrasClave,
    string? Expediente,
    DateOnly? FechaSancion,
    string? OrganoCodigo,
    string? Vigencia,
    List<CitaDetectadaAi> Citas);

public record RelacionCreadaAi(string CodigoDestino, string TipoRelacion);

public record ResultadoCompletarAi(
    bool Ok,
    DatosAi Datos,
    List<string> CamposAplicados,
    List<RelacionCreadaAi> RelacionesCreadas,
    List<string> Advertencias)
{
    public static ResultadoCompletarAi Falla(string error) =>
        new(false, new DatosAi(null, null, null, null, null, null, null, null, null, null, null, []), [], [], [error]);
}

public interface IAiNormaService
{
    Task<ResultadoCompletarAi> CompletarNormaAsync(Guid normaId, CancellationToken ct = default);
}
