namespace Digesto.Application.Ingesta;

public record FragmentoSugerido(
    int Orden,
    Domain.Enums.TipoFragmento Tipo,
    string? Etiqueta,
    string Texto,
    int? PaginaDesde,
    int? PaginaHasta);

public interface IEstructurador
{
    List<FragmentoSugerido> Estructurar(string texto, int paginas);
}

public interface ISanitizadorHtml
{
    string Sanitizar(string html);
}

public record MetadatosSugeridos(
    string? TipoNormaCodigo,
    int? Numero,
    short? Anio,
    DateOnly? FechaSancion,
    string? Expediente,
    string? TituloSugerido);

public interface IExtractorMetadatos
{
    MetadatosSugeridos Extraer(string texto, string nombreArchivo);
}
