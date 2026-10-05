namespace Digesto.Application.Ai;

public record CitaDetectadaAi(string Tipo, int Numero, short Anio, string? TipoRelacion);

public record FragmentoDetectadoAi(string? Tipo, string? Etiqueta, string Texto);

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
    List<CitaDetectadaAi> Citas,
    List<FragmentoDetectadoAi> Fragmentos);

public record RelacionCreadaAi(string CodigoDestino, string TipoRelacion);

public record ResultadoCompletarAi(
    bool Ok,
    DatosAi Datos,
    List<string> CamposAplicados,
    List<RelacionCreadaAi> RelacionesCreadas,
    List<string> Advertencias)
{
    public static ResultadoCompletarAi Falla(string error) =>
        new(false, new DatosAi(null, null, null, null, null, null, null, null, null, null, null, [], []), [], [], [error]);
}

public record EventoProgresoAi(string Etapa, string? Detalle);

public interface IAiNormaService
{
    Task<ResultadoCompletarAi> CompletarNormaAsync(Guid normaId, Func<EventoProgresoAi, Task>? reportar = null, CancellationToken ct = default);
}
